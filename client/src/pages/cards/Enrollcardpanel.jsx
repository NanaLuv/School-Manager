import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  CreditCardIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import api from "../../components/axiosconfig/axiosConfig";

// ============================================================================
// EnrollCardPanel (v2 — multi-student selection)
// ----------------------------------------------------------------------------
// Change from v1: Step 1 is now a MULTI-select (chips) instead of picking one
// student. This matters because a guardian's card is often meant to cover
// several siblings at once — enrolling it once and linking all of them beats
// repeating the whole flow per child.
//
// "The Student" mode (a card belonging to the student themself, not a
// guardian) only makes sense for exactly ONE student, since a card can't
// represent multiple different students' own identities — that option is
// disabled whenever more than one student is selected.
// ============================================================================

const STEPS = { STUDENT: 1, PERSON: 2, CARD: 3 };

const EnrollCardPanel = ({ currentUserId }) => {
  const [step, setStep] = useState(STEPS.STUDENT);

  // Step 1 state — now a list of selected students, not a single one
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);

  // Step 2 state
  const [personMode, setPersonMode] = useState(null);
  const [personQuery, setPersonQuery] = useState("");
  const [personResults, setPersonResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [newPersonForm, setNewPersonForm] = useState({
    first_name: "",
    last_name: "",
    relationship: "Parent",
    phone: "",
    can_pickup: true,
    can_dropoff: true,
    is_primary_guardian: false,
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Step 3 state
  const [cardUid, setCardUid] = useState("");
  const [capturedUid, setCapturedUid] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const hiddenInputRef = useRef(null);

  const refocusInput = useCallback(() => {
    if (step === STEPS.CARD) hiddenInputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    refocusInput();
  }, [refocusInput, capturedUid]);

  // ---------------- Step 1: student search (multi-select) ----------------
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (studentQuery.trim().length < 2) {
        setStudentResults([]);
        return;
      }
      try {
        const res = await api.get(
          `/getstudents?includeInactive=false&search=${encodeURIComponent(studentQuery)}&limit=10`,
        );
        setStudentResults(res.data.students || []);
      } catch (err) {
        console.error("Error searching students:", err);
      }
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [studentQuery]);

  const addStudent = (student) => {
    setSelectedStudents((prev) => {
      if (prev.some((s) => s.id === student.id)) return prev;
      return [...prev, student];
    });
    setStudentQuery("");
    setStudentResults([]);
  };

  const removeStudent = (studentId) => {
    setSelectedStudents((prev) => prev.filter((s) => s.id !== studentId));
    if (personMode === "student") setPersonMode(null);
  };

  const proceedToPersonStep = () => {
    if (selectedStudents.length === 0) {
      setError("Select at least one student first.");
      return;
    }
    setError(null);
    setStep(STEPS.PERSON);
  };

  // ---------------- Step 2: person search (existing) - FIXED ----------------
  useEffect(() => {
    if (personMode !== "existing") {
      setPersonResults([]);
      setSearchLoading(false);
      return;
    }

    if (personQuery.trim().length < 2) {
      setPersonResults([]);
      setSearchLoading(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearchLoading(true);
      setError(null);
      try {
        console.log("🔍 Searching for:", personQuery);
        const res = await api.get(
          `/authorized-persons/search?q=${encodeURIComponent(personQuery)}`,
        );
        console.log("📥 Search results:", res.data);
        setPersonResults(res.data || []);

        if (res.data.length === 0) {
          setError(
            "No guardians found. Try a different name or use 'New Guardian'.",
          );
        }
      } catch (err) {
        console.error("❌ Error searching authorized persons:", err);
        console.error("❌ Response:", err.response?.data);
        setPersonResults([]);
        setError(
          err.response?.status === 404
            ? "Search endpoint not found. Please check backend routes."
            : err.response?.data?.error ||
                "Couldn't search guardians right now. Please try again.",
        );
      } finally {
        setSearchLoading(false);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [personQuery, personMode]);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const goToCardStep = () => {
    setError(null);
    if (personMode === "existing" && !selectedPerson) {
      setError("Select an existing person first.");
      return;
    }
    if (
      personMode === "new" &&
      (!newPersonForm.first_name.trim() || !newPersonForm.last_name.trim())
    ) {
      setError("First and last name are required.");
      return;
    }
    if (personMode === "student" && selectedStudents.length !== 1) {
      setError(
        "A student's own card can only be enrolled for exactly one student.",
      );
      return;
    }
    setStep(STEPS.CARD);
  };

  // ---------------- Step 3: card capture ----------------
  const handleCardKeyDown = (e) => {
    if (e.key !== "Enter") return;
    const uid = cardUid.trim();
    setCardUid("");
    if (!uid) return;
    setCapturedUid(uid);
    setError(null);
  };

  const handleRetapCard = () => {
    setCapturedUid(null);
    setCardUid("");
    refocusInput();
  };

  const handleSave = async () => {
    if (!capturedUid) return;
    setSaving(true);
    setError(null);

    try {
      let authorizedPersonId = null;
      const studentIds = selectedStudents.map((s) => s.id);

      if (personMode === "new") {
        const formData = new FormData();
        formData.append("first_name", newPersonForm.first_name);
        formData.append("last_name", newPersonForm.last_name);
        formData.append("relationship", newPersonForm.relationship);
        formData.append("phone", newPersonForm.phone);
        formData.append("student_ids", JSON.stringify(studentIds));
        formData.append("can_pickup", newPersonForm.can_pickup);
        formData.append("can_dropoff", newPersonForm.can_dropoff);
        formData.append(
          "is_primary_guardian",
          newPersonForm.is_primary_guardian,
        );
        if (photoFile) formData.append("photo", photoFile);

        const personRes = await api.post("/authorized-persons", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        authorizedPersonId = personRes.data.id;
      } else if (personMode === "existing") {
        await api.post(`/authorized-persons/${selectedPerson.id}/link-bulk`, {
          student_ids: studentIds,
          can_pickup: true,
          can_dropoff: true,
          is_primary_guardian: false,
        });
        authorizedPersonId = selectedPerson.id;
      }

      await api.post("/access-cards", {
        card_uid: capturedUid,
        card_type: personMode === "student" ? "Student" : "AuthorizedPerson",
        student_id:
          personMode === "student" ? selectedStudents[0].id : undefined,
        authorized_person_id:
          personMode === "student" ? undefined : authorizedPersonId,
        issued_by: currentUserId,
      });

      const holderName =
        personMode === "student"
          ? `${selectedStudents[0].first_name} ${selectedStudents[0].last_name}`
          : personMode === "existing"
            ? `${selectedPerson.first_name} ${selectedPerson.last_name}`
            : `${newPersonForm.first_name} ${newPersonForm.last_name}`;

      setSuccess(
        `Card enrolled for ${holderName} — covering ${studentIds.length} student${
          studentIds.length > 1 ? "s" : ""
        }.`,
      );

      setTimeout(resetAll, 2500);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to enroll card.");
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    setStep(STEPS.STUDENT);
    setSelectedStudents([]);
    setPersonMode(null);
    setSelectedPerson(null);
    setPersonQuery("");
    setPersonResults([]);
    setSearchLoading(false);
    setNewPersonForm({
      first_name: "",
      last_name: "",
      relationship: "Parent",
      phone: "",
      can_pickup: true,
      can_dropoff: true,
      is_primary_guardian: false,
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setCardUid("");
    setCapturedUid(null);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center space-x-2 mb-6">
        <CreditCardIcon className="w-7 h-7 text-emerald-500" />
        <h1 className="text-xl font-bold text-gray-900">Enroll Access Card</h1>
      </div>

      <StepIndicator step={step} />

      {success && (
        <div className="mt-6 bg-green-50 border border-green-300 rounded-lg p-6 text-center">
          <CheckCircleIcon className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-green-800 font-medium">{success}</p>
        </div>
      )}

      {/* ---------------- STEP 1: multi-select students ---------------- */}
      {!success && step === STEPS.STUDENT && (
        <div className="mt-6 bg-white rounded-lg shadow border p-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search for student(s) this card should cover
          </label>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="Name or admission number..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
          </div>

          {studentResults.length > 0 && (
            <div className="mt-3 divide-y divide-gray-100 border border-gray-200 rounded-md overflow-hidden">
              {studentResults.map((s) => {
                const alreadyAdded = selectedStudents.some(
                  (sel) => sel.id === s.id,
                );
                return (
                  <button
                    key={s.id}
                    onClick={() => addStudent(s)}
                    disabled={alreadyAdded}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {s.first_name} {s.last_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {s.admission_number} • {s.class_name || "No class"}
                      </p>
                    </div>
                    {alreadyAdded && (
                      <span className="text-xs text-emerald-600">Added</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {selectedStudents.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-500 mb-2">
                Selected ({selectedStudents.length}):
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedStudents.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-1.5 rounded-full"
                  >
                    <span>
                      {s.first_name} {s.last_name}
                    </span>
                    <button
                      onClick={() => removeStudent(s.id)}
                      className="hover:text-emerald-900"
                      aria-label={`Remove ${s.first_name}`}
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

          <button
            onClick={proceedToPersonStep}
            disabled={selectedStudents.length === 0}
            className="mt-5 w-full bg-emerald-600 text-white py-2.5 rounded-md font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue with {selectedStudents.length || 0} student
            {selectedStudents.length === 1 ? "" : "s"}
          </button>
        </div>
      )}

      {/* ---------------- STEP 2: who the card belongs to ---------------- */}
      {!success && step === STEPS.PERSON && selectedStudents.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow border p-5">
          <SelectedStudentsBanner
            students={selectedStudents}
            onChange={() => setStep(STEPS.STUDENT)}
          />

          <p className="text-sm font-medium text-gray-700 mt-4 mb-2">
            Who is this card for?
          </p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <ModeButton
              active={personMode === "student"}
              onClick={() =>
                selectedStudents.length === 1 && setPersonMode("student")
              }
              label="The Student"
              disabled={selectedStudents.length !== 1}
              disabledHint="Only for a single student"
            />
            <ModeButton
              active={personMode === "existing"}
              onClick={() => setPersonMode("existing")}
              label="Existing Guardian"
            />
            <ModeButton
              active={personMode === "new"}
              onClick={() => setPersonMode("new")}
              label="New Guardian"
            />
          </div>

          {/* ---------------- FIXED: Existing Person Search ---------------- */}
          {personMode === "existing" && (
            <div>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={personQuery}
                  onChange={(e) => setPersonQuery(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {searchLoading && (
                <p className="text-sm text-gray-400 mt-2 flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Searching...
                </p>
              )}

              {!searchLoading && error && (
                <p className="text-sm text-red-600 mt-2">{error}</p>
              )}

              {!searchLoading &&
                !error &&
                personQuery.trim().length >= 2 &&
                personResults.length === 0 && (
                  <p className="text-sm text-gray-400 mt-2">
                    No matching guardians found. Try a different name or use
                    "New Guardian" instead.
                  </p>
                )}

              {personResults.length > 0 && (
                <div className="mt-3 divide-y divide-gray-100 border border-gray-200 rounded-md overflow-hidden max-h-60 overflow-y-auto">
                  {personResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPerson(p)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between ${
                        selectedPerson?.id === p.id ? "bg-emerald-50" : ""
                      }`}
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {p.first_name} {p.last_name}{" "}
                          <span className="text-xs text-gray-400">
                            ({p.relationship})
                          </span>
                        </p>
                        <p className="text-xs text-gray-500">{p.phone}</p>
                        {p.student_count > 0 && (
                          <p className="text-xs text-emerald-600 mt-0.5">
                            Linked to {p.student_count} student
                            {p.student_count > 1 ? "s" : ""}
                          </p>
                        )}
                        {p.card_uid && (
                          <p className="text-xs text-amber-600 mt-0.5">
                            Already has an active card
                          </p>
                        )}
                      </div>
                      {selectedPerson?.id === p.id && (
                        <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {personMode === "new" && (
            <NewPersonForm
              form={newPersonForm}
              setForm={setNewPersonForm}
              photoPreview={photoPreview}
              onPhotoChange={handlePhotoChange}
            />
          )}

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

          {personMode && (
            <button
              onClick={goToCardStep}
              className="mt-5 w-full bg-emerald-600 text-white py-2.5 rounded-md font-medium hover:bg-emerald-700"
            >
              Continue to Card Tap
            </button>
          )}
        </div>
      )}

      {/* ---------------- STEP 3: tap card ---------------- */}
      {!success && step === STEPS.CARD && selectedStudents.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow border p-5">
          <SelectedStudentsBanner
            students={selectedStudents}
            onChange={() => setStep(STEPS.STUDENT)}
          />

          <input
            ref={hiddenInputRef}
            type="text"
            value={cardUid}
            onChange={(e) => setCardUid(e.target.value)}
            onKeyDown={handleCardKeyDown}
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
                {cardUid || <span className="text-gray-300">—</span>}
              </p>
            </div>
          </div>

          <div
            className="mt-6 text-center py-10 border-2 border-dashed border-gray-300 rounded-lg cursor-text"
            onClick={refocusInput}
          >
            {!capturedUid ? (
              <>
                <CreditCardIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">
                  Tap the blank card on the reader now…
                </p>
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <p className="text-gray-900 font-medium">Card detected</p>
                <p className="text-xs text-gray-400 font-mono mt-1">
                  {capturedUid}
                </p>
                <button
                  onClick={handleRetapCard}
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
              onClick={() => setStep(STEPS.PERSON)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={!capturedUid || saving}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Card"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Sub-components
// ============================================================================

const StepIndicator = ({ step }) => (
  <div className="flex items-center space-x-2 text-sm">
    {["Student(s)", "Card Holder", "Tap Card"].map((label, i) => {
      const num = i + 1;
      const active = step === num;
      const done = step > num;
      return (
        <React.Fragment key={label}>
          {i > 0 && <div className="w-6 h-px bg-gray-300" />}
          <div
            className={`flex items-center space-x-1 px-2 py-1 rounded-full ${
              active
                ? "bg-emerald-100 text-emerald-700 font-medium"
                : done
                  ? "text-emerald-600"
                  : "text-gray-400"
            }`}
          >
            {done ? (
              <CheckCircleIcon className="w-4 h-4" />
            ) : (
              <span>{num}.</span>
            )}
            <span>{label}</span>
          </div>
        </React.Fragment>
      );
    })}
  </div>
);

const SelectedStudentsBanner = ({ students, onChange }) => (
  <div className="bg-gray-50 rounded-md p-3">
    <div className="flex items-center justify-between mb-1">
      <p className="text-xs font-medium text-gray-500">
        {students.length} student{students.length > 1 ? "s" : ""} selected
      </p>
      <button
        onClick={onChange}
        className="text-xs text-blue-600 hover:underline"
      >
        Change
      </button>
    </div>
    <div className="space-y-1.5">
      {students.map((s) => (
        <div key={s.id} className="flex items-center space-x-2">
          <UserIcon className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900">
              {s.first_name} {s.last_name}
            </p>
            <p className="text-xs text-gray-500">
              {s.admission_number} • {s.class_name || "No class"}
            </p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ModeButton = ({
  active,
  onClick,
  label,
  disabled = false,
  disabledHint,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={disabled ? disabledHint : undefined}
    className={`px-3 py-2 text-sm rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      active
        ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-medium"
        : "border-gray-200 text-gray-600 hover:border-gray-300"
    }`}
  >
    {label}
  </button>
);

const NewPersonForm = ({ form, setForm, photoPreview, onPhotoChange }) => (
  <div className="space-y-3 mt-2">
    <div className="grid grid-cols-2 gap-3">
      <input
        type="text"
        placeholder="First name"
        value={form.first_name}
        onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      <input
        type="text"
        placeholder="Last name"
        value={form.last_name}
        onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <select
        value={form.relationship}
        onChange={(e) =>
          setForm((f) => ({ ...f, relationship: e.target.value }))
        }
        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <option>Parent</option>
        <option>Guardian</option>
        <option>Sibling</option>
        <option>Other</option>
      </select>
      <input
        type="text"
        placeholder="Phone number"
        value={form.phone}
        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>

    <div>
      <label className="block text-sm text-gray-600 mb-1">
        Photo (shown to staff at scan time)
      </label>
      <div className="flex items-center space-x-3">
        {photoPreview ? (
          <img
            src={photoPreview}
            alt=""
            className="w-14 h-14 rounded-full object-cover border"
          />
        ) : (
          <UserIcon className="w-14 h-14 text-gray-300" />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={onPhotoChange}
          className="text-sm"
        />
      </div>
    </div>

    <div className="flex items-center space-x-4 pt-1">
      <label className="flex items-center space-x-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.can_pickup}
          onChange={(e) =>
            setForm((f) => ({ ...f, can_pickup: e.target.checked }))
          }
        />
        <span>Can pick up</span>
      </label>
      <label className="flex items-center space-x-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.can_dropoff}
          onChange={(e) =>
            setForm((f) => ({ ...f, can_dropoff: e.target.checked }))
          }
        />
        <span>Can drop off</span>
      </label>
      <label className="flex items-center space-x-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.is_primary_guardian}
          onChange={(e) =>
            setForm((f) => ({ ...f, is_primary_guardian: e.target.checked }))
          }
        />
        <span>Primary guardian</span>
      </label>
    </div>
  </div>
);

export default EnrollCardPanel;
