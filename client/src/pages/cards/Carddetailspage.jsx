import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  CreditCardIcon,
  UserIcon,
  UserPlusIcon,
  TrashIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import api from "../../components/axiosconfig/axiosConfig";

// ============================================================================
// CardDetailsPage
// ----------------------------------------------------------------------------
// Tap a card -> see everything about it -> manage it:
//   - add/remove students linked to this card's guardian (AuthorizedPerson
//     cards only — a Student card always represents exactly one student)
//   - add/remove OTHER guardians for ALL linked students at once
//   - revoke the card
//
// Uses the same hidden-input tap-to-capture trick as the Scan and Enroll
// screens, so it works as its own standalone kiosk view.
// ============================================================================

const CardDetailsPage = ({ currentUserId }) => {
  const [scanInput, setScanInput] = useState("");
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const hiddenInputRef = useRef(null);
  const refocusInput = useCallback(() => hiddenInputRef.current?.focus(), []);

  const handleBackgroundClick = (e) => {
    const interactiveEl = e.target.closest(
      "input, textarea, select, button, a, [role='button']",
    );
    if (interactiveEl) return;
    refocusInput();
  };

  useEffect(() => {
    const handleWindowFocus = () => {
      const active = document.activeElement;
      const isEditingVisibleInput =
        active &&
        active !== hiddenInputRef.current &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);

      if (!isEditingVisibleInput) refocusInput();
    };

    handleWindowFocus();
    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, [refocusInput]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const loadCard = async (uid) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/access-cards/details/${uid}`);
      setDetails(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Card not found.");
      setDetails(null);
    } finally {
      setLoading(false);
      refocusInput();
    }
  };

  const handleScanKeyDown = (e) => {
    if (e.key !== "Enter") return;
    const uid = scanInput.trim();
    setScanInput("");
    if (uid) loadCard(uid);
  };

  const refresh = () => {
    if (details) loadCard(details.card.card_uid);
  };

  const resetToScan = () => {
    setDetails(null);
    setError(null);
    refocusInput();
  };

  return (
    <div className="max-w-3xl mx-auto p-6" onClick={handleBackgroundClick}>
      <input
        ref={hiddenInputRef}
        type="text"
        value={scanInput}
        onChange={(e) => setScanInput(e.target.value)}
        onKeyDown={handleScanKeyDown}
        className="opacity-0 absolute -left-96 w-1 h-1"
        autoFocus
        aria-hidden="true"
      />

      {/* Visible mirror of the hidden scan input — read-only display */}
      <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
        <div className="bg-white border-2 text-xl font-extrabold border-emerald-500 rounded-lg shadow-lg px-4 py-2 min-w-[120px]">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
            Card no:
          </p>
          <p className="font-mono text-lg text-gray-900 break-all min-h-[1.75rem]">
            {scanInput || <span className="text-gray-300">—</span>}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 mb-6">
        <CreditCardIcon className="w-7 h-7 text-emerald-500" />
        <h1 className="text-xl font-bold text-gray-900">Card Details</h1>
      </div>

      {toast && (
        <div className="mb-4 bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm rounded-md px-4 py-2 flex items-center space-x-2">
          <CheckCircleIcon className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {!details && !loading && (
        <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-lg">
          <CreditCardIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">Tap a card to view its details…</p>
          {error && (
            <p className="text-red-600 text-sm mt-3 flex items-center justify-center space-x-1">
              <ExclamationTriangleIcon className="w-4 h-4" />
              <span>{error}</span>
            </p>
          )}
        </div>
      )}

      {loading && (
        <div className="text-center py-16 text-gray-500">Loading…</div>
      )}

      {details && !loading && (
        <div className="space-y-5">
          <CardInfoPanel
            details={details}
            currentUserId={currentUserId}
            onRevoked={() => {
              setToast("Card revoked.");
              refresh();
            }}
            onScanAnother={resetToScan}
          />

          {details.card.status === "Active" &&
            details.card_holder_type === "AuthorizedPerson" && (
              <LinkedStudentsPanel
                details={details}
                onChange={(msg) => {
                  setToast(msg);
                  refresh();
                }}
              />
            )}

          {details.card.status === "Active" &&
            details.card_holder_type === "AuthorizedPerson" && (
              <BulkGuardiansPanel
                students={details.linked_students}
                existingGuardians={details.other_guardians_by_student}
                onChange={(msg) => {
                  setToast(msg);
                  refresh();
                }}
              />
            )}

          {details.card.status === "Active" &&
            details.card_holder_type === "Student" && (
              <SingleStudentGuardiansPanel
                student={{
                  student_id: details.student.id,
                  first_name: details.student.first_name,
                  last_name: details.student.last_name,
                }}
                guardians={details.guardians}
                onChange={(msg) => {
                  setToast(msg);
                  refresh();
                }}
              />
            )}
        </div>
      )}
    </div>
  );
};

// ----------------------------------------------------------------------
// Card + holder summary, with the Revoke action
// ----------------------------------------------------------------------
const CardInfoPanel = ({ details, onRevoked, onScanAnother }) => {
  const { card, card_holder_type } = details;
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const holderName =
    card_holder_type === "Student"
      ? `${details.student.first_name} ${details.student.last_name}`
      : `${details.person.first_name} ${details.person.last_name}`;

  const handleRevoke = async (status) => {
    setRevoking(true);
    try {
      await api.put(`/access-cards/${card.id}/revoke`, { status });
      onRevoked();
      setConfirmRevoke(false);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to revoke card.");
    } finally {
      setRevoking(false);
    }
  };

  const statusColor =
    card.status === "Active"
      ? "bg-emerald-100 text-emerald-700"
      : card.status === "Lost"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700";

  const holderPhoto =
    card_holder_type === "Student"
      ? details.student.photo_filename
      : details.person.photo_filename;

  return (
    <div className="bg-white rounded-lg shadow border p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          {holderPhoto ? (
            <img
              src={`/uploads/${
                card_holder_type === "Student"
                  ? "students"
                  : "authorized-persons"
              }/${holderPhoto}`}
              alt=""
              className="w-14 h-14 rounded-full object-cover border"
            />
          ) : (
            <UserIcon className="w-14 h-14 text-gray-300" />
          )}
          <div>
            <p className="font-semibold text-gray-900">
              {holderName}{" "}
              <span className="text-xs text-gray-400">
                (
                {card_holder_type === "Student"
                  ? "Student's own card"
                  : details.person.relationship}
                )
              </span>
            </p>
            <p className="text-xs text-gray-500 font-mono mt-0.5">
              UID: {card.card_uid}
            </p>
            {card.issued_date && (
              <p className="text-xs text-gray-400">
                Issued {new Date(card.issued_date).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor}`}
        >
          {card.status}
        </span>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
        <button
          onClick={onScanAnother}
          className="text-sm text-blue-600 hover:underline"
        >
          Scan a different card
        </button>

        {card.status === "Active" && !confirmRevoke && (
          <button
            onClick={() => setConfirmRevoke(true)}
            className="flex items-center space-x-1.5 text-sm text-red-600 hover:text-red-700"
          >
            <NoSymbolIcon className="w-4 h-4" />
            <span>Revoke Card</span>
          </button>
        )}

        {confirmRevoke && (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">Mark as:</span>
            <button
              onClick={() => handleRevoke("Lost")}
              disabled={revoking}
              className="text-xs px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 disabled:opacity-50"
            >
              Lost
            </button>
            <button
              onClick={() => handleRevoke("Revoked")}
              disabled={revoking}
              className="text-xs px-2.5 py-1 bg-red-100 text-red-800 rounded-md hover:bg-red-200 disabled:opacity-50"
            >
              Revoked
            </button>
            <button
              onClick={() => setConfirmRevoke(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// Linked students: add / remove students covered by this card's person
// ----------------------------------------------------------------------
const LinkedStudentsPanel = ({ details, onChange }) => {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      try {
        const res = await api.get(
          `/students/search-for-enrollment?q=${encodeURIComponent(query)}`,
        );
        const linkedIds = new Set(
          details.linked_students.map((s) => s.student_id),
        );
        setResults(res.data.filter((s) => !linkedIds.has(s.id)));
      } catch (err) {
        console.error("Error searching students:", err);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, details.linked_students]);

  const addStudent = async (studentId) => {
    setBusyId(studentId);
    try {
      await api.post(
        `/authorized-persons/${details.person.id}/link/${studentId}`,
      );
      setQuery("");
      setResults([]);
      setAdding(false);
      onChange("Student added to this card.");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to add student.");
    } finally {
      setBusyId(null);
    }
  };

  const removeStudent = async (linkId, name) => {
    if (
      !window.confirm(
        `Remove ${name} from this card? This does not delete the student.`,
      )
    )
      return;
    setBusyId(linkId);
    try {
      await api.delete(`/student-authorized-persons/${linkId}`);
      onChange(`${name} removed from this card.`);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to remove student.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow border p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium text-gray-900">
          Students on this card ({details.linked_students.length})
        </h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center space-x-1 text-sm text-emerald-600 hover:text-emerald-700"
        >
          <UserPlusIcon className="w-4 h-4" />
          <span>Add Student</span>
        </button>
      </div>

      {adding && (
        <div className="mb-4 bg-gray-50 rounded-md p-3">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search student by name or admission number..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
          </div>
          {results.length > 0 && (
            <div className="mt-2 divide-y divide-gray-100 border border-gray-200 rounded-md overflow-hidden bg-white">
              {results.map((s) => (
                <button
                  key={s.id}
                  onClick={() => addStudent(s.id)}
                  disabled={busyId === s.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between disabled:opacity-50"
                >
                  <span>
                    {s.first_name} {s.last_name}{" "}
                    <span className="text-xs text-gray-400">
                      ({s.admission_number})
                    </span>
                  </span>
                  {busyId === s.id ? "Adding…" : "Add"}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {details.linked_students.map((s) => (
          <div
            key={s.link_id}
            className="flex items-center justify-between p-3 border border-gray-100 rounded-md"
          >
            <div className="flex items-center space-x-2">
              <UserIcon className="w-6 h-6 text-gray-300" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {s.first_name} {s.last_name}
                  {s.is_primary_guardian ? (
                    <span className="ml-2 text-xs text-emerald-600">
                      Primary
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-gray-500">
                  {s.admission_number} • {s.class_name || "No class"} •{" "}
                  {s.can_pickup ? "Pickup ✓" : "Pickup ✗"} /{" "}
                  {s.can_dropoff ? "Drop-off ✓" : "Drop-off ✗"}
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                removeStudent(s.link_id, `${s.first_name} ${s.last_name}`)
              }
              disabled={busyId === s.link_id}
              className="text-red-400 hover:text-red-600 disabled:opacity-50"
              title="Remove from this card"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
        {details.linked_students.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">
            No students linked to this card yet.
          </p>
        )}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// Bulk Guardians for all students on this card
// ----------------------------------------------------------------------
const BulkGuardiansPanel = ({ students, existingGuardians, onChange }) => {
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState("existing");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [newForm, setNewForm] = useState({
    first_name: "",
    last_name: "",
    relationship: "Parent",
    phone: "",
  });
  const [busy, setBusy] = useState(false);

  // Build a deduplicated list of all guardians across all students
  // Keep track of ALL link_ids for each guardian
  const allGuardians = {};

  students.forEach((student) => {
    const guardians = existingGuardians[student.student_id] || [];
    guardians.forEach((guardian) => {
      if (!allGuardians[guardian.person_id]) {
        allGuardians[guardian.person_id] = {
          ...guardian,
          link_ids: [], // Array to hold all link IDs
          linked_student_names: [],
        };
      }
      allGuardians[guardian.person_id].link_ids.push(guardian.link_id);
      allGuardians[guardian.person_id].linked_student_names.push(
        student.first_name,
      );
    });
  });

  const guardianList = Object.values(allGuardians);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (mode !== "existing" || query.trim().length < 2) {
        setResults([]);
        return;
      }
      try {
        const res = await api.get(
          `/authorized-persons/search?q=${encodeURIComponent(query)}`,
        );
        const linkedIds = new Set(Object.keys(allGuardians));
        setResults(res.data.filter((p) => !linkedIds.has(String(p.id))));
      } catch (err) {
        console.error("Error searching guardians:", err);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, mode, existingGuardians]);

  const addExisting = async (personId, name) => {
    setBusy(true);
    try {
      const studentIds = students.map((s) => s.student_id);
      await api.post(`/authorized-persons/${personId}/link-bulk`, {
        student_ids: studentIds,
      });
      resetAddForm();
      onChange(`${name} added as a guardian for all students on this card.`);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to add guardian.");
    } finally {
      setBusy(false);
    }
  };

  const addNew = async () => {
    if (!newForm.first_name.trim() || !newForm.last_name.trim()) {
      alert("First and last name are required.");
      return;
    }
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("first_name", newForm.first_name);
      formData.append("last_name", newForm.last_name);
      formData.append("relationship", newForm.relationship);
      formData.append("phone", newForm.phone);
      formData.append(
        "student_ids",
        JSON.stringify(students.map((s) => s.student_id)),
      );

      await api.post("/authorized-persons", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      resetAddForm();
      onChange(
        `${newForm.first_name} ${newForm.last_name} added as a guardian for all students.`,
      );
    } catch (err) {
      alert(err.response?.data?.error || "Failed to add guardian.");
    } finally {
      setBusy(false);
    }
  };

  const removeGuardian = async (personId, linkIds, name) => {
    const studentNames = allGuardians[personId].linked_student_names.join(", ");
    if (!window.confirm(`Remove ${name} as guardian from: ${studentNames}?`))
      return;

    setBusy(true);
    try {
      // Delete ALL links for this guardian in parallel
      await Promise.all(
        linkIds.map((linkId) =>
          api.delete(`/student-authorized-persons/${linkId}`),
        ),
      );
      onChange(`${name} removed as guardian from all students.`);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to remove guardian.");
    } finally {
      setBusy(false);
    }
  };

  const resetAddForm = () => {
    setAdding(false);
    setQuery("");
    setResults([]);
    setNewForm({
      first_name: "",
      last_name: "",
      relationship: "Parent",
      phone: "",
    });
  };

  return (
    <div className="bg-white rounded-lg shadow border p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium text-gray-900">
          Other Guardians on this card ({guardianList.length})
        </h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center space-x-1 text-sm text-emerald-600 hover:text-emerald-700"
        >
          <UserPlusIcon className="w-4 h-4" />
          <span>Add Guardian</span>
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Adding a guardian here links them to all {students.length} student
        {students.length > 1 ? "s" : ""} on this card.
      </p>

      {adding && (
        <div className="mb-4 bg-gray-50 rounded-md p-3">
          <div className="flex space-x-2 mb-3">
            <button
              onClick={() => setMode("existing")}
              className={`text-xs px-3 py-1.5 rounded-md ${
                mode === "existing"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-white border border-gray-200 text-gray-600"
              }`}
            >
              Existing Person
            </button>
            <button
              onClick={() => setMode("new")}
              className={`text-xs px-3 py-1.5 rounded-md ${
                mode === "new"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-white border border-gray-200 text-gray-600"
              }`}
            >
              New Person
            </button>
            <button
              onClick={resetAddForm}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {mode === "existing" && (
            <>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>
              {query.trim().length >= 2 && results.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">No matches found.</p>
              )}
              {results.length > 0 && (
                <div className="mt-2 divide-y divide-gray-100 border border-gray-200 rounded-md overflow-hidden bg-white">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() =>
                        addExisting(p.id, `${p.first_name} ${p.last_name}`)
                      }
                      disabled={busy}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      {p.first_name} {p.last_name}{" "}
                      <span className="text-xs text-gray-400">
                        ({p.relationship})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {mode === "new" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="First name"
                  value={newForm.first_name}
                  onChange={(e) =>
                    setNewForm((f) => ({ ...f, first_name: e.target.value }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  placeholder="Last name"
                  value={newForm.last_name}
                  onChange={(e) =>
                    setNewForm((f) => ({ ...f, last_name: e.target.value }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newForm.relationship}
                  onChange={(e) =>
                    setNewForm((f) => ({ ...f, relationship: e.target.value }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option>Parent</option>
                  <option>Guardian</option>
                  <option>Sibling</option>
                  <option>Other</option>
                </select>
                <input
                  placeholder="Phone"
                  value={newForm.phone}
                  onChange={(e) =>
                    setNewForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <button
                onClick={addNew}
                disabled={busy}
                className="w-full bg-emerald-600 text-white text-sm py-2 rounded-md hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "Adding…" : "Add Guardian"}
              </button>
              <p className="text-xs text-gray-400">
                Note: this person won't have a card yet — enroll one separately
                from the Enroll Card screen if needed.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {guardianList.map((g) => (
          <div
            key={g.person_id}
            className="flex items-center justify-between p-3 border border-gray-100 rounded-md"
          >
            <div className="flex items-center space-x-2">
              <UserIcon className="w-6 h-6 text-gray-300" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {g.first_name} {g.last_name}{" "}
                  <span className="text-xs text-gray-400">
                    ({g.relationship})
                  </span>
                </p>
                <p className="text-xs text-gray-500">
                  {g.phone} •{" "}
                  {g.card_uid ? (
                    <span className="text-emerald-600">Has active card</span>
                  ) : (
                    <span className="text-amber-600">No card enrolled</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Linked to: {g.linked_student_names.join(", ")}
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                removeGuardian(
                  g.person_id,
                  g.link_ids,
                  `${g.first_name} ${g.last_name}`,
                )
              }
              disabled={busy}
              className="text-red-400 hover:text-red-600 disabled:opacity-50"
              title="Remove as guardian from all students"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
        {guardianList.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">
            No other guardians linked yet.
          </p>
        )}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// Single student guardians (for when a Student card is scanned)
// ----------------------------------------------------------------------
const SingleStudentGuardiansPanel = ({ student, guardians, onChange }) => {
  // This is the same as the old GuardiansPanel but for a single student
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState("existing");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [newForm, setNewForm] = useState({
    first_name: "",
    last_name: "",
    relationship: "Parent",
    phone: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (mode !== "existing" || query.trim().length < 2) {
        setResults([]);
        return;
      }
      try {
        const res = await api.get(
          `/authorized-persons/search?q=${encodeURIComponent(query)}`,
        );
        const linkedIds = new Set(guardians.map((g) => g.person_id));
        setResults(res.data.filter((p) => !linkedIds.has(p.id)));
      } catch (err) {
        console.error("Error searching guardians:", err);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, mode, guardians]);

  const addExisting = async (personId, name) => {
    setBusy(true);
    try {
      await api.post(
        `/authorized-persons/${personId}/link/${student.student_id}`,
      );
      resetAddForm();
      onChange(`${name} added as a guardian for ${student.first_name}.`);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to add guardian.");
    } finally {
      setBusy(false);
    }
  };

  const addNew = async () => {
    if (!newForm.first_name.trim() || !newForm.last_name.trim()) {
      alert("First and last name are required.");
      return;
    }
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("first_name", newForm.first_name);
      formData.append("last_name", newForm.last_name);
      formData.append("relationship", newForm.relationship);
      formData.append("phone", newForm.phone);
      formData.append("student_id", student.student_id);

      await api.post("/authorized-persons", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      resetAddForm();
      onChange(
        `${newForm.first_name} ${newForm.last_name} added as a new guardian.`,
      );
    } catch (err) {
      alert(err.response?.data?.error || "Failed to add guardian.");
    } finally {
      setBusy(false);
    }
  };

  const removeGuardian = async (linkId, name) => {
    if (
      !window.confirm(`Remove ${name} as a guardian for ${student.first_name}?`)
    )
      return;
    setBusy(true);
    try {
      await api.delete(`/student-authorized-persons/${linkId}`);
      onChange(`${name} removed as a guardian for ${student.first_name}.`);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to remove guardian.");
    } finally {
      setBusy(false);
    }
  };

  const resetAddForm = () => {
    setAdding(false);
    setQuery("");
    setResults([]);
    setNewForm({
      first_name: "",
      last_name: "",
      relationship: "Parent",
      phone: "",
    });
  };

  return (
    <div className="bg-white rounded-lg shadow border p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium text-gray-900">
          Guardians for {student.first_name} ({guardians.length})
        </h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center space-x-1 text-sm text-emerald-600 hover:text-emerald-700"
        >
          <UserPlusIcon className="w-4 h-4" />
          <span>Add Guardian</span>
        </button>
      </div>

      {adding && (
        <div className="mb-4 bg-gray-50 rounded-md p-3">
          <div className="flex space-x-2 mb-3">
            <button
              onClick={() => setMode("existing")}
              className={`text-xs px-3 py-1.5 rounded-md ${
                mode === "existing"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-white border border-gray-200 text-gray-600"
              }`}
            >
              Existing Person
            </button>
            <button
              onClick={() => setMode("new")}
              className={`text-xs px-3 py-1.5 rounded-md ${
                mode === "new"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-white border border-gray-200 text-gray-600"
              }`}
            >
              New Person
            </button>
            <button
              onClick={resetAddForm}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {mode === "existing" && (
            <>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>
              {query.trim().length >= 2 && results.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">No matches found.</p>
              )}
              {results.length > 0 && (
                <div className="mt-2 divide-y divide-gray-100 border border-gray-200 rounded-md overflow-hidden bg-white">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() =>
                        addExisting(p.id, `${p.first_name} ${p.last_name}`)
                      }
                      disabled={busy}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      {p.first_name} {p.last_name}{" "}
                      <span className="text-xs text-gray-400">
                        ({p.relationship})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {mode === "new" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="First name"
                  value={newForm.first_name}
                  onChange={(e) =>
                    setNewForm((f) => ({ ...f, first_name: e.target.value }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  placeholder="Last name"
                  value={newForm.last_name}
                  onChange={(e) =>
                    setNewForm((f) => ({ ...f, last_name: e.target.value }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newForm.relationship}
                  onChange={(e) =>
                    setNewForm((f) => ({ ...f, relationship: e.target.value }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option>Parent</option>
                  <option>Guardian</option>
                  <option>Sibling</option>
                  <option>Other</option>
                </select>
                <input
                  placeholder="Phone"
                  value={newForm.phone}
                  onChange={(e) =>
                    setNewForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <button
                onClick={addNew}
                disabled={busy}
                className="w-full bg-emerald-600 text-white text-sm py-2 rounded-md hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "Adding…" : "Add Guardian"}
              </button>
              <p className="text-xs text-gray-400">
                Note: this person won't have a card yet — enroll one separately
                from the Enroll Card screen if needed.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {guardians.map((g) => (
          <div
            key={g.link_id}
            className="flex items-center justify-between p-3 border border-gray-100 rounded-md"
          >
            <div className="flex items-center space-x-2">
              <UserIcon className="w-6 h-6 text-gray-300" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {g.first_name} {g.last_name}{" "}
                  <span className="text-xs text-gray-400">
                    ({g.relationship})
                  </span>
                </p>
                <p className="text-xs text-gray-500">
                  {g.phone} •{" "}
                  {g.card_uid ? (
                    <span className="text-emerald-600">Has active card</span>
                  ) : (
                    <span className="text-amber-600">No card enrolled</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                removeGuardian(g.link_id, `${g.first_name} ${g.last_name}`)
              }
              disabled={busy}
              className="text-red-400 hover:text-red-600 disabled:opacity-50"
              title="Remove as guardian"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
        {guardians.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">
            No other guardians linked yet.
          </p>
        )}
      </div>
    </div>
  );
};

export default CardDetailsPage;
