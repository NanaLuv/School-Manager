// ============================================================================
// pickupCardController.js
// Enrollment + scan-time lookup + logging for the pickup/drop-off card system.
// Follows the same patterns as your existing control.js (pool.query, connection
// transactions for multi-step writes, file upload handling like createStudent).
// ============================================================================

const pool = require("../db");
const fs = require("fs");
const path = require("path");
const smsService = require("../utils/smsService");

// ----------------------------------------------------------------------
// AUTHORIZED PERSONS
// ----------------------------------------------------------------------

// GET /api/authorized-persons/:studentId — list people authorized for a student
const getAuthorizedPersonsForStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    const [persons] = await pool.query(
      `SELECT
         ap.id, ap.first_name, ap.last_name, ap.relationship, ap.phone,
         ap.photo_filename, ap.is_active,
         sap.can_pickup, sap.can_dropoff, sap.is_primary_guardian,
         ac.id as card_id, ac.card_uid, ac.status as card_status
       FROM student_authorized_persons sap
       INNER JOIN authorized_persons ap ON sap.authorized_person_id = ap.id
       LEFT JOIN access_cards ac
         ON ac.authorized_person_id = ap.id AND ac.status = 'Active'
       WHERE sap.student_id = ? AND ap.is_active = 1
       ORDER BY sap.is_primary_guardian DESC, ap.first_name`,
      [studentId],
    );

    res.json(persons);
  } catch (error) {
    console.error("Error fetching authorized persons:", error);
    res.status(500).json({ error: "Failed to fetch authorized persons" });
  }
};

// POST /api/authorized-persons — create a person + link to student(s) + optional photo
// const createAuthorizedPerson = async (req, res) => {
//   const connection = await pool.getConnection();

//   try {
//     await connection.beginTransaction();

//     const {
//       first_name,
//       last_name,
//       relationship,
//       phone,
//       id_document_note,
//       student_id, // the student to link immediately
//       can_pickup,
//       can_dropoff,
//       is_primary_guardian,
//     } = req.body;

//     if (!first_name || !last_name || !student_id) {
//       await connection.rollback();
//       return res
//         .status(400)
//         .json({ error: "first_name, last_name, and student_id are required" });
//     }

//     let photo_filename = null;
//     if (req.file) {
//       photo_filename = req.file.filename;
//     }

//     const [personResult] = await connection.query(
//       `INSERT INTO authorized_persons
//          (first_name, last_name, relationship, phone, photo_filename, id_document_note)
//        VALUES (?, ?, ?, ?, ?, ?)`,
//       [
//         first_name,
//         last_name,
//         relationship,
//         phone,
//         photo_filename,
//         id_document_note,
//       ],
//     );

//     const personId = personResult.insertId;

//     // FIX: Explicitly convert to 1 or 0 for MySQL
//     const canPickup =
//       can_pickup === "true" || can_pickup === true || can_pickup === 1 ? 1 : 0;
//     const canDropoff =
//       can_dropoff === "true" || can_dropoff === true || can_dropoff === 1
//         ? 1
//         : 0;
//     const isPrimary =
//       is_primary_guardian === "true" ||
//       is_primary_guardian === true ||
//       is_primary_guardian === 1
//         ? 1
//         : 0;

//     await connection.query(
//       `INSERT INTO student_authorized_persons
//          (student_id, authorized_person_id, can_pickup, can_dropoff, is_primary_guardian)
//        VALUES (?, ?, ?, ?, ?)`,
//       [student_id, personId, canPickup, canDropoff, isPrimary],
//     );

//     await connection.commit();

//     const [newPerson] = await pool.query(
//       "SELECT * FROM authorized_persons WHERE id = ?",
//       [personId],
//     );

//     res.status(201).json(newPerson[0]);
//   } catch (error) {
//     await connection.rollback();
//     if (req.file) fs.unlinkSync(req.file.path);
//     console.error("Error creating authorized person:", error);
//     res.status(500).json({ error: "Failed to create authorized person" });
//   } finally {
//     connection.release();
//   }
// };

// ============================================================================
// pickupCardController.js — REPLACE the existing createAuthorizedPerson with
// this version. Backward compatible: still accepts a single student_id, but
// now also accepts student_ids (a JSON array string, since this comes in as
// multipart/form-data) to link the new person to several students at once.
// ============================================================================

const createAuthorizedPerson = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const {
      first_name,
      last_name,
      relationship,
      phone,
      id_document_note,
      student_id, // single-student form (kept for backward compatibility)
      student_ids, // NEW: JSON array string, e.g. '[3,7,12]', for multi-select
      can_pickup,
      can_dropoff,
      is_primary_guardian,
    } = req.body;

    // Normalize to an array of student ids regardless of which field was sent
    let studentIdList = [];
    if (student_ids) {
      try {
        studentIdList = JSON.parse(student_ids);
      } catch (e) {
        await connection.rollback();
        return res
          .status(400)
          .json({ error: "student_ids must be a valid JSON array" });
      }
    } else if (student_id) {
      studentIdList = [student_id];
    }

    if (!first_name || !last_name || studentIdList.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        error: "first_name, last_name, and at least one student are required",
      });
    }

    let photo_filename = null;
    if (req.file) {
      photo_filename = req.file.filename;
    }

    const [personResult] = await connection.query(
      `INSERT INTO authorized_persons
         (first_name, last_name, relationship, phone, photo_filename, id_document_note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        first_name,
        last_name,
        relationship,
        phone,
        photo_filename,
        id_document_note,
      ],
    );

    const personId = personResult.insertId;

    // Link to every selected student in the same transaction
    for (const sid of studentIdList) {
      await connection.query(
        `INSERT INTO student_authorized_persons
           (student_id, authorized_person_id, can_pickup, can_dropoff, is_primary_guardian)
         VALUES (?, ?, ?, ?, ?)`,
        [
          sid,
          personId,
          can_pickup !== "false" && can_pickup !== false,
          can_dropoff !== "false" && can_dropoff !== false,
          is_primary_guardian === "true" || is_primary_guardian === true,
        ],
      );
    }

    await connection.commit();

    const [newPerson] = await pool.query(
      "SELECT * FROM authorized_persons WHERE id = ?",
      [personId],
    );

    res
      .status(201)
      .json({ ...newPerson[0], linked_student_count: studentIdList.length });
  } catch (error) {
    await connection.rollback();
    if (req.file) fs.unlinkSync(req.file.path);
    console.error("Error creating authorized person:", error);
    res.status(500).json({ error: "Failed to create authorized person" });
  } finally {
    connection.release();
  }
};

// ============================================================================
// NEW: bulk-link an EXISTING person to several students at once, so the
// "Existing Guardian" path doesn't need one request per student either.
// POST /api/authorized-persons/:personId/link-bulk
// body: { student_ids: [3, 7, 12], can_pickup, can_dropoff, is_primary_guardian }
// ============================================================================

const linkAuthorizedPersonToStudentsBulk = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { personId } = req.params;
    const {
      student_ids = [],
      can_pickup = true,
      can_dropoff = true,
      is_primary_guardian = false,
    } = req.body;

    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      await connection.rollback();
      return res
        .status(400)
        .json({ error: "student_ids must be a non-empty array" });
    }

    // Find which of these students are already linked, so we can skip them
    // instead of erroring on a UNIQUE constraint violation.
    const [existingLinks] = await connection.query(
      `SELECT student_id FROM student_authorized_persons
       WHERE authorized_person_id = ? AND student_id IN (?)`,
      [personId, student_ids],
    );
    const alreadyLinkedIds = new Set(existingLinks.map((r) => r.student_id));

    const toLink = student_ids.filter((sid) => !alreadyLinkedIds.has(sid));

    for (const sid of toLink) {
      await connection.query(
        `INSERT INTO student_authorized_persons
           (student_id, authorized_person_id, can_pickup, can_dropoff, is_primary_guardian)
         VALUES (?, ?, ?, ?, ?)`,
        [sid, personId, can_pickup, can_dropoff, is_primary_guardian],
      );
    }

    await connection.commit();

    res.status(201).json({
      linked: toLink.length,
      already_linked: alreadyLinkedIds.size,
      skipped_student_ids: [...alreadyLinkedIds],
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error bulk-linking authorized person:", error);
    res
      .status(500)
      .json({ error: "Failed to link authorized person to students" });
  } finally {
    connection.release();
  }
};

// POST /api/authorized-persons/:personId/link/:studentId — link an existing
// person (e.g. a sibling's parent) to another student
const linkAuthorizedPersonToStudent = async (req, res) => {
  try {
    const { personId, studentId } = req.params;
    const {
      can_pickup = true,
      can_dropoff = true,
      is_primary_guardian = false,
    } = req.body || {};

    const [existing] = await pool.query(
      "SELECT id FROM student_authorized_persons WHERE student_id = ? AND authorized_person_id = ?",
      [studentId, personId],
    );

    if (existing.length > 0) {
      return res
        .status(400)
        .json({ error: "This person is already linked to this student" });
    }

    await pool.query(
      `INSERT INTO student_authorized_persons
         (student_id, authorized_person_id, can_pickup, can_dropoff, is_primary_guardian)
       VALUES (?, ?, ?, ?, ?)`,
      [studentId, personId, can_pickup, can_dropoff, is_primary_guardian],
    );

    res.status(201).json({ message: "Linked successfully" });
  } catch (error) {
    console.error("Error linking authorized person:", error);
    res.status(500).json({ error: "Failed to link authorized person" });
  }
};

// ----------------------------------------------------------------------
// CARD ENROLLMENT
// ----------------------------------------------------------------------

// POST /api/access-cards — enroll a card (student's own, or an authorized person's)
const enrollCard = async (req, res) => {
  try {
    const { card_uid, card_type, student_id, authorized_person_id, issued_by } =
      req.body;

    if (!card_uid || !card_type) {
      return res
        .status(400)
        .json({ error: "card_uid and card_type are required" });
    }

    if (card_type === "Student" && !student_id) {
      return res
        .status(400)
        .json({ error: "student_id is required when card_type is Student" });
    }

    if (card_type === "AuthorizedPerson" && !authorized_person_id) {
      return res.status(400).json({
        error:
          "authorized_person_id is required when card_type is AuthorizedPerson",
      });
    }

    // Check the UID isn't already enrolled (active) on another person/student
    const [existing] = await pool.query(
      "SELECT id, status FROM access_cards WHERE card_uid = ?",
      [card_uid],
    );

    if (existing.length > 0 && existing[0].status === "Active") {
      return res.status(400).json({
        error:
          "This card is already enrolled and active. Revoke it first if you want to reassign it.",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO access_cards
         (card_uid, card_type, student_id, authorized_person_id, status, issued_date, issued_by)
       VALUES (?, ?, ?, ?, 'Active', CURDATE(), ?)`,
      [
        card_uid,
        card_type,
        card_type === "Student" ? student_id : null,
        card_type === "AuthorizedPerson" ? authorized_person_id : null,
        issued_by,
      ],
    );

    const [newCard] = await pool.query(
      "SELECT * FROM access_cards WHERE id = ?",
      [result.insertId],
    );

    res.status(201).json(newCard[0]);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({ error: "This card UID is already enrolled" });
    }
    console.error("Error enrolling card:", error);
    res.status(500).json({ error: "Failed to enroll card" });
  }
};

