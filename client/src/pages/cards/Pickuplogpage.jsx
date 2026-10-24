import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ClockIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  UserIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { MapPinIcon as MapPinSolidIcon } from "@heroicons/react/24/solid";
import { MapPinIcon as MapPinOutlineIcon } from "@heroicons/react/24/outline";
import api from "../../components/axiosconfig/axiosConfig";
import { useAuth } from "../contexts/AuthContext";

// ============================================================================
// PickupLogPage
// ----------------------------------------------------------------------------
// Read-only history view of pickup_dropoff_log, backed by GET /pickup-log.
//
// Pinning:
//  - Click a row → toggles is_pinned on the server via PUT /pickup-log/:id/pin.
//  - Pinned rows render in red with a filled pin icon and move to the top
//    (backend ORDER BY handles the sort).
//  - Pins are persisted in the DB, not localStorage.
//
// Auto-refresh:
//  - Silent refresh every 30s (no "Loading…" flash, keeps scroll position).
//  - Pauses while the tab is hidden; catches up on visibility change.
//  - Skips ticks while a request is in flight.
//  - Manual Refresh button + on/off checkbox + "Updated HH:MM:SS" label.
// ============================================================================

const todayISO = () => new Date().toISOString().split("T")[0];

const AUTO_REFRESH_MS = 15000;

