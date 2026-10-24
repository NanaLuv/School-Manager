import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  CreditCardIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import api from "../../components/axiosconfig/axiosConfig";
import { useAuth } from "../contexts/AuthContext";

// ============================================================================
// QuickScanPage — kiosk mode
// ----------------------------------------------------------------------------
// One request per tap: POST /access-cards/quick-scan does lookup, permission
// check, duplicate-today block, insert, and queues SMS — all server-side, in
// one round trip. No per-scan confirmation step; every eligible student on
// the card is approved automatically the instant the card is read.
//
// Mode (Drop-off / Pickup) is chosen ONCE per session, before scanning
// starts, since a single gate is almost always doing one or the other at any
// given time (morning drop-off rush, afternoon pickup rush) — not asking per
// scan is what makes rapid-fire tapping actually fast.
//
// Results render as a running feed (most recent on top) rather than a modal,
// so a new tap never has to wait for the previous result to be dismissed —
// staff can just keep tapping cards continuously.
// ============================================================================

const MAX_FEED_ITEMS = 8;

const QuickScanPage = ({ currentUserId }) => {
  const [mode, setMode] = useState(null); // 'Drop-off' | 'Pickup' | null (not chosen yet)
  const [scanInput, setScanInput] = useState("");
  const [feed, setFeed] = useState([]); // most recent scan results, newest first
  const [pending, setPending] = useState(0); // count of in-flight requests, for a subtle busy indicator

  const hiddenInputRef = useRef(null);

  const { user } = useAuth();

  const refocusInput = useCallback(() => {
    if (mode) hiddenInputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    refocusInput();
    window.addEventListener("focus", refocusInput);
    return () => window.removeEventListener("focus", refocusInput);
  }, [refocusInput]);

  const handleScanKeyDown = (e) => {
    if (e.key !== "Enter") return;
    const uid = scanInput.trim();
    setScanInput("");
    if (!uid || !mode) return;
    processScan(uid);
  };

  // Deliberately NOT awaited by the caller in a blocking way — multiple taps
  // in quick succession each fire their own processScan call, and each one
  // independently appends to the feed whenever ITS OWN response resolves.

  const processScan = async (uid) => {
    setPending((p) => p + 1);
    const scanTime = new Date();

    try {
      const response = await api.post("/access-cards/quick-scan", {
        card_uid: uid,
        action_type: mode,
        approved_by: user?.id || 1,
      });

      addToFeed({
        id: `${uid}-${scanTime.getTime()}`,
        time: scanTime,
        mode,
        status: "ok",
        ...response.data,
      });
    } catch (err) {
      const data = err.response?.data;
      addToFeed({
        id: `${uid}-${scanTime.getTime()}`,
        time: scanTime,
        mode,
        status: data?.blocked ? "blocked" : "error",
        error: data?.error || "Something went wrong reading this card.",
      });
    } finally {
      setPending((p) => Math.max(0, p - 1));
    }
  };

  const addToFeed = (entry) => {
    setFeed((prev) => [entry, ...prev].slice(0, MAX_FEED_ITEMS));
  };

  const changeMode = () => {
    setMode(null);
    setFeed([]);
  };

  // ---------------- Mode not yet chosen: gate screen ----------------
  if (!mode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <CreditCardIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Quick Scan</h1>
          <p className="text-gray-500 mb-8">
            Choose what this session is for before scanning starts.
          </p>
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => setMode("Drop-off")}
              className="flex items-center justify-center space-x-3 bg-blue-600 text-white py-5 rounded-xl text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-7 h-7" />
              <span>Start Drop-off Scanning</span>
            </button>
            <button
              onClick={() => setMode("Pickup")}
              className="flex items-center justify-center space-x-3 bg-emerald-600 text-white py-5 rounded-xl text-lg font-semibold hover:bg-emerald-700 transition-colors"
            >
              <ArrowLeftOnRectangleIcon className="w-7 h-7" />
              <span>Start Pickup Scanning</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Active scanning mode ----------------
  const isDropoff = mode === "Drop-off";

  return (
    <div
      className="min-h-screen bg-gray-50 p-6 flex flex-col items-center"
      onClick={refocusInput}
    >
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
      
      <div
        className={`w-full max-w-xl rounded-xl p-5 mb-6 flex items-center justify-between ${
          isDropoff ? "bg-blue-600" : "bg-emerald-600"
        }`}
      >
        <div className="flex items-center space-x-3 text-white">
          {isDropoff ? (
            <ArrowRightOnRectangleIcon className="w-8 h-8" />
          ) : (
            <ArrowLeftOnRectangleIcon className="w-8 h-8" />
          )}
          <div>
            <p className="text-xs uppercase tracking-wide opacity-80">Mode</p>
            <p className="text-xl font-bold">{mode}</p>
          </div>
        </div>
        <button
          onClick={changeMode}
          className="text-white/90 hover:text-white text-sm underline"
        >
          Change mode
        </button>
      </div>

      <div className="w-full max-w-xl text-center mb-6">
        <p className="text-gray-400 text-sm flex items-center justify-center space-x-2">
          {pending > 0 ? (
            <>
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              <span>Processing…</span>
            </>
          ) : (
            <span>Ready — tap a card</span>
          )}
        </p>
      </div>

      <div className="w-full max-w-xl space-y-3">
        {feed.length === 0 && (
          <p className="text-center text-gray-300 text-sm">
            Scan results will appear here.
          </p>
        )}
        {feed.map((entry) => (
          <FeedItem key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
};

const FeedItem = ({ entry }) => {
  const { status, time } = entry;
  const timeStr = time.toLocaleTimeString();

  if (status === "error" || status === "blocked") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
        <XCircleIcon className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-red-800 font-medium">{entry.error}</p>
          <p className="text-xs text-red-400 mt-0.5">{timeStr}</p>
        </div>
      </div>
    );
  }

  const approved = entry.approved || [];
  const skipped = entry.skipped || [];
  const hasApproved = approved.length > 0;

  return (
    <div
      className={`rounded-lg p-4 border ${
        hasApproved
          ? "bg-green-50 border-green-200"
          : "bg-yellow-50 border-yellow-200"
      }`}
    >
      <div className="flex items-start space-x-3">
        {hasApproved ? (
          <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
        ) : (
          <XCircleIcon className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          {entry.guardian_name && (
            <p className="text-xs text-gray-500">{entry.guardian_name}</p>
          )}

          {hasApproved && (
            <p className="text-sm font-medium text-green-800">
              {entry.mode} approved: {approved.map((a) => a.name).join(", ")}
            </p>
          )}

          {skipped.length > 0 && (
            <p className="text-xs text-yellow-700 mt-1">
              Skipped:{" "}
              {skipped
                .map(
                  (s) =>
                    `${s.name} (${
                      s.reason === "already_done_today"
                        ? "already done today"
                        : "not authorized"
                    })`,
                )
                .join(", ")}
            </p>
          )}

          {!hasApproved && skipped.length === 0 && (
            <p className="text-sm text-yellow-700">
              {entry.error || "No eligible students."}
            </p>
          )}

          <p className="text-xs text-gray-400 mt-1">{timeStr}</p>
        </div>
      </div>
    </div>
  );
};

export default QuickScanPage;
