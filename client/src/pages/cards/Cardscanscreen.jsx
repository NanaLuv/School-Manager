import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  CreditCardIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import api from "../../components/axiosconfig/axiosConfig";
import { useAuth } from "../contexts/AuthContext";

// ============================================================================
// CardScanScreen - Multi-Student Selection with Guardian Selection
// ----------------------------------------------------------------------------
// Shows all guardians linked to students. Staff must select the guardian
// physically present BEFORE approving pickup/drop-off for audit trail.
// ============================================================================

const CardScanScreen = ({ currentUserId }) => {
  const [scanInput, setScanInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [actionType, setActionType] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [guardianDetails, setGuardianDetails] = useState({});
  const [selectedGuardianId, setSelectedGuardianId] = useState(null);

  const hiddenInputRef = useRef(null);
  const { user } = useAuth();

  const refocusInput = useCallback(() => {
    hiddenInputRef.current?.focus();
  }, []);

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

  const resetScan = () => {
    setScanInput("");
    setScanResult(null);
    setError(null);
    setSelectedStudentIds([]);
    setActionType(null);
    setSuccessMessage(null);
    setGuardianDetails({});
    setSelectedGuardianId(null);
    refocusInput();
  };

  const getEligibleStudentIds = (scanResult, actionType) => {
    if (!scanResult) return [];

    if (scanResult.scan_type === "StudentCard") {
      const s = scanResult.student;
      const alreadyDone =
        actionType === "Drop-off"
          ? s.today_status?.dropped_off_today
          : s.today_status?.picked_up_today;
      return alreadyDone ? [] : [s.id];
    }

    return scanResult.students
      .filter((s) => {
        const isAuthorized =
          actionType === "Pickup" ? s.can_pickup : s.can_dropoff;

        const alreadyDone =
          actionType === "Drop-off"
            ? s.today_status?.dropped_off_today
            : s.today_status?.picked_up_today;
        return isAuthorized && !alreadyDone;
      })
      .map((s) => s.id);
  };

  const handleActionTypeChange = (newActionType) => {
    setActionType(newActionType);
    setSelectedStudentIds(getEligibleStudentIds(scanResult, newActionType));
    // Reset guardian selection when action changes
    setSelectedGuardianId(null);
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId],
    );
  };

  const handleScanKeyDown = async (e) => {
    if (e.key !== "Enter") return;

    const uid = scanInput.trim();
    setScanInput("");
    if (!uid) return;

    await lookupCard(uid);
  };

  const lookupCard = async (uid) => {
    setLoading(true);
    setError(null);
    setScanResult(null);
    setSuccessMessage(null);
    setGuardianDetails({});
    setSelectedGuardianId(null);

    try {
      const response = await api.get(`/access-cards/lookup/${uid}`);
      const data = response.data;
      setScanResult(data);

      // Fetch guardian details for all students
      const studentIds = getStudentIdsFromResult(data);
      await fetchGuardiansForStudents(studentIds);

      // Auto-select student for StudentCard
      if (data.scan_type === "StudentCard") {
        setSelectedStudentIds([data.student.id]);
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.blocked) {
        setError({ type: "blocked", message: data.error, status: data.status });
      } else if (err.response?.status === 404) {
        setError({
          type: "not_found",
          message: data?.error || "Card not recognized.",
        });
      } else {
        setError({ type: "generic", message: "Failed to lookup card." });
      }
    } finally {
      setLoading(false);
      refocusInput();
    }
  };

  const getStudentIdsFromResult = (data) => {
    if (data.scan_type === "StudentCard") {
      return [data.student.id];
    }
    return data.students.map((s) => s.id);
  };

  const fetchGuardiansForStudents = async (studentIds) => {
    try {
      const guardianPromises = studentIds.map(async (studentId) => {
        try {
          const response = await api.get(`/authorized-persons/${studentId}`);
          return { studentId, guardians: response.data };
        } catch (err) {
          console.error(
            `Error fetching guardians for student ${studentId}:`,
            err,
          );
          return { studentId, guardians: [] };
        }
      });

      const results = await Promise.all(guardianPromises);
      const guardianMap = {};
      results.forEach((result) => {
        guardianMap[result.studentId] = result.guardians;
      });
      setGuardianDetails(guardianMap);
    } catch (err) {
      console.error("Error fetching guardian details:", err);
    }
  };

  // Get unique guardians across all selected students
  const getUniqueGuardiansForSelectedStudents = () => {
    if (selectedStudentIds.length === 0) return [];

    const guardianMap = {};

    selectedStudentIds.forEach((studentId) => {
      const guardians = guardianDetails[studentId] || [];
      guardians.forEach((guardian) => {
        if (!guardianMap[guardian.id]) {
          guardianMap[guardian.id] = {
            ...guardian,
            linked_student_count: 0,
          };
        }
        guardianMap[guardian.id].linked_student_count++;
      });
    });

    return Object.values(guardianMap);
  };

  const handleApprove = async () => {
    if (selectedStudentIds.length === 0 || !actionType) {
      setError({
        type: "approval_failed",
        message: "Please select at least one student and an action.",
      });
      return;
    }

    if (!selectedGuardianId) {
      setError({
        type: "approval_failed",
        message: "Please select the guardian who is physically present.",
      });
      return;
    }

    setConfirming(true);
    try {
      const cardId =
        scanResult.scan_type === "StudentCard"
          ? scanResult.student.card_id
          : scanResult.card_id;

      const response = await api.post("/pickup-log/bulk", {
        student_ids: selectedStudentIds,
        authorized_person_id: selectedGuardianId,
        card_id: cardId,
        action_type: actionType,
        approved_by: user?.id || 1,
      });

      const students =
        scanResult.scan_type === "StudentCard"
          ? [scanResult.student]
          : scanResult.students;

      const names = selectedStudentIds
        .map((id) => {
          const s = students.find((st) => st.id === id);
          return s ? `${s.first_name} ${s.last_name}` : null;
        })
        .filter(Boolean);

      const selectedGuardian = getUniqueGuardiansForSelectedStudents().find(
        (g) => g.id === selectedGuardianId,
      );

      const anyDuplicates =
        response.data.results?.some((r) => r.duplicate_today) || false;
      const anyFailed = response.data.failed > 0;

      let message = `${actionType} approved for ${names.join(", ")}`;
      if (selectedGuardian) {
        message += ` by ${selectedGuardian.first_name} ${selectedGuardian.last_name}`;
      }
      if (anyDuplicates)
        message += " (note: at least one already had an entry today)";
      if (anyFailed) {
        const failedNames =
          response.data.results
            ?.filter((r) => !r.success)
            .map((r) => {
              const s = students.find((st) => st.id === r.student_id);
              return s ? `${s.first_name} ${s.last_name}` : r.student_id;
            }) || [];
        message += ` — could NOT process: ${failedNames.join(", ")}`;
      }

      setSuccessMessage(message);
      setTimeout(resetScan, anyFailed ? 4500 : 2000);
    } catch (err) {
      console.error("Approve error:", err);
      console.error("Response data:", err.response?.data);
      setError({
        type: "approval_failed",
        message: err.response?.data?.error || "Failed to record this action.",
      });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gray-50 p-6 flex flex-col items-center"
      onClick={handleBackgroundClick}
    >
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

      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <CreditCardIcon className="w-16 h-16 text-emerald-500 mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-gray-900">Tap Card to Scan</h1>
          <p className="text-gray-500">Ready for the next card</p>
        </div>

        {successMessage && (
          <div className="bg-green-50 border border-green-300 rounded-lg p-6 text-center mb-4">
            <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-lg font-medium text-green-800">
              {successMessage}
            </p>
          </div>
        )}

        {error && !successMessage && (
          <div
            className={`rounded-lg p-6 text-center border ${
              error.type === "blocked"
                ? "bg-red-50 border-red-300"
                : "bg-yellow-50 border-yellow-300"
            } mb-4`}
          >
            {error.type === "blocked" ? (
              <XCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-2" />
            ) : (
              <ExclamationTriangleIcon className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
            )}
            <p
              className={`text-lg font-medium ${
                error.type === "blocked" ? "text-red-800" : "text-yellow-800"
              }`}
            >
              {error.message}
            </p>
            {error.status && (
              <p className="text-sm text-gray-500 mt-1">
                Status: {error.status}
              </p>
            )}
            <button
              onClick={resetScan}
              className="mt-4 px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-lg shadow border p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-3"></div>
            <p className="text-gray-500">Looking up card...</p>
          </div>
        ) : scanResult && !error && !successMessage ? (
          <ScanResultCard
            scanResult={scanResult}
            selectedStudentIds={selectedStudentIds}
            toggleStudentSelection={toggleStudentSelection}
            actionType={actionType}
            setActionType={handleActionTypeChange}
            onApprove={handleApprove}
            onCancel={resetScan}
            confirming={confirming}
            guardianDetails={guardianDetails}
            selectedGuardianId={selectedGuardianId}
            setSelectedGuardianId={setSelectedGuardianId}
          />
        ) : !scanResult && !error && !successMessage && !loading ? (
          <div className="bg-white rounded-lg shadow border p-12 text-center">
            <CreditCardIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Present a card to the reader</p>
            <p className="text-xs text-gray-400 mt-2">
              or type the UID and press Enter
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ============================================================================
// ScanResultCard with Guardian Selection
// ============================================================================
const ScanResultCard = ({
  scanResult,
  selectedStudentIds,
  toggleStudentSelection,
  actionType,
  setActionType,
  onApprove,
  onCancel,
  confirming,
  guardianDetails,
  selectedGuardianId,
  setSelectedGuardianId,
}) => {
  const isPersonCard = scanResult.scan_type === "AuthorizedPersonCard";
  const students = isPersonCard ? scanResult.students : [scanResult.student];
  const currentPersonId = isPersonCard ? scanResult.person.id : null;

  const getStatusText = (student) => {
    if (!student.today_status) return "Not yet dropped off";
    if (student.today_status.picked_up_today) {
      const time = new Date(
        student.today_status.picked_up_at,
      ).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `Picked up at ${time}`;
    }
    if (student.today_status.dropped_off_today) {
      const time = new Date(
        student.today_status.dropped_off_at,
      ).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `In school since ${time}`;
    }
    return "Not yet dropped off";
  };

  const getStatusColor = (student) => {
    if (!student.today_status) return "text-gray-500";
    if (student.today_status.picked_up_today) return "text-gray-600";
    if (student.today_status.dropped_off_today) return "text-blue-700";
    return "text-gray-500";
  };

  // Get unique guardians across all selected students
  const getUniqueGuardiansForSelectedStudents = () => {
    if (selectedStudentIds.length === 0) return [];

    const guardianMap = {};

    selectedStudentIds.forEach((studentId) => {
      const guardians = guardianDetails[studentId] || [];
      guardians.forEach((guardian) => {
        if (!guardianMap[guardian.id]) {
          guardianMap[guardian.id] = {
            ...guardian,
            linked_student_count: 0,
          };
        }
        guardianMap[guardian.id].linked_student_count++;
      });
    });

    return Object.values(guardianMap);
  };

  const availableGuardians = getUniqueGuardiansForSelectedStudents();

  return (
    <div className="bg-white rounded-lg shadow border p-6">
      {/* Who scanned */}
      <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
        {isPersonCard && scanResult.person.photo_filename ? (
          <img
            src={`/uploads/authorized-persons/${scanResult.person.photo_filename}`}
            alt=""
            className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
            loading="lazy"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200">
            <UserIcon className="w-8 h-8 text-gray-400" />
          </div>
        )}
        <div>
          <p className="text-lg font-semibold text-gray-900">
            {isPersonCard
              ? `${scanResult.person.first_name} ${scanResult.person.last_name}`
              : `${scanResult.student.first_name} ${scanResult.student.last_name} (Student Card)`}
          </p>

          {isPersonCard && (
            <p className="text-sm text-gray-500">
              {scanResult.person.relationship}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Card scanned as entry point. Select the actual guardian below.
          </p>
        </div>
        <p className="text-red-600 text-xl">Card no: {scanResult.card_no}</p>
      </div>

      {/* Action selection */}
      <div className="pt-4 pb-2 grid grid-cols-2 gap-3">
        <button
          onClick={() => setActionType("Drop-off")}
          className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg border-2 transition-colors ${
            actionType === "Drop-off"
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          <span>Drop-off</span>
        </button>
        <button
          onClick={() => setActionType("Pickup")}
          className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg border-2 transition-colors ${
            actionType === "Pickup"
              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <ArrowLeftOnRectangleIcon className="w-5 h-5" />
          <span>Pickup</span>
        </button>
      </div>

      {/* Student selection */}
      {actionType && (
        <div className="py-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">
              Step 1: Select students for {actionType.toLowerCase()}:
            </p>
            <p className="text-xs text-gray-400">
              {selectedStudentIds.length} of {students.length} selected
            </p>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {students.map((s) => {
              const isEligible = isPersonCard
                ? actionType === "Pickup"
                  ? s.can_pickup
                  : s.can_dropoff
                : true;

              const isChecked = selectedStudentIds.includes(s.id);
              const alreadyDoneToday =
                s.today_status &&
                ((actionType === "Drop-off" &&
                  s.today_status.dropped_off_today) ||
                  (actionType === "Pickup" && s.today_status.picked_up_today));

              const statusText = getStatusText(s);
              const statusColor = getStatusColor(s);

              return (
                <label
                  key={s.id}
                  className={`flex items-center justify-between p-3 rounded-md border ${
                    !isEligible
                      ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                      : isChecked
                        ? "border-emerald-500 bg-emerald-50 cursor-pointer"
                        : "border-gray-200 cursor-pointer hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={!isEligible}
                      onChange={() => toggleStudentSelection(s.id)}
                      className="w-4 h-4 text-emerald-600 rounded flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">
                        {s.first_name} {s.last_name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {s.class_name} • {s.admission_number}
                        {!isEligible && (
                          <span className="text-red-500 ml-1">
                            (not authorized for {actionType.toLowerCase()})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end ml-3 flex-shrink-0">
                    <span className={`text-xs ${statusColor}`}>
                      {statusText}
                    </span>
                    {alreadyDoneToday && (
                      <span className="text-xs text-yellow-600 flex items-center mt-0.5">
                        <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
                        Already done today
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Guardian selection */}
      {actionType && selectedStudentIds.length > 0 && (
        <div className="py-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">
              Step 2: Select the guardian physically present:
            </p>
            {selectedGuardianId && (
              <span className="text-xs text-emerald-600">✓ Selected</span>
            )}
          </div>

          {availableGuardians.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              No authorized guardians found for selected students.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableGuardians.map((guardian) => {
                const isSelected = selectedGuardianId === guardian.id;
                const isCurrentCardHolder =
                  isPersonCard && guardian.id === currentPersonId;

                return (
                  <button
                    key={guardian.id}
                    onClick={() => setSelectedGuardianId(guardian.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-md border transition-colors ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-500"
                            : "border-gray-300"
                        }`}
                      />
                      {guardian.photo_filename ? (
                        <img
                          src={`/uploads/authorized-persons/${guardian.photo_filename}`}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <UserIcon className="w-10 h-10 text-gray-400" />
                      )}
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900">
                          {guardian.first_name} {guardian.last_name}
                          {isCurrentCardHolder && (
                            <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                              Card scanned
                            </span>
                          )}
                          {guardian.is_primary_guardian && (
                            <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                              Primary
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {guardian.relationship} • Linked to{" "}
                          {guardian.linked_student_count} student
                          {guardian.linked_student_count > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {actionType === "Pickup" && (
                        <span
                          className={`text-xs ${
                            guardian.can_pickup
                              ? "text-emerald-600"
                              : "text-red-500"
                          }`}
                        >
                          {guardian.can_pickup ? "✓" : "✗"} Pickup
                        </span>
                      )}
                      {actionType === "Drop-off" && (
                        <span
                          className={`text-xs ${
                            guardian.can_dropoff
                              ? "text-emerald-600"
                              : "text-red-500"
                          }`}
                        >
                          {guardian.can_dropoff ? "✓" : "✗"} Drop-off
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="pt-4 flex space-x-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onApprove}
          disabled={
            selectedStudentIds.length === 0 ||
            !actionType ||
            !selectedGuardianId ||
            confirming
          }
          className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {confirming
            ? "Approving..."
            : `Approve ${selectedStudentIds.length || 0} student${
                selectedStudentIds.length === 1 ? "" : "s"
              }`}
        </button>
      </div>
    </div>
  );
};

export default CardScanScreen;
