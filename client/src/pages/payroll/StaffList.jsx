import React, { useState, useEffect } from "react";
import {
  UserPlusIcon,
  PencilIcon,
  TrashIcon,
  PhoneIcon,
  BanknotesIcon,
  DocumentArrowUpIcon,
  DocumentArrowDownIcon,
  ArrowPathIcon,
  UserMinusIcon,
  UserIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import Modal from "../../components/common/Modal";
import * as XLSX from "xlsx";
import api from "../../components/axiosconfig/axiosConfig";
import useDebounce from "../../hooks/useDebounce";

const StaffList = () => {
  const [staff, setStaff] = useState([]);
  const [inactiveStaff, setInactiveStaff] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [isInactiveModalOpen, setIsInactiveModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  // Category Management State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryFormData, setCategoryFormData] = useState({
    category_name: "",
    description: "",
  });
  const [loadingCategories, setLoadingCategories] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    if (showActiveOnly) {
      fetchStaff();
    } else {
      fetchInactiveStaff();
    }
  }, [currentPage, debouncedSearchTerm, showActiveOnly]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const response = await api.get("/payroll/getstaff", {
        params: {
          page: currentPage,
          limit: 10,
          search: debouncedSearchTerm,
          is_active: "true",
        },
      });
      setStaff(response.data.staff || []);
      setTotalPages(response.data.pagination?.totalPages || 1);
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error("Error fetching staff:", error);
    } finally {
      setLoading(false);
    }
  };

  // ========== CATEGORY MANAGEMENT FUNCTIONS ==========

  const handleAddCategory = () => {
    setEditingCategory(null);
    setIsCategoryModalOpen(true);
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setIsCategoryModalOpen(true);
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm("Are you sure you want to delete this category?"))
      return;

    try {
      await api.delete(`/payroll/categories/${categoryId}`);
      alert("Category deleted successfully!");
    } catch (error) {
      console.error("Error deleting category:", error);
      alert(error.response?.data?.error || "Failed to delete category");
    }
  };

  const fetchInactiveStaff = async () => {
    setLoading(true);
    try {
      const response = await api.get("/payroll/staff/inactive", {
        params: {
          page: currentPage,
          limit: 10,
          search: debouncedSearchTerm,
        },
      });

      setInactiveStaff(response.data.staff || []);
      setTotalPages(response.data.pagination?.totalPages || 1);
    } catch (error) {
      console.error("Error fetching inactive staff:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = () => {
    setEditingStaff(null);
    setIsAddModalOpen(true);
  };

  const handleBulkImport = () => {
    setIsBulkImportModalOpen(true);
  };

  const handleViewInactive = () => {
    setShowActiveOnly(false);
    setCurrentPage(1);
    setIsInactiveModalOpen(true);
  };

  const handleViewActive = () => {
    setShowActiveOnly(true);
    setCurrentPage(1);
    fetchStaff();
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        staff_number: "EMP001",
        first_name: "Nana",
        last_name: "Manu",
        category: "Teacher",
        employment_date: "2024-01-15",
        contact_phone: "0551234567",
        bank_name: "GCB Bank",
        bank_account_number: "1234567890",
        bank_branch: "Accra Main",
        mobile_money_number: "0551234567",
        mobile_money_provider: "MTN",
        emergency_contact: "Nana Love",
        emergency_phone: "0557654321",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "staff_import_template.xlsx");
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const staffData = jsonData
        .map((row) => ({
          staff_number: row.staff_number || row["Staff Number"],
          first_name: row.first_name || row["First Name"],
          last_name: row.last_name || row["Last Name"],
          category_id: getCategoryIdByName(row.category || row["Category"]),
          employment_date: row.employment_date || row["Employment Date"],
          contact_phone: row.contact_phone || row["Contact Phone"],
          bank_name: row.bank_name || row["Bank Name"],
          bank_account_number: row.bank_account_number || row["Account Number"],
          bank_branch: row.bank_branch || row["Bank Branch"],
          mobile_money_number: row.mobile_money_number || row["Mobile Money"],
          mobile_money_provider:
            row.mobile_money_provider || row["Mobile Provider"],
          emergency_contact: row.emergency_contact || row["Emergency Contact"],
          emergency_phone: row.emergency_phone || row["Emergency Phone"],
        }))
        .filter((staff) => staff.first_name && staff.last_name);

      try {
        const response = await api.post("/payroll/bulk-import", {
          staff: staffData,
        });

        alert(`Successfully imported ${response.data.imported} staff members`);
        setIsBulkImportModalOpen(false);
        fetchStaff();
      } catch (error) {
        console.error("Error importing staff:", error);
        alert("Failed to import staff. Please check the file format.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const getCategoryIdByName = (categoryName) => {
    const category = categories.find(
      (cat) => cat.category_name.toLowerCase() === categoryName?.toLowerCase(),
    );
    return category ? category.id : 1;
  };

  const handleEditStaff = (staffMember) => {
    setEditingStaff(staffMember);
    setIsAddModalOpen(true);
  };

  const handleDeleteStaff = async (staffMember) => {
    if (staffMember.has_payroll_history) {
      const confirmDeactivate = window.confirm(
        `This staff member has payroll history.\n\nDo you want to DEACTIVATE ${staffMember.first_name} ${staffMember.last_name}?\n\n- They won't appear in active staff lists\n- They can be reactivated later\n- Payroll records will be preserved\n\nClick OK to deactivate, Cancel to cancel.`,
      );

      if (confirmDeactivate) {
        try {
          await api.put(`/payroll/staff/${staffMember.id}/deactivate`, {
            is_active: false,
          });
          alert(
            `${staffMember.first_name} ${staffMember.last_name} has been deactivated`,
          );
          fetchStaff();
        } catch (error) {
          console.error("Error deactivating staff:", error);
          alert("Failed to deactivate staff member");
        }
      }
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to DELETE ${staffMember.first_name} ${staffMember.last_name}?\n\nThis action cannot be undone.`,
    );

    if (confirmDelete) {
      try {
        await api.delete(`/payroll/staff/${staffMember.id}`);
        alert("Staff member deleted successfully");
        fetchStaff();
      } catch (error) {
        console.error("Error deleting staff:", error);
        alert(error.response?.data?.error || "Failed to delete staff member");
      }
    }
  };

  const handleActivateStaff = async (staffMember) => {
    const confirmActivate = window.confirm(
      `Activate ${staffMember.first_name} ${staffMember.last_name}?\n\nThey will be available for payroll processing again.`,
    );

    if (confirmActivate) {
      try {
        const response = await api.put(
          `/payroll/staff/${staffMember.id}/activate`,
        );
        alert(response.data.message);
        fetchInactiveStaff();
        fetchStaff();
      } catch (error) {
        console.error("Error activating staff:", error);
        alert(error.response?.data?.error || "Failed to activate staff member");
      }
    }
  };

  // Unified save function that decides which action to take
  const handleSaveStaff = async (staffData) => {
    try {
      if (editingStaff) {
        // Call the update function
        await handleUpdateStaff(staffData);
      } else {
        // Call the create function
        await handleSaveNewStaff(staffData);
      }
    } catch (error) {
      // Error is already handled in the individual functions
      console.error("Error in handleSaveStaff:", error);
    }
  };

  const handleSaveNewStaff = async (staffData) => {
    try {
      await api.post("/payroll/addstaff", staffData);
      alert("Staff member added successfully!");
      setIsAddModalOpen(false);
      fetchStaff();
    } catch (error) {
      console.error("❌ Error creating staff:", error);
      alert(error.response?.data?.error || "Failed to create staff member");
    }
  };

  const handleUpdateStaff = async (staffData) => {
    if (!editingStaff?.id) {
      alert("No staff member selected for update");
      return;
    }

    try {
      await api.put(`/update-payroll/staff/${editingStaff.id}`, staffData);
      alert("Staff member updated successfully!");
      setIsAddModalOpen(false);
      setEditingStaff(null);
      fetchStaff();
    } catch (error) {
      console.error("❌ Error updating staff:", error);
      console.error("❌ Response status:", error.response?.status);
      console.error("❌ Response data:", error.response?.data);

      if (error.response?.status === 404) {
        alert(`Route not found. Please check the backend route.`);
      } else if (error.response?.status === 401) {
        alert("Your session has expired. Please login again.");
        window.location.href = "/login";
      } else {
        alert(error.response?.data?.error || "Failed to update staff member");
      }
    }
  };

  const exportStaff = () => {
    const dataToExport = showActiveOnly ? staff : inactiveStaff;
    const exportData = dataToExport.map((s) => ({
      "Staff ID": s.staff_number,
      Name: `${s.first_name} ${s.last_name}`,
      Category: s.category_name,
      Phone: s.contact_phone,
      Bank: s.bank_name,
      Account: s.bank_account_number,
      "Mobile Money": s.mobile_money_number,
      Employed: new Date(s.employment_date).toLocaleDateString(),
      Status: s.is_active ? "Active" : "Inactive",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Staff");
    XLSX.writeFile(
      workbook,
      `${showActiveOnly ? "active" : "inactive"}_staff_export_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
  };

  const currentStaffList = showActiveOnly ? staff : inactiveStaff;

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // Category Modal Component
  // const CategoryModal = () => (
  //   <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
  //     <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
  //       <div className="p-6">
  //         <div className="flex justify-between items-center mb-4">
  //           <h3 className="text-xl font-semibold text-gray-900">
  //             {editingCategory ? "Edit Category" : "Add New Category"}
  //           </h3>
  //           <button
  //             onClick={() => {
  //               setIsCategoryModalOpen(false);
  //               setEditingCategory(null);
  //               setCategoryFormData({ category_name: "", description: "" });
  //             }}
  //             className="text-gray-400 hover:text-gray-500"
  //           >
  //             ✕
  //           </button>
  //         </div>

  //         <div className="space-y-4">
  //           <div>
  //             <label className="block text-sm font-medium text-gray-700 mb-1">
  //               Category Name *
  //             </label>
  //             <input
  //               type="text"
  //               value={categoryFormData.category_name}
  //               onChange={(e) =>
  //                 setCategoryFormData({
  //                   ...categoryFormData,
  //                   category_name: e.target.value,
  //                 })
  //               }
  //               placeholder="e.g., Teacher, Administrator, Accountant"
  //               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
  //             />
  //           </div>

  //           <div>
  //             <label className="block text-sm font-medium text-gray-700 mb-1">
  //               Description (Optional)
  //             </label>
  //             <textarea
  //               value={categoryFormData.description}
  //               onChange={(e) =>
  //                 setCategoryFormData({
  //                   ...categoryFormData,
  //                   description: e.target.value,
  //                 })
  //               }
  //               placeholder="Brief description of this category..."
  //               rows="3"
  //               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
  //             />
  //           </div>

  //           <div className="flex justify-end space-x-3 pt-4 border-t">
  //             <button
  //               type="button"
  //               onClick={() => {
  //                 setIsCategoryModalOpen(false);
  //                 setEditingCategory(null);
  //                 setCategoryFormData({ category_name: "", description: "" });
  //               }}
  //               className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
  //             >
  //               Cancel
  //             </button>
  //             <button
  //               type="button"
  //               onClick={
  //                 editingCategory ? handleUpdateCategory : handleAddCategory
  //               }
  //               className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
  //             >
  //               {editingCategory ? "Update Category" : "Add Category"}
  //             </button>
  //           </div>
  //         </div>
  //       </div>
  //     </div>
  //   </div>
  // );

  const CategoryModal = () => {
    const [localCategoryName, setLocalCategoryName] = useState("");
    const [localDescription, setLocalDescription] = useState("");

    useEffect(() => {
      if (editingCategory) {
        setLocalCategoryName(editingCategory.category_name || "");
        setLocalDescription(editingCategory.description || "");
      } else {
        setLocalCategoryName("");
        setLocalDescription("");
      }
    }, [editingCategory, isCategoryModalOpen]);

    const handleSave = async () => {
      if (!localCategoryName.trim()) {
        alert("Please enter a category name");
        return;
      }

      try {
        if (editingCategory) {
          await api.put(`/payroll/categories/${editingCategory.id}`, {
            category_name: localCategoryName,
            description: localDescription,
          });
          alert("Category updated successfully!");
        } else {
          await api.post("/payroll/addstaffcategory", {
            category_name: localCategoryName,
            description: localDescription,
          });
          alert("Category added successfully!");
          fetchStaff(); // Refresh categories after adding a new one
        }

        setIsCategoryModalOpen(false);
        setEditingCategory(null);
        setLocalCategoryName("");
        setLocalDescription("");
      } catch (error) {
        console.error("Error saving category:", error);
        alert(error.response?.data?.error || "Failed to save category");
      }
    };

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingCategory ? "Edit Category" : "Add New Category"}
              </h3>
              <button
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  setEditingCategory(null);
                  setLocalCategoryName("");
                  setLocalDescription("");
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={localCategoryName}
                  onChange={(e) => setLocalCategoryName(e.target.value)}
                  placeholder="e.g., Teacher, Administrator, Accountant"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={localDescription}
                  onChange={(e) => setLocalDescription(e.target.value)}
                  placeholder="Brief description of this category..."
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setIsCategoryModalOpen(false);
                    setEditingCategory(null);
                    setLocalCategoryName("");
                    setLocalDescription("");
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {editingCategory ? "Update Category" : "Add Category"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <LoadingSpinner text="Loading staff..." />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {showActiveOnly ? "Active Staff Members" : "Inactive Staff Members"}
          </h2>
          <p className="text-sm text-gray-600">
            Total: {currentStaffList.length} staff members
          </p>
        </div>
        <div className="flex gap-2">
          {showActiveOnly ? (
            <>
              <button
                onClick={handleViewInactive}
                className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg"
              >
                <UserMinusIcon className="w-5 h-5" />
                <span>View Inactive Staff</span>
              </button>
              <button
                onClick={exportStaff}
                className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
              >
                <DocumentArrowDownIcon className="w-5 h-5" />
                <span>Export</span>
              </button>
              <button
                onClick={handleBulkImport}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
              >
                <DocumentArrowUpIcon className="w-5 h-5" />
                <span>Bulk Import</span>
              </button>
              <button
                onClick={handleAddStaff}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                <UserPlusIcon className="w-5 h-5" />
                <span>Add Staff</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleViewActive}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                <UserIcon className="w-5 h-5" />
                <span>View Active Staff</span>
              </button>
              <button
                onClick={exportStaff}
                className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
              >
                <DocumentArrowDownIcon className="w-5 h-5" />
                <span>Export</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search Bar with Manage Categories Button */}
      <div className="mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search staff by name or staff number..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => {
                // This should work - update searchTerm immediately
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={() => {
              setEditingCategory(null);
              setCategoryFormData({ category_name: "", description: "" });
              setIsCategoryModalOpen(true);
            }}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg whitespace-nowrap"
          >
            <TagIcon className="w-5 h-5" />
            <span>Add Categories</span>
          </button>
        </div>
        {searchTerm && (
          <div className="mt-1 text-sm text-gray-500 flex items-center gap-2">
            <span>
              Searching for: <span className="font-medium">{searchTerm}</span>
            </span>
            {debouncedSearchTerm !== searchTerm && (
              <span className="text-gray-400">(typing...)</span>
            )}
            {debouncedSearchTerm === searchTerm && debouncedSearchTerm && (
              <span className="text-green-600">✓</span>
            )}
          </div>
        )}
      </div>
      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentStaffList.map((staffMember) => (
          <div
            key={staffMember.id}
            className={`bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow ${
              !staffMember.is_active
                ? "border-red-200 bg-red-50/30"
                : "border-gray-200"
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {staffMember.first_name} {staffMember.last_name}
                </h3>
                <p className="text-sm text-gray-500">
                  {staffMember.staff_number}
                </p>
                <p className="text-sm text-blue-600 font-medium mt-1">
                  {staffMember.category_name}
                </p>
                {!staffMember.is_active && (
                  <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    <UserMinusIcon className="w-3 h-3 mr-1" />
                    Inactive
                  </span>
                )}
              </div>
              <div className="flex space-x-2">
                {staffMember.is_active ? (
                  <>
                    <button
                      onClick={() => handleEditStaff(staffMember)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Edit"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteStaff(staffMember)}
                      className="text-red-600 hover:text-red-900"
                      title={
                        staffMember.has_payroll_history
                          ? "Deactivate"
                          : "Delete"
                      }
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleActivateStaff(staffMember)}
                    className="text-green-600 hover:text-green-900"
                    title="Activate Staff"
                  >
                    <ArrowPathIcon className="w-5 h-5" />
                    <span className="sr-only">Activate</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center text-sm text-gray-600">
                <PhoneIcon className="w-4 h-4 mr-2" />
                <span>{staffMember.contact_phone || "No phone"}</span>
              </div>

              {staffMember.bank_name && (
                <div className="flex items-center text-sm text-gray-600">
                  <BanknotesIcon className="w-4 h-4 mr-2" />
                  <span>
                    {staffMember.bank_name} ••••
                    {staffMember.bank_account_number?.slice(-4)}
                  </span>
                </div>
              )}

              {staffMember.mobile_money_number && (
                <div className="flex items-center text-sm text-gray-600">
                  <PhoneIcon className="w-4 h-4 mr-2" />
                  <span>
                    Mobile: {staffMember.mobile_money_number} (
                    {staffMember.mobile_money_provider})
                  </span>
                </div>
              )}

              <div className="text-sm text-gray-500">
                Employed since{" "}
                {new Date(staffMember.employment_date).toLocaleDateString()}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Status:</span>
                <span
                  className={`font-medium ${
                    staffMember.is_active ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {staffMember.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-2 border rounded-lg ${
                  currentPage === page
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-gray-300"
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
      {/* Add/Edit Staff Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingStaff(null);
        }}
        title={editingStaff ? "Edit Staff Member" : "Add New Staff"}
        size="large"
      >
        <StaffForm
          staff={editingStaff}
          categories={categories}
          onSave={handleSaveStaff}
          onCancel={() => {
            setIsAddModalOpen(false);
            setEditingStaff(null);
          }}
        />
      </Modal>
      {/* Bulk Import Modal */}
      <Modal
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        title="Bulk Import Staff"
        size="medium"
      >
        <BulkImportForm
          onDownloadTemplate={handleDownloadTemplate}
          onFileUpload={handleFileUpload}
          onCancel={() => setIsBulkImportModalOpen(false)}
        />
      </Modal>
      {/* Inactive Staff List Modal */}
      <Modal
        isOpen={isInactiveModalOpen}
        onClose={() => {
          setIsInactiveModalOpen(false);
          setShowActiveOnly(true);
          fetchStaff();
        }}
        title="Inactive Staff Members"
        size="large"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800">
              These staff members have been deactivated. They will not appear in
              active staff lists or payroll processing. You can reactivate them
              at any time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
            {inactiveStaff.map((staffMember) => (
              <div
                key={staffMember.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {staffMember.first_name} {staffMember.last_name}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {staffMember.staff_number}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {staffMember.category_name}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      handleActivateStaff(staffMember);
                      setIsInactiveModalOpen(false);
                    }}
                    className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                    Activate
                  </button>
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  <div>📞 {staffMember.contact_phone || "No phone"}</div>
                  {staffMember.bank_name && (
                    <div>🏦 {staffMember.bank_name}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {inactiveStaff.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No inactive staff members found
            </div>
          )}

          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={() => {
                setIsInactiveModalOpen(false);
                setShowActiveOnly(true);
                fetchStaff();
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
      {/* Category Modal */}
      {isCategoryModalOpen && <CategoryModal />}
    </div>
  );
};

// FIXED: Staff Form Component with proper useEffect
const StaffForm = ({ staff, categories, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    staff_number: "",
    first_name: "",
    last_name: "",
    category_id: "",
    employment_date: new Date().toISOString().split("T")[0],
    contact_phone: "",
    bank_name: "",
    bank_account_number: "",
    bank_branch: "",
    mobile_money_number: "",
    mobile_money_provider: "MTN",
    emergency_contact: "",
    emergency_phone: "",
  });

  // IMPORTANT: Update form data when staff prop changes (for editing)
  useEffect(() => {
    if (staff) {
      const formattedData = {
        staff_number: staff.staff_number || "",
        first_name: staff.first_name || "",
        last_name: staff.last_name || "",
        category_id: staff.category_id || "",
        employment_date: staff.employment_date
          ? staff.employment_date.split("T")[0]
          : new Date().toISOString().split("T")[0],
        contact_phone: staff.contact_phone || "",
        bank_name: staff.bank_name || "",
        bank_account_number: staff.bank_account_number || "",
        bank_branch: staff.bank_branch || "",
        mobile_money_number: staff.mobile_money_number || "",
        mobile_money_provider: staff.mobile_money_provider || "MTN",
        emergency_contact: staff.emergency_contact || "",
        emergency_phone: staff.emergency_phone || "",
      };
      setFormData(formattedData);
    } else {
      // Reset form when adding new staff
      setFormData({
        staff_number: "",
        first_name: "",
        last_name: "",
        category_id: categories[0]?.id || "",
        employment_date: new Date().toISOString().split("T")[0],
        contact_phone: "",
        bank_name: "",
        bank_account_number: "",
        bank_branch: "",
        mobile_money_number: "",
        mobile_money_provider: "MTN",
        emergency_contact: "",
        emergency_phone: "",
      });
    }
  }, [staff, categories]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 max-h-[70vh] overflow-y-auto p-1"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Staff Number *
          </label>
          <input
            type="text"
            name="staff_number"
            value={formData.staff_number}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            required
            placeholder="EMP001"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category *
          </label>
          <select
            name="category_id"
            value={formData.category_id}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select Category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.category_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First Name *
          </label>
          <input
            type="text"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last Name *
          </label>
          <input
            type="text"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Employment Date *
          </label>
          <input
            type="date"
            name="employment_date"
            value={formData.employment_date}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contact Phone *
          </label>
          <input
            type="tel"
            name="contact_phone"
            value={formData.contact_phone}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            required
            placeholder="0551234567"
          />
        </div>
      </div>

      {/* Bank Details Section */}
      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Bank Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bank Name
            </label>
            <input
              type="text"
              name="bank_name"
              value={formData.bank_name}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="GCB Bank"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Number
            </label>
            <input
              type="text"
              name="bank_account_number"
              value={formData.bank_account_number}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="1234567890"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bank Branch
            </label>
            <input
              type="text"
              name="bank_branch"
              value={formData.bank_branch}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Accra Main"
            />
          </div>
        </div>
      </div>

      {/* Mobile Money Section */}
      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Mobile Money
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mobile Money Number
            </label>
            <input
              type="text"
              name="mobile_money_number"
              value={formData.mobile_money_number}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="0551234567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mobile Money Provider
            </label>
            <select
              name="mobile_money_provider"
              value={formData.mobile_money_provider}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="MTN">MTN</option>
              <option value="Vodafone">Vodafone</option>
              <option value="AirtelTigo">AirtelTigo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Emergency Contact Section */}
      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Emergency Contact
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Emergency Contact Name
            </label>
            <input
              type="text"
              name="emergency_contact"
              value={formData.emergency_contact}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Emergency Phone
            </label>
            <input
              type="tel"
              name="emergency_phone"
              value={formData.emergency_phone}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-6 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {staff ? "Update Staff" : "Add Staff"}
        </button>
      </div>
    </form>
  );
};

// Bulk Import Form Component
const BulkImportForm = ({ onDownloadTemplate, onFileUpload, onCancel }) => {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">Instructions:</h4>
        <ul className="text-sm text-blue-700 list-disc pl-5 space-y-1">
          <li>Download the template file</li>
          <li>Fill in staff information</li>
          <li>Save as Excel file (.xlsx)</li>
          <li>Upload the completed file</li>
          <li>
            Categories should match exactly (Teacher, Administrator, etc.)
          </li>
        </ul>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <DocumentArrowUpIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 mb-4">Upload your Excel file</p>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={onFileUpload}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <p className="text-xs text-gray-500 mt-2">
          Only Excel files (.xlsx, .xls) are accepted
        </p>
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
        >
          <DocumentArrowDownIcon className="w-5 h-5" />
          Download Template
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffList;