// PUT /api/access-cards/:id/revoke — mark a card Lost or Revoked
const revokeCard = async (req, res) => {
  try {
    const { id } = req.params;
    const { status = "Revoked" } = req.body; // 'Lost' or 'Revoked'

    if (!["Lost", "Revoked"].includes(status)) {
      return res
        .status(400)
        .json({ error: "status must be 'Lost' or 'Revoked'" });
    }

    const [result] = await pool.query(
      "UPDATE access_cards SET status = ? WHERE id = ?",
      [status, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Card not found" });
    }

    res.json({ message: `Card marked as ${status}` });
  } catch (error) {
    console.error("Error revoking card:", error);
    res.status(500).json({ error: "Failed to revoke card" });
  }
};

// ----------------------------------------------------------------------
// SCAN-TIME LOOKUP  ← the core of the gate workflow
// ----------------------------------------------------------------------

// GET /api/access-cards/lookup/:card_uid
// const lookupCard = async (req, res) => {
//   try {
//     const { card_uid } = req.params;

//     const [cards] = await pool.query(
//       "SELECT * FROM access_cards WHERE card_uid = ?",
//       [card_uid],
//     );

//     if (cards.length === 0) {
//       return res.status(404).json({
//         found: false,
//         error: "Card not recognized. Use manual search instead.",
//       });
//     }

//     const card = cards[0];

//     if (card.status !== "Active") {
//       return res.status(403).json({
//         found: true,
//         blocked: true,
//         status: card.status,
//         error: `This card is marked as ${card.status}. Do not permit pickup/drop-off with this card.`,
//       });
//     }

//     // ---- Case 1: it's the STUDENT's own card ----
//     if (card.card_type === "Student") {
//       const [students] = await pool.query(
//         `SELECT s.id, s.first_name, s.last_name, s.admission_number,
//                 s.photo_filename, c.class_name
//          FROM students s
//          LEFT JOIN class_assignments ca ON s.id = ca.student_id
//            AND ca.academic_year_id = (SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1)
//          LEFT JOIN classes c ON ca.class_id = c.id
//          WHERE s.id = ?`,
//         [card.student_id],
//       );

//       if (students.length === 0) {
//         return res
//           .status(404)
//           .json({ found: false, error: "Student not found" });
//       }

//       const todayStatus = await getTodayStatus(card.student_id);

//       return res.json({
//         found: true,
//         blocked: false,
//         scan_type: "StudentCard",
//         student: {
//           ...students[0],
//           card_id: card.id,

//           // STUDENTS CAN ALWAYS DROP OFF AND PICK UP THEMSELVES
//           can_pickup: true,
//           can_dropoff: true,
//         },
//         today_status: todayStatus,
//       });
//     }

//     // ---- Case 2: it's an AUTHORIZED PERSON's card ----
//     const [persons] = await pool.query(
//       "SELECT * FROM authorized_persons WHERE id = ?",
//       [card.authorized_person_id],
//     );

//     if (persons.length === 0 || !persons[0].is_active) {
//       return res.status(404).json({
//         found: false,
//         error: "Authorized person not found or inactive",
//       });
//     }

//     // const [authorizedStudents] = await pool.query(
//     //   `SELECT
//     //      s.id, s.first_name, s.last_name, s.admission_number, s.photo_filename,
//     //      c.class_name,
//     //      sap.can_pickup, sap.can_dropoff, sap.is_primary_guardian
//     //    FROM student_authorized_persons sap
//     //    INNER JOIN students s ON sap.student_id = s.id
//     //    LEFT JOIN class_assignments ca ON s.id = ca.student_id
//     //      AND ca.academic_year_id = (SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1)
//     //    LEFT JOIN classes c ON ca.class_id = c.id
//     //    WHERE sap.authorized_person_id = ?
//     //      AND (s.is_active IS NULL OR s.is_active = TRUE)`,
//     //   [card.authorized_person_id],
//     // );

//     // FIX: Explicitly cast boolean values - MySQL returns 0/1, need to convert
//     const [authorizedStudents] = await pool.query(
//       `SELECT
//          s.id, s.first_name, s.last_name, s.admission_number, s.photo_filename,
//          c.class_name,
//          CAST(sap.can_pickup AS SIGNED) as can_pickup,
//          CAST(sap.can_dropoff AS SIGNED) as can_dropoff,
//          CAST(sap.is_primary_guardian AS SIGNED) as is_primary_guardian
//        FROM student_authorized_persons sap
//        INNER JOIN students s ON sap.student_id = s.id
//        LEFT JOIN class_assignments ca ON s.id = ca.student_id
//          AND ca.academic_year_id = (SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1)
//        LEFT JOIN classes c ON ca.class_id = c.id
//        WHERE sap.authorized_person_id = ?
//          AND (s.is_active IS NULL OR s.is_active = TRUE)`,
//       [card.authorized_person_id],
//     );

//     // Attach today's drop-off/pickup status to each student
//     const studentsWithStatus = await Promise.all(
//       authorizedStudents.map(async (s) => ({
//         ...s,

//         // Convert 1/0 or true/false to boolean
//         can_pickup: s.can_pickup === 1 || s.can_pickup === true,
//         can_dropoff: s.can_dropoff === 1 || s.can_dropoff === true,
//         is_primary_guardian:
//           s.is_primary_guardian === 1 || s.is_primary_guardian === true,

//         today_status: await getTodayStatus(s.id),
//       })),
//     );

//     res.json({
//       found: true,
//       blocked: false,
//       scan_type: "AuthorizedPersonCard",
//       //   person: persons[0],
//       person: {
//         ...persons[0],
//         // Add a default photo URL if none exists
//         photo_url: persons[0].photo_filename
//           ? `/uploads/authorized-persons/${persons[0].photo_filename}`
//           : null,
//       },
//       card_id: card.id,
//       students: studentsWithStatus,
//     });
//   } catch (error) {
//     console.error("Error looking up card:", error);
//     res.status(500).json({ error: "Failed to look up card" });
//   }
// };

// GET /api/access-cards/lookup/:card_uid
const lookupCard = async (req, res) => {
  try {
    const { card_uid } = req.params;

    const [cards] = await pool.query(
      "SELECT * FROM access_cards WHERE card_uid = ?",
      [card_uid],
    );

    if (cards.length === 0) {
      return res.status(404).json({
        found: false,
        error: "Card not recognized. Use manual search instead.",
      });
    }

    const card = cards[0];

    if (card.status !== "Active") {
      return res.status(403).json({
        found: true,
        blocked: true,
        status: card.status,
        error: `This card is marked as ${card.status}. Do not permit pickup/drop-off with this card.`,
      });
    }

    // ---- Case 1: it's the STUDENT's own card ----
    if (card.card_type === "Student") {
      const [students] = await pool.query(
        `SELECT s.id, s.first_name, s.last_name, s.admission_number,
                s.photo_filename, c.class_name
         FROM students s
         LEFT JOIN class_assignments ca ON s.id = ca.student_id
           AND ca.academic_year_id = (SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1)
         LEFT JOIN classes c ON ca.class_id = c.id
         WHERE s.id = ?`,
        [card.student_id],
      );

      if (students.length === 0) {
        return res
          .status(404)
          .json({ found: false, error: "Student not found" });
      }

      const todayStatus = await getTodayStatus(card.student_id);

      return res.json({
        found: true,
        card_no: card.card_uid,
        blocked: false,
        scan_type: "StudentCard",
        card_id: card.id, 
        student: {
          ...students[0],
          card_id: card.id,
          can_pickup: true,
          can_dropoff: true,
        },
        today_status: todayStatus,
      });
    }

    // ---- Case 2: it's an AUTHORIZED PERSON's card ----
    const [persons] = await pool.query(
      "SELECT * FROM authorized_persons WHERE id = ?",
      [card.authorized_person_id],
    );

    if (persons.length === 0 || !persons[0].is_active) {
      return res.status(404).json({
        found: false,
        error: "Authorized person not found or inactive",
      });
    }

    const [authorizedStudents] = await pool.query(
      `SELECT
         s.id, s.first_name, s.last_name, s.admission_number, s.photo_filename,
         c.class_name,
         CAST(sap.can_pickup AS SIGNED) as can_pickup,
         CAST(sap.can_dropoff AS SIGNED) as can_dropoff,
         CAST(sap.is_primary_guardian AS SIGNED) as is_primary_guardian
       FROM student_authorized_persons sap
       INNER JOIN students s ON sap.student_id = s.id
       LEFT JOIN class_assignments ca ON s.id = ca.student_id
         AND ca.academic_year_id = (SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1)
       LEFT JOIN classes c ON ca.class_id = c.id
       WHERE sap.authorized_person_id = ?
         AND (s.is_active IS NULL OR s.is_active = TRUE)`,
      [card.authorized_person_id],
    );

    const studentsWithStatus = await Promise.all(
      authorizedStudents.map(async (s) => ({
        ...s,
        can_pickup: s.can_pickup === 1 || s.can_pickup === true,
        can_dropoff: s.can_dropoff === 1 || s.can_dropoff === true,
        is_primary_guardian:
          s.is_primary_guardian === 1 || s.is_primary_guardian === true,
        today_status: await getTodayStatus(s.id),
      })),
    );

    res.json({
      found: true,
      blocked: false,
      scan_type: "AuthorizedPersonCard",
      card_no: card.card_uid,
      card_id: card.id, // ← ADD THIS
      person: {
        ...persons[0],
        photo_url: persons[0].photo_filename
          ? `/uploads/authorized-persons/${persons[0].photo_filename}`
          : null,
      },
      students: studentsWithStatus,
    });
  } catch (error) {
    console.error("Error looking up card:", error);
    res.status(500).json({ error: "Failed to look up card" });
  }
};

// Helper: has this student been dropped off / picked up today, and by whom
const getTodayStatus = async (studentId) => {
  const [rows] = await pool.query(
    `SELECT action_type, scanned_at,
            CONCAT(ap.first_name, ' ', ap.last_name) as by_person
     FROM pickup_dropoff_log pdl
     LEFT JOIN authorized_persons ap ON pdl.authorized_person_id = ap.id
     WHERE pdl.student_id = ? AND DATE(pdl.scanned_at) = CURDATE()
     ORDER BY pdl.scanned_at DESC`,
    [studentId],
  );

  const lastDropoff = rows.find((r) => r.action_type === "Drop-off");
  const lastPickup = rows.find((r) => r.action_type === "Pickup");

  return {
    dropped_off_today: !!lastDropoff,
    dropped_off_at: lastDropoff?.scanned_at || null,
    dropped_off_by: lastDropoff?.by_person || null,
    picked_up_today: !!lastPickup,
    picked_up_at: lastPickup?.scanned_at || null,
    picked_up_by: lastPickup?.by_person || null,
  };
};

// ----------------------------------------------------------------------
// LOGGING THE APPROVED ACTION
// ----------------------------------------------------------------------

// POST /api/pickup-log — staff clicks "Approve" after visually matching the person
const logPickupDropoff = async (req, res) => {
  try {
    const {
      student_id,
      authorized_person_id, // null if it was the student's own card
      card_id,
      action_type, // 'Drop-off' or 'Pickup'
      approved_by,
      notes,
    } = req.body;

    if (!student_id || !card_id || !action_type || !approved_by) {
      return res.status(400).json({
        error: "student_id, card_id, action_type, and approved_by are required",
      });
    }

    if (!["Drop-off", "Pickup"].includes(action_type)) {
      return res
        .status(400)
        .json({ error: "action_type must be 'Drop-off' or 'Pickup'" });
    }

    // Guard: if authorized_person_id given, confirm they're actually
    // authorized for this student and for this action type
    if (authorized_person_id) {
      const [link] = await pool.query(
        `SELECT can_pickup, can_dropoff FROM student_authorized_persons
         WHERE student_id = ? AND authorized_person_id = ?`,
        [student_id, authorized_person_id],
      );

      if (link.length === 0) {
        return res.status(403).json({
          error: "This person is not authorized for this student",
        });
      }

      const allowed =
        action_type === "Pickup" ? link[0].can_pickup : link[0].can_dropoff;

      if (!allowed) {
        return res.status(403).json({
          error: `This person is not authorized to perform ${action_type} for this student`,
        });
      }
    }

    // Soft warning (not a hard block) if the same action already happened today —
    // the frontend should surface this before calling this endpoint, but we
    // double-check server-side too since two staff could be scanning at once.
    const [already] = await pool.query(
      `SELECT id, scanned_at FROM pickup_dropoff_log
       WHERE student_id = ? AND action_type = ? AND DATE(scanned_at) = CURDATE()`,
      [student_id, action_type],
    );

    const [result] = await pool.query(
      `INSERT INTO pickup_dropoff_log
         (student_id, authorized_person_id, card_id, action_type, approved_by, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        student_id,
        authorized_person_id || null,
        card_id,
        action_type,
        approved_by,
        notes,
      ],
    );

    res.status(201).json({
      success: true,
      log_id: result.insertId,
      duplicate_today: already.length > 0,
      previous_entries_today: already,
    });
  } catch (error) {
    console.error("Error logging pickup/dropoff:", error);
    res.status(500).json({ error: "Failed to log pickup/drop-off" });
  }
};

// GET /api/pickup-log — history with filters, for records/reporting
const getPickupLog = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const {
      student_id,
      student_search,
      class_id,
      action_type,
      start_date,
      end_date,
      page = 1,
      limit = 25,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereConditions = ["1=1"];
    let params = [];

    if (student_id) {
      whereConditions.push("pdl.student_id = ?");
      params.push(student_id);
    }

    if (student_search) {
      whereConditions.push(
        "(s.first_name LIKE ? OR s.last_name LIKE ? OR s.admission_number LIKE ?)",
      );
      params.push(
        `%${student_search}%`,
        `%${student_search}%`,
        `%${student_search}%`,
      );
    }

    if (class_id) {
      whereConditions.push("ca.class_id = ?");
      params.push(class_id);
    }

    if (action_type && ["Drop-off", "Pickup"].includes(action_type)) {
      whereConditions.push("pdl.action_type = ?");
      params.push(action_type);
    }

    if (start_date && end_date) {
      whereConditions.push("DATE(pdl.scanned_at) BETWEEN ? AND ?");
      params.push(start_date, end_date);
    } else if (start_date) {
      whereConditions.push("DATE(pdl.scanned_at) >= ?");
      params.push(start_date);
    } else if (end_date) {
      whereConditions.push("DATE(pdl.scanned_at) <= ?");
      params.push(end_date);
    }

    // (a) added pbu join for pinned_by username
    const joinClause = `
        INNER JOIN students s ON pdl.student_id = s.id
        LEFT JOIN class_assignments ca ON s.id = ca.student_id
          AND ca.academic_year_id = (SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1)
        LEFT JOIN classes c ON ca.class_id = c.id
        LEFT JOIN authorized_persons ap ON pdl.authorized_person_id = ap.id
        INNER JOIN users u ON pdl.approved_by = u.id
        LEFT JOIN users pbu ON pdl.pinned_by = pbu.id
      `;

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total
         FROM pickup_dropoff_log pdl
         ${joinClause}
         WHERE ${whereConditions.join(" AND ")}`,
      params,
    );

    // (b) added pin fields to SELECT; (c) changed ORDER BY to prioritise pins
    const [logs] = await pool.query(
      `SELECT
           pdl.id, pdl.action_type, pdl.scanned_at, pdl.notes,
           pdl.is_pinned, pdl.pinned_at,
           pbu.username as pinned_by_name,
           s.id as student_id, s.first_name as student_first_name,
           s.last_name as student_last_name, s.admission_number,
           c.class_name,
           ap.id as authorized_person_id, ap.first_name as person_first_name,
           ap.last_name as person_last_name, ap.relationship, ap.phone,
           u.username as approved_by_name
         FROM pickup_dropoff_log pdl
         ${joinClause}
         WHERE ${whereConditions.join(" AND ")}
         ORDER BY pdl.is_pinned DESC, pdl.pinned_at DESC, pdl.scanned_at DESC
         LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset],
    );

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching pickup log:", error);
    res.status(500).json({ error: "Failed to fetch pickup log" });
  }
};



// GET /api/authorized-persons/search?q=...
const searchAuthorizedPersons = async (req, res) => {
  try {
    const { q = "" } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }
    const [persons] = await pool.query(
      `SELECT
      ap.id, ap.first_name, ap.last_name, ap.relationship, ap.phone,
      ap.photo_filename,
      ANY_VALUE(ac.card_uid) as card_uid,
      ANY_VALUE(ac.status) as card_status,
      GROUP_CONCAT(DISTINCT CONCAT(s.first_name, ' ', s.last_name) SEPARATOR ', ') as linked_students
    FROM authorized_persons ap
    LEFT JOIN access_cards ac
      ON ac.authorized_person_id = ap.id AND ac.status = 'Active'
    LEFT JOIN student_authorized_persons sap ON sap.authorized_person_id = ap.id
    LEFT JOIN students s ON sap.student_id = s.id
    WHERE ap.is_active = 1
      AND (ap.first_name LIKE ? OR ap.last_name LIKE ? OR ap.phone LIKE ?)
    GROUP BY ap.id
    ORDER BY ap.first_name
    LIMIT 20`,
      [`%${q}%`, `%${q}%`, `%${q}%`],
    );

    res.json(persons);
  } catch (error) {
    console.error("Error searching authorized persons:", error);
    res.status(500).json({ error: "Failed to search authorized persons" });
  }
};

// GET /api/authorized-persons/search?q=...
// const searchAuthorizedPersons = async (req, res) => {
//   try {
//     const { q = "" } = req.query;

//     if (!q || q.trim().length < 2) {
//       return res.json([]);
//     }

//     const searchTerm = `%${q.trim()}%`;

//     const [persons] = await pool.query(
//       `SELECT
//          ap.id,
//          ap.first_name,
//          ap.last_name,
//          ap.relationship,
//          ap.phone,
//          ap.photo_filename,
//          ap.is_active,
//          ac.card_uid,
//          ac.status as card_status,
//          GROUP_CONCAT(DISTINCT CONCAT(s.first_name, ' ', s.last_name) SEPARATOR ', ') as linked_students,
//          COUNT(DISTINCT sap.student_id) as student_count
//        FROM authorized_persons ap
//        LEFT JOIN access_cards ac
//          ON ac.authorized_person_id = ap.id AND ac.status = 'Active'
//        LEFT JOIN student_authorized_persons sap ON sap.authorized_person_id = ap.id
//        LEFT JOIN students s ON sap.student_id = s.id AND (s.is_active IS NULL OR s.is_active = TRUE)
//        WHERE ap.is_active = 1
//          AND (
//            ap.first_name LIKE ?
//            OR ap.last_name LIKE ?
//            OR CONCAT(ap.first_name, ' ', ap.last_name) LIKE ?
//            OR ap.phone LIKE ?
//          )
//        GROUP BY ap.id
//        ORDER BY ap.first_name
//        LIMIT 20`,
//       [searchTerm, searchTerm, searchTerm, searchTerm],
//     );

//     res.json(persons);
//   } catch (error) {
//     console.error("Error searching authorized persons:", error);
//     res.status(500).json({
//       error: "Failed to search authorized persons",
//       details: error.message
//     });
//   }
// };

// GET /api/authorized-persons/search?q=...
// const searchAuthorizedPersons = async (req, res) => {
//   try {
//     const { q = "" } = req.query;

//     console.log("🔍 Search query received:", q);

//     if (!q || q.trim().length < 2) {
//       console.log("❌ Query too short, returning empty");
//       return res.json([]);
//     }

//     const searchTerm = `%${q.trim()}%`;

//     // Log to debug
//     console.log("📊 Searching with term:", searchTerm);

//     // First, check if there are any authorized persons at all
//     const [countResult] = await pool.query(
//       "SELECT COUNT(*) as total FROM authorized_persons WHERE is_active = 1"
//     );
//     console.log(`📊 Total active authorized persons: ${countResult[0].total}`);

//     const [persons] = await pool.query(
//       `SELECT
//          ap.id,
//          ap.first_name,
//          ap.last_name,
//          ap.relationship,
//          ap.phone,
//          ap.photo_filename,
//          ap.is_active,
//          ac.card_uid,
//          ac.status as card_status,
//          (SELECT COUNT(*) FROM student_authorized_persons WHERE authorized_person_id = ap.id) as student_count,
//          (SELECT GROUP_CONCAT(CONCAT(s.first_name, ' ', s.last_name) SEPARATOR ', ')
//           FROM student_authorized_persons sap
//           JOIN students s ON sap.student_id = s.id
//           WHERE sap.authorized_person_id = ap.id AND (s.is_active IS NULL OR s.is_active = TRUE)
//          ) as linked_students
//        FROM authorized_persons ap
//        LEFT JOIN access_cards ac
//          ON ac.authorized_person_id = ap.id AND ac.status = 'Active'
//        WHERE ap.is_active = 1
//          AND (
//            ap.first_name LIKE ?
//            OR ap.last_name LIKE ?
//            OR CONCAT(ap.first_name, ' ', ap.last_name) LIKE ?
//            OR ap.phone LIKE ?
//          )
//        GROUP BY ap.id
//        ORDER BY ap.first_name
//        LIMIT 20`,
//       [searchTerm, searchTerm, searchTerm, searchTerm],
//     );

//     console.log(`✅ Found ${persons.length} matching persons`);
//     console.log("📥 Results:", JSON.stringify(persons, null, 2));

//     res.json(persons);
//   } catch (error) {
//     console.error("❌ Error searching authorized persons:", error);
//     res.status(500).json({
//       error: "Failed to search authorized persons",
//       details: error.message
//     });
//   }
// };

// GET /api/authorized-persons/search?q=...
// const searchAuthorizedPersons = async (req, res) => {
//   try {
//     const { q = "" } = req.query;

//     if (!q || q.trim().length < 2) {
//       return res.json([]);
//     }

//     const searchTerm = `%${q.trim()}%`;

//     // Simplified query - show all matching persons regardless of student links
//     const [persons] = await pool.query(
//       `SELECT
//          ap.id,
//          ap.first_name,
//          ap.last_name,
//          ap.relationship,
//          ap.phone,
//          ap.photo_filename,
//          ap.is_active,
//          ac.card_uid,
//          ac.status as card_status,
//          (SELECT COUNT(*) FROM student_authorized_persons WHERE authorized_person_id = ap.id) as student_count,
//          (SELECT GROUP_CONCAT(CONCAT(s.first_name, ' ', s.last_name) SEPARATOR ', ')
//           FROM student_authorized_persons sap
//           JOIN students s ON sap.student_id = s.id
//           WHERE sap.authorized_person_id = ap.id AND (s.is_active IS NULL OR s.is_active = TRUE)
//          ) as linked_students
//        FROM authorized_persons ap
//        LEFT JOIN access_cards ac
//          ON ac.authorized_person_id = ap.id AND ac.status = 'Active'
//        WHERE ap.is_active = 1
//          AND (
//            ap.first_name LIKE ?
//            OR ap.last_name LIKE ?
//            OR CONCAT(ap.first_name, ' ', ap.last_name) LIKE ?
//            OR ap.phone LIKE ?
//          )
//        GROUP BY ap.id
//        ORDER BY ap.first_name
//        LIMIT 20`,
//       [searchTerm, searchTerm, searchTerm, searchTerm],
//     );
//     console.log(
//       `Found ${persons.length} matching authorized persons for query "${q}"`,
//     );
//     res.json(persons);
//   } catch (error) {
//     console.error("Error searching authorized persons:", error);
//     res.status(500).json({ error: "Failed to search authorized persons" });
//   }
// };

// POST /api/authorized-persons/:personId/link-bulk
const linkBulkAuthorizedPersons = async (req, res) => {
  try {
    const { personId } = req.params;
    const {
      student_ids,
      can_pickup = true,
      can_dropoff = true,
      is_primary_guardian = false,
    } = req.body;

    if (
      !student_ids ||
      !Array.isArray(student_ids) ||
      student_ids.length === 0
    ) {
      return res.status(400).json({ error: "student_ids array is required" });
    }

    // Check if person exists
    const [person] = await pool.query(
      "SELECT id FROM authorized_persons WHERE id = ? AND is_active = 1",
      [personId],
    );

    if (person.length === 0) {
      return res.status(404).json({ error: "Authorized person not found" });
    }

    let linkedCount = 0;
    let skippedCount = 0;

    for (const studentId of student_ids) {
      // Check if already linked
      const [existing] = await pool.query(
        "SELECT id FROM student_authorized_persons WHERE student_id = ? AND authorized_person_id = ?",
        [studentId, personId],
      );

      if (existing.length > 0) {
        skippedCount++;
        continue;
      }

      await pool.query(
        `INSERT INTO student_authorized_persons 
         (student_id, authorized_person_id, can_pickup, can_dropoff, is_primary_guardian)
         VALUES (?, ?, ?, ?, ?)`,
        [
          studentId,
          personId,
          can_pickup ? 1 : 0,
          can_dropoff ? 1 : 0,
          is_primary_guardian ? 1 : 0,
        ],
      );
      linkedCount++;
    }

    res.json({
      success: true,
      message: `Linked ${linkedCount} students (${skippedCount} already linked)`,
      linked_count: linkedCount,
      skipped_count: skippedCount,
    });
  } catch (error) {
    console.error("Error linking authorized persons:", error);
    res.status(500).json({ error: "Failed to link authorized persons" });
  }
};

// log pickup dropoff bulk
// const logPickupDropoffBulk = async (req, res) => {
//   const connection = await pool.getConnection();

//   try {
//     await connection.beginTransaction();

//     const {
//       student_ids,
//       authorized_person_id,
//       card_id,
//       action_type,
//       approved_by,
//       notes,
//     } = req.body;

//     if (!Array.isArray(student_ids) || student_ids.length === 0) {
//       await connection.rollback();
//       return res
//         .status(400)
//         .json({ error: "student_ids must be a non-empty array" });
//     }

//     if (!card_id || !action_type || !approved_by) {
//       await connection.rollback();
//       return res.status(400).json({
//         error: "card_id, action_type, and approved_by are required",
//       });
//     }

//     if (!["Drop-off", "Pickup"].includes(action_type)) {
//       await connection.rollback();
//       return res
//         .status(400)
//         .json({ error: "action_type must be 'Drop-off' or 'Pickup'" });
//     }

//     const results = [];

//     for (const studentId of student_ids) {
//       // Per-student authorization check — same guard as the single-student
//       // endpoint, just looped. A person could theoretically be authorized
//       // for some linked students but not others (e.g. can_pickup=false for
//       // one child specifically), so this can't be checked once for the batch.
//       if (authorized_person_id) {
//         const [link] = await connection.query(
//           `SELECT can_pickup, can_dropoff FROM student_authorized_persons
//              WHERE student_id = ? AND authorized_person_id = ?`,
//           [studentId, authorized_person_id],
//         );

//         if (link.length === 0) {
//           results.push({
//             student_id: studentId,
//             success: false,
//             error: "Not authorized for this student",
//           });
//           continue;
//         }

//         const allowed =
//           action_type === "Pickup" ? link[0].can_pickup : link[0].can_dropoff;

//         if (!allowed) {
//           results.push({
//             student_id: studentId,
//             success: false,
//             error: `Not authorized to perform ${action_type} for this student`,
//           });
//           continue;
//         }
//       }

//       const [already] = await connection.query(
//         `SELECT id FROM pickup_dropoff_log
//            WHERE student_id = ? AND action_type = ? AND DATE(scanned_at) = CURDATE()`,
//         [studentId, action_type],
//       );

//       const [insertResult] = await connection.query(
//         `INSERT INTO pickup_dropoff_log
//              (student_id, authorized_person_id, card_id, action_type, approved_by, notes)
//            VALUES (?, ?, ?, ?, ?, ?)`,
//         [
//           studentId,
//           authorized_person_id || null,
//           card_id,
//           action_type,
//           approved_by,
//           notes,
//         ],
//       );

//       results.push({
//         student_id: studentId,
//         success: true,
//         log_id: insertResult.insertId,
//         duplicate_today: already.length > 0,
//       });
//     }

//     await connection.commit();

//     const successCount = results.filter((r) => r.success).length;
//     const failCount = results.length - successCount;

//     res.status(201).json({
//       success: true,
//       processed: results.length,
//       succeeded: successCount,
//       failed: failCount,
//       results,
//     });
//   } catch (error) {
//     await connection.rollback();
//     console.error("Error in bulk pickup/dropoff logging:", error);
//     res
//       .status(500)
//       .json({ error: "Failed to log pickup/drop-off for students" });
//   } finally {
//     connection.release();
//   }
// };

const logPickupDropoffBulk = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const {
      student_ids,
      authorized_person_id,
      card_id,
      action_type,
      approved_by,
      notes,
    } = req.body;

    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      await connection.rollback();
      return res
        .status(400)
        .json({ error: "student_ids must be a non-empty array" });
    }

    if (!card_id || !action_type || !approved_by) {
      await connection.rollback();
      return res.status(400).json({
        error: "card_id, action_type, and approved_by are required",
      });
    }

    if (!["Drop-off", "Pickup"].includes(action_type)) {
      await connection.rollback();
      return res
        .status(400)
        .json({ error: "action_type must be 'Drop-off' or 'Pickup'" });
    }

    // ---- Batch-fetch everything needed for SMS, before the loop ----
    const [studentRows] = await connection.query(
      `SELECT id, first_name, last_name, parent_contact FROM students WHERE id IN (?)`,
      [student_ids],
    );
    const studentMap = studentRows.reduce((acc, s) => {
      acc[s.id] = s;
      return acc;
    }, {});

    let guardianName = null;
    let guardianPhone = null;
    if (authorized_person_id) {
      const [personRows] = await connection.query(
        "SELECT first_name, last_name, phone FROM authorized_persons WHERE id = ?",
        [authorized_person_id],
      );
      if (personRows.length > 0) {
        guardianName = `${personRows[0].first_name} ${personRows[0].last_name}`;
        guardianPhone = personRows[0].phone;
      }
    }

    const results = [];
    const smsQueue = []; // built during the loop, fired after commit

    for (const studentId of student_ids) {
      const student = studentMap[studentId];

      if (!student) {
        results.push({
          student_id: studentId,
          success: false,
          error: "Student not found",
        });
        continue;
      }

      // Per-student authorization check — unchanged from before
      if (authorized_person_id) {
        const [link] = await connection.query(
          `SELECT can_pickup, can_dropoff FROM student_authorized_persons
           WHERE student_id = ? AND authorized_person_id = ?`,
          [studentId, authorized_person_id],
        );

        if (link.length === 0) {
          results.push({
            student_id: studentId,
            success: false,
            error: "Not authorized for this student",
          });
          continue;
        }

        const allowed =
          action_type === "Pickup" ? link[0].can_pickup : link[0].can_dropoff;

        if (!allowed) {
          results.push({
            student_id: studentId,
            success: false,
            error: `Not authorized to perform ${action_type} for this student`,
          });
          continue;
        }
      }

      // Hard duplicate-today block — unchanged from the earlier lockout patch
      const [already] = await connection.query(
        `SELECT id, scanned_at FROM pickup_dropoff_log
         WHERE student_id = ? AND action_type = ? AND DATE(scanned_at) = CURDATE()`,
        [studentId, action_type],
      );

      if (already.length > 0) {
        results.push({
          student_id: studentId,
          success: false,
          error: `Already has a ${action_type} recorded today at ${new Date(
            already[0].scanned_at,
          ).toLocaleTimeString()} — locked until tomorrow.`,
          already_logged: true,
        });
        continue;
      }

      const [insertResult] = await connection.query(
        `INSERT INTO pickup_dropoff_log
           (student_id, authorized_person_id, card_id, action_type, approved_by, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          studentId,
          authorized_person_id || null,
          card_id,
          action_type,
          approved_by,
          notes,
        ],
      );

      const scannedAt = new Date(); // matches DB's CURRENT_TIMESTAMP closely enough for the SMS

      results.push({
        student_id: studentId,
        success: true,
        log_id: insertResult.insertId,
        sms_status: "sending",
      });

      // Queue the SMS — NOT sent yet, just gathered here. Sent after commit,
      // using the phone we already resolved (guardian's, or the student's
      // own parent_contact as fallback).
      const phone = guardianPhone || student.parent_contact;
      if (phone) {
        smsQueue.push({ student, phone, scannedAt });
      }
    }

    await connection.commit();

    // ---- Fire SMS in the background, AFTER commit, NOT awaited ----
    // Using `pool.query` here (not `connection`), since `connection` gets
    // released in `finally` below and may already be back in the pool's
    // free list by the time these promises resolve.
    const time = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    smsQueue.forEach(({ student, phone }) => {
      smsService
        .sendPickupDropoffSMS(student, action_type, time, guardianName, phone)
        .then((smsResult) => {
          return pool.query(
            `INSERT INTO sms_logs
               (student_id, phone_number, message, type, status, message_id, error_message, sent_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              student.id,
              phone,
              smsResult.sms_body,
              action_type === "Drop-off"
                ? "dropoff_notification"
                : "pickup_notification",
              smsResult.success ? "sent" : "failed",
              smsResult.messageId,
              smsResult.success ? null : smsResult.error,
            ],
          );
        })
        .catch((err) => {
          console.error(
            `Background SMS failed for student ${student.id} (${action_type}):`,
            err,
          );
        });
    });

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    res.status(201).json({
      success: true,
      processed: results.length,
      succeeded: successCount,
      failed: failCount,
      results,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error in bulk pickup/dropoff logging:", error);
    res
      .status(500)
      .json({ error: "Failed to log pickup/drop-off for students" });
  } finally {
    connection.release();
  }
};

