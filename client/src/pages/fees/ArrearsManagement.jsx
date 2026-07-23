import React, { useState, useEffect } from "react";
import {
  PlusIcon,
  UserIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  ArrowPathIcon,
  CreditCardIcon,
  FunnelIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import api from "../../components/axiosconfig/axiosConfig";
import { useAuth } from "../contexts/AuthContext";

const ArrearsManagement = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [arrears, setArrears] = useState([]);
  const [allTerms, setAllTerms] = useState([]);
  const [overpayments, setOverpayments] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formType, setFormType] = useState("arrear");

  const [filters, setFilters] = useState({
    class_id: "",
    academic_year_id: "",
    term_id: "",
    student_search: "",
    has_arrears: "all",
    has_overpayment: "all",
    amount_range: "all",
  });

  const [newRecord, setNewRecord] = useState({
    description: "",
    amount: "",
    academic_year_id: "",
    term_id: "",
    is_credit_note: false,
    can_refund: true,
  });

  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [terms, setTerms] = useState([]);

  // Fetch students when class filter changes
  useEffect(() => {
    fetchStudents();
  }, [filters.class_id]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, students]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [classesRes, yearsRes, termsRes] = await Promise.all([
        api.get("/getclasses"),
        api.get("/getacademicyears"),
        api.get("/getterms"),
      ]);

      setClasses(classesRes.data);
      setAcademicYears(yearsRes.data);
      setAllTerms(termsRes.data);

      const currentYear = yearsRes.data.find((year) => year.is_current);
      if (currentYear) {
        const currentYearTerms = termsRes.data.filter(
          (term) => term.academic_year_id === currentYear.id,
        );

        setFilters((prev) => ({
          ...prev,
          academic_year_id: currentYear.id,
          term_id: currentYearTerms[0]?.id || "",
        }));
      }

      // Initial fetch of students
      await fetchStudents();
    } catch (error) {
      console.error("Error fetching initial data:", error);
      alert("Error loading data");
    }
    setLoading(false);
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams();

      // Get all students (no pagination limit)
      params.append("includeInactive", "true");
      params.append("limit", "1000"); // Get all students

      if (filters.class_id) {
        params.append("class_id", filters.class_id);
      }

      const response = await api.get(`/getstudents?${params.toString()}`);
      const studentsData = response.data?.students || [];
      setStudents(studentsData);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
    setLoading(false);
  };

  const applyFilters = () => {
    let filtered = [...students];

    // Student search filter
    if (filters.student_search) {
      const searchTerm = filters.student_search.toLowerCase();
      filtered = filtered.filter(
        (student) =>
          student.first_name?.toLowerCase().includes(searchTerm) ||
          student.last_name?.toLowerCase().includes(searchTerm) ||
          student.admission_number?.toLowerCase().includes(searchTerm),
      );
    }

    // Has arrears filter
    if (filters.has_arrears === "yes") {
      filtered = filtered.filter((student) => student.has_arrears === 1);
    } else if (filters.has_arrears === "no") {
      filtered = filtered.filter((student) => !student.has_arrears);
    }

    // Has overpayment filter
    if (filters.has_overpayment === "yes") {
      filtered = filtered.filter((student) => student.has_overpayment === 1);
    } else if (filters.has_overpayment === "no") {
      filtered = filtered.filter((student) => !student.has_overpayment);
    }

    setFilteredStudents(filtered);
  };

  const fetchStudentRecords = async (studentId) => {
    try {
      const [arrearsRes, overpaymentsRes] = await Promise.all([
        api.get(`/getstudentarrears/${studentId}`),
        api.get(`/getstudentoverpayments/${studentId}`),
      ]);
      setArrears(arrearsRes.data?.arrears || []);
      setOverpayments(overpaymentsRes.data?.overpayments || []);
    } catch (error) {
      console.error("Error fetching student records:", error);
    }
  };

  const handleAddRecord = async () => {
    if (!selectedStudent || !newRecord.description || !newRecord.amount) {
      alert("Please fill all required fields");
      return;
    }

    if (!newRecord.term_id || newRecord.term_id === "") {
      alert("Please select a term");
      return;
    }

    if (!newRecord.academic_year_id || newRecord.academic_year_id === "") {
      alert("Please select an academic year");
      return;
    }

    try {
      const endpoint =
        formType === "arrear" ? "/addstudentarrear" : "/addstudentoverpayment";

      const payload =
        formType === "arrear"
          ? {
              student_id: selectedStudent.id,
              description: newRecord.description,
              amount: parseFloat(newRecord.amount),
              academic_year_id: parseInt(newRecord.academic_year_id),
              term_id: parseInt(newRecord.term_id),
              created_by: user?.id || 1,
            }
          : {
              student_id: selectedStudent.id,
              description: newRecord.description,
              amount: parseFloat(newRecord.amount),
              academic_year_id: parseInt(newRecord.academic_year_id),
              term_id: parseInt(newRecord.term_id),
              is_credit_note: newRecord.is_credit_note,
              can_refund: newRecord.can_refund,
              created_by: user?.id || 1,
            };

      await api.post(endpoint, payload);

      setNewRecord({
        description: "",
        amount: "",
        academic_year_id: filters.academic_year_id,
        term_id: filters.term_id,
        is_credit_note: false,
        can_refund: true,
      });
      setShowAddForm(false);

      await fetchStudentRecords(selectedStudent.id);

      alert(
        `${formType === "arrear" ? "Arrears" : "Credit"} added successfully`,
      );
    } catch (error) {
      console.error(`Error adding ${formType}:`, error);
      alert(
        `Error adding ${formType}: ${
          error.response?.data?.error || error.message
        }`,
      );
    }
  };

  const handleDeleteRecord = async (recordId, type) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`))
      return;

    try {
      const endpoint =
        type === "arrear"
          ? `/deletestudentarrear/${recordId}`
          : `/deletestudentoverpayment/${recordId}`;

      await api.delete(endpoint);
      await fetchStudentRecords(selectedStudent.id);
      alert(
        `${type === "arrear" ? "Arrear" : "Overpayment"} deleted successfully`,
      );
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      alert(`Error deleting ${type}`);
    }
  };

  const calculateTotalArrears = () => {
    return arrears.reduce(
      (total, arrear) => total + parseFloat(arrear.amount || 0),
      0,
    );
  };

  const calculateTotalOverpayments = () => {
    return overpayments
      .filter((op) => op.status === "Active")
      .reduce(
        (total, overpayment) => total + parseFloat(overpayment.amount || 0),
        0,
      );
  };

  const calculateNetBalance = () => {
    return calculateTotalOverpayments() - calculateTotalArrears();
  };

  // open the add form and set default values based on the type (arrear or overpayment)
  const openAddForm = async (type) => {
    setFormType(type);

    // Get current year and its terms
    const currentYear = academicYears.find((year) => year.is_current);
    const currentYearTerms = currentYear
      ? allTerms.filter((term) => term.academic_year_id === currentYear.id)
      : [];

    if (type === "arrear") {
      // For arrears: Default to current year, but also show previous years in dropdown
      // Use current year if it exists, otherwise use the most recent year
      let defaultYear = currentYear;

      if (!defaultYear && academicYears.length > 0) {
        // Sort years by start date descending (most recent first)
        const sortedYears = [...academicYears].sort(
          (a, b) => new Date(b.start_date) - new Date(a.start_date),
        );
        defaultYear = sortedYears[0];
      }

      if (defaultYear) {
        const yearTerms = allTerms.filter(
          (term) => term.academic_year_id === defaultYear.id,
        );

        setNewRecord((prev) => ({
          ...prev,
          academic_year_id: defaultYear.id,
          term_id: yearTerms[0]?.id || "",
          description: "",
          amount: "",
        }));
      } else {
        // No years available at all
        setNewRecord((prev) => ({
          ...prev,
          academic_year_id: "",
          term_id: "",
          description: "",
          amount: "",
        }));
      }
    } else {
      // For overpayments/credits: Always use current year
      if (currentYear) {
        // Get terms for current year
        const currentYearTerms = allTerms.filter(
          (term) => term.academic_year_id === currentYear.id,
        );

        // Try to match the selected term from filters, or use the first term
        const defaultTermId =
          currentYearTerms.find((term) => term.id === parseInt(filters.term_id))
            ?.id ||
          currentYearTerms[0]?.id ||
          "";

        setNewRecord((prev) => ({
          ...prev,
          academic_year_id: currentYear.id,
          term_id: defaultTermId,
          description: "",
          amount: "",
          is_credit_note: false,
          can_refund: true,
        }));
      } else {
        // If no current year, try to use the first available year
        const firstYear = academicYears[0];
        if (firstYear) {
          const firstYearTerms = allTerms.filter(
            (term) => term.academic_year_id === firstYear.id,
          );

          setNewRecord((prev) => ({
            ...prev,
            academic_year_id: firstYear.id,
            term_id: firstYearTerms[0]?.id || "",
            description: "",
            amount: "",
            is_credit_note: false,
            can_refund: true,
          }));
        } else {
          setNewRecord((prev) => ({
            ...prev,
            academic_year_id: "",
            term_id: "",
            description: "",
            amount: "",
            is_credit_note: false,
            can_refund: true,
          }));
        }
      }
    }

    setShowAddForm(true);
  };

  const clearFilters = () => {
    setFilters({
      class_id: "",
      academic_year_id: filters.academic_year_id,
      term_id: filters.term_id,
      student_search: "",
      has_arrears: "all",
      has_overpayment: "all",
      amount_range: "all",
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Student Balances Management
          </h1>
          <p className="text-gray-600">
            Manage outstanding arrears and overpayments
          </p>
        </div>
      </div>

      {/* Enhanced Filters */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <FunnelIcon className="w-5 h-5 mr-2" />
            Filters
          </h3>
          <button
            onClick={clearFilters}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 text-sm"
          >
            <ArrowPathIcon className="w-4 h-4" />
            <span>Clear Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Class
            </label>
            <select
              value={filters.class_id}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, class_id: e.target.value }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Classes</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.class_name}
                  {classItem.room_number && ` (${classItem.room_number})`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Academic Year
            </label>
            <select
              value={filters.academic_year_id}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  academic_year_id: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select Year</option>
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.year_label}
                  {year.is_current && " (Current)"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Term
            </label>
            <select
              value={filters.term_id}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, term_id: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select Term</option>
              {allTerms
                .filter(
                  (term) => term.academic_year_id === filters.academic_year_id,
                )
                .map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.term_name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Student
            </label>
            <input
              type="text"
              value={filters.student_search}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  student_search: e.target.value,
                }))
              }
              placeholder="Name or admission number..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Advanced Filters */}
        {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Has Arrears
            </label>
            <select
              value={filters.has_arrears}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, has_arrears: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Students</option>
              <option value="yes">With Arrears Only</option>
              <option value="no">Without Arrears</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Has Overpayment
            </label>
            <select
              value={filters.has_overpayment}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  has_overpayment: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Students</option>
              <option value="yes">With Overpayment Only</option>
              <option value="no">Without Overpayment</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount Range
            </label>
            <select
              value={filters.amount_range}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  amount_range: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Amounts</option>
              <option value="0-100">Ghc 0 - 100</option>
              <option value="100-500">Ghc 100 - 500</option>
              <option value="500+">Ghc 500+</option>
            </select>
          </div>
        </div> */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Students List */}
        <div className="bg-white rounded-lg shadow border">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Students ({filteredStudents.length})
            </h3>
            <span className="text-sm text-gray-500">
              {filters.class_id ? (
                <>
                  {filteredStudents.length} in{" "}
                  {classes.find((c) => c.id === parseInt(filters.class_id))
                    ?.class_name || "selected class"}
                </>
              ) : (
                `Showing ${filteredStudents.length} of ${students.length}`
              )}
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${
                  selectedStudent?.id === student.id ? "bg-blue-50" : ""
                }`}
                onClick={() => {
                  setSelectedStudent(student);
                  fetchStudentRecords(student.id);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      {student.first_name} {student.last_name}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {student.admission_number} •{" "}
                      {student.class_name || "No Class Assigned"}
                    </p>
                    <div className="flex space-x-2 mt-1">
                      {student.has_arrears && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          Arrears
                        </span>
                      )}
                      {student.has_overpayment && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Credit
                        </span>
                      )}
                    </div>
                  </div>
                  <UserIcon className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}

            {filteredStudents.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <UserIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No students match your filters</p>
                <button
                  onClick={clearFilters}
                  className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Balances Management - rest remains the same */}
        <div className="bg-white rounded-lg shadow border">
          <div className="p-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedStudent
                  ? `Balances for ${selectedStudent.first_name} ${selectedStudent.last_name}`
                  : "Select a Student"}
              </h3>
              {selectedStudent && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => openAddForm("overpayment")}
                    className="flex items-center space-x-2 bg-green-500 text-white px-3 py-2 rounded-md hover:bg-green-600 transition-colors"
                  >
                    <CreditCardIcon className="w-4 h-4" />
                    <span>Add Credit</span>
                  </button>
                  <button
                    onClick={() => openAddForm("arrear")}
                    className="flex items-center space-x-2 bg-red-500 text-white px-3 py-2 rounded-md hover:bg-red-600 transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span>Add Arrears</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {selectedStudent ? (
            <div className="p-4">
              {/* Net Balance Summary */}
              <div
                className={`mb-4 p-4 rounded-lg border ${
                  calculateNetBalance() >= 0
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {calculateNetBalance() >= 0 ? (
                      <CreditCardIcon className="w-5 h-5 text-green-500" />
                    ) : (
                      <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                    )}
                    <span
                      className={`font-semibold ${
                        calculateNetBalance() >= 0
                          ? "text-green-800"
                          : "text-red-800"
                      }`}
                    >
                      Net Balance
                    </span>
                  </div>
                  <span
                    className={`text-xl font-bold ${
                      calculateNetBalance() >= 0
                        ? "text-green-800"
                        : "text-red-800"
                    }`}
                  >
                    {calculateNetBalance() >= 0 ? "+" : ""}Ghc{" "}
                    {Math.abs(calculateNetBalance()).toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                  <div className="text-red-600">
                    Total Arrears: Ghc {calculateTotalArrears().toFixed(2)}
                  </div>
                  <div className="text-green-600">
                    Available Credit: Ghc{" "}
                    {calculateTotalOverpayments().toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Arrears List */}
              <div className="space-y-3 mb-6">
                <h4 className="font-medium text-gray-900">
                  Outstanding Arrears
                </h4>
                {arrears.map((arrear) => (
                  <div
                    key={arrear.id}
                    className="p-3 border border-red-200 rounded-lg bg-red-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {arrear.description}
                        </div>
                        <div className="text-sm text-gray-500 flex flex-wrap gap-2 mt-1">
                          <span>
                            {arrear.year_label || "N/A"} •{" "}
                            {arrear.term_name || "N/A"}
                          </span>
                          <span>
                            Added:{" "}
                            {new Date(arrear.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-lg font-semibold text-red-600">
                          Ghc {parseFloat(arrear.amount).toFixed(2)}
                        </span>
                        <button
                          onClick={() =>
                            handleDeleteRecord(arrear.id, "arrear")
                          }
                          className="text-red-600 hover:text-red-800"
                          title="Delete arrear"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {arrears.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No arrears recorded for this student
                  </div>
                )}
              </div>

              {/* Overpayments List */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">
                  Available Overpayments/Credits
                </h4>
                {overpayments
                  .filter((op) => op.status === "Active")
                  .map((overpayment) => (
                    <div
                      key={overpayment.id}
                      className="p-3 border border-green-200 rounded-lg bg-green-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">
                            {overpayment.description}
                          </div>
                          <div className="text-sm text-gray-500">
                            Added:{" "}
                            {new Date(
                              overpayment.created_at,
                            ).toLocaleDateString()}
                            {overpayment.is_credit_note && (
                              <span className="ml-2 text-blue-600 font-medium">
                                Credit Note
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-lg font-semibold text-green-600">
                            Ghc {parseFloat(overpayment.amount).toFixed(2)}
                          </span>
                          <button
                            onClick={() =>
                              handleDeleteRecord(overpayment.id, "overpayment")
                            }
                            className="text-green-600 hover:text-green-800"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                {overpayments.filter((op) => op.status === "Active").length ===
                  0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No active overpayments for this student
                  </div>
                )}
              </div>

              {/* Add Record Form */}
              {showAddForm && (
                <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <h4 className="font-medium text-gray-900 mb-3">
                    Add New{" "}
                    {formType === "arrear" ? "Arrear" : "Credit/Overpayment"}
                  </h4>

                  <div
                    className={`mb-4 p-3 rounded-lg ${
                      formType === "arrear"
                        ? "bg-yellow-50 border border-yellow-200 text-yellow-800"
                        : "bg-blue-50 border border-blue-200 text-blue-800"
                    }`}
                  >
                    <div className="flex items-start">
                      <InformationCircleIcon className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <strong>Note:</strong>{" "}
                        {formType === "arrear"
                          ? "Select the academic year and term when these fees were originally due. This is typically a previous term."
                          : "This credit will be applied to the current academic year and term for future bill adjustments."}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description *
                      </label>
                      <input
                        type="text"
                        value={newRecord.description}
                        onChange={(e) =>
                          setNewRecord((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder={
                          formType === "arrear"
                            ? "e.g., Balance from Term 2 2023-2024, Outstanding fees from last year, etc."
                            : "e.g., Overpayment, Credit note, Advance payment, Scholarship credit, etc."
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Academic Year *
                        </label>
                        <select
                          value={newRecord.academic_year_id}
                          onChange={(e) =>
                            setNewRecord((prev) => ({
                              ...prev,
                              academic_year_id: e.target.value,
                              term_id: "", // Reset term when academic year changes
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">Select Academic Year</option>
                          {academicYears
                            .sort(
                              (a, b) =>
                                new Date(b.start_date) - new Date(a.start_date),
                            ) // Most recent first
                            .map((year) => (
                              <option
                                key={year.id}
                                value={year.id}
                                className={
                                  year.is_current ? "font-semibold" : ""
                                }
                              >
                                {year.year_label}{" "}
                                {year.is_current ? "(Current)" : ""}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Term *
                        </label>
                        <select
                          value={newRecord.term_id}
                          onChange={(e) =>
                            setNewRecord((prev) => ({
                              ...prev,
                              term_id: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          disabled={!newRecord.academic_year_id}
                        >
                          <option value="">
                            {newRecord.academic_year_id
                              ? "Select Term"
                              : "Select Academic Year First"}
                          </option>
                          {allTerms
                            .filter(
                              (term) =>
                                term.academic_year_id ===
                                parseInt(newRecord.academic_year_id),
                            )
                            .sort(
                              (a, b) =>
                                new Date(a.start_date) - new Date(b.start_date),
                            ) // Chronological order
                            .map((term) => (
                              <option key={term.id} value={term.id}>
                                {term.term_name}
                                {term.start_date &&
                                  ` (${new Date(
                                    term.start_date,
                                  ).toLocaleDateString()})`}
                              </option>
                            ))}
                        </select>
                        {!newRecord.term_id && newRecord.academic_year_id && (
                          <p className="text-red-500 text-xs mt-1">
                            Please select a term
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newRecord.amount}
                        onChange={(e) =>
                          setNewRecord((prev) => ({
                            ...prev,
                            amount: e.target.value,
                          }))
                        }
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>

                    {formType === "overpayment" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="is_credit_note"
                            checked={newRecord.is_credit_note}
                            onChange={(e) =>
                              setNewRecord((prev) => ({
                                ...prev,
                                is_credit_note: e.target.checked,
                              }))
                            }
                            className="mr-2"
                          />
                          <label
                            htmlFor="is_credit_note"
                            className="text-sm text-gray-700"
                          >
                            Formal Credit Note
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="can_refund"
                            checked={newRecord.can_refund}
                            onChange={(e) =>
                              setNewRecord((prev) => ({
                                ...prev,
                                can_refund: e.target.checked,
                              }))
                            }
                            className="mr-2"
                          />
                          <label
                            htmlFor="can_refund"
                            className="text-sm text-gray-700"
                          >
                            Eligible for Refund
                          </label>
                        </div>
                      </div>
                    )}

                    <div className="flex space-x-3 pt-2">
                      <button
                        onClick={handleAddRecord}
                        disabled={
                          !newRecord.term_id ||
                          !newRecord.academic_year_id ||
                          !newRecord.amount ||
                          !newRecord.description
                        }
                        className={`px-4 py-2 text-white rounded-md hover:opacity-90 transition-colors ${
                          formType === "arrear" ? "bg-red-500" : "bg-green-500"
                        } ${
                          !newRecord.term_id ||
                          !newRecord.academic_year_id ||
                          !newRecord.amount ||
                          !newRecord.description
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        Save {formType === "arrear" ? "Arrear" : "Credit"}
                      </button>
                      <button
                        onClick={() => setShowAddForm(false)}
                        className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <UserIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Please select a student to manage balances</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArrearsManagement;
