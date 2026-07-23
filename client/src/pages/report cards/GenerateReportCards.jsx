import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CogIcon,
  AcademicCapIcon,
  UserGroupIcon,
  DocumentChartBarIcon,
  EyeIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ReportCardPreview from "../../components/report-cards/ReportCardPreview";
import { useAcademicData } from "../../hooks/useAcademicContext";
import api from "../../components/axiosconfig/axiosConfig";

const GenerateReportCards = () => {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [classes, setClasses] = useState([]);
  const [classStats, setClassStats] = useState({
    studentCount: 0,
    existingReportCards: 0,
    studentsWithGrades: 0,
    subjectsCount: 0,
  });
  const [formData, setFormData] = useState({
    class_id: "",
    issued_by: 1,
    force_update: false, // Add force update option
  });
  const [generationResults, setGenerationResults] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const navigate = useNavigate();

  const {
    academicYears,
    terms,
    selectedAcademicYear,
    selectedTerm,
    handleAcademicYearChange,
    handleTermChange,
    loading: academicLoading,
    error: academicError,
    getSelectedAcademicYear,
    getSelectedTerm,
  } = useAcademicData();

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (formData.class_id && selectedAcademicYear && selectedTerm) {
      fetchClassStats();
    }
  }, [formData.class_id, selectedAcademicYear, selectedTerm]);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const response = await api.get("/getclasses");
      setClasses(response.data);
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
    setLoading(false);
  };

  const fetchClassStats = async () => {
    if (!formData.class_id || !selectedAcademicYear || !selectedTerm) return;

    try {
      // Get student count in class
      const studentsRes = await api.get(
        `/getclasses/${formData.class_id}/students`,
      );

      // Check for existing report cards
      const reportCardsRes = await api.get(
        `/getreportcards?class_id=${formData.class_id}&academic_year_id=${selectedAcademicYear}&term_id=${selectedTerm}`,
      );

      // Get grades count to show how many students have grades
      const gradesRes = await api.get(
        `/getgrades?class_id=${formData.class_id}&academic_year_id=${selectedAcademicYear}&term_id=${selectedTerm}`,
      );

      const studentsWithGrades = new Set(
        gradesRes.data.map((g) => g.student_id),
      ).size;

      // Get subjects for this class
      const subjectsRes = await api.get(
        `/getclasssubjects/${formData.class_id}/${selectedAcademicYear}`,
      );

      setClassStats({
        studentCount: studentsRes.data.students?.length || 0,
        existingReportCards: reportCardsRes.data.length || 0,
        studentsWithGrades: studentsWithGrades,
        subjectsCount: subjectsRes.data?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching class stats:", error);
    }
  };

  const handleGenerate = async () => {
    if (!formData.class_id || !selectedAcademicYear || !selectedTerm) {
      alert("Please select class, academic year, and term");
      return;
    }

    // Check if students have grades
    if (classStats.studentsWithGrades === 0) {
      alert(
        "No students have grades entered for this term. Please enter grades first.",
      );
      return;
    }

    // Show warning if updating existing report cards
    if (classStats.existingReportCards > 0 && !formData.force_update) {
      setShowWarning(true);
      return;
    }

    await performGeneration();
  };

  const performGeneration = async () => {
    setGenerating(true);
    setGenerationResults(null);

    try {
      const termDetails = terms.find((t) => t.id == selectedTerm);

      const payload = {
        ...formData,
        academic_year_id: selectedAcademicYear,
        term_id: selectedTerm,
        term_start_date: termDetails?.start_date || null,
        term_end_date: termDetails?.end_date || null,
      };

      const response = await api.post("/generatereportcards", payload);

      setGenerationResults(response.data);

      let message = "";
      if (response.data.generated > 0 && response.data.updated > 0) {
        message = `✅ Generated ${response.data.generated} new report cards and updated ${response.data.updated} existing ones!`;
      } else if (response.data.generated > 0) {
        message = `✅ Successfully generated ${response.data.generated} new report cards!`;
      } else if (response.data.updated > 0) {
        message = `✅ Successfully updated ${response.data.updated} existing report cards!`;
      } else {
        message = `⚠️ No report cards were generated. ${response.data.skipped || 0} were skipped.`;
      }

      alert(message);
      fetchClassStats();
      setShowWarning(false);
    } catch (error) {
      console.error("Error generating report cards:", error);

      if (error.response?.data?.error) {
        alert("Error: " + error.response.data.error);
      } else if (error.response?.data?.details) {
        alert("Error: " + error.response.data.details);
      } else {
        alert("Error generating report cards: " + error.message);
      }
    }
    setGenerating(false);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleViewReportCards = () => {
    navigate("/academics/report-cards");
  };

  if (academicLoading) {
    return <LoadingSpinner text="Loading academic data..." />;
  }

  if (academicError) {
    return (
      <div className="p-6 text-red-600 bg-red-50 rounded-lg">
        <h2 className="text-lg font-bold mb-2">Error Loading Academic Data</h2>
        <p>{academicError}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
        >
          Retry
        </button>
      </div>
    );
  }

  const selectedYear = getSelectedAcademicYear();
  const selectedTermObj = getSelectedTerm();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <DocumentChartBarIcon className="w-6 h-6 mr-2 text-emerald-500" />
          Generate Report Cards
        </h1>
        <p className="text-gray-600 mt-1">
          Generate or update report cards for students based on their grades
        </p>
      </div>

      {/* Selected Academic Info */}
      {selectedYear && selectedTermObj && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-800">
                📅 Currently selected:{" "}
                <span className="font-semibold">
                  {selectedYear.year_label} • {selectedTermObj.term_name}
                </span>
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                {selectedYear.is_current && "✅ Current Academic Year • "}
                {new Date(selectedTermObj.start_date) <= new Date() &&
                  new Date(selectedTermObj.end_date) >= new Date() &&
                  "📌 Current Term (Active Today)"}
              </p>
            </div>
            <button
              onClick={() => {
                handleAcademicYearChange("");
                handleTermChange("");
                setFormData({
                  class_id: "",
                  issued_by: 1,
                  force_update: false,
                });
              }}
              className="text-xs text-emerald-700 hover:text-emerald-900"
            >
              Change Selection
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generation Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Generation Settings
            </h2>

            <div className="space-y-4">
              {/* Academic Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Academic Year *
                </label>
                <select
                  value={selectedAcademicYear || ""}
                  onChange={(e) => handleAcademicYearChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select Academic Year</option>
                  {academicYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.year_label} {year.is_current && "⭐ (Current)"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Term */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Term *
                </label>
                <select
                  value={selectedTerm || ""}
                  onChange={(e) => handleTermChange(e.target.value)}
                  disabled={!selectedAcademicYear}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
                >
                  <option value="">Select Term</option>
                  {terms.map((term) => {
                    const isCurrent =
                      new Date(term.start_date) <= new Date() &&
                      new Date(term.end_date) >= new Date();
                    return (
                      <option key={term.id} value={term.id}>
                        {term.term_name} {isCurrent && "📌 (Current)"}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Class Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Class *
                </label>
                <select
                  value={formData.class_id}
                  onChange={(e) =>
                    handleInputChange("class_id", e.target.value)
                  }
                  disabled={!selectedAcademicYear || !selectedTerm}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
                >
                  <option value="">Select Class</option>
                  {classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.class_name}{" "}
                      {classItem.room_number && `(${classItem.room_number})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Force Update Option */}
              {classStats.existingReportCards > 0 && (
                <div className="flex items-center space-x-2 p-3 bg-yellow-50 rounded border border-yellow-200">
                  <input
                    type="checkbox"
                    id="force_update"
                    checked={formData.force_update}
                    onChange={(e) =>
                      handleInputChange("force_update", e.target.checked)
                    }
                    className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-500"
                  />
                  <label
                    htmlFor="force_update"
                    className="text-sm text-yellow-800"
                  >
                    Force update existing report cards with latest grades
                  </label>
                </div>
              )}

              {/* Show selected info */}
              {selectedYear && selectedTermObj && formData.class_id && (
                <div className="p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-sm font-medium text-blue-800">
                    Ready to generate report cards for:
                  </p>
                  <p className="text-sm text-blue-700">
                    📚 {selectedYear.year_label} • {selectedTermObj.term_name} •{" "}
                    {classes.find((c) => c.id == formData.class_id)?.class_name}
                  </p>
                  {classStats.subjectsCount > 0 && (
                    <p className="text-xs text-blue-600 mt-1">
                      📖 {classStats.subjectsCount} subjects • 👨‍🎓{" "}
                      {classStats.studentCount} students
                    </p>
                  )}
                </div>
              )}

              {/* Preview Button */}
              {selectedAcademicYear && selectedTerm && formData.class_id && (
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="w-full flex items-center justify-center space-x-2 bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors"
                >
                  <EyeIcon className="w-4 h-4" />
                  <span>
                    {showPreview ? "Hide Preview" : "Show Sample Preview"}
                  </span>
                </button>
              )}

              {showPreview &&
                selectedAcademicYear &&
                selectedTerm &&
                formData.class_id && (
                  <div className="mt-4">
                    <ReportCardPreview
                      classId={formData.class_id}
                      academicYearId={selectedAcademicYear}
                      termId={selectedTerm}
                    />
                  </div>
                )}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={
                  generating ||
                  !formData.class_id ||
                  !selectedAcademicYear ||
                  !selectedTerm ||
                  classStats.studentsWithGrades === 0
                }
                className="w-full flex items-center justify-center space-x-2 bg-emerald-500 text-white px-4 py-3 rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {generating ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    <span>Generating Report Cards...</span>
                  </>
                ) : (
                  <>
                    <CogIcon className="w-5 h-5" />
                    <span>
                      {classStats.existingReportCards > 0 &&
                      !formData.force_update
                        ? "Generate New Report Cards (Skip Existing)"
                        : classStats.existingReportCards > 0 &&
                            formData.force_update
                          ? "Update All Report Cards"
                          : "Generate Report Cards"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results */}
          {generationResults && (
            <div
              className={`mt-6 p-6 rounded-lg ${
                generationResults.errors?.length > 0
                  ? "bg-yellow-50 border border-yellow-200"
                  : "bg-green-50 border border-green-200"
              }`}
            >
              <h3 className="text-lg font-semibold mb-3">Generation Results</h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {generationResults.generated || 0}
                  </div>
                  <div className="text-sm text-gray-600">New</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {generationResults.updated || 0}
                  </div>
                  <div className="text-sm text-gray-600">Updated</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {generationResults.skipped || 0}
                  </div>
                  <div className="text-sm text-gray-600">Skipped</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {generationResults.errors?.length || 0}
                  </div>
                  <div className="text-sm text-gray-600">Errors</div>
                </div>
              </div>

              {generationResults.errors?.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-yellow-800 mb-2 flex items-center">
                    <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                    Errors ({generationResults.errors.length})
                  </h4>
                  <div className="max-h-40 overflow-y-auto">
                    {generationResults.errors.map((error, index) => (
                      <div
                        key={index}
                        className="text-sm text-yellow-700 p-2 border-b border-yellow-200"
                      >
                        <strong>{error.student}:</strong> {error.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t">
                <button
                  onClick={handleViewReportCards}
                  className="w-full flex items-center justify-center space-x-2 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                >
                  <DocumentChartBarIcon className="w-4 h-4" />
                  <span>View All Report Cards</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Statistics Panel */}
        <div className="space-y-6">
          {/* Class Info Card */}
          {formData.class_id && selectedAcademicYear && selectedTerm && (
            <div className="bg-white rounded-lg shadow border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Class Information
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <UserGroupIcon className="w-5 h-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">
                      Total Students
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {classStats.studentCount || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <AcademicCapIcon className="w-5 h-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">
                      Students with Grades
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {classStats.studentsWithGrades || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <DocumentChartBarIcon className="w-5 h-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">
                      Existing Report Cards
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {classStats.existingReportCards || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CogIcon className="w-5 h-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">Subjects</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {classStats.subjectsCount || 0}
                  </span>
                </div>

                {classStats.studentsWithGrades === 0 &&
                  classStats.studentCount > 0 && (
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-xs text-red-700">
                        ⚠️ No grades entered for students in this class. Please
                        enter grades first.
                      </p>
                    </div>
                  )}

                {classStats.existingReportCards > 0 && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-700">
                      <strong>ℹ️ Note:</strong> {classStats.existingReportCards}{" "}
                      report card(s) already exist.
                      {!formData.force_update
                        ? " They will be skipped. Check 'Force update' to refresh them."
                        : " They will be updated with latest grades."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              How It Works
            </h3>

            <ul className="text-sm text-blue-700 space-y-2">
              <li className="flex items-start">
                <span className="mr-2">1️⃣</span>
                <span>Select academic year, term, and class</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">2️⃣</span>
                <span>System calculates grades using grading scales</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">3️⃣</span>
                <span>Generates individual report cards for each student</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">4️⃣</span>
                <span>
                  <strong>Updated!</strong> Existing report cards can be
                  refreshed with latest grades
                </span>
              </li>
            </ul>

            <div className="mt-4 p-3 bg-white rounded border">
              <p className="text-xs text-gray-600">
                <strong>Requirements:</strong> Students must have scores entered
                for all subjects. Use the "Force update" option to refresh
                existing report cards when grades change or new subjects are
                added.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Quick Actions
            </h3>

            <div className="space-y-2">
              <button
                onClick={handleViewReportCards}
                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-900">
                  📄 View All Report Cards
                </div>
                <div className="text-sm text-gray-600">
                  Browse and manage generated report cards
                </div>
              </button>

              <button
                onClick={() => navigate("/academics/grades")}
                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-900">
                  📝 Manage Scores
                </div>
                <div className="text-sm text-gray-600">
                  Enter or edit student scores
                </div>
              </button>

              <button
                onClick={() => navigate("/academics/grading-scales")}
                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-900">
                  ⚖️ Grading Scales
                </div>
                <div className="text-sm text-gray-600">
                  Configure grade calculations
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Modal for Force Update */}
      {showWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center mb-4">
              <ExclamationTriangleIcon className="w-6 h-6 text-yellow-500 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">
                Report Cards Already Exist
              </h3>
            </div>
            <p className="text-gray-600 mb-4">
              {classStats.existingReportCards} report card(s) already exist for
              this class and term. What would you like to do?
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setFormData((prev) => ({ ...prev, force_update: true }));
                  setShowWarning(false);
                  performGeneration();
                }}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                🔄 Update Existing Report Cards
              </button>
              <button
                onClick={() => {
                  setFormData((prev) => ({ ...prev, force_update: false }));
                  setShowWarning(false);
                  performGeneration();
                }}
                className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                 Generate Only New Report Cards
              </button>
              <button
                onClick={() => setShowWarning(false)}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateReportCards;