// ============================================================================
// ============================================================================
// GET /api/access-cards/details/:card_uid
//
// Unlike lookupCard (built for the fast scan-and-approve flow), this returns
// everything needed for a full management view:
//   - the card itself (id, uid, status, type, issued date)
//   - the card holder (person or student)
//   - for AuthorizedPerson cards: every student linked to that person,
//     WITH the join id (needed to unlink) and per-student permissions
//   - for EVERY linked student: every OTHER guardian authorized for them
//     too (not just this card's holder) — this is what lets staff manage
//     the whole family's access from any single card as an entry point
// ============================================================================

const getCardDetails = async (req, res) => {
  try {
    const { card_uid } = req.params;

    const [cards] = await pool.query(
      "SELECT * FROM access_cards WHERE card_uid = ?",
      [card_uid],
    );

    if (cards.length === 0) {
      return res.status(404).json({ found: false, error: "Card not found" });
    }

    const card = cards[0];

    // ---- Student's own card ----
    if (card.card_type === "Student") {
      const [students] = await pool.query(
        `SELECT s.id, s.first_name, s.last_name, s.admission_number,
                s.photo_filename, c.class_name
         FROM students s
         LEFT JOIN class_assignments ca ON s.id = ca.student_id
           AND ca.academic_year_id = (SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1)
         LEFT JOIN classes c ON ca.class_id = c.id
         WHERE s.id = ?`,
        [card.student_id],
      );

      if (students.length === 0) {
        return res
          .status(404)
          .json({ found: false, error: "Student not found" });
      }

      const guardians = await getGuardiansForStudent(card.student_id);

      return res.json({
        found: true,
        card,
        card_holder_type: "Student",
        student: students[0],
        guardians,
      });
    }

    // ---- Authorized person's card ----
    const [persons] = await pool.query(
      "SELECT * FROM authorized_persons WHERE id = ?",
      [card.authorized_person_id],
    );

    if (persons.length === 0) {
      return res
        .status(404)
        .json({ found: false, error: "Authorized person not found" });
    }

    const [linkedStudents] = await pool.query(
      `SELECT
         sap.id as link_id, sap.can_pickup, sap.can_dropoff, sap.is_primary_guardian,
         s.id as student_id, s.first_name, s.last_name, s.admission_number,
         s.photo_filename, c.class_name
       FROM student_authorized_persons sap
       INNER JOIN students s ON sap.student_id = s.id
       LEFT JOIN class_assignments ca ON s.id = ca.student_id
         AND ca.academic_year_id = (SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1)
       LEFT JOIN classes c ON ca.class_id = c.id
       WHERE sap.authorized_person_id = ?
       ORDER BY s.first_name`,
      [card.authorized_person_id],
    );

    // For each linked student, fetch every OTHER guardian too
    const otherGuardiansByStudent = {};
    for (const s of linkedStudents) {
      const allGuardians = await getGuardiansForStudent(s.student_id);
      otherGuardiansByStudent[s.student_id] = allGuardians.filter(
        (g) => g.person_id !== card.authorized_person_id,
      );
    }

    res.json({
      found: true,
      card,
      card_holder_type: "AuthorizedPerson",
      person: persons[0],
      linked_students: linkedStudents,
      other_guardians_by_student: otherGuardiansByStudent,
    });
  } catch (error) {
    console.error("Error fetching card details:", error);
    res.status(500).json({ error: "Failed to fetch card details" });
  }
};

