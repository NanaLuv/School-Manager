import React, { useState, useEffect, useMemo } from "react";
import {
  XMarkIcon,
  ArrowRightIcon,
  AcademicCapIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

// ============================================================================
// PromotionPreviewModal
// ----------------------------------------------------------------------------
// Read-only confirmation step shown before a bulk class promotion is sent
// to the backend. Also lets the user tweak the promotion status right here
// (Promoted / Pending / Not Promoted / Conditional) without going back.
//
// Props:
//   open                     — bool
//   onClose                  — close without submitting
//   onConfirm                — submit for real
//   submitting               — bool, shows "Enrolling…"
//   sourceClass              — { id, class_name, room_number } | null
//   targetClass              — { id, class_name, room_number, capacity, current_student_count } | null
//   academicYear             — { id, year_label } | null
//   promotionStatus          — string (controlled)
//   onPromotionStatusChange  — (nextStatus) => void  ← new
//   promotionStatusOptions   — optional array of strings (defaults below)
//   students                 — array of students being promoted
//   skipped                  — array of { student, reason }
// ============================================================================

const DEFAULT_STATUS_OPTIONS = [
  "Pending",
  "Promoted",
  "Not Promoted",
  "Conditional",
];

const PromotionPreviewModal = ({
  open,
  onClose,
  onConfirm,
  submitting = false,
  sourceClass,
  targetClass,
  academicYear,
  promotionStatus,
  onPromotionStatusChange,
  promotionStatusOptions = DEFAULT_STATUS_OPTIONS,
  students = [],
  skipped = [],
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Local mirror so the select responds instantly, then we notify the parent.
  const [statusValue, setStatusValue] = useState(promotionStatus);

  useEffect(() => {
    setStatusValue(promotionStatus);
  }, [promotionStatus]);

  const handleStatusChange = (e) => {
    const next = e.target.value;
    setStatusValue(next);
    onPromotionStatusChange?.(next);
  };

  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return students;
    const q = searchTerm.toLowerCase();
    return students.filter(
      (s) =>
        s.first_name?.toLowerCase().includes(q) ||
        s.last_name?.toLowerCase().includes(q) ||
        s.admission_number?.toLowerCase().includes(q),
    );
  }, [students, searchTerm]);

  if (!open) return null;

  const targetCurrent = targetClass?.current_student_count || 0;
  const targetCapacity = targetClass?.capacity || null;
  const afterCount = targetCurrent + students.length;
  const wouldOverflow = targetCapacity && afterCount > targetCapacity;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-40"
        onClick={submitting ? undefined : onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <AcademicCapIcon className="w-6 h-6 text-emerald-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Confirm promotions
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Source → target banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-center flex-1 min-w-[120px]">
                <p className="text-xs uppercase tracking-wide text-emerald-700 font-medium">
                  From
                </p>
                <p className="text-lg font-bold text-emerald-900">
                  {sourceClass?.class_name || "—"}
                </p>
                {sourceClass?.room_number && (
                  <p className="text-xs text-emerald-700">
                    Room {sourceClass.room_number}
                  </p>
                )}
              </div>

              <ArrowRightIcon className="w-6 h-6 text-emerald-600 flex-shrink-0" />

              <div className="text-center flex-1 min-w-[120px]">
                <p className="text-xs uppercase tracking-wide text-emerald-700 font-medium">
                  To
                </p>
                <p className="text-lg font-bold text-emerald-900">
                  {targetClass?.class_name || "—"}
                </p>
                {targetClass?.room_number && (
                  <p className="text-xs text-emerald-700">
                    Room {targetClass.room_number}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Meta row — now with editable Promotion Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="bg-gray-50 rounded-md p-3">
              <p className="text-xs text-gray-500 mb-1">Academic Year</p>
              <p className="font-medium text-gray-900">
                {academicYear?.year_label || "—"}
              </p>
            </div>

            <div className="bg-gray-50 rounded-md p-3">
              <label
                htmlFor="promotion_status_preview"
                className="block text-xs text-gray-500 mb-1"
              >
                Promotion Status
              </label>
              <select
                id="promotion_status_preview"
                value={statusValue}
                onChange={handleStatusChange}
                disabled={submitting}
                className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {promotionStatusOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-gray-50 rounded-md p-3">
              <p className="text-xs text-gray-500 mb-1">Students</p>
              <p className="font-medium text-gray-900">{students.length}</p>
            </div>
          </div>

          {/* Capacity warning */}
          {targetCapacity && (
            <div
              className={`rounded-md p-3 text-sm border ${
                wouldOverflow
                  ? "bg-red-50 border-red-200 text-red-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
              }`}
            >
              <p>
                <strong>{targetClass?.class_name}</strong> capacity:{" "}
                {targetCurrent}/{targetCapacity} →{" "}
                <strong>
                  {afterCount}/{targetCapacity}
                </strong>{" "}
                after enrollment
              </p>
              {wouldOverflow && (
                <p className="mt-1 text-xs">
                  This exceeds capacity by {afterCount - targetCapacity}. The
                  server will reject this enrollment.
                </p>
              )}
            </div>
          )}

          {/* Skipped warning */}
          {skipped.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <div className="flex items-start space-x-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">
                    {skipped.length} student
                    {skipped.length !== 1 ? "s" : ""} will be skipped
                  </p>
                  <ul className="mt-1 list-disc pl-5 space-y-0.5">
                    {skipped.slice(0, 5).map(({ student, reason }) => (
                      <li key={student.id}>
                        {student.first_name} {student.last_name} — {reason}
                      </li>
                    ))}
                    {skipped.length > 5 && (
                      <li className="italic">…and {skipped.length - 5} more</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Student list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">
                Students being promoted ({students.length})
              </p>
              {students.length > 5 && (
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}
            </div>

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                {filteredStudents.length === 0 ? (
                  <p className="text-center py-6 text-sm text-gray-500">
                    No students match your search
                  </p>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Student
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Admission №
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Gender
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredStudents.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm text-gray-900">
                            <div className="flex items-center space-x-2">
                              <UserIcon className="w-4 h-4 text-gray-300 flex-shrink-0" />
                              <span>
                                {s.first_name} {s.last_name}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600 font-mono">
                            {s.admission_number || "—"}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600">
                            {s.gender || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={
              submitting || students.length === 0 || Boolean(wouldOverflow)
            }
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-500 rounded-md hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Enrolling…</span>
              </>
            ) : (
              <span>
                Confirm & enroll {students.length} student
                {students.length !== 1 ? "s" : ""}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromotionPreviewModal;
