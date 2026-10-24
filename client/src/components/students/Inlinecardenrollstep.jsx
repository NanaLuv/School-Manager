import React, { useState, useRef, useEffect, useCallback } from "react";
import { CreditCardIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import api from "../../components/axiosconfig/axiosConfig";

const InlineCardEnrollStep = ({
  studentId,
  studentName,
  issuedBy,
  parentName,
  parentContact,
  onDone,
}) => {
  const [cardUid, setCardUid] = useState("");
  const [capturedUid, setCapturedUid] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [guardianStatus, setGuardianStatus] = useState(null); // null | 'linking' | 'done' | 'failed'
  const [guardianMessage, setGuardianMessage] = useState(null);
  const hiddenInputRef = useRef(null);

  const splitName = (fullName) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return { first_name: parts[0], last_name: "" };
    return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
  };

  const refocusInput = useCallback(() => {
    hiddenInputRef.current?.focus();
  }, []);

  useEffect(() => {
    refocusInput();
  }, [refocusInput]);

  const handleKeyDown = (e) => {
    if (e.key !== "Enter") return;
    const uid = cardUid.trim();
    setCardUid("");
    if (!uid) return;
    setCapturedUid(uid);
    setError(null);
  };

  const handleRetap = () => {
    setCapturedUid(null);
    setCardUid("");
    refocusInput();
  };

//   const handleSave = async () => {
//     if (!capturedUid) return;
//     setSaving(true);
//     setError(null);

//     try {
//       await api.post("/access-cards", {
//         card_uid: capturedUid,
//         card_type: "Student",
//         student_id: studentId,
//         issued_by: issuedBy,
//       });
//       setSuccess(true);
//       setTimeout(() => onDone?.(), 1500);
//     } catch (err) {
//       setError(err.response?.data?.error || "Failed to enroll card.");
//     } finally {
//       setSaving(false);
//     }
//   };

const handleSave = async () => {
  if (!capturedUid) return;
  setSaving(true);
  setError(null);

  try {
    await api.post("/access-cards", {
      card_uid: capturedUid,
      card_type: "Student",
      student_id: studentId,
      issued_by: issuedBy,
    });

    // Card enrolled successfully. Now, if the admission form captured a
    // parent name + phone, auto-link that guardian in the background —
    // this is additive: if it fails for some reason, the card itself is
    // still enrolled, so we don't block success on it, just surface a
    // separate status for it.
    if (parentName && parentContact) {
      setGuardianStatus("linking");
      try {
        const { first_name, last_name } = splitName(parentName);
        const linkResponse = await api.post(
          "/authorized-persons/auto-link-from-student",
          {
            student_id: studentId,
            first_name,
            last_name,
            phone: parentContact,
            relationship: "Parent/Guardian",
            can_pickup: true,
            can_dropoff: true,
            is_primary_guardian: true,
          },
        );
        setGuardianStatus("done");
        setGuardianMessage(linkResponse.data.message);
      } catch (guardianErr) {
        setGuardianStatus("failed");
        setGuardianMessage(
          guardianErr.response?.data?.error ||
            "Could not link guardian automatically.",
        );
      }
    }

    setSuccess(true);
    setTimeout(() => onDone?.(), guardianStatus === "failed" ? 3000 : 1800);
  } catch (err) {
    setError(err.response?.data?.error || "Failed to enroll card.");
  } finally {
    setSaving(false);
  }
};

if (success) {
  return (
    <div className="bg-green-50 border border-green-300 rounded-lg p-6 text-center">
      <CheckCircleIcon className="w-10 h-10 text-green-500 mx-auto mb-2" />
      <p className="text-green-800 font-medium">
        Card enrolled for {studentName}.
      </p>

      {guardianStatus === "linking" && (
        <p className="text-sm text-green-700 mt-2">Linking guardian…</p>
      )}
      {guardianStatus === "done" && (
        <p className="text-sm text-green-700 mt-2">{guardianMessage}</p>
      )}
      {guardianStatus === "failed" && (
        <p className="text-sm text-yellow-700 mt-2">
          {guardianMessage} You can add the guardian manually via Card Details.
        </p>
      )}
    </div>
  );
}

  return (
    <div className="bg-white rounded-lg shadow border p-5">
      <div className="flex items-center space-x-2 mb-4">
        <CreditCardIcon className="w-6 h-6 text-emerald-500" />
        <h3 className="font-medium text-gray-900">
          Enroll access card for {studentName}
        </h3>
      </div>

      <input
        ref={hiddenInputRef}
        type="text"
        value={cardUid}
        onChange={(e) => setCardUid(e.target.value)}
        onKeyDown={handleKeyDown}
        className="opacity-0 absolute -left-96 w-1 h-1"
        autoFocus
        aria-hidden="true"
      />

      <div
        className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-text"
        onClick={refocusInput}
      >
        {!capturedUid ? (
          <>
            <CreditCardIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">
              Tap the blank card on the reader now…
            </p>
          </>
        ) : (
          <>
            <CheckCircleIcon className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-gray-900 font-medium text-sm">Card detected</p>
            <p className="text-xs text-gray-400 font-mono mt-1">
              {capturedUid}
            </p>
            <button
              onClick={handleRetap}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Not this card — tap again
            </button>
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <div className="mt-5 flex space-x-3">
        <button
          onClick={() => onDone?.()}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Skip for now
        </button>
        <button
          onClick={handleSave}
          disabled={!capturedUid || saving}
          className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Enroll Card"}
        </button>
      </div>
    </div>
  );
};

export default InlineCardEnrollStep;

// ============================================================================
// INTEGRATION NOTES — how to wire this into your Add Student page
// ============================================================================
//
// Your backend's `createStudent` function returns the new student record as
// `newStudent[0]`, which includes `.id` — that's all this component needs.
//
// 1. Add two pieces of state to your AddStudent component:
//
//      const [createdStudent, setCreatedStudent] = useState(null);
//      const [showCardEnroll, setShowCardEnroll] = useState(false);
//
// 2. In your form's submit handler, wherever you currently do something
//    like `await api.post("/students", formData)` and then navigate away
//    or reset the form on success, change it to:
//
//      const response = await api.post("/students", formData);
//      setCreatedStudent(response.data);   // response.data IS newStudent[0]
//      setShowCardEnroll(true);
//      // don't navigate away yet — wait for InlineCardEnrollStep's onDone
//
// 3. Render the step conditionally, in place of (or below) your form:
//
//      {showCardEnroll && createdStudent && (
//        <InlineCardEnrollStep
//          studentId={createdStudent.id}
//          studentName={`${createdStudent.first_name} ${createdStudent.last_name}`}
//          issuedBy={currentUserId}
//          onDone={() => {
//            // now do whatever you previously did right after a successful
//            // save — reset the form, navigate to the student list, etc.
//            navigate("/students");
//          }}
//        />
//      )}
//
// That's the whole integration — no changes needed to your existing student
// creation logic itself, this only adds a step AFTER it succeeds.
