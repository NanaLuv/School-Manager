import React, { useState, useEffect, useCallback } from "react";
import {
  ChatBubbleLeftRightIcon,
  UserIcon,
  UsersIcon,
  AcademicCapIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import api from "../../components/axiosconfig/axiosConfig";
import { useAuth } from "../contexts/AuthContext";
// ============================================================================
// MessagingPage
// ----------------------------------------------------------------------------
// Four recipient modes: a single student's parent, all parents, a single
// teacher, or all teachers. Message supports {token} placeholders that get
// substituted per-recipient server-side (see messagingController.js) — the
// available tokens change depending on recipient type, shown as insertable
// chips above the textarea.
// ============================================================================

const RECIPIENT_MODES = [
  { key: "single_student", label: "One Student's Parent", icon: UserIcon },
  { key: "all_students", label: "All Parents", icon: UsersIcon },
  { key: "single_teacher", label: "One Teacher", icon: AcademicCapIcon },
  { key: "all_teachers", label: "All Teachers", icon: UsersIcon },
];

const TOKENS_BY_MODE = {
  single_student: [
    { token: "student_name", label: "Student Name" },
    { token: "parent_name", label: "Parent Name" },
    { token: "class_name", label: "Class" },
  ],
  all_students: [
    { token: "student_name", label: "Student Name" },
    { token: "parent_name", label: "Parent Name" },
    { token: "class_name", label: "Class" },
  ],
  single_teacher: [{ token: "teacher_name", label: "Teacher Name" }],
  all_teachers: [{ token: "teacher_name", label: "Teacher Name" }],
};

const MessagingPage = ({ currentUserId }) => {
  const [recipientMode, setRecipientMode] = useState("single_student");
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [teachers, setTeachers] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [error, setError] = useState(null);

  const { user } = useAuth();
  // Load teachers once (typically a small list — fine to fetch in full and
  // filter/select client-side rather than building a search endpoint for it)
  useEffect(() => {
    api
      .get("/getteachers")
      .then((res) => setTeachers(res.data || []))
      .catch((err) => console.error("Error fetching teachers:", err));
  }, []);

  // Student search (only relevant in single_student mode)
  useEffect(() => {
    if (recipientMode !== "single_student") return;
    const t = setTimeout(async () => {
      if (studentQuery.trim().length < 2) {
        setStudentResults([]);
        return;
      }
      try {
        const res = await api.get(
          `/students/search-for-enrollment?q=${encodeURIComponent(studentQuery)}`,
        );
        setStudentResults(res.data || []);
      } catch (err) {
        console.error("Error searching students:", err);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [studentQuery, recipientMode]);

  // Recipients preview (count + sample tokens) — refetches whenever the
  // recipient selection actually changes to something resolvable.
  const fetchPreview = useCallback(async () => {
    const params = new URLSearchParams({ recipient_type: recipientMode });
    if (recipientMode === "single_student" && selectedStudent) {
      params.set("student_id", selectedStudent.id);
    } else if (recipientMode === "single_teacher" && selectedTeacherId) {
      params.set("teacher_id", selectedTeacherId);
    } else if (
      recipientMode === "single_student" ||
      recipientMode === "single_teacher"
    ) {
      setPreview(null);
      return; // nothing selected yet for the single-recipient modes
    }

    setPreviewLoading(true);
    try {
      const res = await api.get(`/messaging/recipients-preview?${params}`);
      setPreview(res.data);
    } catch (err) {
      console.error("Error fetching recipients preview:", err);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [recipientMode, selectedStudent, selectedTeacherId]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  const resetRecipientSelection = (mode) => {
    setRecipientMode(mode);
    setSelectedStudent(null);
    setStudentQuery("");
    setStudentResults([]);
    setSelectedTeacherId("");
    setSendResult(null);
  };

  const insertToken = (token) => {
    setMessage((prev) => `${prev}{${token}}`);
  };

  const canSend =
    message.trim().length > 0 &&
    ((recipientMode === "single_student" && selectedStudent) ||
      (recipientMode === "single_teacher" && selectedTeacherId) ||
      recipientMode === "all_students" ||
      recipientMode === "all_teachers");

  const handleSend = async () => {
    if (!canSend) return;

    const recipientDescription =
      recipientMode === "single_student"
        ? `${selectedStudent.first_name} ${selectedStudent.last_name}'s parent`
        : recipientMode === "single_teacher"
          ? teachers.find((t) => t.id === parseInt(selectedTeacherId))
              ?.first_name +
            " " +
            teachers.find((t) => t.id === parseInt(selectedTeacherId))
              ?.last_name
          : recipientMode === "all_students"
            ? `all ${preview?.with_phone ?? "?"} parents with a phone on file`
            : `all ${preview?.with_phone ?? "?"} teachers with a phone on file`;

    if (!window.confirm(`Send this message to ${recipientDescription}?`))
      return;

    setSending(true);
    setError(null);
    setSendResult(null);

    try {
      const response = await api.post("/messaging/send", {
        recipient_type: recipientMode,
        student_id:
          recipientMode === "single_student" ? selectedStudent.id : undefined,
        teacher_id:
          recipientMode === "single_teacher" ? selectedTeacherId : undefined,
        message,
        sent_by: user?.id || 1, // use the authenticated user ID if available
      });

      setSendResult(response.data);
      if (response.data.sent > 0) {
        setMessage(""); // clear on at least partial success, keep it on total failure for editing
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const tokens = TOKENS_BY_MODE[recipientMode] || [];

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center space-x-2 mb-6">
        <ChatBubbleLeftRightIcon className="w-7 h-7 text-emerald-500" />
        <h1 className="text-xl font-bold text-gray-900">Send Message</h1>
      </div>

      {/* Recipient mode selector */}
      <div className="bg-white rounded-lg shadow border p-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Send to
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {RECIPIENT_MODES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => resetRecipientSelection(key)}
              className={`flex flex-col items-center justify-center space-y-1 px-3 py-3 rounded-md border-2 text-sm transition-colors ${
                recipientMode === key
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-medium"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-center">{label}</span>
            </button>
          ))}
        </div>

        {/* Single student picker */}
        {recipientMode === "single_student" && (
          <div className="mt-4">
            {selectedStudent ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-md p-3">
                <div>
                  <p className="font-medium text-gray-900">
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selectedStudent.admission_number} •{" "}
                    {selectedStudent.class_name}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    placeholder="Search student name or admission number..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {studentResults.length > 0 && (
                  <div className="mt-2 divide-y divide-gray-100 border border-gray-200 rounded-md overflow-hidden">
                    {studentResults.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedStudent(s);
                          setStudentQuery("");
                          setStudentResults([]);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50"
                      >
                        <p className="font-medium text-gray-900 text-sm">
                          {s.first_name} {s.last_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {s.admission_number} • {s.class_name}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Single teacher picker */}
        {recipientMode === "single_teacher" && (
          <div className="mt-4">
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select a teacher...</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.first_name} {t.last_name}
                  {t.specialization ? ` — ${t.specialization}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Recipient count preview */}
        {preview && (
          <div className="mt-4 bg-gray-50 rounded-md p-3 text-sm">
            <p className="text-gray-700">
              <strong>{preview.with_phone}</strong> recipient
              {preview.with_phone === 1 ? "" : "s"} will receive this
              {preview.without_phone > 0 && (
                <span className="text-yellow-600">
                  {" "}
                  ({preview.without_phone} skipped — no phone on file)
                </span>
              )}
            </p>
            {preview.sample_names?.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                e.g. {preview.sample_names.join(", ")}
                {preview.total > preview.sample_names.length && "…"}
              </p>
            )}
          </div>
        )}
        {previewLoading && (
          <p className="text-xs text-gray-400 mt-2">Checking recipients…</p>
        )}
      </div>

      {/* Message composer */}
      <div className="bg-white rounded-lg shadow border p-5 mt-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Message</label>
          <span
            className={`text-xs ${message.length > 160 ? "text-yellow-600" : "text-gray-400"}`}
          >
            {message.length} characters
            {message.length > 160 && " (will send as multiple SMS segments)"}
          </span>
        </div>

        {tokens.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {tokens.map(({ token, label }) => (
              <button
                key={token}
                onClick={() => insertToken(token)}
                className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full hover:bg-blue-100"
              >
                + {label}
              </button>
            ))}
          </div>
        )}

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder="Type your message. Use the buttons above to insert {student_name}, {parent_name}, etc."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />

        {message.includes("{") && preview?.sample_tokens && (
          <div className="mt-2 text-xs text-gray-400 border-t border-gray-100 pt-2">
            <strong>Preview for {preview.sample_names?.[0]}:</strong>{" "}
            {message.replace(
              /\{(\w+)\}/g,
              (m, key) => preview.sample_tokens[key] || m,
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <button
          onClick={handleSend}
          disabled={!canSend || sending}
          className="mt-4 w-full flex items-center justify-center space-x-2 bg-emerald-600 text-white py-2.5 rounded-md font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          <PaperAirplaneIcon className="w-4 h-4" />
          <span>{sending ? "Sending..." : "Send Message"}</span>
        </button>
      </div>

      {sendResult && (
        <div
          className={`mt-4 p-4 rounded-md text-sm ${
            sendResult.failed > 0 || sendResult.skipped_no_phone > 0
              ? "bg-yellow-50 border border-yellow-200 text-yellow-800"
              : "bg-green-50 border border-green-200 text-green-700"
          }`}
        >
          <p>
            <strong>{sendResult.sent}</strong> sent
            {sendResult.failed > 0 && `, ${sendResult.failed} failed`}
            {sendResult.skipped_no_phone > 0 &&
              `, ${sendResult.skipped_no_phone} skipped (no phone)`}{" "}
            out of {sendResult.total} recipient
            {sendResult.total === 1 ? "" : "s"}.
          </p>
        </div>
      )}
    </div>
  );
};

export default MessagingPage;
