import React, { useState, useEffect } from "react";
import {
  DocumentArrowDownIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  UserGroupIcon,
  UserIcon,
  LockClosedIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useAcademicData } from "../../hooks/useAcademicContext";
import api from "../../components/axiosconfig/axiosConfig";

// ============================================================================
// SingleReportCardPage
// ----------------------------------------------------------------------------
// Confidential lookup for ONE student's report card.
//
// Confidentiality rules:
//   - NO auto-search. The user must explicitly press Search (or Enter).
//   - The server is queried only with an EXACT identifier:
//       • Exact admission number, OR
//       • Exact first name + exact last name
//   - Class alone is never enough (blocked).
//   - Only a single exact match is shown. No lists, no prefixes, no partials.
//   - On any zero-or-many match, we show a neutral "no match" message —
//     never a list of candidates.
//
// PDF: reuses /getindividualreportcardpdf/:id for Download and Preview.
// ============================================================================

const SingleReportCardPage = () => {
  const {
    academicYears,
    terms,
    selectedAcademicYear,
    selectedTerm,
    handleAcademicYearChange,
    handleTermChange,
    loading: academicLoading,
  } = useAcademicData();

  const [classes, setClasses] = useState([]);

  // Identity inputs
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [classId, setClassId] = useState("");

  // The values that were actually submitted (frozen at submit time). We
  // do not re-run queries if the user keeps typing in the inputs.
  const [submitted, setSubmitted] = useState(null);

  const [result, setResult] = useState(null); // single match object or null
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const [busy, setBusy] = useState(false); // preview/download in flight
  const [actionError, setActionError] = useState(null);

  // Load classes once
  useEffect(() => {
    api
      .get("/getclasses")
      .then((res) => setClasses(res.data || []))
      .catch((err) => console.error("Error fetching classes:", err));
  }, []);

  // ---------------------------------------------------------------------------
  // Derived: which mode is the user in?
  // ---------------------------------------------------------------------------
  const hasAdmissionNumber = admissionNumber.trim().length > 0;
  const hasPartialName =
    firstName.trim().length > 0 !== lastName.trim().length > 0;
  const hasFullName = firstName.trim().length > 0 && lastName.trim().length > 0;

  // Query allowed only when a real identifier is present
  const canSearch = hasAdmissionNumber || hasFullName;

  const blockedReason = (() => {
    if (!selectedAcademicYear || !selectedTerm) {
      return "Select an academic year and term to begin.";
    }
    if (hasPartialName) {
      return "Enter both first name and last name for a name search.";
    }
    if (classId && !hasAdmissionNumber && !hasFullName) {
      return "Class alone is not allowed. Provide the student's admission number or full name.";
    }
    if (!canSearch) {
      return "Enter the student's admission number, or their full name (first and last).";
    }
    return null;
  })();

  // ---------------------------------------------------------------------------
  // Search — fires ONLY on explicit submit
  // ---------------------------------------------------------------------------
  const handleSearch = async (e) => {
    e?.preventDefault?.();

    if (!selectedAcademicYear || !selectedTerm) return;
    if (!canSearch) return;

    // Freeze what we're searching for so later typing doesn't affect it
    const payload = {
      admissionNumber: admissionNumber.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      classId,
      academicYearId: selectedAcademicYear,
      termId: selectedTerm,
    };
    setSubmitted(payload);

    setSearching(true);
    setSearchError(null);
    setNotFound(false);
    setResult(null);
    setActionError(null);

    try {
      // Build the API call. We still pass `search` so the server narrows,
      // but the real guarantee is the client-side exact-match filter below.
      const searchParam = payload.admissionNumber
        ? payload.admissionNumber
        : payload.firstName;

      const params = new URLSearchParams({
        academic_year_id: payload.academicYearId,
        term_id: payload.termId,
        search: searchParam,
        page: "1",
        limit: "50", // allow the server to return several AMAs; we filter down
        sort_by: "student_name",
        sort_order: "asc",
        ...(payload.classId && { class_id: payload.classId }),
      });

      const response = await api.get(`/getreportcards?${params}`);
      const cards = response.data.reportCards || [];

      // ---------------------------------------------------------------------------
      // Exact-match filter (trim + lowercase both sides)
      // ---------------------------------------------------------------------------
      const norm = (v) =>
        String(v ?? "")
          .trim()
          .toLowerCase();

      const admNeedle = norm(payload.admissionNumber);
      const firstNeedle = norm(payload.firstName);
      const lastNeedle = norm(payload.lastName);

      const exact = cards.filter((c) => {
        if (admNeedle) {
          return norm(c.admission_number) === admNeedle;
        }
        return (
          norm(c.first_name) === firstNeedle && norm(c.last_name) === lastNeedle
        );
      });

      // Optional class narrowing
      const finalMatches = payload.classId
        ? exact.filter(
            (c) => String(c.class_id ?? "") === String(payload.classId),
          )
        : exact;

      if (finalMatches.length === 1) {
        setResult(finalMatches[0]);
      } else {
        setResult(null);
        setNotFound(true);
      }
    } catch (err) {
      console.error("Search error:", err);
      setSearchError(
        err.response?.data?.error || "Failed to look up the report card.",
      );
    } finally {
      setSearching(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Clear
  // ---------------------------------------------------------------------------
  const handleClear = () => {
    setAdmissionNumber("");
    setFirstName("");
    setLastName("");
    setClassId("");
    setSubmitted(null);
    setResult(null);
    setNotFound(false);
    setSearchError(null);
    setActionError(null);
  };

  // ---------------------------------------------------------------------------
  // PDF actions — Preview / Download
  // ---------------------------------------------------------------------------
  const fetchPdfBlob = async (cardId) => {
    const response = await api.get(`/getindividualreportcardpdf/${cardId}`, {
      responseType: "blob",
    });
    return new Blob([response.data], { type: "application/pdf" });
  };

  const handleDownload = async () => {
    if (!result) return;
    setBusy(true);
    setActionError(null);
    try {
      const blob = await fetchPdfBlob(result.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeName = `${result.first_name || "student"}-${
        result.last_name || ""
      }`
        .trim()
        .replace(/\s+/g, "-");
      link.setAttribute("download", `report-card-${safeName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      let msg = "Failed to download report card";
      try {
        const text = await err.response?.data?.text?.();
        if (text) {
          const parsed = JSON.parse(text);
          msg = parsed.error || msg;
        }
      } catch {
        /* ignore */
      }
      setActionError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async () => {
    if (!result) return;
    setBusy(true);
    setActionError(null);
    try {
      const blob = await fetchPdfBlob(result.id);
      const url = window.URL.createObjectURL(blob);
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win) {
        setActionError(
          "Pop-up blocked. Please allow pop-ups to preview the PDF.",
        );
        window.URL.revokeObjectURL(url);
        return;
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error("Preview error:", err);
      let msg = "Failed to open report card";
      try {
        const text = await err.response?.data?.text?.();
        if (text) {
          const parsed = JSON.parse(text);
          msg = parsed.error || msg;
        }
      } catch {
        /* ignore */
      }
      setActionError(msg);
    } finally {
      setBusy(false);
    }
  };

  const hasContext = Boolean(selectedAcademicYear && selectedTerm);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">
          Student Report Card Lookup
        </h1>
        <p className="text-gray-600 flex items-center mt-1">
          <LockClosedIcon className="w-4 h-4 text-emerald-600 mr-1" />
          search results appear only for an exact student match.
        </p>
      </div>

      {/* Filters */}
      <form
        onSubmit={handleSearch}
        className="bg-white rounded-lg shadow border p-5 mb-6"
      >
        {/* Year + Term */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center">
                <CalendarIcon className="w-4 h-4 mr-1" />
                Academic Year *
              </span>
            </label>
            <select
              value={selectedAcademicYear || ""}
              onChange={(e) => handleAcademicYearChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              disabled={academicLoading}
            >
              <option value="">Select Year</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.year_label} {y.is_current ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Term *
            </label>
            <select
              value={selectedTerm || ""}
              onChange={(e) => handleTermChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              disabled={!selectedAcademicYear || academicLoading}
            >
              <option value="">Select Term</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.term_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Identifiers */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-3">
            Identify the student
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Exact Admission Number
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={admissionNumber}
                  onChange={(e) => {
                    setAdmissionNumber(e.target.value);
                    if (e.target.value.trim()) {
                      setFirstName("");
                      setLastName("");
                    }
                    // Reset any previous result when the user edits
                    setResult(null);
                    setNotFound(false);
                    setSearchError(null);
                  }}
                  placeholder="e.g., ADM-2026-0001"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  disabled={!hasContext}
                  autoComplete="off"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                The full admission number is required — no partial matches.
              </p>
            </div>

            {/* <div className="md:col-span-3">
              <div className="flex items-center my-1">
                <div className="flex-1 border-t border-gray-200" />
                <span className="px-3 text-xs text-gray-400 bg-white">
                  or exact full name
                </span>
                <div className="flex-1 border-t border-gray-200" />
              </div>
            </div> */}

            {/* <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (e.target.value.trim()) setAdmissionNumber("");
                  setResult(null);
                  setNotFound(false);
                  setSearchError(null);
                }}
                placeholder="e.g., Ama"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={!hasContext}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (e.target.value.trim()) setAdmissionNumber("");
                  setResult(null);
                  setNotFound(false);
                  setSearchError(null);
                }}
                placeholder="e.g., Boateng"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={!hasContext}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center">
                  <UserGroupIcon className="w-4 h-4 mr-1" />
                  Class (optional, narrows search)
                </span>
              </label>
              <select
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setResult(null);
                  setNotFound(false);
                  setSearchError(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={!hasContext}
              >
                <option value="">Any class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name}
                  </option>
                ))}
              </select>
            </div> */}
          </div>

          {/* Blocked reason */}
          {blockedReason && (
            <div className="mt-4 flex items-start space-x-2 bg-amber-50 border border-amber-200 rounded-md p-3">
              <LockClosedIcon className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">{blockedReason}</p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex justify-end space-x-2">
            {(admissionNumber || firstName || lastName || classId) && (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-800 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <XMarkIcon className="w-4 h-4" />
                <span>Clear</span>
              </button>
            )}
            <button
              type="submit"
              disabled={!hasContext || !canSearch || searching}
              className="flex items-center space-x-2 bg-emerald-500 text-white px-4 py-2 rounded-md hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <MagnifyingGlassIcon className="w-4 h-4" />
              <span>{searching ? "Searching…" : "Search Student"}</span>
            </button>
          </div>

          {actionError && (
            <p className="mt-3 text-sm text-red-600">{actionError}</p>
          )}
        </div>
      </form>

      {/* Result panel */}
      {hasContext && submitted && (
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          {searching ? (
            <div className="text-center py-12 text-gray-500">Searching…</div>
          ) : searchError ? (
            <div className="text-center py-12 text-red-600">{searchError}</div>
          ) : notFound ? (
            <div className="text-center py-12">
              <UserIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">
                No matching report card.
              </p>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                Check that the admission number or full name is exactly correct,
                and that the student has a report card for the selected year and
                term.
              </p>
            </div>
          ) : result ? (
            <div className="p-5 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 font-semibold">
                  {(result.first_name?.[0] || "?").toUpperCase()}
                  {(result.last_name?.[0] || "").toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {result.first_name} {result.last_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate font-mono">
                    {result.admission_number}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {result.class_name ? `${result.class_name} • ` : ""}
                    {result.academic_year} — {result.term_name}
                    {result.overall_total != null
                      ? ` • Total: ${result.overall_total}`
                      : ""}
                    {result.overall_position
                      ? ` • Pos: ${result.overall_position}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-shrink-0">
                <button
                  onClick={handlePreview}
                  disabled={busy}
                  className="flex items-center space-x-1.5 bg-white border border-emerald-500 text-emerald-600 px-3 py-2 rounded-md hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <EyeIcon className="w-4 h-4" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={handleDownload}
                  disabled={busy}
                  className="flex items-center space-x-1.5 bg-emerald-500 text-white px-3 py-2 rounded-md hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <DocumentArrowDownIcon className="w-4 h-4" />
                  <span>{busy ? "Working…" : "Download"}</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Idle state — no search performed yet */}
      {hasContext && !submitted && (
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <div className="text-center py-12">
            <LockClosedIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 max-w-sm mx-auto">
              Enter the student's admission number or full name above, then
              press Search.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SingleReportCardPage;
