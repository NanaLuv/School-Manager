import React, { useState, useEffect } from "react";
import {
  ChartBarIcon,
  AcademicCapIcon,
  UserGroupIcon,
  TrophyIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  DocumentChartBarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { useAcademicData } from "../../hooks/useAcademicContext";
import api from "../../components/axiosconfig/axiosConfig";

const AssessmentDashboard = () => {
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
  const [selectedClass, setSelectedClass] = useState("");
  const [loading, setLoading] = useState(false);
  const [assessmentData, setAssessmentData] = useState(null);
  const [expandedSubjects, setExpandedSubjects] = useState({});

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClass && selectedAcademicYear && selectedTerm) {
      fetchAssessmentData();
    }
  }, [selectedClass, selectedAcademicYear, selectedTerm]);

  const fetchClasses = async () => {
    try {
      const response = await api.get("/getclasses");
      setClasses(response.data);
      if (response.data.length > 0) {
        setSelectedClass(response.data[0].id);
      }
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };

  const fetchAssessmentData = async () => {
    setLoading(true);
    try {
      const response = await api.get(
        `/assessment/class-performance?class_id=${selectedClass}&academic_year_id=${selectedAcademicYear}&term_id=${selectedTerm}`,
      );
      setAssessmentData(response.data);
    } catch (error) {
      console.error("Error fetching assessment data:", error);
      alert("Error loading assessment data");
    }
    setLoading(false);
  };

  const toggleSubjectExpand = (subjectId) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [subjectId]: !prev[subjectId],
    }));
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-600 bg-green-100";
    if (score >= 70) return "text-blue-600 bg-blue-100";
    if (score >= 60) return "text-yellow-600 bg-yellow-100";
    if (score >= 50) return "text-orange-600 bg-orange-100";
    return "text-red-600 bg-red-100";
  };

  const getGradeLetter = (score) => {
    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 60) return "C";
    if (score >= 50) return "D";
    if (score >= 40) return "E";
    return "F";
  };

  const handleExport = () => {
    if (!assessmentData) return;

    const exportData = {
      class_name: assessmentData.class_name,
      academic_year: assessmentData.academic_year,
      term: assessmentData.term,
      subjects: assessmentData.subjects,
      students: assessmentData.students,
      class_summary: assessmentData.class_summary,
    };

    // You can implement CSV/Excel export here
    console.log("Export data:", exportData);
    alert("Export feature coming soon!");
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading || academicLoading) {
    return <LoadingSpinner text="Loading assessment data..." />;
  }

  if (!assessmentData) {
    return (
      <div className="p-6 text-center">
        <DocumentChartBarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700">
          No Data Available
        </h2>
        <p className="text-gray-500 mt-2">
          Please select a class, academic year, and term to view assessment
          data.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto print:p-0">
      {/* Header */}
      <div className="mb-6 print:mb-4">
        <div className="flex justify-between items-start print:block">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <ChartBarIcon className="w-6 h-6 mr-2 text-blue-500" />
              Class Performance Assessment
            </h1>
            <p className="text-gray-600 mt-1">
              Comprehensive analysis of student performance
            </p>
          </div>

          {/* <div className="flex space-x-2 print:hidden">
            <button
              onClick={handleExport}
              className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              <span>Export</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              <PrinterIcon className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div> */}
        </div>
      </div>

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
              Class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.class_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Class Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Total Students</p>
              <p className="text-3xl font-bold">
                {assessmentData.class_summary.total_students}
              </p>
            </div>
            <UserGroupIcon className="w-12 h-12 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Class Average</p>
              <p className="text-3xl font-bold">
                {assessmentData.class_summary.class_average.toFixed(1)}%
              </p>
            </div>
            <AcademicCapIcon className="w-12 h-12 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow-lg p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Highest Score</p>
              <p className="text-3xl font-bold">
                {assessmentData.class_summary.highest_score.toFixed(1)}%
              </p>
              <p className="text-xs opacity-75 mt-1">
                {assessmentData.class_summary.top_student}
              </p>
            </div>
            <TrophyIcon className="w-12 h-12 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Pass Rate</p>
              <p className="text-3xl font-bold">
                {assessmentData.class_summary.pass_rate.toFixed(1)}%
              </p>
              <p className="text-xs opacity-75 mt-1">
                {assessmentData.class_summary.passed_students} passed
              </p>
            </div>
            <ArrowTrendingUpIcon className="w-12 h-12 opacity-50" />
          </div>
        </div>
      </div>

      {/* Grade Distribution */}
      <div className="bg-white rounded-lg shadow border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Grade Distribution
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {assessmentData.grade_distribution.map((grade) => (
            <div key={grade.grade} className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {grade.count}
              </div>
              <div className="text-sm text-gray-600">
                Students got {grade.grade}
              </div>
              <div className="text-xs text-gray-500">
                ({grade.percentage.toFixed(1)}%)
              </div>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${grade.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subject-wise Performance */}
      <div className="bg-white rounded-lg shadow border mb-6">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Subject-wise Performance Analysis
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Detailed breakdown of each subject's performance
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {assessmentData.subjects.map((subject) => (
            <div key={subject.subject_id} className="p-6">
              {/* Subject Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => toggleSubjectExpand(subject.subject_id)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    {expandedSubjects[subject.subject_id] ? (
                      <ChevronUpIcon className="w-5 h-5" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5" />
                    )}
                  </button>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {subject.subject_name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {subject.subject_code}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-6">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Class Average</p>
                    <p className="text-xl font-bold text-blue-600">
                      {subject.class_average.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Highest</p>
                    <p className="text-lg font-semibold text-green-600">
                      {subject.highest_score.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Lowest</p>
                    <p className="text-lg font-semibold text-red-600">
                      {subject.lowest_score.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Pass Rate</p>
                    <p className="text-lg font-semibold text-purple-600">
                      {subject.pass_rate.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Score Distribution Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>F (0-39)</span>
                  <span>E (40-49)</span>
                  <span>D (50-59)</span>
                  <span>C (60-69)</span>
                  <span>B (70-79)</span>
                  <span>A (80-100)</span>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-red-500"
                    style={{ width: `${subject.distribution.F || 0}%` }}
                  />
                  <div
                    className="bg-orange-500"
                    style={{ width: `${subject.distribution.E || 0}%` }}
                  />
                  <div
                    className="bg-yellow-500"
                    style={{ width: `${subject.distribution.D || 0}%` }}
                  />
                  <div
                    className="bg-blue-500"
                    style={{ width: `${subject.distribution.C || 0}%` }}
                  />
                  <div
                    className="bg-indigo-500"
                    style={{ width: `${subject.distribution.B || 0}%` }}
                  />
                  <div
                    className="bg-green-500"
                    style={{ width: `${subject.distribution.A || 0}%` }}
                  />
                </div>
              </div>

              {/* Expanded Details */}
              {expandedSubjects[subject.subject_id] && (
                <div className="mt-6 pt-4 border-t">
                  <h4 className="font-medium text-gray-900 mb-3">
                    Top Performers
                  </h4>
                  <div className="space-y-2 mb-6">
                    {subject.top_performers.map((student, idx) => (
                      <div
                        key={student.student_id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-sm font-medium text-gray-500">
                            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                          </span>
                          <span className="font-medium text-gray-900">
                            {student.student_name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(
                              student.score,
                            )}`}
                          >
                            {student.score.toFixed(1)}%
                          </span>
                          <span className="text-sm font-semibold text-gray-700">
                            {getGradeLetter(student.score)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <h4 className="font-medium text-gray-900 mb-3">
                    Needs Improvement
                  </h4>
                  <div className="space-y-2">
                    {subject.lowest_performers.map((student) => (
                      <div
                        key={student.student_id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <span className="font-medium text-gray-900">
                          {student.student_name}
                        </span>
                        <div className="flex items-center space-x-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(
                              student.score,
                            )}`}
                          >
                            {student.score.toFixed(1)}%
                          </span>
                          <span className="text-sm font-semibold text-gray-700">
                            {getGradeLetter(student.score)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Student Performance Table */}
      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Student Performance Summary
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Overall ranking and performance metrics
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Student Name
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Average Score
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Grade
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Subjects Passed
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Performance
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {assessmentData.students.map((student, index) => (
                <tr key={student.student_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      {index === 0 && (
                        <TrophyIcon className="w-5 h-5 text-yellow-500 mr-2" />
                      )}
                      <span className="font-medium text-gray-900">
                        {index + 1}
                        {index === 0
                          ? "st"
                          : index === 1
                            ? "nd"
                            : index === 2
                              ? "rd"
                              : "th"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {student.student_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {student.admission_number}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getScoreColor(
                        student.average_score,
                      )}`}
                    >
                      {student.average_score.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {student.grade}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-900">
                    {student.subjects_passed} / {student.total_subjects}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {student.performance_trend === "up" ? (
                      <div className="flex items-center text-green-600">
                        <ArrowTrendingUpIcon className="w-4 h-4 mr-1" />
                        <span className="text-xs">Improving</span>
                      </div>
                    ) : student.performance_trend === "down" ? (
                      <div className="flex items-center text-red-600">
                        <ArrowTrendingDownIcon className="w-4 h-4 mr-1" />
                        <span className="text-xs">Needs Attention</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-gray-500">
                        <span className="text-xs">Stable</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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

export default AssessmentDashboard;
