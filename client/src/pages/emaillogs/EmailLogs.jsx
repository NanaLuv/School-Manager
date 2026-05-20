import React, { useState, useEffect } from "react";
import {
  EnvelopeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  FunnelIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  DevicePhoneMobileIcon,
  CreditCardIcon,
} from "@heroicons/react/24/outline";
import api from "../../components/axiosconfig/axiosConfig";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { toast } from "react-hot-toast";

const EmailLogs = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState("email"); // "email" or "sms"

  // Email logs state
  const [emailLogs, setEmailLogs] = useState([]);
  const [emailLoading, setEmailLoading] = useState(true);
  const [emailStats, setEmailStats] = useState(null);
  const [emailLoadingStats, setEmailLoadingStats] = useState(true);

  // SMS logs state
  const [smsLogs, setSmsLogs] = useState([]);
  const [smsLoading, setSmsLoading] = useState(true);
  const [smsStats, setSmsStats] = useState(null);
  const [smsLoadingStats, setSmsLoadingStats] = useState(true);
  const [smsBalance, setSmsBalance] = useState(null);
  const [smsBalanceLoading, setSmsBalanceLoading] = useState(true);

  // Pagination state
  const [emailPagination, setEmailPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [smsPagination, setSmsPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Filter state
  const [emailFilters, setEmailFilters] = useState({
    email_type: "",
    status: "",
    start_date: "",
    end_date: "",
    student_id: "",
  });

  const [smsFilters, setSmsFilters] = useState({
    sms_type: "",
    status: "",
    start_date: "",
    end_date: "",
    student_id: "",
  });

  // Show/hide filter panels
  const [showEmailFilters, setShowEmailFilters] = useState(false);
  const [showSmsFilters, setShowSmsFilters] = useState(false);

  // Load email data
  useEffect(() => {
    if (activeTab === "email") {
      fetchEmailLogs();
    }
  }, [
    activeTab,
    emailPagination.page,
    emailFilters.email_type,
    emailFilters.status,
    emailFilters.start_date,
    emailFilters.end_date,
    emailFilters.student_id,
  ]);

  useEffect(() => {
    if (activeTab === "email") {
      fetchEmailStats();
    }
  }, [activeTab, emailFilters.start_date, emailFilters.end_date]);

  // Load SMS data
  useEffect(() => {
    if (activeTab === "sms") {
      fetchSmsLogs();
      fetchSmsStats();
    }
  }, [
    activeTab,
    smsPagination.page,
    smsFilters.sms_type,
    smsFilters.status,
    smsFilters.start_date,
    smsFilters.end_date,
    smsFilters.student_id,
  ]);

  // Fetch email logs
  const fetchEmailLogs = async () => {
    setEmailLoading(true);
    try {
      const params = new URLSearchParams({
        page: emailPagination.page,
        limit: emailPagination.limit,
      });

      if (emailFilters.email_type)
        params.append("email_type", emailFilters.email_type);
      if (emailFilters.status) params.append("status", emailFilters.status);
      if (emailFilters.start_date)
        params.append("start_date", emailFilters.start_date);
      if (emailFilters.end_date)
        params.append("end_date", emailFilters.end_date);
      if (emailFilters.student_id)
        params.append("student_id", emailFilters.student_id);

      const response = await api.get(`/email-logs?${params.toString()}`);
      if (response.data.success) {
        setEmailLogs(response.data.data);
        setEmailPagination(response.data.pagination);
      } else {
        toast.error("Failed to load email logs");
      }
    } catch (error) {
      console.error("Error fetching email logs:", error);
      toast.error(error.response?.data?.error || "Error loading email logs");
    } finally {
      setEmailLoading(false);
    }
  };

  // Fetch email statistics
  const fetchEmailStats = async () => {
    setEmailLoadingStats(true);
    try {
      const params = new URLSearchParams();
      if (emailFilters.start_date)
        params.append("start_date", emailFilters.start_date);
      if (emailFilters.end_date)
        params.append("end_date", emailFilters.end_date);

      const response = await api.get(`/email-stats?${params.toString()}`);
      if (response.data.success) {
        setEmailStats(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching email stats:", error);
    } finally {
      setEmailLoadingStats(false);
    }
  };

  // Fetch SMS logs
  const fetchSmsLogs = async () => {
    setSmsLoading(true);
    try {
      const params = new URLSearchParams({
        page: smsPagination.page,
        limit: smsPagination.limit,
      });

      if (smsFilters.sms_type) params.append("sms_type", smsFilters.sms_type);
      if (smsFilters.status) params.append("status", smsFilters.status);
      if (smsFilters.start_date)
        params.append("start_date", smsFilters.start_date);
      if (smsFilters.end_date) params.append("end_date", smsFilters.end_date);
      if (smsFilters.student_id)
        params.append("student_id", smsFilters.student_id);

      const response = await api.get(`/sms-logs?${params.toString()}`);
      if (response.data.success) {
        setSmsLogs(response.data.data);
        setSmsPagination(response.data.pagination);
      } else {
        toast.error("Failed to load SMS logs");
      }
    } catch (error) {
      console.error("Error fetching SMS logs:", error);
      toast.error(error.response?.data?.error || "Error loading SMS logs");
    } finally {
      setSmsLoading(false);
    }
  };

  // Fetch SMS statistics
  const fetchSmsStats = async () => {
    setSmsLoadingStats(true);
    try {
      const params = new URLSearchParams();
      if (smsFilters.start_date)
        params.append("start_date", smsFilters.start_date);
      if (smsFilters.end_date) params.append("end_date", smsFilters.end_date);

      const response = await api.get(`/sms-stats?${params.toString()}`);
      if (response.data.success) {
        setSmsStats(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching SMS stats:", error);
    } finally {
      setSmsLoadingStats(false);
    }
  };


  // Handle email filter changes
  const handleEmailFilterChange = (key, value) => {
    setEmailFilters((prev) => ({ ...prev, [key]: value }));
    setEmailPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Handle SMS filter changes
  const handleSmsFilterChange = (key, value) => {
    setSmsFilters((prev) => ({ ...prev, [key]: value }));
    setSmsPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Clear email filters
  const clearEmailFilters = () => {
    setEmailFilters({
      email_type: "",
      status: "",
      start_date: "",
      end_date: "",
      student_id: "",
    });
    setEmailPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Clear SMS filters
  const clearSmsFilters = () => {
    setSmsFilters({
      sms_type: "",
      status: "",
      start_date: "",
      end_date: "",
      student_id: "",
    });
    setSmsPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Get email status badge
  const getEmailStatusBadge = (status, errorMessage) => {
    if (status === "sent") {
      return (
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="w-3 h-3 mr-1" />
            Sent
          </span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center justify-center group relative">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircleIcon className="w-3 h-3 mr-1" />
            Failed
          </span>
          {errorMessage && (
            <div className="absolute bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
              <ExclamationTriangleIcon className="w-3 h-3 inline mr-1" />
              {errorMessage}
            </div>
          )}
        </div>
      );
    }
  };

  // Get SMS status badge
  const getSmsStatusBadge = (status, errorMessage) => {
    if (status === "sent") {
      return (
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="w-3 h-3 mr-1" />
            Sent
          </span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center justify-center group relative">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircleIcon className="w-3 h-3 mr-1" />
            Failed
          </span>
          {errorMessage && (
            <div className="absolute bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
              <ExclamationTriangleIcon className="w-3 h-3 inline mr-1" />
              {errorMessage}
            </div>
          )}
        </div>
      );
    }
  };

  // Get email type badge
  const getEmailTypeBadge = (type) => {
    const colors = {
      payment_receipt: "bg-blue-100 text-blue-800",
      balance_reminder: "bg-purple-100 text-purple-800",
      invoice: "bg-green-100 text-green-800",
      general: "bg-gray-100 text-gray-800",
    };

    const labels = {
      payment_receipt: "Payment Receipt",
      balance_reminder: "Balance Reminder",
      invoice: "Invoice",
      general: "General",
    };

    const colorClass = colors[type] || "bg-gray-100 text-gray-800";
    const label = labels[type] || (type ? type.replace(/_/g, " ") : "Unknown");

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
      >
        {label}
      </span>
    );
  };

  // Get SMS type badge
  const getSmsTypeBadge = (type) => {
    const colors = {
      payment_receipt: "bg-blue-100 text-blue-800",
      balance_reminder: "bg-purple-100 text-purple-800",
      general: "bg-gray-100 text-gray-800",
    };

    const labels = {
      payment_receipt: "Payment Receipt",
      balance_reminder: "Balance Reminder",
      general: "General",
    };

    const colorClass = colors[type] || "bg-gray-100 text-gray-800";
    const label = labels[type] || (type ? type.replace(/_/g, " ") : "Unknown");

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
      >
        {label}
      </span>
    );
  };

  // Pagination component
  const Pagination = ({ pagination, onPageChange }) => {
    if (pagination.totalPages <= 1) return null;

    return (
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing{" "}
              <span className="font-medium">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{" "}
              of <span className="font-medium">{pagination.total}</span> results
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
              <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={!pagination.hasPrevPage}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Previous</span>
                <ChevronLeftIcon className="h-5 w-5" />
              </button>

              {[...Array(Math.min(5, pagination.totalPages))].map((_, idx) => {
                let pageNum;
                if (pagination.totalPages <= 5) {
                  pageNum = idx + 1;
                } else if (pagination.page <= 3) {
                  pageNum = idx + 1;
                } else if (pagination.page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + idx;
                } else {
                  pageNum = pagination.page - 2 + idx;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      pagination.page === pageNum
                        ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                        : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={!pagination.hasNextPage}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Next</span>
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  // Render email logs
  const renderEmailLogs = () => (
    <>
      {/* Email Statistics Cards */}
      {emailStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-lg p-3">
                <EnvelopeIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 truncate">
                  Total Emails
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {emailLoadingStats ? "..." : emailStats.overview.total_emails}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-lg p-3">
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 truncate">
                  Successful
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {emailLoadingStats ? "..." : emailStats.overview.successful}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-red-100 rounded-lg p-3">
                <XCircleIcon className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 truncate">
                  Failed
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {emailLoadingStats ? "..." : emailStats.overview.failed}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-lg p-3">
                <DocumentTextIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 truncate">
                  Success Rate
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {emailLoadingStats
                    ? "..."
                    : emailStats.overview.total_emails > 0
                      ? Math.round(
                          (emailStats.overview.successful /
                            emailStats.overview.total_emails) *
                            100,
                        )
                      : 0}
                  %
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Filters */}
      <EmailFilters
        showFilters={showEmailFilters}
        setShowFilters={setShowEmailFilters}
        filters={emailFilters}
        onFilterChange={handleEmailFilterChange}
        onClearFilters={clearEmailFilters}
        onApplyFilters={fetchEmailLogs}
      />

      {/* Email Type Summary */}
      {emailStats && emailStats.by_type.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Email Type Summary
          </h3>
          <div className="flex flex-wrap gap-3">
            {emailStats.by_type.map((type) => (
              <div
                key={type.email_type}
                className="flex items-center bg-gray-50 rounded-lg px-3 py-2"
              >
                {getEmailTypeBadge(type.email_type)}
                <span className="ml-2 text-sm text-gray-600">
                  {type.sent_count} sent, {type.failed_count} failed
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email Logs Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {emailLoading ? (
          <div className="py-20">
            <LoadingSpinner text="Loading email logs..." />
          </div>
        ) : emailLogs.length === 0 ? (
          <div className="text-center py-12">
            <EnvelopeIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No emails found
            </h3>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Recipient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Message ID
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {emailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <ClockIcon className="w-4 h-4 text-gray-400 mr-2" />
                          {formatDate(log.sent_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {log.student_name || "Unknown"}
                        </div>
                        {log.admission_number && (
                          <div className="text-xs text-gray-500">
                            {log.admission_number}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.recipient_email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getEmailTypeBadge(log.email_type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getEmailStatusBadge(log.status, log.error_message)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {log.message_id
                          ? `${log.message_id.substring(0, 8)}...`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              pagination={emailPagination}
              onPageChange={(page) =>
                setEmailPagination((prev) => ({ ...prev, page }))
              }
            />
          </>
        )}
      </div>
    </>
  );

  // Render SMS logs
  const renderSmsLogs = () => (
    <>
     

      {/* SMS Statistics Cards */}
      {smsStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-lg p-3">
                <DevicePhoneMobileIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 truncate">
                  Total SMS
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {smsLoadingStats ? "..." : smsStats.overview.total_sms}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-lg p-3">
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 truncate">
                  Delivered
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {smsLoadingStats ? "..." : smsStats.overview.delivered}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-red-100 rounded-lg p-3">
                <XCircleIcon className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 truncate">
                  Failed
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {smsLoadingStats ? "..." : smsStats.overview.failed}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-lg p-3">
                <DocumentTextIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 truncate">
                  Delivery Rate
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {smsLoadingStats
                    ? "..."
                    : smsStats.overview.total_sms > 0
                      ? Math.round(
                          (smsStats.overview.delivered /
                            smsStats.overview.total_sms) *
                            100,
                        )
                      : 0}
                  %
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SMS Filters */}
      <SmsFilters
        showFilters={showSmsFilters}
        setShowFilters={setShowSmsFilters}
        filters={smsFilters}
        onFilterChange={handleSmsFilterChange}
        onClearFilters={clearSmsFilters}
        onApplyFilters={fetchSmsLogs}
      />

      {/* SMS Type Summary */}
      {smsStats && smsStats.by_type.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            SMS Type Summary
          </h3>
          <div className="flex flex-wrap gap-3">
            {smsStats.by_type.map((type) => (
              <div
                key={type.type}
                className="flex items-center bg-gray-50 rounded-lg px-3 py-2"
              >
                {getSmsTypeBadge(type.type)}
                <span className="ml-2 text-sm text-gray-600">
                  {type.sent_count} sent, {type.failed_count} failed
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SMS Logs Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {smsLoading ? (
          <div className="py-20">
            <LoadingSpinner text="Loading SMS logs..." />
          </div>
        ) : smsLogs.length === 0 ? (
          <div className="text-center py-12">
            <DevicePhoneMobileIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No SMS messages found
            </h3>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Phone Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Message Preview
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {smsLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <ClockIcon className="w-4 h-4 text-gray-400 mr-2" />
                          {formatDate(log.sent_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {log.student_name || "Unknown"}
                        </div>
                        {log.admission_number && (
                          <div className="text-xs text-gray-500">
                            {log.admission_number}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {log.phone_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getSmsTypeBadge(log.type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getSmsStatusBadge(log.status, log.error_message)}
                      </td>
                      <td className="px-6 py-4">
                        <div
                          className="text-sm text-gray-600 max-w-xs truncate"
                          title={log.message}
                        >
                          {/* {log.message?.substring(0, 80)}
                          {log.message?.length > 80 ? "..." : ""} */}
                          {log.message_id}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              pagination={smsPagination}
              onPageChange={(page) =>
                setSmsPagination((prev) => ({ ...prev, page }))
              }
            />
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <EnvelopeIcon className="w-6 h-6 mr-2 text-blue-500" />
            Communication Logs
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Track all email and SMS communications sent to parents and students
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("email")}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === "email"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <EnvelopeIcon className="w-5 h-5 mr-2" />
              Email Logs
            </button>
            <button
              onClick={() => setActiveTab("sms")}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === "sms"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <DevicePhoneMobileIcon className="w-5 h-5 mr-2" />
              SMS Logs
            </button>
          </nav>
        </div>

        {/* Refresh button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => {
              if (activeTab === "email") {
                fetchEmailLogs();
                fetchEmailStats();
              } else {
                fetchSmsLogs();
                fetchSmsStats();
              }
            }}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <ArrowPathIcon
              className={`w-4 h-4 mr-2 ${emailLoading || smsLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {/* Render active tab */}
        {activeTab === "email" ? renderEmailLogs() : renderSmsLogs()}
      </div>
    </div>
  );
};

// Email Filters Component
const EmailFilters = ({
  showFilters,
  setShowFilters,
  filters,
  onFilterChange,
  onClearFilters,
  onApplyFilters,
}) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
    <div
      className="px-6 py-4 flex items-center justify-between cursor-pointer"
      onClick={() => setShowFilters(!showFilters)}
    >
      <div className="flex items-center">
        <FunnelIcon className="w-5 h-5 text-gray-500 mr-2" />
        <h2 className="text-lg font-medium text-gray-900">Filters</h2>
        {(filters.email_type ||
          filters.status ||
          filters.start_date ||
          filters.end_date) && (
          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Active
          </span>
        )}
      </div>
      <ChevronRightIcon
        className={`w-5 h-5 text-gray-400 transform transition-transform ${showFilters ? "rotate-90" : ""}`}
      />
    </div>

    {showFilters && (
      <div className="px-6 pb-6 border-t border-gray-200 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Type
            </label>
            <select
              value={filters.email_type}
              onChange={(e) => onFilterChange("email_type", e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm"
            >
              <option value="">All Types</option>
              <option value="payment_receipt">Payment Receipt</option>
              <option value="balance_reminder">Balance Reminder</option>
              <option value="invoice">Invoice</option>
              <option value="general">General</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => onFilterChange("status", e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm"
            >
              <option value="">All Status</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => onFilterChange("start_date", e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => onFilterChange("end_date", e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm"
            />
          </div>

          <div className="lg:col-span-4 flex justify-end space-x-3">
            <button
              onClick={onClearFilters}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Clear Filters
            </button>
            <button
              onClick={onApplyFilters}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);

// SMS Filters Component
const SmsFilters = ({
  showFilters,
  setShowFilters,
  filters,
  onFilterChange,
  onClearFilters,
  onApplyFilters,
}) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
    <div
      className="px-6 py-4 flex items-center justify-between cursor-pointer"
      onClick={() => setShowFilters(!showFilters)}
    >
      <div className="flex items-center">
        <FunnelIcon className="w-5 h-5 text-gray-500 mr-2" />
        <h2 className="text-lg font-medium text-gray-900">Filters</h2>
        {(filters.sms_type ||
          filters.status ||
          filters.start_date ||
          filters.end_date) && (
          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Active
          </span>
        )}
      </div>
      <ChevronRightIcon
        className={`w-5 h-5 text-gray-400 transform transition-transform ${showFilters ? "rotate-90" : ""}`}
      />
    </div>

    {showFilters && (
      <div className="px-6 pb-6 border-t border-gray-200 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SMS Type
            </label>
            <select
              value={filters.sms_type}
              onChange={(e) => onFilterChange("sms_type", e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm"
            >
              <option value="">All Types</option>
              <option value="payment_receipt">Payment Receipt</option>
              <option value="balance_reminder">Balance Reminder</option>
              <option value="general">General</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => onFilterChange("status", e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm"
            >
              <option value="">All Status</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => onFilterChange("start_date", e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => onFilterChange("end_date", e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm"
            />
          </div>

          <div className="lg:col-span-4 flex justify-end space-x-3">
            <button
              onClick={onClearFilters}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Clear Filters
            </button>
            <button
              onClick={onApplyFilters}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);

export default EmailLogs;
