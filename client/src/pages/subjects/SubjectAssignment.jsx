import React, { useState, useEffect } from "react";
import {
  PlusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PencilIcon,
  TrashIcon,
  AcademicCapIcon,
  UserGroupIcon,
  BookOpenIcon,
} from "@heroicons/react/24/outline";
import Modal from "../../components/common/Modal";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import BatchAssignmentForm from "../../components/subjects/BatchAssignmentForm";
import api from "../../components/axiosconfig/axiosConfig";

const SubjectAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedClasses, setExpandedClasses] = useState({});
  const [selectedYear, setSelectedYear] = useState("");

  const getData = async () => {
    setLoading(true);
    try {
      const [assignmentsRes, subjectsRes, teachersRes, classesRes, yearsRes] =
        await Promise.all([
          api.get("/getsubjectassignments"),
          api.get("/getsubjects"),
          api.get("/getteachers"),
          api.get("/getclasses"),
          api.get("/getacademicyearsforsubjectassignment"),
        ]);

      setAssignments(assignmentsRes.data);
      setSubjects(subjectsRes.data);
      setTeachers(teachersRes.data);
      setClasses(classesRes.data);

      // Set default selected year to current or first
      const years = yearsRes.data;
      setAcademicYears(years);
      const currentYear = years.find((y) => y.is_current) || years[0];
      if (currentYear) {
        setSelectedYear(currentYear.id);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    getData();
  }, []);

  // Filter assignments by selected academic year
  const filteredAssignments = assignments.filter(
    (a) => a.academic_year_id === parseInt(selectedYear),
  );

  // Group assignments by class
  const groupByClass = () => {
    const grouped = {};
    filteredAssignments.forEach((assignment) => {
      const classId = assignment.class_id;
      if (!grouped[classId]) {
        grouped[classId] = {
          class_id: assignment.class_id,
          class_name: assignment.class_name,
          room_number: assignment.room_number,
          assignments: [],
        };
      }
      grouped[classId].assignments.push(assignment);
    });
    return Object.values(grouped);
  };

  const groupedAssignments = groupByClass();

  const toggleClassExpand = (classId) => {
    setExpandedClasses((prev) => ({
      ...prev,
      [classId]: !prev[classId],
    }));
  };

  const handleAddAssignment = () => {
    setIsModalOpen(true);
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (window.confirm("Are you sure you want to delete this assignment?")) {
      try {
        await api.delete(`/deletesubjectassignment/${assignmentId}`);
        getData();
      } catch (error) {
        console.error("Error deleting assignment:", error);
        alert("Failed to delete assignment");
      }
    }
  };

  const handleSaveAssignment = async (assignmentData) => {
    try {
      // Handle batch assignment (multiple subjects)
      const { class_id, academic_year_id, teacher_id, subject_ids } =
        assignmentData;

      let successCount = 0;
      let errorCount = 0;

      for (const subjectId of subject_ids) {
        try {
          // Check if assignment already exists
          const existing = assignments.find(
            (a) =>
              a.class_id === class_id &&
              a.subject_id === subjectId &&
              a.academic_year_id === academic_year_id,
          );

          if (existing) {
            // Update existing
            await api.put(`/updatesubjectassignment/${existing.id}`, {
              subject_id: subjectId,
              class_id: class_id,
              teacher_id: teacher_id,
              academic_year_id: academic_year_id,
            });
          } else {
            // Create new
            await api.post("/createsubjectassignment", {
              subject_id: subjectId,
              class_id: class_id,
              teacher_id: teacher_id,
              academic_year_id: academic_year_id,
            });
          }
          successCount++;
        } catch (error) {
          console.error(`Error saving subject ${subjectId}:`, error);
          errorCount++;
        }
      }

      alert(
        `Batch assignment complete!\n✅ ${successCount} subjects assigned\n❌ ${errorCount} errors`,
      );
      setIsModalOpen(false);
      getData();
    } catch (error) {
      console.error("Error saving batch assignment:", error);
      alert("Failed to save assignments");
    }
  };

  const handleYearChange = (e) => {
    setSelectedYear(e.target.value);
    setExpandedClasses({}); // Reset expanded state when year changes
  };

  if (loading) {
    return <LoadingSpinner text="Loading subject assignments..." />;
  }

  const getTeacherName = (teacherId) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    return teacher
      ? `${teacher.first_name} ${teacher.last_name}`
      : "Not Assigned";
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Subject Assignments
          </h1>
          <p className="text-gray-600">
            Assign multiple subjects to classes and teachers
          </p>
        </div>
        <button
          onClick={handleAddAssignment}
          className="flex items-center space-x-2 bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          <span>Assign Subjects</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <p className="text-sm text-gray-600">Total Assignments</p>
          <p className="text-2xl font-bold text-gray-900">
            {filteredAssignments.length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <p className="text-sm text-gray-600">Active Teachers</p>
          <p className="text-2xl font-bold text-gray-900">{teachers.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <p className="text-sm text-gray-600">Subjects</p>
          <p className="text-2xl font-bold text-gray-900">{subjects.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <p className="text-sm text-gray-600">Classes with Assignments</p>
          <p className="text-2xl font-bold text-gray-900">
            {groupedAssignments.length}
          </p>
        </div>
      </div>

      {/* Academic Year Filter */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">
            Academic Year:
          </label>
          <select
            value={selectedYear}
            onChange={handleYearChange}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year_label} {year.is_current ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grouped Assignments by Class */}
      {groupedAssignments.length === 0 ? (
        <div className="bg-white rounded-lg shadow border p-12 text-center">
          <AcademicCapIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Subject Assignments
          </h3>
          <p className="text-gray-600 mb-4">
            No subjects have been assigned to classes for the selected academic
            year.
          </p>
          <button
            onClick={handleAddAssignment}
            className="bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600"
          >
            Batch Assign Subjects
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedAssignments.map((group) => (
            <div
              key={group.class_id}
              className="bg-white rounded-lg shadow border overflow-hidden"
            >
              {/* Class Header */}
              <div
                className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleClassExpand(group.class_id)}
              >
                <div className="flex items-center space-x-3">
                  {expandedClasses[group.class_id] ? (
                    <ChevronDownIcon className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronRightIcon className="w-5 h-5 text-gray-500" />
                  )}
                  <UserGroupIcon className="w-5 h-5 text-blue-500" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {group.class_name}
                    </h3>
                    {group.room_number && (
                      <p className="text-sm text-gray-500">
                        Room: {group.room_number}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-500">
                    {group.assignments.length} subject(s)
                  </span>
                </div>
              </div>

              {/* Assignments Table for this class */}
              {expandedClasses[group.class_id] && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Subject
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Subject Code
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Teacher
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {group.assignments.map((assignment) => (
                        <tr key={assignment.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center">
                              <BookOpenIcon className="w-4 h-4 text-gray-400 mr-2" />
                              <span className="font-medium text-gray-900">
                                {assignment.subject_name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-500">
                              {assignment.subject_code}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-900">
                              {getTeacherName(assignment.teacher_id)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex space-x-2">
                              <button
                                onClick={() =>
                                  handleDeleteAssignment(assignment.id)
                                }
                                className="text-red-600 hover:text-red-900"
                                title="Delete Assignment"
                              >
                                <TrashIcon className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Batch Assignment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Batch Assign Subjects to Class"
        size="large"
      >
        <BatchAssignmentForm
          subjects={subjects}
          teachers={teachers}
          classes={classes}
          academicYears={academicYears}
          existingAssignments={filteredAssignments}
          onSave={handleSaveAssignment}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  );
};

export default SubjectAssignments;