const PickupLogPage = () => {
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [sendingSms, setSendingSms] = useState(null); // 'Drop-off' | 'Pickup' | null
  const [smsResult, setSmsResult] = useState(null);

  // Pin state — which row currently has a pin request in flight
  const [pinningId, setPinningId] = useState(null);

  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [filters, setFilters] = useState({
    student_search: "",
    class_id: "",
    action_type: "all",
    start_date: todayISO(),
    end_date: todayISO(),
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const abortControllerRef = useRef(null);
  const inFlightRef = useRef(false);
  const lastUpdatedRef = useRef(0);

  // Load classes once
  useEffect(() => {
    api
      .get("/getclasses")
      .then((res) => setClasses(res.data))
      .catch((err) => console.error("Error fetching classes:", err));
  }, []);

  // ---------------------------------------------------------------------------
  // fetchLogs — supports { silent: true } for background refreshes
  // ---------------------------------------------------------------------------
  const fetchLogs = useCallback(
    async (page = pagination.page, { silent = false } = {}) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      inFlightRef.current = true;

      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({
          page,
          limit: pagination.limit,
          ...(filters.student_search && {
            student_search: filters.student_search,
          }),
          ...(filters.class_id && { class_id: filters.class_id }),
          ...(filters.action_type !== "all" && {
            action_type: filters.action_type,
          }),
          ...(filters.start_date && { start_date: filters.start_date }),
          ...(filters.end_date && { end_date: filters.end_date }),
        });

        const response = await api.get(`/pickup-log?${params}`, {
          signal: controller.signal,
        });

        setLogs(response.data.logs || []);
        setPagination(response.data.pagination || pagination);

        const now = new Date();
        setLastUpdated(now);
        lastUpdatedRef.current = now.getTime();
      } catch (error) {
        if (error.name === "CanceledError" || error.code === "ERR_CANCELED")
          return;
        console.error("Error fetching pickup log:", error);
      } finally {
        // Only the newest request clears the flags
        if (abortControllerRef.current === controller) {
          inFlightRef.current = false;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [filters, pagination.limit, pagination.page],
  );

  // Debounced fetch on filter change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    const timeoutId = setTimeout(() => fetchLogs(1), 200);
    return () => clearTimeout(timeoutId);
  }, [
    filters.student_search,
    filters.class_id,
    filters.action_type,
    filters.start_date,
    filters.end_date,
  ]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Auto-refresh timer — reads the latest fetchLogs via ref
  // ---------------------------------------------------------------------------
  const fetchLogsRef = useRef(fetchLogs);
  useEffect(() => {
    fetchLogsRef.current = fetchLogs;
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;

    const tick = () => {
      if (document.visibilityState !== "visible") return; // tab hidden — skip
      if (inFlightRef.current) return; // a request is already running — skip
      fetchLogsRef.current(undefined, { silent: true });
    };

    const intervalId = setInterval(tick, AUTO_REFRESH_MS);

    // Coming back to the tab: catch up immediately if the data has gone stale
    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastUpdatedRef.current > AUTO_REFRESH_MS
      ) {
        tick();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [autoRefresh]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPagination((prev) => ({ ...prev, page: newPage }));
    fetchLogs(newPage);
  };

  const clearFilters = () => {
    setFilters({
      student_search: "",
      class_id: "",
      action_type: "all",
      start_date: "",
      end_date: "",
    });
  };

  const setToday = () => {
    setFilters((prev) => ({
      ...prev,
      start_date: todayISO(),
      end_date: todayISO(),
    }));
  };

  const handleSendBulkSms = async (actionType) => {
    const confirmMsg =
      `Send ${actionType} SMS to guardians for all matching entries` +
      (filters.start_date || filters.end_date
        ? ` (${filters.start_date || "any date"} to ${filters.end_date || "any date"})`
        : "") +
      (filters.class_id ? ", filtered by class" : "") +
      (filters.student_search ? `, matching "${filters.student_search}"` : "") +
      "?";

    if (!window.confirm(confirmMsg)) return;

    setSendingSms(actionType);
    setSmsResult(null);
    try {
      const response = await api.post("/pickup-log/send-bulk-sms", {
        action_type: actionType,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
        class_id: filters.class_id || undefined,
        student_search: filters.student_search || undefined,
      });

      setSmsResult({ actionType, ...response.data });
    } catch (error) {
      console.error("Error sending bulk SMS:", error);
      setSmsResult({
        actionType,
        error:
          error.response?.data?.error || "Failed to send SMS notifications.",
      });
    } finally {
      setSendingSms(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Pin toggle — persists to the backend, then refetches so the row moves.
  // ---------------------------------------------------------------------------
  const handlePinToggle = async (log) => {
    if (pinningId) return; // ignore rapid double-clicks while a request is in flight
    setPinningId(log.id);
    try {
      await api.put(`/pickup-log/${log.id}/pin`, {
        pinned: !log.is_pinned,
        pinned_by: currentUserId,
      });
      await fetchLogs(pagination.page);
    } catch (error) {
      console.error("Error toggling pin:", error);
      alert(error.response?.data?.error || "Could not update pin.");
    } finally {
      setPinningId(null);
    }
  };

  const hasActiveFilters =
    filters.student_search ||
    filters.class_id ||
    filters.action_type !== "all" ||
    filters.start_date ||
    filters.end_date;

  const pinnedCount = logs.filter((l) => l.is_pinned).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header with auto-refresh controls */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center space-x-2">
          <ClockIcon className="w-7 h-7 text-emerald-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Pickup / Drop-off Log
            </h1>
            <p className="text-gray-600 text-sm">
              History of card-verified drop-offs and pickups
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right">
            <p className="text-xs text-gray-500">
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString()}`
                : "Not loaded yet"}
            </p>
            <label className="flex items-center justify-end space-x-1 text-xs text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span>Auto-refresh</span>
            </label>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Student
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Name or admission number..."
                value={filters.student_search}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    student_search: e.target.value,
                  }))
                }
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Class
            </label>
            <select
              value={filters.class_id}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, class_id: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.class_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Action
            </label>
            <select
              value={filters.action_type}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, action_type: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All</option>
              <option value="Drop-off">Drop-off</option>
              <option value="Pickup">Pickup</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date Range
            </label>
            <div className="flex space-x-1">
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    start_date: e.target.value,
                  }))
                }
                className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, end_date: e.target.value }))
                }
                className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-gray-600 flex items-center space-x-3">
            <span>
              {pagination.total} record{pagination.total === 1 ? "" : "s"}
            </span>
            {pinnedCount > 0 && (
              <span className="inline-flex items-center space-x-1 text-xs font-medium text-red-700 bg-red-100 border border-red-300 rounded-full px-2.5 py-0.5">
                <MapPinSolidIcon className="w-3.5 h-3.5" />
                <span>{pinnedCount} pinned on this page</span>
              </span>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={setToday}
              className="text-sm text-emerald-600 hover:underline"
            >
              Today only
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-800 px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <XMarkIcon className="w-4 h-4" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between flex-wrap gap-3">
          <div className="flex space-x-2">
            <button
              onClick={() => handleSendBulkSms("Drop-off")}
              disabled={sendingSms !== null}
              className="flex items-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 text-sm"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              <span>
                {sendingSms === "Drop-off" ? "Sending..." : "Send Drop-off SMS"}
              </span>
            </button>
            <button
              onClick={() => handleSendBulkSms("Pickup")}
              disabled={sendingSms !== null}
              className="flex items-center space-x-2 bg-emerald-500 text-white px-4 py-2 rounded-md hover:bg-emerald-600 disabled:opacity-50 text-sm"
            >
              <ArrowLeftOnRectangleIcon className="w-4 h-4" />
              <span>
                {sendingSms === "Pickup" ? "Sending..." : "Send Pickup SMS"}
              </span>
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Sends to all matching entries under current filters, not just this
            page.
          </p>

          <button
            onClick={() => fetchLogs(pagination.page, { silent: true })}
            disabled={refreshing || loading}
            className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 disabled:opacity-60 text-sm"
          >
            <ArrowPathIcon
              className={`w-4 h-4 ${refreshing || loading ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </button>
        </div>

        {smsResult && (
          <div
            className={
              "mt-3 p-3 rounded-md text-sm " +
              (smsResult.error
                ? "bg-red-50 border border-red-200 text-red-700"
                : smsResult.failed > 0 || smsResult.skipped_no_phone > 0
                  ? "bg-yellow-50 border border-yellow-200 text-yellow-800"
                  : "bg-green-50 border border-green-200 text-green-700")
            }
          >
            {smsResult.error ? (
              <p>{smsResult.error}</p>
            ) : (
              <p>
                <strong>{smsResult.actionType} SMS:</strong> {smsResult.sent}{" "}
                sent
                {smsResult.failed > 0 && `, ${smsResult.failed} failed`}
                {smsResult.skipped_no_phone > 0 &&
                  `, ${smsResult.skipped_no_phone} skipped (no phone on file)`}
                {smsResult.total === 0 &&
                  "no matching entries found for these filters"}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow border overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <ClockIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No pickup/drop-off records found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Time</Th>
                  <Th>Student</Th>
                  <Th>Action</Th>
                  <Th>By</Th>
                  <Th>Approved By</Th>
                  <Th>Notes</Th>
                  <Th>{/* pin column */}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <LogRow
                    key={log.id}
                    log={log}
                    onTogglePin={handlePinToggle}
                    pinBusy={pinningId === log.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow border">
          <p className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages} (
            {pagination.total} total)
          </p>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!pagination.hasPrevPage}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.hasNextPage}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Th = ({ children }) => (
  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
    {children}
  </th>
);

const LogRow = ({ log, onTogglePin, pinBusy }) => {
  const isPickup = log.action_type === "Pickup";
  const scannedTime = new Date(log.scanned_at);
  const pinned = !!log.is_pinned;

  return (
    <tr
      onClick={() => onTogglePin(log)}
      title={pinned ? "Click to unpin" : "Click to pin to top"}
      className={`cursor-pointer transition-colors ${
        pinned
          ? "bg-red-100 hover:bg-red-200 border-l-4 border-red-500"
          : "hover:bg-gray-50"
      } ${pinBusy ? "opacity-60" : ""}`}
    >
      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
        <div>{scannedTime.toLocaleDateString()}</div>
        <div className="text-xs text-gray-400">
          {scannedTime.toLocaleTimeString()}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center space-x-2">
          <UserIcon className="w-6 h-6 text-gray-300" />
          <div>
            <p className="text-sm font-medium text-gray-900">
              {log.student_first_name} {log.student_last_name}
            </p>
            <p className="text-xs text-gray-500">
              {log.admission_number} • {log.class_name || "No class"}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium ${
            isPickup
              ? "bg-emerald-100 text-emerald-700"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          {isPickup ? (
            <ArrowLeftOnRectangleIcon className="w-3.5 h-3.5" />
          ) : (
            <ArrowRightOnRectangleIcon className="w-3.5 h-3.5" />
          )}
          <span>{log.action_type}</span>
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        {log.person_first_name ? (
          <>
            <p>
              {log.person_first_name} {log.person_last_name}
            </p>
            <p className="text-xs text-gray-400">{log.relationship}</p>
            {log.phone && <p className="text-xs text-gray-500">{log.phone}</p>}
          </>
        ) : (
          <span className="text-xs text-gray-400 italic">
            Student's own card
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {log.approved_by_name}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
        {log.notes || "—"}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {pinned ? (
          <div className="flex flex-col items-end">
            <MapPinSolidIcon className="w-5 h-5 text-red-600" />
            {log.pinned_by_name && (
              <span className="text-[10px] text-red-700 mt-0.5">
                pinned by {log.pinned_by_name}
              </span>
            )}
          </div>
        ) : (
          <MapPinOutlineIcon className="w-5 h-5 text-gray-300" />
        )}
      </td>
    </tr>
  );
};

export default PickupLogPage;
