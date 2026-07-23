import React, { useState, useEffect } from "react";
import {
  ChartBarIcon,
  UsersIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import api from "../../components/axiosconfig/axiosConfig";

const PayrollSummary = () => {
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchPeriodsData();
  }, []);

  // Auto-select first period when periods load
  useEffect(() => {
    if (periods.length > 0 && !selectedPeriodId) {
      const filtered = getFilteredPeriods();
      if (filtered.length > 0) {
        setSelectedPeriodId(filtered[0].id);
        fetchSummaryData(filtered[0].id);
      }
    }
  }, [periods, selectedYear]);

  const fetchPeriodsData = async () => {
    setLoading(true);
    try {
      const response = await api.get("/payroll/getpayrollperiods");
      const fetchedPeriods = response.data || [];

      // Format periods with month names
      const formattedPeriods = fetchedPeriods.map((period) => ({
        ...period,
        month_name: getMonthName(period.period_month),
        display_name: `${getMonthName(period.period_month)} ${period.period_year}`,
        is_current: isCurrentPeriod(period),
        total_gross: parseFloat(period.total_gross || 0),
        total_net: parseFloat(period.total_net || 0),
        total_deductions: parseFloat(period.total_deductions || 0),
        staff_count: period.staff_count || 0,
      }));

      setPeriods(formattedPeriods);

      // Get distinct years
      const years = [...new Set(fetchedPeriods.map((p) => p.period_year))];
      if (years.length > 0) {
        setSelectedYear(Math.max(...years));
      }
    } catch (error) {
      console.error("Error fetching periods data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummaryData = async (periodId) => {
    if (!periodId) return;

    setLoading(true);
    try {
      // Get the selected period from periods state (already has totals)
      const selectedPeriod = periods.find((p) => p.id === parseInt(periodId));

      if (!selectedPeriod) {
        // If not found in periods, fetch directly
        const periodResponse = await api.get(`/payroll/period/${periodId}`);
        const periodData = periodResponse.data;

        // Get entries for this period
        const entriesResponse = await api.get(`/payroll/entries/${periodId}`);

        const summary = {
          period: {
            ...periodData,
            month_name: getMonthName(periodData.period_month),
            display_name: `${getMonthName(periodData.period_month)} ${periodData.period_year}`,
          },
          totalGross: parseFloat(periodData.total_gross || 0),
          totalNet: parseFloat(periodData.total_net || 0),
          totalDeductions: parseFloat(periodData.total_deductions || 0),
          staffCount: periodData.staff_count || 0,
          averageSalary: periodData.staff_count
            ? (periodData.total_net || 0) / periodData.staff_count
            : 0,
          isProcessed: periodData.is_processed || false,
          processedDate: periodData.processed_at,
          entries: entriesResponse.data?.entries || [],
        };

        setSummaryData(summary);
      } else {
        // Get entries for this period to get detailed breakdown
        const entriesResponse = await api.get(`/payroll/entries/${periodId}`);

        const summary = {
          period: selectedPeriod,
          totalGross: selectedPeriod.total_gross,
          totalNet: selectedPeriod.total_net,
          totalDeductions: selectedPeriod.total_deductions,
          staffCount: selectedPeriod.staff_count,
          averageSalary: selectedPeriod.staff_count
            ? selectedPeriod.total_net / selectedPeriod.staff_count
            : 0,
          isProcessed: selectedPeriod.is_processed,
          processedDate: selectedPeriod.processed_at,
          entries: entriesResponse.data?.entries || [],
        };

        setSummaryData(summary);
      }
    } catch (error) {
      console.error("Error fetching summary data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (e) => {
    const periodId = e.target.value;
    setSelectedPeriodId(periodId);
    if (periodId) {
      fetchSummaryData(periodId);
    }
  };

  const handleYearChange = (e) => {
    const year = parseInt(e.target.value);
    setSelectedYear(year);
    // Reset selected period when year changes
    setSelectedPeriodId("");
    setSummaryData(null);
  };

  // Helper functions
  const getMonthName = (monthNumber) => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return months[monthNumber - 1] || `Month ${monthNumber}`;
  };

  const isCurrentPeriod = (period) => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    return (
      period.period_month === currentMonth && period.period_year === currentYear
    );
  };

  const getFilteredPeriods = () => {
    return periods.filter((p) => p.period_year === parseInt(selectedYear));
  };

  // Get available years
  const availableYears = [...new Set(periods.map((p) => p.period_year))].sort(
    (a, b) => b - a,
  );
  const filteredPeriods = getFilteredPeriods();

  if (loading && periods.length === 0) {
    return <LoadingSpinner text="Loading summary..." />;
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Payroll Summary
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Overview of payroll periods and processed data
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Year Filter */}
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-gray-500" />
            <select
              value={selectedYear}
              onChange={handleYearChange}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Period Filter */}
          <select
            value={selectedPeriodId}
            onChange={handlePeriodChange}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
          >
            <option value="">Select a period</option>
            {filteredPeriods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.display_name}
                {period.is_processed ? " ✅" : " ⏳"}
                {period.total_net > 0 &&
                  ` - Ghc ${period.total_net.toFixed(2)}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading state for period change */}
      {loading && selectedPeriodId && (
        <div className="py-12">
          <LoadingSpinner text="Loading period data..." />
        </div>
      )}

      {/* Selected Period Info */}
      {summaryData?.period && !loading && (
        <>
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div>
                <h3 className="text-lg font-medium text-blue-900">
                  {summaryData.period.month_name}{" "}
                  {summaryData.period.period_year}
                </h3>
                <p className="text-sm text-blue-700">
                  Period:{" "}
                  {new Date(summaryData.period.start_date).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    },
                  )}{" "}
                  to{" "}
                  {new Date(summaryData.period.end_date).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    },
                  )}
                </p>
              </div>
              <div className="mt-2 md:mt-0">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    summaryData.period.is_processed
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {summaryData.period.is_processed ? "Processed" : "Pending"}
                </span>
                {summaryData.period.is_processed &&
                  summaryData.processedDate && (
                    <p className="text-xs text-blue-600 mt-1">
                      Processed:{" "}
                      {new Date(summaryData.processedDate).toLocaleDateString()}
                    </p>
                  )}
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 p-6 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">
                    Total Net Pay
                  </p>
                  <p className="text-3xl font-bold text-blue-900 mt-2">
                    Ghc {summaryData.totalNet.toFixed(2)}
                  </p>
                </div>
                <CurrencyDollarIcon className="w-8 h-8 text-blue-500" />
              </div>
              <div className="mt-4 flex items-center">
                <span className="text-sm text-blue-700">
                  Paid to {summaryData.staffCount} staff
                </span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 p-6 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">
                    Average Salary
                  </p>
                  <p className="text-3xl font-bold text-green-900 mt-2">
                    Ghc{" "}
                    {summaryData.averageSalary.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <UsersIcon className="w-8 h-8 text-green-500" />
              </div>
              <div className="mt-4">
                <span className="inline-flex items-center text-sm text-green-700">
                  Per employee
                </span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 p-6 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">
                    Total Deductions
                  </p>
                  <p className="text-3xl font-bold text-purple-900 mt-2">
                    Ghc {summaryData.totalDeductions.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center text-sm text-purple-700">
                    <span>Tax, SSNIT & others</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 p-6 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600 font-medium">
                    Total Gross
                  </p>
                  <p className="text-3xl font-bold text-orange-900 mt-2">
                    Ghc {summaryData.totalGross.toFixed(2)}
                  </p>
                </div>
                <DocumentTextIcon className="w-8 h-8 text-orange-500" />
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Payroll Breakdown for {summaryData.period?.display_name}
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-gray-600">Gross Salary Total</span>
                <span className="font-semibold">
                  Ghc {summaryData.totalGross.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-gray-600">Total Deductions</span>
                <span className="font-semibold text-red-600">
                  - Ghc {summaryData.totalDeductions.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-gray-900 font-medium text-lg">
                  Net Payable
                </span>
                <span className="text-2xl font-bold text-blue-600">
                  Ghc {summaryData.totalNet.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Additional info */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Period Status</p>
                  <p
                    className={`font-medium ${
                      summaryData.period?.is_processed
                        ? "text-green-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {summaryData.period?.is_processed
                      ? "Fully Processed"
                      : "Draft/Pending"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Staff Included</p>
                  <p className="font-medium">
                    {summaryData.staffCount} employees
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Payroll Entries</p>
                  <p className="font-medium">
                    {summaryData.entries?.length || 0} records
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Period</p>
                  <p className="font-medium">
                    {new Date(
                      summaryData.period?.start_date,
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    -{" "}
                    {new Date(summaryData.period?.end_date).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                      },
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* No period selected message */}
      {!selectedPeriodId && !loading && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No period selected
          </h3>
          <p className="text-gray-600">
            Please select a payroll period from the dropdown above to view
            summary data.
          </p>
        </div>
      )}

      {/* No data for selected filters */}
      {filteredPeriods.length === 0 && !loading && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No periods found
          </h3>
          <p className="text-gray-600">
            No payroll periods found for {selectedYear}. Create periods first.
          </p>
        </div>
      )}
    </div>
  );
};

export default PayrollSummary;
