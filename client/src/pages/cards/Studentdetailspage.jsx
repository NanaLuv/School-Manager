import React, { useState, useEffect } from "react";
import {
  UserIcon,
  MagnifyingGlassIcon,
  CreditCardIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
} from "@heroicons/react/24/outline";
import api from "../../components/axiosconfig/axiosConfig";

// ============================================================================
// StudentDetailsPage
// ----------------------------------------------------------------------------
// Search a student by name/admission number, see:
//   - their own card_uid + status (if one was enrolled for them directly)
//   - every authorized guardian, each with their own card_uid/status and
//     pickup/drop-off permissions for this specific student
//
// Read-focused — for adding/removing guardians or cards, staff use
// CardDetailsPage or EnrollCardPanel; this page is the fast "look someone up
// and see the full picture" view.
// ============================================================================

const StudentDetailsPage = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await api.get(
          `/students/search-for-enrollment?q=${encodeURIComponent(query)}`,
        );
        setResults(res.data || []);
      } catch (err) {
        console.error("Error searching students:", err);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const loadStudent = async (studentId) => {
    setLoading(true);
    setError(null);
    setDetails(null);
    setResults([]);
    setQuery("");
    try {
      const res = await api.get(`/students/${studentId}/access-full-details`);
      setDetails(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load student details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center space-x-2 mb-6">
        <UserIcon className="w-7 h-7 text-emerald-500" />
        <h1 className="text-xl font-bold text-gray-900">
          Student Access Details
        </h1>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow border p-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Search for a student by name or admission number
        </label>
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Kwame Bonsu or ADM5978"
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            autoFocus
          />
        </div>

        {searching && <p className="text-sm text-gray-400 mt-2">Searching…</p>}

        {results.length > 0 && (
          <div className="mt-3 divide-y divide-gray-100 border border-gray-200 rounded-md overflow-hidden">
            {results.map((s) => (
              <button
                key={s.id}
                onClick={() => loadStudent(s.id)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3"
              >
                <UserIcon className="w-8 h-8 text-gray-300" />
                <div>
                  <p className="font-medium text-gray-900">
                    {s.first_name} {s.last_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {s.admission_number} • {s.class_name || "No class"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <p className="text-center text-gray-500 mt-6">Loading…</p>}

      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 text-red-700 rounded-md p-4 text-sm">
          {error}
        </div>
      )}

      {details && (
        <div className="mt-6 space-y-6">
          {/* Student header */}
          <div className="bg-white rounded-lg shadow border p-5 flex items-center space-x-4">
            <UserIcon className="w-14 h-14 text-gray-300" />
            <div>
              <p className="text-lg font-semibold text-gray-900">
                {details.student.first_name} {details.student.last_name}
              </p>
              <p className="text-sm text-gray-500">
                {details.student.admission_number} •{" "}
                {details.student.class_name || "No class assigned"}
              </p>
            </div>
          </div>

          {/* Student's own card */}
          <div className="bg-white rounded-lg shadow border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center space-x-2">
              <CreditCardIcon className="w-4 h-4" />
              <span>Student's Own Card</span>
            </h2>
            {details.own_card ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm text-gray-900">
                    {details.own_card.card_uid}
                  </p>
                  <p className="text-xs text-gray-400">
                    Issued{" "}
                    {details.own_card.issued_date
                      ? new Date(
                          details.own_card.issued_date,
                        ).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <CardStatusBadge status={details.own_card.status} />
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                No card enrolled directly for this student.
              </p>
            )}
          </div>

          {/* Guardians */}
          <div className="bg-white rounded-lg shadow border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Authorized Guardians ({details.guardians.length})
            </h2>

            {details.guardians.length === 0 ? (
              <p className="text-sm text-gray-400">
                No guardians linked to this student yet.
              </p>
            ) : (
              <div className="space-y-3">
                {details.guardians.map((g) => (
                  <GuardianRow key={g.sap_id} guardian={g} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CardStatusBadge = ({ status }) => {
  const styles = {
    Active: "bg-green-100 text-green-700",
    Lost: "bg-yellow-100 text-yellow-700",
    Revoked: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
        styles[status] || "bg-gray-100 text-gray-600"
      }`}
    >
      {status}
    </span>
  );
};

const GuardianRow = ({ guardian }) => (
  <div className="border border-gray-200 rounded-md p-4">
    <div className="flex items-start justify-between">
      <div className="flex items-center space-x-3">
        {guardian.photo_filename ? (
          <img
            src={`/uploads/authorized-persons/${guardian.photo_filename}`}
            alt=""
            className="w-12 h-12 rounded-full object-cover border"
          />
        ) : (
          <UserIcon className="w-12 h-12 text-gray-300" />
        )}
        <div>
          <p className="font-medium text-gray-900 flex items-center space-x-2">
            <span>
              {guardian.first_name} {guardian.last_name}
            </span>
            {guardian.is_primary_guardian && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                Primary
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500">
            {guardian.relationship} • {guardian.phone || "No phone on file"}
          </p>
        </div>
      </div>

      <div className="text-right">
        {guardian.card_uid ? (
          <>
            <p className="font-mono text-xs text-gray-600">
              {guardian.card_uid}
            </p>
            <CardStatusBadge status={guardian.card_status} />
          </>
        ) : (
          <span className="text-xs text-gray-400 italic">No card</span>
        )}
      </div>
    </div>

    <div className="mt-3 flex items-center space-x-4 pt-3 border-t border-gray-100">
      <PermissionBadge
        allowed={guardian.can_dropoff}
        icon={ArrowRightOnRectangleIcon}
        label="Drop-off"
      />
      <PermissionBadge
        allowed={guardian.can_pickup}
        icon={ArrowLeftOnRectangleIcon}
        label="Pickup"
      />
    </div>
  </div>
);

const PermissionBadge = ({ allowed, icon: Icon, label }) => (
  <div
    className={`flex items-center space-x-1.5 text-sm ${
      allowed ? "text-emerald-600" : "text-gray-300"
    }`}
  >
    {allowed ? (
      <CheckCircleIcon className="w-4 h-4" />
    ) : (
      <XCircleIcon className="w-4 h-4" />
    )}
    <Icon className="w-4 h-4" />
    <span>{label}</span>
  </div>
);

export default StudentDetailsPage;