// Helper: every guardian authorized for a given student, plus whether they
// currently hold an active card of their own.
const getGuardiansForStudent = async (studentId) => {
  const [rows] = await pool.query(
    `SELECT
       sap.id as link_id, sap.can_pickup, sap.can_dropoff, sap.is_primary_guardian,
       ap.id as person_id, ap.first_name, ap.last_name, ap.relationship, ap.phone,
       ap.photo_filename,
       ac.card_uid, ac.status as card_status
     FROM student_authorized_persons sap
     INNER JOIN authorized_persons ap ON sap.authorized_person_id = ap.id
     LEFT JOIN access_cards ac ON ac.authorized_person_id = ap.id AND ac.status = 'Active'
     WHERE sap.student_id = ? AND ap.is_active = 1
     ORDER BY sap.is_primary_guardian DESC, ap.first_name`,
    [studentId],
  );
  return rows;
};

// GET /api/students/search-for-enrollment?q=...
const searchStudentsForEnrollment = async (req, res) => {
  try {
    const { q = "" } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const [students] = await pool.query(
      `SELECT
         s.id, s.first_name, s.last_name, s.admission_number, s.photo_filename,
         c.class_name
       FROM students s
       LEFT JOIN class_assignments ca ON s.id = ca.student_id
         AND ca.academic_year_id = (SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1)
       LEFT JOIN classes c ON ca.class_id = c.id
       WHERE (s.first_name LIKE ? OR s.last_name LIKE ? OR s.admission_number LIKE ?)
         AND (s.is_active IS NULL OR s.is_active = TRUE)
       ORDER BY s.first_name, s.last_name
       LIMIT 15`,
      [`%${q}%`, `%${q}%`, `%${q}%`],
    );

    res.json(students);
  } catch (error) {
    console.error("Error searching students for enrollment:", error);
    res.status(500).json({ error: "Failed to search students" });
  }
};

