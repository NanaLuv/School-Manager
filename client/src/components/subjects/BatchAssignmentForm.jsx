import React, { useState, useEffect } from "react";
import {
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

const BatchAssignmentForm = ({
  subjects,
  teachers,
  classes,
  academicYears,
  existingAssignments,
  onSave,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    class_id: "",
    academic_year_id: "",
    teacher_id: "",
    subject_ids: [],
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [selectAll, setSelectAll] = useState(false);
  const [errors, setErrors] = useState({});
  const [selectedSubjectsCount, setSelectedSubjectsCount] = useState(0);

  // Set default academic year to current
  useEffect(() => {
    const currentYear = academicYears.find((y) => y.is_current);
    if (currentYear && !formData.academic_year_id) {
      setFormData((prev) => ({
        ...prev,
        academic_year_id: currentYear.id,
      }));
    }
  }, [academicYears]);

  // Update selected count whenever subject_ids changes
  useEffect(() => {
    setSelectedSubjectsCount(formData.subject_ids.length);
  }, [formData.subject_ids]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleSubjectToggle = (subjectId) => {
    setFormData((prev) => {
      const isSelected = prev.subject_ids.includes(subjectId);
      const newSubjectIds = isSelected
        ? prev.subject_ids.filter((id) => id !== subjectId)
        : [...prev.subject_ids, subjectId];

      return { ...prev, subject_ids: newSubjectIds };
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setFormData((prev) => ({ ...prev, subject_ids: [] }));
      setSelectAll(false);
    } else {
      const allSubjectIds = filteredSubjects.map((s) => s.id);
      setFormData((prev) => ({ ...prev, subject_ids: allSubjectIds }));
      setSelectAll(true);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.class_id) {
      newErrors.class_id = "Please select a class";
    }
    if (!formData.academic_year_id) {
      newErrors.academic_year_id = "Please select an academic year";
    }
    if (!formData.teacher_id) {
      newErrors.teacher_id = "Please select a teacher";
    }
    if (formData.subject_ids.length === 0) {
      newErrors.subject_ids = "Please select at least one subject";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(formData);
    }
  };

  // Filter subjects by search term
  const filteredSubjects = subjects.filter(
    (subject) =>
      subject.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subject.subject_code.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Check if a subject is already assigned to this class/year
  const isSubjectAssigned = (subjectId) => {
    return existingAssignments.some(
      (a) =>
        a.subject_id === subjectId &&
        a.class_id === parseInt(formData.class_id) &&
        a.academic_year_id === parseInt(formData.academic_year_id),
    );
  };

  // Get teacher name by ID
  const getTeacherName = (teacherId) => {
    const teacher = teachers.find((t) => t.id === parseInt(teacherId));
    return teacher ? `${teacher.first_name} ${teacher.last_name}` : "";
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Academic Year *
          </label>
          <select
            name="academic_year_id"
            value={formData.academic_year_id}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              errors.academic_year_id ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Select Academic Year</option>
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year_label} {year.is_current ? "(Current)" : ""}
              </option>
            ))}
          </select>
          {errors.academic_year_id && (
            <p className="text-red-500 text-sm mt-1">
              {errors.academic_year_id}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Class *
          </label>
          <select
            name="class_id"
            value={formData.class_id}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              errors.class_id ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Select Class</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.class_name} {cls.room_number ? `(${cls.room_number})` : ""}
              </option>
            ))}
          </select>
          {errors.class_id && (
            <p className="text-red-500 text-sm mt-1">{errors.class_id}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Teacher (Same for all selected subjects) *
          </label>
          <select
            name="teacher_id"
            value={formData.teacher_id}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              errors.teacher_id ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Select Teacher</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.first_name} {teacher.last_name} -{" "}
                {teacher.specialization}
              </option>
            ))}
          </select>
          {errors.teacher_id && (
            <p className="text-red-500 text-sm mt-1">{errors.teacher_id}</p>
          )}
        </div>
      </div>

      {/* Subject Selection Section */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 p-4 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-md font-semibold text-gray-900">
              Select Subjects to Assign
            </h3>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {selectedSubjectsCount} subject(s) selected
              </span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-sm text-emerald-600 hover:text-emerald-800"
              >
                {selectAll ? "Deselect All" : "Select All"}
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-3 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search subjects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {filteredSubjects.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No subjects found matching your search
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredSubjects.map((subject) => {
                const isSelected = formData.subject_ids.includes(subject.id);
                const isAlreadyAssigned =
                  formData.class_id &&
                  formData.academic_year_id &&
                  isSubjectAssigned(subject.id);

                return (
                  <div
                    key={subject.id}
                    className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${
                      isAlreadyAssigned ? "bg-yellow-50" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <button
                        type="button"
                        onClick={() => handleSubjectToggle(subject.id)}
                        className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-emerald-500 border-emerald-500"
                            : "border-gray-300 hover:border-emerald-500"
                        }`}
                      >
                        {isSelected && (
                          <CheckIcon className="w-3 h-3 text-white" />
                        )}
                      </button>
                      <div>
                        <div className="font-medium text-gray-900">
                          {subject.subject_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          Code: {subject.subject_code}
                        </div>
                      </div>
                    </div>
                    {isAlreadyAssigned && (
                      <div className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                        Already assigned to this class/year
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Selected Subjects Summary */}
      {selectedSubjectsCount > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-green-800 mb-2">
            Selected Subjects ({selectedSubjectsCount})
          </h4>
          <div className="flex flex-wrap gap-2">
            {subjects
              .filter((s) => formData.subject_ids.includes(s.id))
              .map((subject) => (
                <span
                  key={subject.id}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                >
                  {subject.subject_name}
                  <button
                    type="button"
                    onClick={() => handleSubjectToggle(subject.id)}
                    className="ml-1 text-green-600 hover:text-green-800"
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </span>
              ))}
          </div>

          {formData.teacher_id && (
            <div className="mt-3 text-sm text-green-700">
              <strong>Teacher:</strong> {getTeacherName(formData.teacher_id)}
            </div>
          )}
        </div>
      )}

      {errors.subject_ids && (
        <p className="text-red-500 text-sm">{errors.subject_ids}</p>
      )}

      <div className="bg-blue-50 p-4 rounded-md">
        <p className="text-sm text-blue-700">
          <strong>Note:</strong> This will assign ALL selected subjects to the
          chosen class with the same teacher. Subjects that are already assigned
          will be updated with the new teacher.
        </p>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors"
        >
          Assign {selectedSubjectsCount} Subject
          {selectedSubjectsCount !== 1 ? "s" : ""}
        </button>
      </div>
    </form>
  );
};

export default BatchAssignmentForm;
