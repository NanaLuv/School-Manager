import React, { useState, useEffect, useMemo } from "react";
import {
  CheckIcon,
  UserGroupIcon,
  UsersIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";
import PromotionPreviewModal from "./Promotionpreviewmodal";

const BulkClassAssignmentForm = ({
  students,
  classes,
  academicYears,
  onSave,
  onCancel,
}) => {
  // "individual" = pick students one by one (existing behaviour)
  // "class"      = pick a source class → all its students auto-select
  const [mode, setMode] = useState("individual");

  const [formData, setFormData] = useState({
    student_ids: [],
    class_id: "",
    academic_year_id: "",
    promotion_status: "Pending",
  });

  const [errors, setErrors] = useState({});
  const [availableStudents, setAvailableStudents] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Source class + source academic year for "class" mode
  const [sourceClassId, setSourceClassId] = useState("");
  const [sourceAcademicYearId, setSourceAcademicYearId] = useState("");

  // Preview modal state
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Default TARGET academic year = current one
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (academicYears.length > 0) {
      const currentYear = academicYears.find((year) => year.is_current);
      if (currentYear) {
        setFormData((prev) => ({
          ...prev,
          academic_year_id: currentYear.id,
        }));
      }
    }
  }, [academicYears]);

  // ---------------------------------------------------------------------------
  // Default SOURCE academic year = most recent past year (for class mode)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (academicYears.length > 0 && !sourceAcademicYearId) {
      const past = [...academicYears]
        .filter((y) => !y.is_current)
        .sort((a, b) =>
          String(b.year_label).localeCompare(String(a.year_label)),
        )[0];
      if (past) setSourceAcademicYearId(past.id);
    }
  }, [academicYears, sourceAcademicYearId]);

  // ---------------------------------------------------------------------------
  // INDIVIDUAL MODE: available students = active + not already enrolled in
  // the target academic year.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (formData.academic_year_id) {
      const filtered = students.filter((student) => {
        const hasAssignment = student.assignments?.some(
          (a) =>
            String(a.academic_year_id) === String(formData.academic_year_id),
        );
        return !hasAssignment && student.is_active !== false;
      });
      setAvailableStudents(filtered);
    } else {
      setAvailableStudents(students.filter((s) => s.is_active !== false));
    }
  }, [formData.academic_year_id, students]);

  // ---------------------------------------------------------------------------
  // INDIVIDUAL MODE: search filter
  // ---------------------------------------------------------------------------
  const filteredStudents = availableStudents.filter((student) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      student.first_name?.toLowerCase().includes(searchLower) ||
      student.last_name?.toLowerCase().includes(searchLower) ||
      student.admission_number?.toLowerCase().includes(searchLower)
    );
  });

  // ---------------------------------------------------------------------------
  // CLASS MODE: students who were in the chosen source class during the
  // chosen source academic year — looked up from assignments[] history.
  // ---------------------------------------------------------------------------
  const studentsInSourceClass = useMemo(() => {
    if (!sourceClassId || !sourceAcademicYearId) return [];

    return students.filter((s) => {
      if (s.is_active === false) return false;
      return s.assignments?.some(
        (a) =>
          String(a.academic_year_id) === String(sourceAcademicYearId) &&
          String(a.class_id) === String(sourceClassId),
      );
    });
  }, [students, sourceClassId, sourceAcademicYearId]);

  // ---------------------------------------------------------------------------
  // CLASS MODE: auto-select all eligible students from the source class.
  // Skips those already assigned in the TARGET year.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (mode !== "class" || !sourceClassId || !sourceAcademicYearId) return;

    const eligibleIds = studentsInSourceClass
      .filter((s) => {
        const alreadyInTargetYear = s.assignments?.some(
          (a) =>
            String(a.academic_year_id) === String(formData.academic_year_id),
        );
        return !alreadyInTargetYear;
      })
      .map((s) => s.id);

    setFormData((prev) => ({ ...prev, student_ids: eligibleIds }));
    setSelectAll(
      eligibleIds.length > 0 &&
        eligibleIds.length === studentsInSourceClass.length,
    );
  }, [
    sourceClassId,
    sourceAcademicYearId,
    mode,
    studentsInSourceClass,
    formData.academic_year_id,
  ]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "academic_year_id") {
      setFormData((prev) => ({ ...prev, student_ids: [] }));
      setSelectAll(false);
    }

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleStudentSelection = (studentId) => {
    setFormData((prev) => {
      const isSelected = prev.student_ids.includes(studentId);
      return {
        ...prev,
        student_ids: isSelected
          ? prev.student_ids.filter((id) => id !== studentId)
          : [...prev.student_ids, studentId],
      };
    });
  };

  const handleSelectAll = () => {
    const pool = mode === "class" ? studentsInSourceClass : filteredStudents;

    if (selectAll) {
      setFormData((prev) => ({ ...prev, student_ids: [] }));
    } else {
      setFormData((prev) => ({
        ...prev,
        student_ids: pool.map((s) => s.id),
      }));
    }
    setSelectAll(!selectAll);
  };

  const handleModeSwitch = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setFormData((prev) => ({ ...prev, student_ids: [] }));
    setSelectAll(false);
    setSearchTerm("");
    setSourceClassId("");
    setSourceAcademicYearId("");
    setErrors({});
  };

  const validateForm = () => {
    const newErrors = {};

    if (formData.student_ids.length === 0) {
      newErrors.student_ids = "Please select at least one student";
    }
    if (!formData.class_id) {
      newErrors.class_id = "Please select a class";
    }
    if (!formData.academic_year_id) {
      newErrors.academic_year_id = "Please select an academic year";
    }

    if (mode === "class") {
      if (!sourceAcademicYearId) {
        newErrors.sourceAcademicYearId = "Please select a source academic year";
      }
      if (!sourceClassId) {
        newErrors.sourceClassId = "Please select a source class";
      } else if (String(sourceClassId) === String(formData.class_id)) {
        newErrors.class_id =
          "Target class must be different from the source class";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit → open the preview modal
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setShowPreview(true);
  };

  // Confirm from preview → real save
  const handleConfirmEnroll = async () => {
    setSubmitting(true);
    try {
      await onSave(formData);
      setShowPreview(false);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived helpers
  // ---------------------------------------------------------------------------
  const getSelectedClassInfo = () =>
    classes.find((cls) => cls.id === formData.class_id);

  const getSourceClassInfo = () =>
    classes.find((cls) => cls.id === sourceClassId);

  const classInfo = getSelectedClassInfo();
  const sourceClassInfo = getSourceClassInfo();
  const selectedCount = formData.student_ids.length;

  const sourceYearLabel =
    academicYears.find((y) => y.id === sourceAcademicYearId)?.year_label || "";
  const targetYearLabel =
    academicYears.find((y) => y.id === formData.academic_year_id)?.year_label ||
    "";

  const studentsInBox =
    mode === "class" ? studentsInSourceClass : filteredStudents;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Mode toggle */}
      <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
        <button
          type="button"
          onClick={() => handleModeSwitch("individual")}
          className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === "individual"
              ? "bg-white text-emerald-700 shadow-sm"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          <UserGroupIcon className="w-4 h-4" />
          <span>Pick students individually</span>
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch("class")}
          className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === "class"
              ? "bg-white text-emerald-700 shadow-sm"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          <UsersIcon className="w-4 h-4" />
          <span>Promote a whole class</span>
        </button>
      </div>

      {/* Academic years + class pickers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Source Academic Year (class mode only) */}
        {mode === "class" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source Academic Year *
            </label>
            <select
              value={sourceAcademicYearId}
              onChange={(e) => {
                setSourceAcademicYearId(e.target.value);
                setSourceClassId("");
                setFormData((prev) => ({ ...prev, student_ids: [] }));
                setSelectAll(false);
                if (errors.sourceAcademicYearId) {
                  setErrors((prev) => ({
                    ...prev,
                    sourceAcademicYearId: "",
                  }));
                }
              }}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                errors.sourceAcademicYearId
                  ? "border-red-500"
                  : "border-gray-300"
              }`}
            >
              <option value="">Select Source Year</option>
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.year_label} {year.is_current ? "(Current)" : ""}
                </option>
              ))}
            </select>
            {errors.sourceAcademicYearId && (
              <p className="text-red-500 text-sm mt-1">
                {errors.sourceAcademicYearId}
              </p>
            )}
          </div>
        )}

        {/* Source Class (class mode only) */}
        {mode === "class" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source Class *
            </label>
            <select
              value={sourceClassId}
              onChange={(e) => setSourceClassId(e.target.value)}
              disabled={!sourceAcademicYearId}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50 disabled:text-gray-500 ${
                errors.sourceClassId ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">
                {sourceAcademicYearId
                  ? "Select Source Class"
                  : "Select a source year first"}
              </option>
              {classes.map((cls) => {
                const count = students.filter((s) => {
                  if (s.is_active === false) return false;
                  return s.assignments?.some(
                    (a) =>
                      String(a.academic_year_id) ===
                        String(sourceAcademicYearId) &&
                      String(a.class_id) === String(cls.id),
                  );
                }).length;
                return (
                  <option key={cls.id} value={cls.id}>
                    {cls.class_name}
                    {cls.room_number ? ` - ${cls.room_number}` : ""} ({count})
                  </option>
                );
              })}
            </select>
            {errors.sourceClassId && (
              <p className="text-red-500 text-sm mt-1">
                {errors.sourceClassId}
              </p>
            )}
          </div>
        )}

        {/* Target Academic Year */}
        <div className={mode === "class" ? "" : "lg:col-span-2"}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Academic Year *
          </label>
          <select
            name="academic_year_id"
            value={formData.academic_year_id}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              errors.academic_year_id ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Select Academic Year</option>
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year_label} {year.is_current ? "(Current)" : ""}
              </option>
            ))}
          </select>
          {errors.academic_year_id && (
            <p className="text-red-500 text-sm mt-1">
              {errors.academic_year_id}
            </p>
          )}
        </div>

        {/* Target Class */}
        <div className={mode === "class" ? "" : "lg:col-span-2"}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Promote to Class *
          </label>
          <select
            name="class_id"
            value={formData.class_id}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              errors.class_id ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Select Class</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.class_name}
                {cls.capacity
                  ? ` (${cls.current_student_count || 0}/${cls.capacity})`
                  : ""}
                {cls.room_number ? ` - ${cls.room_number}` : ""}
              </option>
            ))}
          </select>
          {errors.class_id && (
            <p className="text-red-500 text-sm mt-1">{errors.class_id}</p>
          )}
        </div>
      </div>

      {/* Source → target preview banner (class mode) */}
      {mode === "class" && sourceClassInfo && classInfo && (
        <div className="bg-emerald-50 p-4 rounded-md border border-emerald-200 flex items-center space-x-3">
          <AcademicCapIcon className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          <div className="text-sm text-emerald-800">
            <p className="font-medium">
              {sourceClassInfo.class_name} ({sourceYearLabel}) →{" "}
              {classInfo.class_name} ({targetYearLabel})
            </p>
            <p className="text-emerald-700">
              {studentsInSourceClass.length} student
              {studentsInSourceClass.length !== 1 ? "s" : ""} in source class ·{" "}
              <strong>{selectedCount}</strong> selected for promotion
            </p>
          </div>
        </div>
      )}

      {/* Target class info box */}
      {classInfo && (
        <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-blue-800">
                {classInfo.class_name}
              </h4>
              <div className="text-sm text-blue-700 space-y-1 mt-1">
                {classInfo.capacity && (
                  <p>
                    <strong>Capacity:</strong>{" "}
                    {classInfo.current_student_count || 0}/{classInfo.capacity}{" "}
                    students
                    {selectedCount > 0 && (
                      <span className="ml-2">
                        → {classInfo.current_student_count + selectedCount}/
                        {classInfo.capacity} after enrollment
                      </span>
                    )}
                  </p>
                )}
                {classInfo.room_number && (
                  <p>
                    <strong>Room:</strong> {classInfo.room_number}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-800">
                {selectedCount}
              </div>
              <div className="text-sm text-blue-600">students selected</div>
            </div>
          </div>
        </div>
      )}

      {/* Student list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {mode === "class" ? "Students to promote" : "Select Students"} *
            </label>
            <p className="text-sm text-gray-500">
              {mode === "class"
                ? sourceClassId && sourceAcademicYearId
                  ? `${studentsInSourceClass.length} student${
                      studentsInSourceClass.length !== 1 ? "s" : ""
                    } in ${sourceClassInfo?.class_name} (${sourceYearLabel})`
                  : "Choose a source year and class above"
                : `${availableStudents.length} students available for enrollment`}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {mode === "individual" && (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-48 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={mode === "class" && studentsInSourceClass.length === 0}
              className={`px-3 py-1 text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${
                selectAll
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {selectAll ? "Deselect All" : "Select All"}
            </button>
          </div>
        </div>

        {errors.student_ids && (
          <p className="text-red-500 text-sm mb-2">{errors.student_ids}</p>
        )}

        <div className="border border-gray-300 rounded-md overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            {studentsInBox.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {mode === "class"
                  ? sourceClassId && sourceAcademicYearId
                    ? "No active students found in this class for that year"
                    : "Choose a source year and class to see its students"
                  : searchTerm
                    ? "No students match your search"
                    : "No students available for enrollment"}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {studentsInBox.map((student) => {
                  const isSelected = formData.student_ids.includes(student.id);

                  // Previous-year class for this student (badge in class mode)
                  const sourceAssignment =
                    mode === "class" && sourceAcademicYearId
                      ? student.assignments?.find(
                          (a) =>
                            String(a.academic_year_id) ===
                              String(sourceAcademicYearId) &&
                            String(a.class_id) === String(sourceClassId),
                        )
                      : null;

                  // Current/latest class for this student (badge in individual mode)
                  const latestAssignment = student.assignments?.find(
                    (a) => a.is_current,
                  );

                  return (
                    <div
                      key={student.id}
                      onClick={() => handleStudentSelection(student.id)}
                      className={`flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                        isSelected ? "bg-emerald-50" : ""
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full border flex items-center justify-center mr-3 flex-shrink-0 ${
                          isSelected
                            ? "bg-emerald-500 border-emerald-500"
                            : "border-gray-300"
                        }`}
                      >
                        {isSelected && (
                          <CheckIcon className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              {student.first_name} {student.last_name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {student.admission_number &&
                                `Adm: ${student.admission_number}`}
                              {student.gender && ` • ${student.gender}`}
                            </p>
                          </div>
                          <div className="text-right space-y-1">
                            {/* Class-mode badge: where they were in the source year */}
                            {mode === "class" && sourceAssignment && (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                                In {sourceYearLabel}:{" "}
                                {sourceAssignment.class_name}
                              </span>
                            )}
                            {/* Individual-mode badge: current/latest class */}
                            {mode === "individual" && latestAssignment && (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                                Current: {latestAssignment.class_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 text-sm text-gray-500">
          {selectedCount > 0 && (
            <p>
              <strong>{selectedCount}</strong> student
              {selectedCount !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>
      </div>

      {/* Promotion status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Promotion Status (for all selected students)
        </label>
        <select
          name="promotion_status"
          value={formData.promotion_status}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="Pending">Pending</option>
          <option value="Promoted">Promoted</option>
          <option value="Not Promoted">Not Promoted</option>
          <option value="Conditional">Conditional</option>
        </select>
      </div>

      {/* Info banner */}
      <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
        <div className="flex">
          <div className="flex-shrink-0">
            <UserGroupIcon className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Bulk Enrollment Information
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  All selected students will be enrolled in the same class for
                  the chosen target academic year
                </li>
                <li>Each student can only be in one class per academic year</li>
                <li>
                  Students already enrolled in the target academic year will be
                  skipped
                </li>
                <li>Class capacity will be checked before enrollment</li>
                {mode === "class" && (
                  <li>
                    <strong>Class mode:</strong> pick the source academic year
                    and source class to see students from a previous year
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={formData.student_ids.length === 0}
          className={`px-4 py-2 rounded-md transition-colors ${
            formData.student_ids.length === 0
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-emerald-500 text-white hover:bg-emerald-600"
          }`}
        >
          <div className="flex items-center space-x-2">
            <UserGroupIcon className="w-5 h-5" />
            <span>
              Review & enroll {selectedCount} student
              {selectedCount !== 1 ? "s" : ""}
            </span>
          </div>
        </button>
      </div>

      {/* Preview modal */}
      <PromotionPreviewModal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={handleConfirmEnroll}
        submitting={submitting}
        sourceClass={sourceClassInfo || null}
        targetClass={classInfo || null}
        academicYear={
          academicYears.find((y) => y.id === formData.academic_year_id) || null
        }
        promotionStatus={formData.promotion_status}
        onPromotionStatusChange={(next) =>
          setFormData((prev) => ({ ...prev, promotion_status: next }))
        }
        students={students.filter((s) => formData.student_ids.includes(s.id))}
        skipped={[]}
      />
    </form>
  );
};

export default BulkClassAssignmentForm;