// DELETE /api/student-authorized-persons/:linkId — remove a guardian-student link
const removeStudentAuthorizedPerson = async (req, res) => {
  try {
    const { linkId } = req.params;

    const [result] = await pool.query(
      "DELETE FROM student_authorized_persons WHERE id = ?",
      [linkId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Link not found" });
    }

    res.json({ message: "Link removed successfully" });
  } catch (error) {
    console.error("Error removing student-authorized-person link:", error);
    res.status(500).json({ error: "Failed to remove link" });
  }
};

const sendBulkPickupDropoffSMS = async (req, res) => {
  try {
    const { action_type, start_date, end_date, class_id, student_search } =
      req.body;

    if (!action_type || !["Drop-off", "Pickup"].includes(action_type)) {
      return res
        .status(400)
        .json({ error: "action_type must be 'Drop-off' or 'Pickup'" });
    }

    let whereConditions = ["pdl.action_type = ?"];
    let params = [action_type];

    if (student_search) {
      whereConditions.push(
        "(s.first_name LIKE ? OR s.last_name LIKE ? OR s.admission_number LIKE ?)",
      );
      params.push(
        `%${student_search}%`,
        `%${student_search}%`,
        `%${student_search}%`,
      );
    }

    if (class_id) {
      whereConditions.push("ca.class_id = ?");
      params.push(class_id);
    }

    if (start_date && end_date) {
      whereConditions.push("DATE(pdl.scanned_at) BETWEEN ? AND ?");
      params.push(start_date, end_date);
    } else if (start_date) {
      whereConditions.push("DATE(pdl.scanned_at) >= ?");
      params.push(start_date);
    } else if (end_date) {
      whereConditions.push("DATE(pdl.scanned_at) <= ?");
      params.push(end_date);
    }

    const [entries] = await pool.query(
      `SELECT
         pdl.id as log_id, pdl.scanned_at,
         s.id as student_id, s.first_name, s.last_name, s.admission_number,
         s.parent_contact,
         ap.id as authorized_person_id, ap.first_name as guardian_first_name,
         ap.last_name as guardian_last_name, ap.phone as guardian_phone
       FROM pickup_dropoff_log pdl
       INNER JOIN students s ON pdl.student_id = s.id
       LEFT JOIN class_assignments ca ON s.id = ca.student_id
         AND ca.academic_year_id = (SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1)
       LEFT JOIN authorized_persons ap ON pdl.authorized_person_id = ap.id
       WHERE ${whereConditions.join(" AND ")}
       ORDER BY pdl.scanned_at DESC`,
      params,
    );

    if (entries.length === 0) {
      return res.json({
        success: true,
        total: 0,
        sent: 0,
        failed: 0,
        skipped_no_phone: 0,
        results: [],
      });
    }

    const results = [];

    for (const entry of entries) {
      const phone = entry.guardian_phone || entry.parent_contact;

      if (!phone) {
        results.push({
          log_id: entry.log_id,
          student: `${entry.first_name} ${entry.last_name}`,
          success: false,
          skipped: true,
          error: "No phone number on file for this guardian or student",
        });
        continue;
      }

      const guardianName = entry.authorized_person_id
        ? `${entry.guardian_first_name} ${entry.guardian_last_name}`
        : null;

      const time = new Date(entry.scanned_at).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

      const smsResult = await smsService.sendPickupDropoffSMS(
        {
          id: entry.student_id,
          first_name: entry.first_name,
          last_name: entry.last_name,
        },
        action_type,
        time,
        guardianName,
        phone,
      );

      // Log every attempt, success or failure — same pattern your existing
      // balance-reminder flow uses for sms_logs.
      await pool.query(
        `INSERT INTO sms_logs
           (student_id, phone_number, message, type, status, message_id, error_message, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          entry.student_id,
          phone,
          smsResult.sms_body,
          action_type === "Drop-off"
            ? "dropoff_notification"
            : "pickup_notification",
          smsResult.success ? "sent" : "failed",
          smsResult.messageId,
          smsResult.success ? null : smsResult.error,
        ],
      );

      results.push({
        log_id: entry.log_id,
        student: `${entry.first_name} ${entry.last_name}`,
        phone,
        success: smsResult.success,
        error: smsResult.success ? null : smsResult.error,
      });
    }

    const sent = results.filter((r) => r.success).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.length - sent - skipped;

    res.json({
      success: true,
      total: entries.length,
      sent,
      failed,
      skipped_no_phone: skipped,
      results,
    });
  } catch (error) {
    console.error("Error sending bulk pickup/dropoff SMS:", error);
    res.status(500).json({ error: "Failed to send bulk SMS notifications" });
  }
};

const quickScanCard = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { card_uid, action_type, approved_by } = req.body;

    if (!card_uid || !action_type || !approved_by) {
      connection.release();
      return res.status(400).json({
        error: "card_uid, action_type, and approved_by are required",
      });
    }

    if (!["Drop-off", "Pickup"].includes(action_type)) {
      connection.release();
      return res
        .status(400)
        .json({ error: "action_type must be 'Drop-off' or 'Pickup'" });
    }

    // ---- 1. Card lookup ----
    const [cards] = await connection.query(
      "SELECT * FROM access_cards WHERE card_uid = ?",
      [card_uid],
    );

    if (cards.length === 0) {
      connection.release();
      return res.status(404).json({
        found: false,
        error: "Card not recognized.",
      });
    }

    const card = cards[0];

    if (card.status !== "Active") {
      connection.release();
      return res.status(403).json({
        found: true,
        blocked: true,
        status: card.status,
        error: `This card is ${card.status}. Do not permit entry.`,
      });
    }

    let candidateStudents = []; // [{id, first_name, last_name, parent_contact, can_pickup, can_dropoff}]
    let guardianName = null;
    let guardianPhone = null;
    let scanType;

    if (card.card_type === "Student") {
      scanType = "StudentCard";
      const [students] = await connection.query(
        "SELECT id, first_name, last_name, parent_contact FROM students WHERE id = ?",
        [card.student_id],
      );

      if (students.length === 0) {
        connection.release();
        return res
          .status(404)
          .json({ found: false, error: "Student not found" });
      }

      candidateStudents = [
        { ...students[0], can_pickup: true, can_dropoff: true },
      ];
    } else {
      scanType = "AuthorizedPersonCard";

      // ---- 2. Guardian lookup ----
      const [persons] = await connection.query(
        "SELECT first_name, last_name, phone, is_active FROM authorized_persons WHERE id = ?",
        [card.authorized_person_id],
      );

      if (persons.length === 0 || !persons[0].is_active) {
        connection.release();
        return res.status(404).json({
          found: false,
          error: "Authorized person not found or inactive",
        });
      }

      guardianName = `${persons[0].first_name} ${persons[0].last_name}`;
      guardianPhone = persons[0].phone;

      // ---- 3. Linked students + permissions, one query ----
      const [linked] = await connection.query(
        `SELECT s.id, s.first_name, s.last_name, s.parent_contact,
                sap.can_pickup, sap.can_dropoff
         FROM student_authorized_persons sap
         INNER JOIN students s ON sap.student_id = s.id
         WHERE sap.authorized_person_id = ?
           AND (s.is_active IS NULL OR s.is_active = TRUE)`,
        [card.authorized_person_id],
      );

      candidateStudents = linked;
    }

    if (candidateStudents.length === 0) {
      connection.release();
      return res.json({
        found: true,
        blocked: false,
        scan_type: scanType,
        approved: [],
        skipped: [],
        error: "No students linked to this card.",
      });
    }

    // Filter to students actually eligible for THIS action (permission check)
    const permittedStudents = candidateStudents.filter((s) =>
      action_type === "Pickup" ? s.can_pickup : s.can_dropoff,
    );
    const notPermitted = candidateStudents.filter((s) =>
      action_type === "Pickup" ? !s.can_pickup : !s.can_dropoff,
    );

    let eligibleStudents = permittedStudents;
    let alreadyDoneToday = [];

    // ---- 4. ONE batched duplicate-today check for all permitted students ----
    if (permittedStudents.length > 0) {
      const permittedIds = permittedStudents.map((s) => s.id);
      const [existingToday] = await connection.query(
        `SELECT DISTINCT student_id FROM pickup_dropoff_log
         WHERE student_id IN (?)
           AND action_type = ?
           AND scanned_at >= CURDATE()
           AND scanned_at < CURDATE() + INTERVAL 1 DAY`,
        [permittedIds, action_type],
      );
      const alreadyDoneIds = new Set(existingToday.map((r) => r.student_id));

      eligibleStudents = permittedStudents.filter(
        (s) => !alreadyDoneIds.has(s.id),
      );
      alreadyDoneToday = permittedStudents.filter((s) =>
        alreadyDoneIds.has(s.id),
      );
    }

    let approved = [];

    // ---- 5. ONE multi-row INSERT for everyone eligible ----
    if (eligibleStudents.length > 0) {
      await connection.beginTransaction();

      const values = eligibleStudents.map((s) => [
        s.id,
        card.card_type === "Student" ? null : card.authorized_person_id,
        card.id,
        action_type,
        approved_by,
        null, // notes
      ]);

      const [insertResult] = await connection.query(
        `INSERT INTO pickup_dropoff_log
           (student_id, authorized_person_id, card_id, action_type, approved_by, notes)
         VALUES ?`,
        [values],
      );

      await connection.commit();

      const firstInsertId = insertResult.insertId;
      approved = eligibleStudents.map((s, i) => ({
        student_id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        log_id: firstInsertId + i, // safe: multi-row INSERT assigns contiguous IDs on a single connection
        parent_contact: s.parent_contact,
      }));
    }

    connection.release();

    // ---- Fire-and-forget SMS, AFTER the connection is released, using pool ----
    if (approved.length > 0) {
      const time = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

      approved.forEach((a) => {
        const phone = guardianPhone || a.parent_contact;
        if (!phone) return;

        const nameParts = a.name.split(" ");
        const student = {
          id: a.student_id,
          first_name: nameParts[0],
          last_name: nameParts.slice(1).join(" "),
        };

        smsService
          .sendPickupDropoffSMS(student, action_type, time, guardianName, phone)
          .then((smsResult) =>
            pool.query(
              `INSERT INTO sms_logs
                 (student_id, phone_number, message, type, status, message_id, error_message, sent_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
              [
                a.student_id,
                phone,
                smsResult.sms_body,
                action_type === "Drop-off"
                  ? "dropoff_notification"
                  : "pickup_notification",
                smsResult.success ? "sent" : "failed",
                smsResult.messageId,
                smsResult.success ? null : smsResult.error,
              ],
            ),
          )
          .catch((err) =>
            console.error(
              `Background SMS failed for student ${a.student_id}:`,
              err,
            ),
          );
      });
    }

    res.json({
      found: true,
      blocked: false,
      scan_type: scanType,
      guardian_name: guardianName,
      approved: approved.map((a) => ({
        student_id: a.student_id,
        name: a.name,
      })),
      skipped: [
        ...alreadyDoneToday.map((s) => ({
          student_id: s.id,
          name: `${s.first_name} ${s.last_name}`,
          reason: "already_done_today",
        })),
        ...notPermitted.map((s) => ({
          student_id: s.id,
          name: `${s.first_name} ${s.last_name}`,
          reason: "not_authorized",
        })),
      ],
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {
      /* connection may already be released; ignore */
    }
    connection.release();
    console.error("Error in quick-scan:", error);
    res.status(500).json({ error: "Failed to process scan" });
  }
};

const getStudentAccessDetails = async (req, res) => {
  try {
    const { studentId } = req.params;

    const [students] = await pool.query(
      `SELECT s.id, s.first_name, s.last_name, s.admission_number,
              s.photo_filename, s.parent_contact, c.class_name
       FROM students s
       LEFT JOIN class_assignments ca ON s.id = ca.student_id
         AND ca.academic_year_id = (SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1)
       LEFT JOIN classes c ON ca.class_id = c.id
       WHERE s.id = ?`,
      [studentId],
    );

    if (students.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    // The student's own card, if one was enrolled directly for them
    // (separate from any guardian's card). Shows the most recent one
    // regardless of status, so staff can see a revoked/lost card here too,
    // not just an active one.
    const [ownCards] = await pool.query(
      `SELECT id, card_uid, status, issued_date
       FROM access_cards
       WHERE card_type = 'Student' AND student_id = ?
       ORDER BY id DESC LIMIT 1`,
      [studentId],
    );

    // Every guardian authorized for this student, each with their own
    // active card (if any) and their specific permissions for this student.
    const [guardians] = await pool.query(
      `SELECT
         ap.id, ap.first_name, ap.last_name, ap.relationship, ap.phone,
         ap.photo_filename, ap.is_active,
         sap.id as sap_id, sap.can_pickup, sap.can_dropoff, sap.is_primary_guardian,
         ac.card_uid, ac.status as card_status
       FROM student_authorized_persons sap
       INNER JOIN authorized_persons ap ON sap.authorized_person_id = ap.id
       LEFT JOIN access_cards ac
         ON ac.authorized_person_id = ap.id AND ac.status = 'Active'
       WHERE sap.student_id = ? AND ap.is_active = 1
       ORDER BY sap.is_primary_guardian DESC, ap.first_name`,
      [studentId],
    );

    res.json({
      student: students[0],
      own_card: ownCards[0] || null,
      guardians: guardians.map((g) => ({
        id: g.id,
        sap_id: g.sap_id,
        first_name: g.first_name,
        last_name: g.last_name,
        relationship: g.relationship,
        phone: g.phone,
        photo_filename: g.photo_filename,
        can_pickup: !!g.can_pickup,
        can_dropoff: !!g.can_dropoff,
        is_primary_guardian: !!g.is_primary_guardian,
        card_uid: g.card_uid || null,
        card_status: g.card_status || null,
      })),
    });
  } catch (error) {
    console.error("Error fetching student access details:", error);
    res.status(500).json({ error: "Failed to fetch student access details" });
  }
};

// ============================================================================
// pickupCardController.js — ADD: auto-link guardian from student form data
// ============================================================================
// POST /api/authorized-persons/auto-link-from-student
// body: {
//   student_id, first_name, last_name, phone,
//   relationship, can_pickup, can_dropoff, is_primary_guardian
// }
//
// Used by InlineCardEnrollStep right after a student's own card is enrolled:
// turns the parent_name/parent_contact already captured on the admission
// form into a real authorized_persons record, without staff re-typing it.
//
// Dedupes by phone number — if a guardian with this phone already exists
// (e.g. a sibling's parent, enrolled when an older child was registered),
// this LINKS to that existing record instead of creating a duplicate person.
// ============================================================================

const autoLinkGuardianFromStudent = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const {
      student_id,
      first_name,
      last_name,
      phone,
      relationship = "Parent/Guardian",
      can_pickup = true,
      can_dropoff = true,
      is_primary_guardian = true,
    } = req.body;

    if (!student_id || !first_name || !phone) {
      await connection.rollback();
      return res
        .status(400)
        .json({ error: "student_id, first_name, and phone are required" });
    }

    // ---- Find an existing guardian with this phone number first ----
    const [existingByPhone] = await connection.query(
      "SELECT id, first_name, last_name FROM authorized_persons WHERE phone = ? AND is_active = 1 LIMIT 1",
      [phone],
    );

    let personId;
    let created;

    if (existingByPhone.length > 0) {
      personId = existingByPhone[0].id;
      created = false;
    } else {
      const [insertResult] = await connection.query(
        `INSERT INTO authorized_persons (first_name, last_name, relationship, phone)
         VALUES (?, ?, ?, ?)`,
        [first_name, last_name || "", relationship, phone],
      );
      personId = insertResult.insertId;
      created = true;
    }

    // ---- Link to this student, if not already linked ----
    const [existingLink] = await connection.query(
      "SELECT id FROM student_authorized_persons WHERE student_id = ? AND authorized_person_id = ?",
      [student_id, personId],
    );

    let linked;
    if (existingLink.length === 0) {
      await connection.query(
        `INSERT INTO student_authorized_persons
           (student_id, authorized_person_id, can_pickup, can_dropoff, is_primary_guardian)
         VALUES (?, ?, ?, ?, ?)`,
        [student_id, personId, can_pickup, can_dropoff, is_primary_guardian],
      );
      linked = true;
    } else {
      linked = false; // already linked — nothing to do, not an error
    }

    await connection.commit();

    const [personRow] = await pool.query(
      "SELECT * FROM authorized_persons WHERE id = ?",
      [personId],
    );

    res.status(created ? 201 : 200).json({
      person: personRow[0],
      created,
      linked,
      message: created
        ? "New guardian created and linked."
        : linked
          ? "Existing guardian (matched by phone) linked to this student."
          : "This guardian was already linked to this student.",
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error auto-linking guardian from student form:", error);
    res.status(500).json({ error: "Failed to link guardian" });
  } finally {
    connection.release();
  }
};


const pinPickupLog = async (req, res) => {
  try {
    const { id } = req.params;
    const { pinned, pinned_by } = req.body;

    if (typeof pinned !== "boolean") {
      return res.status(400).json({ error: "pinned must be true or false" });
    }

    if (pinned && !pinned_by) {
      return res
        .status(400)
        .json({ error: "pinned_by is required when pinning" });
    }

    // ONE-AT-A-TIME (optional): uncomment to unpin everything else first,
    // so at most a single row is ever pinned.
    // if (pinned) {
    //   await pool.query(
    //     "UPDATE pickup_dropoff_log SET is_pinned = 0, pinned_at = NULL, pinned_by = NULL WHERE is_pinned = 1",
    //   );
    // }

    const [result] = pinned
      ? await pool.query(
          `UPDATE pickup_dropoff_log
           SET is_pinned = 1, pinned_at = NOW(), pinned_by = ?
           WHERE id = ?`,
          [pinned_by, id],
        )
      : await pool.query(
          `UPDATE pickup_dropoff_log
           SET is_pinned = 0, pinned_at = NULL, pinned_by = NULL
           WHERE id = ?`,
          [id],
        );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Log entry not found" });
    }

    res.json({ success: true, id: parseInt(id), is_pinned: pinned });
  } catch (error) {
    console.error("Error pinning pickup log entry:", error);
    res.status(500).json({ error: "Failed to update pin" });
  }
};

module.exports = {
  getAuthorizedPersonsForStudent,
  createAuthorizedPerson,
  linkAuthorizedPersonToStudent,
  linkBulkAuthorizedPersons,
  linkAuthorizedPersonToStudentsBulk,
  searchAuthorizedPersons,
  enrollCard,
  revokeCard,
  lookupCard,
  logPickupDropoff,
  getPickupLog,
  logPickupDropoffBulk,
  getCardDetails,
  searchStudentsForEnrollment,
  removeStudentAuthorizedPerson,
  sendBulkPickupDropoffSMS,
  quickScanCard,
  getStudentAccessDetails,
  autoLinkGuardianFromStudent,
  pinPickupLog,
};
