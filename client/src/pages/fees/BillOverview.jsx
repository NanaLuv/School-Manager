import React, { useState, useEffect } from "react";
import {
  DocumentTextIcon,
  UserGroupIcon,
  BanknotesIcon,
  AcademicCapIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  ChevronLeftIcon,
  CalendarIcon,
  UserIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { useAcademicData } from "../../hooks/useAcademicContext";
import api from "../../components/axiosconfig/axiosConfig";
import * as XLSX from "xlsx";

const BillAnalysisDashboard = () => {
  const {
    academicYears,
    terms,
    selectedAcademicYear,
    selectedTerm,
    handleAcademicYearChange,
    handleTermChange,
    loading: academicLoading,
    getSelectedAcademicYear,
    getSelectedTerm,
  } = useAcademicData();

  const [loading, setLoading] = useState(false);
  const [billCategories, setBillCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [students, setStudents] = useState([]);
  const [classBreakdown, setClassBreakdown] = useState([]);
  const [summary, setSummary] = useState({
    total_students: 0,
    total_amount: 0,
    average_amount: 0,
    total_classes: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryInfo, setCategoryInfo] = useState(null);
  const [pagination, setPagination] = useState({});

  useEffect(() => {
    fetchBillCategories();
  }, []);

  useEffect(() => {
    if (selectedAcademicYear && selectedTerm && selectedCategory) {
      fetchStudentsByCategory();
    }
  }, [selectedAcademicYear, selectedTerm, selectedCategory, searchTerm]);

  const fetchBillCategories = async () => {
    try {
      const response = await api.get("/getfeecategories");
      setBillCategories(response.data || []);
      if (response.data.length > 0) {
        setSelectedCategory(response.data[0].id);
      }
    } catch (error) {
      console.error("Error fetching bill categories:", error);
    }
  };

  const fetchStudentsByCategory = async () => {
    if (!selectedCategory || !selectedAcademicYear || !selectedTerm) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.get("/getstudentsbybillcategory", {
        params: {
          academic_year_id: selectedAcademicYear,
          term_id: selectedTerm,
          fee_category_id: selectedCategory,
          search: searchTerm,
          limit: 1000,
        },
      });

      const data = response.data;
      setStudents(data.students || []);
      setClassBreakdown(data.class_breakdown || []);
      setSummary({
        total_students: data.summary?.total_students || 0,
        total_amount: data.summary?.total_amount || 0,
        average_amount: data.summary?.average_amount || 0,
        total_classes: data.summary?.total_classes || 0,
      });
      setPagination(data.pagination || {});

      // Find category info
      const category = billCategories.find(
        (c) => c.id === parseInt(selectedCategory),
      );
      setCategoryInfo(category);
    } catch (error) {
      console.error("Error fetching students by category:", error);
      alert("Error loading student data");
    }
    setLoading(false);
  };

  const formatCurrency = (amount) => {
    return `Ghc ${parseFloat(amount || 0).toFixed(2)}`;
  };

  const handleExport = () => {
    if (!students.length) return;

    const exportData = students.map((student) => ({
      "Admission Number": student.admission_number,
      "Student Name": `${student.first_name} ${student.last_name}`,
      Class: student.class_name,
      "Bill Amount": student.bill_amount,
      "Final Amount": student.final_amount,
      "Has Custom Amount": student.has_custom_amount ? "Yes" : "No",
      "Due Date": student.due_date
        ? new Date(student.due_date).toLocaleDateString()
        : "N/A",
      Status: student.is_compulsory ? "Compulsory" : "Optional",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Students by Bill Category",
    );

    const fileName = `${categoryInfo?.category_name || "students"}_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handlePrint = () => {
    window.print();
  };

  if (academicLoading || loading) {
    return <LoadingSpinner text="Loading data..." />;
  }

  const selectedYear = getSelectedAcademicYear();
  const selectedTermObj = getSelectedTerm();

  return (
    <div className="p-6 max-w-7xl mx-auto print:p-0">
      {/* Header */}
      <div className="mb-6 print:mb-4">
        <div className="flex justify-between items-start print:block">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <DocumentTextIcon className="w-6 h-6 mr-2 text-blue-500" />
              Students by Bill Category
            </h1>
            <p className="text-gray-600 mt-1">
              View all students who have selected a specific bill category
            </p>
          </div>

          <div className="flex space-x-2 print:hidden">
            {students.length > 0 && (
              <>
                <button
                  onClick={handleExport}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  <span>Export</span>
                </button>
                {/* <button
                  onClick={handlePrint}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  <PrinterIcon className="w-4 h-4" />
                  <span>Print</span>
                </button> */}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Academic Context Display */}
      {selectedYear && selectedTermObj && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex flex-wrap justify-between items-center">
            <div>
              <p className="text-sm text-blue-800 font-medium">
                {selectedYear.year_label} • {selectedTermObj.term_name}
              </p>
              {categoryInfo && (
                <p className="text-xs text-blue-600 mt-1">
                  Category:{" "}
                  <span className="font-medium">
                    {categoryInfo.category_name}
                  </span>
                </p>
              )}
            </div>
            <div className="flex items-center space-x-4 text-sm text-blue-700">
              <span>{summary.total_students} students</span>
              <span>{summary.total_classes} classes</span>
              <span>{formatCurrency(summary.total_amount)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow border p-4 mb-6 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Academic Year
            </label>
            <select
              value={selectedAcademicYear || ""}
              onChange={(e) => handleAcademicYearChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Year</option>
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.year_label} {year.is_current && "(Current)"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Term
            </label>
            <select
              value={selectedTerm || ""}
              onChange={(e) => handleTermChange(e.target.value)}
              disabled={!selectedAcademicYear}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">Select Term</option>
              {terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.term_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bill Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              {billCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.category_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search students by name or admission number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Class Breakdown */}
      {classBreakdown.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Class Breakdown
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {classBreakdown.map((cls) => (
              <div
                key={cls.class_id}
                className="bg-white border border-gray-200 rounded-lg p-3"
              >
                <p className="text-sm font-medium text-gray-900">
                  {cls.class_name}
                </p>
                <p className="text-xs text-gray-500">
                  {cls.student_count} students •{" "}
                  {formatCurrency(cls.total_amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Info */}
      {categoryInfo && students.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="bg-indigo-100 p-3 rounded-full">
              <DocumentTextIcon className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {categoryInfo.category_name}
              </h2>
              {categoryInfo.description && (
                <p className="text-sm text-gray-600">
                  {categoryInfo.description}
                </p>
              )}
            </div>
            <div className="ml-auto flex items-center space-x-6 text-sm">
              <div className="text-center">
                <p className="text-gray-500">Students</p>
                <p className="text-xl font-bold text-gray-900">
                  {summary.total_students}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-500">Classes</p>
                <p className="text-xl font-bold text-gray-900">
                  {summary.total_classes}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-500">Total Amount</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(summary.total_amount)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-500">Average</p>
                <p className="text-xl font-bold text-blue-600">
                  {formatCurrency(summary.average_amount)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Students List */}
      {students.length === 0 ? (
        <div className="bg-white rounded-lg shadow border p-12 text-center">
          <DocumentTextIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Students Found
          </h3>
          <p className="text-gray-500">
            {categoryInfo
              ? `No students have selected "${categoryInfo.category_name}" in their finalized bills`
              : "Please select a bill category to view students"}
          </p>
          {categoryInfo && (
            <p className="text-sm text-gray-400 mt-2">
              Make sure bills have been generated and finalized for students
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Students ({students.length})
              {searchTerm && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  (filtered)
                </span>
              )}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Admission No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bill Amount
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Final Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.map((student, index) => (
                  <tr key={student.student_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-600 font-medium text-sm">
                            {student.first_name?.charAt(0) || ""}
                            {student.last_name?.charAt(0) || ""}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {student.first_name} {student.last_name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {student.admission_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {student.class_name}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500">
                      {formatCurrency(student.bill_amount)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      <span
                        className={
                          student.has_custom_amount
                            ? "text-purple-600"
                            : "text-green-600"
                        }
                      >
                        {formatCurrency(student.final_amount)}
                        {student.has_custom_amount && (
                          <span className="ml-1 text-xs text-purple-500">
                            (Custom)
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          student.is_compulsory
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {student.is_compulsory ? "Compulsory" : "Optional"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {student.due_date
                        ? new Date(student.due_date).toLocaleDateString()
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td
                    colSpan="5"
                    className="px-4 py-3 text-right font-medium text-gray-900"
                  >
                    Total:
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-green-600">
                    {formatCurrency(summary.total_amount)}
                  </td>
                  <td colSpan="2" className="px-4 py-3 text-sm text-gray-500">
                    {students.length} students
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          .print\\:p-0 {
            padding: 0;
          }
          .print\\:mb-4 {
            margin-bottom: 1rem;
          }
          .print\\:block {
            display: block;
          }
          .print\\:hidden {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default BillAnalysisDashboard;
