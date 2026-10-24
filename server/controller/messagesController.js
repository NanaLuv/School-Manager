// ============================================================================
// messagingController.js — NEW controller file
// ============================================================================
// A separate file from pickupCardController.js since this is its own
// feature area (general staff-to-parent / staff-to-teacher messaging), not
// specifically tied to the pickup/drop-off system.
//
// Two endpoints:
//   GET  /api/messaging/recipients-preview  — count + sample names before sending
//   POST /api/messaging/send                — the actual personalized bulk send
// ============================================================================

const pool = require("../db");
const smsService = require("../utils/smsService");
const crypto = require("crypto");

// Replaces {token} placeholders in a message with per-recipient values.
// Unrecognized tokens are left as-is rather than silently deleted, so a
// typo like {studnet_name} is visibly wrong in the sent message instead of
// disappearing without explanation.
const personalize = (template, tokens) => {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    tokens[key] !== undefined && tokens[key] !== null && tokens[key] !== ""
      ? tokens[key]
      : match,
  );
};

// Shared resolver: given the recipient selection, return
// [{ recipient_id, recipient_name, phone, tokens }] — recipients with no
// phone number on file are still included but flagged, so the caller can
// report them as skipped rather than just silently vanishing from counts.
const resolveRecipients = async ({
  recipient_type,
  student_id,
  teacher_id,
}) => {
  if (recipient_type === "single_student") {
    if (!student_id)
      throw new Error("student_id is required for single_student");
    const [rows] = await pool.query(
      `SELECT s.id, s.first_name, s.last_name, s.parent_name, s.parent_contact,
              c.class_name
       FROM students s
       LEFT JOIN class_assignments ca ON s.id = ca.student_id
         AND ca.academic_year_id = (SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1)
       LEFT JOIN classes c ON ca.class_id = c.id
       WHERE s.id = ?`,
      [student_id],
    );
    return rows.map((s) => ({
      recipient_id: s.id,
      recipient_name: `${s.first_name} ${s.last_name}`,
      phone: s.parent_contact,
      tokens: {
        student_name: `${s.first_name} ${s.last_name}`,
        parent_name: s.parent_name || `${s.first_name} ${s.last_name}`,
        class_name: s.class_name || "",
        name: s.parent_name || `${s.first_name} ${s.last_name}`,
      },
    }));
  }

  if (recipient_type === "all_students") {
    const [rows] = await pool.query(
      `SELECT s.id, s.first_name, s.last_name, s.parent_name, s.parent_contact,
              c.class_name
       FROM students s
       LEFT JOIN class_assignments ca ON s.id = ca.student_id
         AND ca.academic_year_id = (SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1)
       LEFT JOIN classes c ON ca.class_id = c.id
       WHERE (s.is_active IS NULL OR s.is_active = TRUE)`,
    );
    return rows.map((s) => ({
      recipient_id: s.id,
      recipient_name: `${s.first_name} ${s.last_name}`,
      phone: s.parent_contact,
      tokens: {
        student_name: `${s.first_name} ${s.last_name}`,
        parent_name: s.parent_name || `${s.first_name} ${s.last_name}`,
        class_name: s.class_name || "",
        name: s.parent_name || `${s.first_name} ${s.last_name}`,
      },
    }));
  }

  if (recipient_type === "single_teacher") {
    if (!teacher_id)
      throw new Error("teacher_id is required for single_teacher");
    const [rows] = await pool.query(
      "SELECT id, first_name, last_name, contact_info FROM teachers WHERE id = ?",
      [teacher_id],
    );
    return rows.map((t) => ({
      recipient_id: t.id,
      recipient_name: `${t.first_name} ${t.last_name}`,
      phone: t.contact_info,
      tokens: {
        teacher_name: `${t.first_name} ${t.last_name}`,
        name: `${t.first_name} ${t.last_name}`,
      },
    }));
  }

  if (recipient_type === "all_teachers") {
    const [rows] = await pool.query(
      "SELECT id, first_name, last_name, contact_info FROM teachers",
    );
    return rows.map((t) => ({
      recipient_id: t.id,
      recipient_name: `${t.first_name} ${t.last_name}`,
      phone: t.contact_info,
      tokens: {
        teacher_name: `${t.first_name} ${t.last_name}`,
        name: `${t.first_name} ${t.last_name}`,
      },
    }));
  }

  throw new Error("Invalid recipient_type");
};

// GET /api/messaging/recipients-preview?recipient_type=...&student_id=...&teacher_id=...
const getRecipientsPreview = async (req, res) => {
  try {
    const { recipient_type, student_id, teacher_id } = req.query;

    const recipients = await resolveRecipients({
      recipient_type,
      student_id,
      teacher_id,
    });

    const withPhone = recipients.filter((r) => r.phone);
    const withoutPhone = recipients.filter((r) => !r.phone);

    res.json({
      total: recipients.length,
      with_phone: withPhone.length,
      without_phone: withoutPhone.length,
      sample_names: recipients.slice(0, 5).map((r) => r.recipient_name),
      sample_tokens: recipients[0]?.tokens || null, // for the frontend's live preview
    });
  } catch (error) {
    console.error("Error previewing recipients:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to preview recipients" });
  }
};

// POST /api/messaging/send
// body: { recipient_type, student_id, teacher_id, message, sent_by }
const sendBulkMessage = async (req, res) => {
  try {
    const { recipient_type, student_id, teacher_id, message, sent_by } =
      req.body;

    if (!recipient_type || !message || !sent_by) {
      return res
        .status(400)
        .json({ error: "recipient_type, message, and sent_by are required" });
    }

    const recipients = await resolveRecipients({
      recipient_type,
      student_id,
      teacher_id,
    });

    if (recipients.length === 0) {
      return res.json({
        success: true,
        total: 0,
        sent: 0,
        failed: 0,
        skipped_no_phone: 0,
        results: [],
      });
    }

    const batchId = crypto.randomUUID();
    const isTeacherRecipient = recipient_type.includes("teacher");
    const results = [];

    for (const recipient of recipients) {
      if (!recipient.phone) {
        results.push({
          recipient_id: recipient.recipient_id,
          name: recipient.recipient_name,
          success: false,
          skipped: true,
          error: "No phone number on file",
        });
        continue;
      }

      const personalizedMessage = personalize(message, recipient.tokens);

      const smsResult = await smsService.sendSMS(
        recipient.recipient_id,
        recipient.phone,
        personalizedMessage,
        "general",
      );

      await pool.query(
        `INSERT INTO message_logs
           (batch_id, recipient_type, recipient_id, recipient_name, phone_number,
            message, status, message_id, error_message, sent_by, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          batchId,
          isTeacherRecipient ? "Teacher" : "Student",
          recipient.recipient_id,
          recipient.recipient_name,
          recipient.phone,
          personalizedMessage,
          smsResult.success ? "sent" : "failed",
          smsResult.messageId,
          smsResult.success ? null : smsResult.error,
          sent_by,
        ],
      );

      results.push({
        recipient_id: recipient.recipient_id,
        name: recipient.recipient_name,
        success: smsResult.success,
        error: smsResult.success ? null : smsResult.error,
      });
    }

    const sent = results.filter((r) => r.success).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.length - sent - skipped;

    res.json({
      success: true,
      batch_id: batchId,
      total: recipients.length,
      sent,
      failed,
      skipped_no_phone: skipped,
      results,
    });
  } catch (error) {
    console.error("Error sending bulk message:", error);
    res.status(500).json({ error: error.message || "Failed to send messages" });
  }
};

module.exports = {
  getRecipientsPreview,
  sendBulkMessage,
};

