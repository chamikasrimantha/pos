// src/components/employees/EmployeesView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  updateEmployeeSalary,
  markEmployeeLeft,
  recordDailyWage,
  reverseDailyWage,
  getEmployeePayments,
  getPayrollMonthSheet,
  finalisePayrollMonth,
  recordSalaryPayment,
  reopenPayrollMonth,
  assignLeaveRecord,
  requestLeave,
  decideLeaveRequest,
  getLeaveRecords,
  getCustomerLedger,
  getCustomers,
  getShops,
  getUsers,
} from "@/lib/firestore-service";
import {
  formatCurrency,
  formatDate,
  renderEmployeePayslipHTML,
  renderPayrollSummaryHTML,
} from "@/lib/receipt-generator";
import { formatYearMonth } from "@/lib/payroll-math";
import {
  Employee,
  EmployeePayment,
  LeaveRecord,
  LeaveType,
  PayrollMonth,
  CustomerLedgerEntry,
} from "@/types";
import {
  Briefcase,
  Plus,
  Search,
  DollarSign,
  Calendar,
  Clock,
  Printer,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  UserCheck,
  UserX,
  CreditCard,
  Banknote,
  Building2,
  ChevronRight,
  X,
  ShieldAlert,
} from "lucide-react";

export function EmployeesView() {
  const {
    currentUser,
    activeShop,
    openPrintModal,
    showToast,
    refreshData,
    dataVersion,
  } = useApp();

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const [activeTab, setActiveTab] = useState<"employees" | "wages" | "payroll" | "leave">("employees");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => formatYearMonth(Date.now()));

  // Modals state
  const [isCreateEmpOpen, setIsCreateEmpOpen] = useState(false);
  const [isGiveWageOpen, setIsGiveWageOpen] = useState(false);
  const [isEditSalaryOpen, setIsEditSalaryOpen] = useState(false);
  const [isAssignLeaveOpen, setIsAssignLeaveOpen] = useState(false);
  const [isStaffLedgerOpen, setIsStaffLedgerOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [isRecordSalaryPayOpen, setIsRecordSalaryPayOpen] = useState(false);

  // Selected entities for modals
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollMonth | null>(null);

  // Form states - Create Employee
  const [empName, setEmpName] = useState("");
  const [empPhone, setEmpPhone] = useState("");
  const [empDesignation, setEmpDesignation] = useState("Sales Assistant");
  const [empBranch, setEmpBranch] = useState("rightway");
  const [empSalary, setEmpSalary] = useState("60000");
  const [empDefaultWage, setEmpDefaultWage] = useState("1500");
  const [empUserId, setEmpUserId] = useState("");
  const [empCreateStaffCust, setEmpCreateStaffCust] = useState(true);
  const [empNotes, setEmpNotes] = useState("");

  // Form states - Give Wage
  const [wageEmpId, setWageEmpId] = useState("");
  const [wageAmount, setWageAmount] = useState("1500");
  const [wageMethod, setWageMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [wageDate, setWageDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [wageNote, setWageNote] = useState("");

  // Form states - Edit Salary
  const [newSalary, setNewSalary] = useState("65000");
  const [salaryEffectiveMonth, setSalaryEffectiveMonth] = useState(() => formatYearMonth(Date.now()));
  const [salaryReason, setSalaryReason] = useState("Annual salary increment");

  // Form states - Assign / Request Leave
  const [leaveEmpId, setLeaveEmpId] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("OFF_DAY");
  const [leaveFrom, setLeaveFrom] = useState(() => new Date().toISOString().split("T")[0]);
  const [leaveTo, setLeaveTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [leaveDays, setLeaveDays] = useState("1");
  const [leaveReason, setLeaveReason] = useState("");

  // Reopen Modal state
  const [reopenReason, setReopenReason] = useState("");

  // Salary Payment Modal state
  const [salaryPayMethod, setSalaryPayMethod] = useState<"CASH" | "BANK_TRANSFER">("BANK_TRANSFER");
  const [salaryPayRef, setSalaryPayRef] = useState("");

  // Staff recovery overrides
  const [creditRecoveryOverrides, setCreditRecoveryOverrides] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data queries
  const shops = useMemo(() => getShops(), []);
  const allUsers = useMemo(() => getUsers(), [dataVersion]);
  const cashierUsers = useMemo(() => allUsers.filter((u) => u.role === "CASHIER"), [allUsers]);

  // Load employees
  const employees = useMemo(() => {
    if (!currentUser || !isSuperAdmin) return [];
    try {
      return getEmployees(currentUser);
    } catch {
      return [];
    }
  }, [currentUser, isSuperAdmin, dataVersion]);

  // Load payments for selected month
  const payments = useMemo(() => {
    if (!currentUser || !isSuperAdmin) return [];
    try {
      return getEmployeePayments(undefined, selectedMonth, currentUser);
    } catch {
      return [];
    }
  }, [currentUser, isSuperAdmin, selectedMonth, dataVersion]);

  // Load payroll sheet for selected month
  const { payrollMonths, sheetEmployees } = useMemo(() => {
    if (!currentUser || !isSuperAdmin) return { payrollMonths: [], sheetEmployees: [] };
    try {
      const res = getPayrollMonthSheet(selectedMonth, currentUser);
      return { payrollMonths: res.payrollMonths, sheetEmployees: res.employees };
    } catch {
      return { payrollMonths: [], sheetEmployees: [] };
    }
  }, [currentUser, isSuperAdmin, selectedMonth, dataVersion]);

  // Load leaves
  const leaveRecords = useMemo(() => {
    if (!currentUser) return [];
    try {
      return getLeaveRecords(undefined, currentUser);
    } catch {
      return [];
    }
  }, [currentUser, dataVersion]);

  // Staff credit entries for modal
  const staffLedgerEntries = useMemo(() => {
    if (!selectedEmp || !selectedEmp.customerAccountId || !currentUser) return [];
    try {
      return getCustomerLedger(selectedEmp.customerAccountId);
    } catch {
      return [];
    }
  }, [selectedEmp, currentUser, dataVersion]);

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return employees.filter((e) => {
      if (selectedBranch !== "ALL" && e.branchId !== selectedBranch) return false;
      if (q) {
        return (
          e.name.toLowerCase().includes(q) ||
          e.phone.includes(q) ||
          e.designation.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [employees, selectedBranch, searchQuery]);

  // Calculate live wage remaining for wage modal
  const wageModalEmp = employees.find((e) => e.id === wageEmpId);
  const wageMonthPayments = useMemo(() => {
    if (!wageEmpId) return [];
    const wageMonth = wageDate.slice(0, 7);
    return payments.filter((p) => p.employeeId === wageEmpId && p.month === wageMonth);
  }, [wageEmpId, wageDate, payments]);

  const wageDrawnThisMonth = wageMonthPayments.reduce((sum, p) => {
    return p.type === "WAGE_REVERSAL" ? sum - Math.abs(p.amount) : sum + p.amount;
  }, 0);

  const wageInputAmount = parseFloat(wageAmount) || 0;
  const wageNewTotal = wageDrawnThisMonth + wageInputAmount;
  const wageEmpSalary = wageModalEmp?.monthlySalary || 0;
  const wageRemaining = wageEmpSalary - wageNewTotal;
  const isWageOverSalary = wageRemaining < 0;

  // Handlers
  const handleOpenGiveWage = (emp: Employee) => {
    setSelectedEmp(emp);
    setWageEmpId(emp.id);
    setWageAmount((emp.dailyWageDefault || 1500).toString());
    setWageDate(new Date().toISOString().split("T")[0]);
    setWageNote("");
    setIsGiveWageOpen(true);
  };

  const handleOpenEditSalary = (emp: Employee) => {
    setSelectedEmp(emp);
    setNewSalary(emp.monthlySalary.toString());
    setSalaryEffectiveMonth(formatYearMonth(Date.now()));
    setSalaryReason("Annual salary adjustment");
    setIsEditSalaryOpen(true);
  };

  const handleOpenStaffLedger = (emp: Employee) => {
    setSelectedEmp(emp);
    setIsStaffLedgerOpen(true);
  };

  // Submit Create Employee
  const handleCreateEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      const created = await createEmployee({
        name: empName.trim(),
        phone: empPhone.trim(),
        designation: empDesignation.trim(),
        branchId: empBranch,
        joinDate: Date.now(),
        monthlySalary: parseFloat(empSalary) || 0,
        dailyWageDefault: parseFloat(empDefaultWage) || undefined,
        userId: empUserId || undefined,
        createStaffCustomer: empCreateStaffCust,
        notes: empNotes.trim() || undefined,
        callingUser: currentUser,
      });

      showToast(`Employee ${created.name} created successfully!`, "success");
      setIsCreateEmpOpen(false);
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to create employee", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Give Wage
  const handleGiveWageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !wageEmpId) return;

    const amt = parseFloat(wageAmount) || 0;
    if (amt <= 0) {
      showToast("Please enter a valid wage amount", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const dateTimestamp = new Date(wageDate).getTime();
      const res = await recordDailyWage({
        employeeId: wageEmpId,
        date: dateTimestamp,
        amount: amt,
        method: wageMethod,
        note: wageNote.trim() || undefined,
        callingUser: currentUser,
      });

      showToast(`Recorded daily wage of ${formatCurrency(amt)}`, "success");
      setIsGiveWageOpen(false);
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to record daily wage", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit Salary
  const handleEditSalarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedEmp) return;

    const sal = parseFloat(newSalary) || 0;
    if (sal <= 0) {
      showToast("Please enter a valid salary amount", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateEmployeeSalary({
        employeeId: selectedEmp.id,
        newSalary: sal,
        effectiveFrom: salaryEffectiveMonth,
        reason: salaryReason.trim(),
        callingUser: currentUser,
      });

      showToast(`Salary updated for ${selectedEmp.name}`, "success");
      setIsEditSalaryOpen(false);
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to update salary", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Reverse Wage
  const handleReverseWage = async (paymentId: string) => {
    if (!currentUser) return;
    const reason = window.prompt("Reason for reversing this wage entry:");
    if (!reason || !reason.trim()) return;

    try {
      await reverseDailyWage({
        paymentId,
        reason: reason.trim(),
        callingUser: currentUser,
      });
      showToast("Wage payment reversed", "success");
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to reverse wage payment", "error");
    }
  };

  // Submit Mark Left
  const handleMarkLeft = async (emp: Employee) => {
    if (!currentUser) return;
    if (!window.confirm(`Mark ${emp.name} as resigned / left employment?`)) return;

    try {
      await markEmployeeLeft({
        employeeId: emp.id,
        leaveDate: Date.now(),
        callingUser: currentUser,
      });
      showToast(`${emp.name} marked as left.`, "success");
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to mark employee as left", "error");
    }
  };

  // Finalise Payroll Month
  const handleFinalisePayroll = async (payroll: PayrollMonth) => {
    if (!currentUser) return;

    const recoveryVal = creditRecoveryOverrides[payroll.employeeId] !== undefined
      ? creditRecoveryOverrides[payroll.employeeId]
      : payroll.staffCreditRecovered;

    setIsSubmitting(true);
    try {
      const finalised = await finalisePayrollMonth({
        employeeId: payroll.employeeId,
        month: selectedMonth,
        staffCreditRecovery: recoveryVal,
        callingUser: currentUser,
      });

      showToast(`Finalised payroll for ${selectedMonth}! Net payable: ${formatCurrency(finalised.netPayable)}`, "success");
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to finalise payroll", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reopen Payroll Month
  const handleReopenPayrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedPayroll || !reopenReason.trim()) return;

    setIsSubmitting(true);
    try {
      await reopenPayrollMonth({
        employeeId: selectedPayroll.employeeId,
        month: selectedPayroll.month,
        reason: reopenReason.trim(),
        callingUser: currentUser,
      });

      showToast(`Payroll for ${selectedPayroll.month} reopened.`, "success");
      setIsReopenModalOpen(false);
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to reopen payroll", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Record Salary Payment
  const handleRecordSalaryPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedPayroll) return;

    setIsSubmitting(true);
    try {
      await recordSalaryPayment({
        employeeId: selectedPayroll.employeeId,
        month: selectedPayroll.month,
        paymentMethod: salaryPayMethod,
        paymentDate: Date.now(),
        reference: salaryPayRef.trim() || undefined,
        callingUser: currentUser,
      });

      showToast(`Recorded salary payment for ${selectedPayroll.month}!`, "success");
      setIsRecordSalaryPayOpen(false);
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to record salary payment", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Assign Leave / Off Day
  const handleAssignLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const daysNum = parseFloat(leaveDays) || 1;
    if (daysNum <= 0) {
      showToast("Leave days must be at least 0.5", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSuperAdmin) {
        await assignLeaveRecord({
          employeeId: leaveEmpId,
          type: leaveType,
          fromDate: leaveFrom,
          toDate: leaveTo,
          days: daysNum,
          reason: leaveReason.trim() || undefined,
          callingUser: currentUser,
        });
        showToast("Assigned leave / off day (Approved)!", "success");
      } else {
        await requestLeave({
          employeeId: leaveEmpId,
          type: leaveType,
          fromDate: leaveFrom,
          toDate: leaveTo,
          days: daysNum,
          reason: leaveReason.trim() || undefined,
          callingUser: currentUser,
        });
        showToast("Leave request submitted for Super Admin approval!", "success");
      }

      setIsAssignLeaveOpen(false);
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to save leave record", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Decide Leave Request
  const handleDecideLeave = async (leaveId: string, decision: "APPROVE" | "REJECT") => {
    if (!currentUser) return;
    try {
      await decideLeaveRequest({
        leaveId,
        decision,
        callingUser: currentUser,
      });
      showToast(`Leave request ${decision === "APPROVE" ? "Approved" : "Rejected"}`, "success");
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to process leave decision", "error");
    }
  };

  // Print Payslip
  const handlePrintPayslip = (payroll: PayrollMonth) => {
    const emp = employees.find((e) => e.id === payroll.employeeId);
    if (!emp) return;
    const shop = shops.find((s) => s.id === emp.branchId) || activeShop;
    const wageEntries = payments.filter((p) => p.employeeId === emp.id && p.month === payroll.month);
    const html = renderEmployeePayslipHTML(payroll, emp, shop, wageEntries, leaveRecords);
    openPrintModal(`Payslip — ${emp.name} (${payroll.month})`, html);
  };

  // Print Payroll Summary
  const handlePrintSummary = () => {
    const html = renderPayrollSummaryHTML(selectedMonth, payrollMonths, sheetEmployees, activeShop);
    openPrintModal(`Payroll Summary — ${selectedMonth}`, html);
  };

  // Access guard for cashiers:
  if (!isSuperAdmin) {
    // If cashier linked to an employee, offer My Leave
    const myEmp = employees.find((e) => e.userId === currentUser?.uid || (currentUser as any)?.linkedEmployeeId === e.id);
    return (
      <div className="page-responsive-container" style={{ padding: "24px" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", padding: "32px", textAlign: "center", maxWidth: "600px", margin: "40px auto" }}>
          <ShieldAlert size={48} color="#dc2626" style={{ margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: "20px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
            Employees & Payroll is Restricted
          </h2>
          <div style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "8px", lineHeight: "1.5" }}>
            This module contains confidential employee salaries, fixed wages, and payroll records. Access is strictly restricted to the Super Admin.
          </div>

          {myEmp && (
            <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px dashed var(--line)" }}>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)" }}>
                You are linked as employee: {myEmp.name} ({myEmp.designation})
              </div>
              <button
                className="btn btn-primary"
                style={{ marginTop: "12px" }}
                onClick={() => {
                  setLeaveEmpId(myEmp.id);
                  setIsAssignLeaveOpen(true);
                }}
              >
                <Plus size={16} /> Request Leave / Off Day
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="page-responsive-container"
      style={{
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        minHeight: "100%",
        paddingBottom: "90px",
      }}
    >
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
            Employees & Payroll (Super Admin)
          </h2>
          <div style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "2px" }}>
            Fixed monthly salaries, daily wage draws, staff credit recovery, payslips and leave management.
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-primary" onClick={() => setIsCreateEmpOpen(true)}>
            <Plus size={16} /> Add new employee
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--line)", paddingBottom: "8px", flexWrap: "wrap" }}>
        <button
          className={`btn ${activeTab === "employees" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("employees")}
        >
          <UserCheck size={16} /> Employees ({employees.length})
        </button>

        <button
          className={`btn ${activeTab === "wages" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("wages")}
        >
          <Banknote size={16} /> Daily Wages ({payments.length})
        </button>

        <button
          className={`btn ${activeTab === "payroll" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("payroll")}
        >
          <CreditCard size={16} /> Monthly Payroll ({selectedMonth})
        </button>

        <button
          className={`btn ${activeTab === "leave" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("leave")}
        >
          <Calendar size={16} /> Leave & Off Days ({leaveRecords.length})
        </button>
      </div>

      {/* TAB 1: EMPLOYEES LIST */}
      {activeTab === "employees" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Filter Bar */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <select
                className="input-field"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                style={{ width: "160px", height: "40px", fontSize: "13px" }}
              >
                <option value="ALL">All branches</option>
                <option value="rightway">RightWay Shoes</option>
                <option value="mega">Mega Shoes</option>
              </select>
            </div>

            <div style={{ position: "relative", width: "260px" }}>
              <input
                type="text"
                className="input-field"
                placeholder="Search employee name, phone…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: "34px", height: "40px", fontSize: "13px" }}
              />
              <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)" }} />
            </div>
          </div>

          {/* Employees Table */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="pos-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Branch</th>
                    <th>Designation</th>
                    <th className="num">Monthly Fixed Salary</th>
                    <th className="num">Default Daily Wage</th>
                    <th>Staff Customer Account</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => {
                    const shop = shops.find((s) => s.id === emp.branchId);
                    const isLeft = emp.status === "LEFT";

                    return (
                      <tr key={emp.id} style={{ opacity: isLeft ? 0.6 : 1 }}>
                        <td>
                          <div style={{ fontWeight: "700", color: "var(--ink)" }}>{emp.name}</div>
                          <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>{emp.phone}</div>
                        </td>
                        <td>
                          <span className="badge badge-neutral">{shop?.name || emp.branchId}</span>
                        </td>
                        <td>{emp.designation}</td>
                        <td className="num" style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
                          {formatCurrency(emp.monthlySalary)}
                        </td>
                        <td className="num" style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-2)" }}>
                          {emp.dailyWageDefault ? formatCurrency(emp.dailyWageDefault) : "-"}
                        </td>
                        <td>
                          {emp.customerAccountId ? (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenStaffLedger(emp)}
                              title="View staff credit & advances ledger"
                            >
                              Staff Ledger
                            </button>
                          ) : (
                            <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>Not linked</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${isLeft ? "badge-neutral" : "badge-success"}`}>
                            {isLeft ? "Resigned / Left" : "Active"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            {!isLeft && (
                              <>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleOpenGiveWage(emp)}
                                  title="Give Daily Wage"
                                >
                                  <Banknote size={14} /> Wage
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleOpenEditSalary(emp)}
                                  title="Edit Salary"
                                >
                                  Edit salary
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleMarkLeft(emp)}
                                  title="Mark as Resigned / Left"
                                  style={{ color: "#b91c1c" }}
                                >
                                  <UserX size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DAILY WAGES */}
      {activeTab === "wages" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Header Controls */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "14px", fontWeight: "600" }}>Month:</span>
              <input
                type="month"
                className="input-field"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ height: "40px", fontSize: "14px" }}
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={() => {
                if (employees.length > 0) {
                  handleOpenGiveWage(employees[0]);
                } else {
                  showToast("Please create an employee first", "error");
                }
              }}
            >
              <Plus size={16} /> Give daily wage
            </button>
          </div>

          {/* Wages Table */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="pos-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>Method</th>
                    <th className="num">Amount</th>
                    <th>Note</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--ink-2)" }}>
                        No daily wages recorded for {selectedMonth}. Click &quot;Give daily wage&quot; to issue.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => {
                      const emp = employees.find((e) => e.id === p.employeeId);
                      const isRev = p.type === "WAGE_REVERSAL";

                      return (
                        <tr key={p.id} style={{ background: isRev ? "#fff1f2" : undefined }}>
                          <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatDate(p.date)}</td>
                          <td style={{ fontWeight: "600" }}>{emp?.name || p.employeeId}</td>
                          <td>
                            <span className={`badge ${isRev ? "badge-neutral" : "badge-primary"}`}>
                              {isRev ? "Reversal" : "Daily Wage"}
                            </span>
                          </td>
                          <td>{p.method}</td>
                          <td className="num" style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums", color: isRev ? "#b91c1c" : "var(--ink)" }}>
                            {formatCurrency(p.amount)}
                          </td>
                          <td style={{ fontSize: "12px", color: "var(--ink-2)", maxWidth: "240px" }}>{p.note || "-"}</td>
                          <td>
                            {!isRev && p.type === "DAILY_WAGE" && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleReverseWage(p.id)}
                                title="Reverse Wage Entry"
                                style={{ color: "#b91c1c" }}
                              >
                                <RotateCcw size={13} /> Reverse
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MONTHLY PAYROLL */}
      {activeTab === "payroll" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Controls bar */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "14px", fontWeight: "600" }}>Payroll Month:</span>
              <input
                type="month"
                className="input-field"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ height: "40px", fontSize: "14px" }}
              />
            </div>

            <button className="btn btn-secondary" onClick={handlePrintSummary}>
              <Printer size={16} /> Print payroll summary sheet
            </button>
          </div>

          {/* Payroll Sheet Table */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="pos-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th className="num">Salary</th>
                    <th className="num">Wages Paid</th>
                    <th className="num">Staff Credit</th>
                    <th className="num">Credit Recovery</th>
                    <th className="num">Net Payable</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollMonths.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--ink-2)" }}>
                        No active employees for {selectedMonth}.
                      </td>
                    </tr>
                  ) : (
                    payrollMonths.map((p) => {
                      const emp = sheetEmployees.find((e) => e.id === p.employeeId);
                      const isFinalised = p.status === "FINALISED";
                      const isPaid = p.status === "PAID";
                      const isOpen = p.status === "OPEN";

                      const recoveryVal = creditRecoveryOverrides[p.employeeId] !== undefined
                        ? creditRecoveryOverrides[p.employeeId]
                        : p.staffCreditRecovered;

                      return (
                        <tr key={p.id}>
                          <td>
                            <div style={{ fontWeight: "700" }}>{emp?.name}</div>
                            <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>{emp?.designation}</div>
                          </td>
                          <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {formatCurrency(p.proRatedSalary)}
                          </td>
                          <td className="num" style={{ fontVariantNumeric: "tabular-nums", color: "#b91c1c" }}>
                            -{formatCurrency(p.dailyWagesPaid)}
                          </td>
                          <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {formatCurrency(p.staffCreditOutstanding)}
                          </td>
                          <td className="num">
                            {isOpen ? (
                              <input
                                type="number"
                                min="0"
                                max={p.staffCreditOutstanding}
                                className="input-field"
                                value={recoveryVal}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setCreditRecoveryOverrides({
                                    ...creditRecoveryOverrides,
                                    [p.employeeId]: val,
                                  });
                                }}
                                style={{ width: "100px", height: "32px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                              />
                            ) : (
                              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                                {formatCurrency(p.staffCreditRecovered)}
                              </span>
                            )}
                          </td>
                          <td className="num" style={{ fontWeight: "900", fontVariantNumeric: "tabular-nums", color: "#16a34a", fontSize: "15px" }}>
                            {formatCurrency(p.netPayable)}
                            {p.isOverpaid && (
                              <div style={{ fontSize: "11px", color: "#b91c1c", fontWeight: "normal" }}>
                                Overpaid by {formatCurrency(p.overpaidAmount)}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${isPaid ? "badge-success" : isFinalised ? "badge-primary" : "badge-neutral"}`}>
                              {p.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                              {isOpen && (
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleFinalisePayroll(p)}
                                  disabled={isSubmitting}
                                >
                                  Finalise
                                </button>
                              )}

                              {isFinalised && (
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => {
                                    setSelectedPayroll(p);
                                    setSalaryPayRef("");
                                    setIsRecordSalaryPayOpen(true);
                                  }}
                                >
                                  Pay salary
                                </button>
                              )}

                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handlePrintPayslip(p)}
                                title="Print Monthly Payslip"
                              >
                                <Printer size={14} /> Payslip
                              </button>

                              {!isOpen && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => {
                                    setSelectedPayroll(p);
                                    setReopenReason("");
                                    setIsReopenModalOpen(true);
                                  }}
                                  title="Reopen finalised month"
                                  style={{ color: "#b45309" }}
                                >
                                  <RotateCcw size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LEAVE & OFF DAYS */}
      {activeTab === "leave" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Header Controls */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: "700", margin: 0 }}>Roster & Leave Management</h3>
              <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                Assign off days directly (Approved) or review cashier leave requests
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => {
                if (employees.length > 0) setLeaveEmpId(employees[0].id);
                setIsAssignLeaveOpen(true);
              }}
            >
              <Plus size={16} /> Assign leave / off day
            </button>
          </div>

          {/* Pending Requests Cards */}
          {leaveRecords.filter((l) => l.status === "REQUESTED").length > 0 && (
            <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "var(--radius-tile)", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", color: "#92400e", marginBottom: "12px" }}>
                <Clock size={16} /> Pending Cashier Leave Requests
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
                {leaveRecords.filter((l) => l.status === "REQUESTED").map((lr) => {
                  const emp = employees.find((e) => e.id === lr.employeeId);
                  return (
                    <div key={lr.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "var(--radius-control)", padding: "12px" }}>
                      <div style={{ fontWeight: "700", fontSize: "14px" }}>{emp?.name}</div>
                      <div style={{ fontSize: "12px", color: "var(--ink-2)", marginTop: "2px" }}>
                        <strong>{lr.type}</strong> · {lr.days} day(s)
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>
                        {lr.fromDate} to {lr.toDate}
                      </div>
                      {lr.reason && <div style={{ fontSize: "12px", fontStyle: "italic", marginTop: "4px" }}>&quot;{lr.reason}&quot;</div>}
                      <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1 }}
                          onClick={() => handleDecideLeave(lr.id, "APPROVE")}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ flex: 1, color: "#b91c1c" }}
                          onClick={() => handleDecideLeave(lr.id, "REJECT")}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Leave History Table */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-tile)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="pos-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>From</th>
                    <th>To</th>
                    <th className="num">Days</th>
                    <th>Status</th>
                    <th>Reason / Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--ink-2)" }}>
                        No leave or off days recorded.
                      </td>
                    </tr>
                  ) : (
                    leaveRecords.map((lr) => {
                      const emp = employees.find((e) => e.id === lr.employeeId);
                      return (
                        <tr key={lr.id}>
                          <td style={{ fontWeight: "600" }}>{emp?.name}</td>
                          <td>
                            <span className="badge badge-neutral">{lr.type}</span>
                          </td>
                          <td>{lr.fromDate}</td>
                          <td>{lr.toDate}</td>
                          <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {lr.days}
                          </td>
                          <td>
                            <span className={`badge ${lr.status === "APPROVED" ? "badge-success" : lr.status === "REJECTED" ? "badge-neutral" : "badge-warning"}`}>
                              {lr.status}
                            </span>
                          </td>
                          <td style={{ fontSize: "12px", color: "var(--ink-2)" }}>{lr.reason || lr.note || "-"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE EMPLOYEE MODAL */}
      {isCreateEmpOpen && (
        <div className="modal-backdrop">
          <form onSubmit={handleCreateEmployeeSubmit} className="modal-panel animate-fade-in" style={{ maxWidth: "520px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Briefcase size={22} style={{ color: "var(--primary)" }} />
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>Add New Employee</h3>
                  <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>Create staff profile and payroll link</div>
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsCreateEmpOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Full Name *</label>
                <input type="text" required className="input-field" placeholder="e.g. Ruwan Jayawardena" value={empName} onChange={(e) => setEmpName(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Mobile Phone *</label>
                <input type="tel" required className="input-field" placeholder="e.g. 0771234567" value={empPhone} onChange={(e) => setEmpPhone(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Designation *</label>
                <input type="text" required className="input-field" placeholder="e.g. Sales Cashier" value={empDesignation} onChange={(e) => setEmpDesignation(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Branch *</label>
                <select className="input-field" value={empBranch} onChange={(e) => setEmpBranch(e.target.value)}>
                  <option value="rightway">RightWay Shoes</option>
                  <option value="mega">Mega Shoes</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Monthly Fixed Salary (Rs.) *</label>
                <input type="number" required min="0" className="input-field" value={empSalary} onChange={(e) => setEmpSalary(e.target.value)} style={{ fontWeight: "700" }} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Default Daily Wage (Rs.)</label>
                <input type="number" min="0" className="input-field" placeholder="e.g. 1500" value={empDefaultWage} onChange={(e) => setEmpDefaultWage(e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Link to Cashier Account (Optional)</label>
              <select className="input-field" value={empUserId} onChange={(e) => setEmpUserId(e.target.value)}>
                <option value="">-- No linked cashier account --</option>
                {cashierUsers.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "14px", padding: "10px", background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: "var(--radius-control)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
                <input type="checkbox" checked={empCreateStaffCust} onChange={(e) => setEmpCreateStaffCust(e.target.checked)} style={{ accentColor: "var(--primary)" }} />
                Create and link staff customer account for credit purchases & advances
              </label>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsCreateEmpOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Creating…" : "Save Employee"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* GIVE WAGE MODAL */}
      {isGiveWageOpen && (
        <div className="modal-backdrop">
          <form onSubmit={handleGiveWageSubmit} className="modal-panel animate-fade-in" style={{ maxWidth: "460px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Banknote size={22} style={{ color: "var(--primary)" }} />
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>Give Daily Wage</h3>
                  <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>Deducted from fixed monthly salary</div>
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsGiveWageOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Employee *</label>
              <select className="input-field" value={wageEmpId} onChange={(e) => setWageEmpId(e.target.value)}>
                {employees.filter((e) => e.status === "ACTIVE").map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.designation} - {formatCurrency(e.monthlySalary)})</option>
                ))}
              </select>
            </div>

            {/* Live calculation card */}
            <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "var(--radius-control)", padding: "10px 14px", marginBottom: "14px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Monthly salary:</span>
                <strong>{formatCurrency(wageEmpSalary)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#b91c1c", marginTop: "2px" }}>
                <span>Wages drawn this month:</span>
                <span>-{formatCurrency(wageDrawnThisMonth)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "700", borderTop: "1px solid #e2e8f0", paddingTop: "4px", marginTop: "4px" }}>
                <span>Salary remaining after this wage:</span>
                <span style={{ color: isWageOverSalary ? "#b91c1c" : "#16a34a" }}>
                  {formatCurrency(wageRemaining)}
                </span>
              </div>
            </div>

            {isWageOverSalary && (
              <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b", padding: "8px 12px", borderRadius: "var(--radius-control)", marginBottom: "12px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <AlertTriangle size={16} />
                <strong>Warning:</strong> Total wages will exceed this month&apos;s salary by {formatCurrency(Math.abs(wageRemaining))}!
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Amount (Rs.) *</label>
                <input type="number" required min="1" className="input-field" value={wageAmount} onChange={(e) => setWageAmount(e.target.value)} style={{ fontWeight: "700" }} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Payment Method</label>
                <select className="input-field" value={wageMethod} onChange={(e) => setWageMethod(e.target.value as any)}>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Date</label>
              <input type="date" className="input-field" value={wageDate} onChange={(e) => setWageDate(e.target.value)} />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Note (optional)</label>
              <input type="text" className="input-field" placeholder="e.g. Counter assistant daily draw" value={wageNote} onChange={(e) => setWageNote(e.target.value)} />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsGiveWageOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Recording…" : "Record Wage Draw"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT SALARY MODAL */}
      {isEditSalaryOpen && selectedEmp && (
        <div className="modal-backdrop">
          <form onSubmit={handleEditSalarySubmit} className="modal-panel animate-fade-in" style={{ maxWidth: "440px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <DollarSign size={22} style={{ color: "var(--primary)" }} />
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>Edit Salary</h3>
                  <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>{selectedEmp.name} (Current: {formatCurrency(selectedEmp.monthlySalary)})</div>
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsEditSalaryOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>New Monthly Fixed Salary (Rs.) *</label>
              <input type="number" required min="0" className="input-field" value={newSalary} onChange={(e) => setNewSalary(e.target.value)} style={{ fontWeight: "700" }} />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Effective From Month *</label>
              <input type="month" required className="input-field" value={salaryEffectiveMonth} onChange={(e) => setSalaryEffectiveMonth(e.target.value)} />
              <div style={{ fontSize: "11px", color: "var(--ink-3)", marginTop: "2px" }}>
                Earlier months will keep their historical salary on payslips.
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Reason for Salary Change *</label>
              <input type="text" required className="input-field" value={salaryReason} onChange={(e) => setSalaryReason(e.target.value)} />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsEditSalaryOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Updating…" : "Update Salary"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ASSIGN LEAVE MODAL */}
      {isAssignLeaveOpen && (
        <div className="modal-backdrop">
          <form onSubmit={handleAssignLeaveSubmit} className="modal-panel animate-fade-in" style={{ maxWidth: "460px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Calendar size={22} style={{ color: "var(--primary)" }} />
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>
                    {isSuperAdmin ? "Assign Leave / Off Day" : "Request Leave"}
                  </h3>
                  <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>
                    {isSuperAdmin ? "Directly saved as Approved" : "Submitted for Super Admin approval"}
                  </div>
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsAssignLeaveOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {isSuperAdmin && (
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Employee *</label>
                <select className="input-field" value={leaveEmpId} onChange={(e) => setLeaveEmpId(e.target.value)}>
                  {employees.filter((e) => e.status === "ACTIVE").map((e) => (
                    <option key={e.id} value={e.id}>{e.name} ({e.designation})</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Leave Type *</label>
                <select className="input-field" value={leaveType} onChange={(e) => setLeaveType(e.target.value as any)}>
                  <option value="OFF_DAY">Off Day (Assigned rest day)</option>
                  <option value="ANNUAL">Annual Leave</option>
                  <option value="CASUAL">Casual Leave</option>
                  <option value="SICK">Sick Leave</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="UNPAID">Unpaid Leave</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Days (0.5 steps) *</label>
                <input type="number" step="0.5" min="0.5" className="input-field" value={leaveDays} onChange={(e) => setLeaveDays(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>From Date *</label>
                <input type="date" className="input-field" value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>To Date *</label>
                <input type="date" className="input-field" value={leaveTo} onChange={(e) => setLeaveTo(e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Reason / Notes</label>
              <input type="text" className="input-field" placeholder="e.g. Scheduled weekly rest day" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsAssignLeaveOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : isSuperAdmin ? "Assign Leave" : "Submit Request"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STAFF CREDIT LEDGER MODAL */}
      {isStaffLedgerOpen && selectedEmp && (
        <div className="modal-backdrop">
          <div className="modal-panel animate-fade-in" style={{ maxWidth: "600px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>Staff Credit Ledger: {selectedEmp.name}</h3>
                <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>Products bought on credit and cash advances</div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsStaffLedgerOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ maxHeight: "350px", overflowY: "auto", border: "1px solid var(--line)", borderRadius: "var(--radius-control)" }}>
              <table className="pos-table" style={{ fontSize: "12px" }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Ref / Note</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {staffLedgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "20px", color: "var(--ink-2)" }}>
                        No staff credit entries found for this employee account.
                      </td>
                    </tr>
                  ) : (
                    staffLedgerEntries.map((e) => (
                      <tr key={e.id}>
                        <td>{formatDate(e.createdAt)}</td>
                        <td>
                          <span className="badge badge-neutral">{e.type}</span>
                        </td>
                        <td>{e.referenceNumber || e.note || "-"}</td>
                        <td className="num" style={{ fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
                          {formatCurrency(e.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsStaffLedgerOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* REOPEN PAYROLL MODAL */}
      {isReopenModalOpen && selectedPayroll && (
        <div className="modal-backdrop">
          <form onSubmit={handleReopenPayrollSubmit} className="modal-panel animate-fade-in" style={{ maxWidth: "420px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>Reopen Finalised Month</h3>
                <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>Month: {selectedPayroll.month}</div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsReopenModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ fontSize: "13px", color: "var(--ink-2)", marginBottom: "14px" }}>
              Reopening this month will reverse any staff credit salary recovery posted to the customer ledger and allow modifications.
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Audited Reason for Reopening *</label>
              <textarea
                required
                rows={3}
                className="input-field"
                placeholder="Explain why this finalised month is being reopened..."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                style={{ height: "auto" }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsReopenModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ background: "#b45309", borderColor: "#b45309" }} disabled={isSubmitting}>
                {isSubmitting ? "Reopening…" : "Confirm Reopen"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RECORD SALARY PAYMENT MODAL */}
      {isRecordSalaryPayOpen && selectedPayroll && (
        <div className="modal-backdrop">
          <form onSubmit={handleRecordSalaryPaySubmit} className="modal-panel animate-fade-in" style={{ maxWidth: "440px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>Record Salary Payment</h3>
                <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>Month: {selectedPayroll.month}</div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsRecordSalaryPayOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "var(--radius-control)", padding: "12px", textAlign: "center", marginBottom: "14px" }}>
              <div style={{ fontSize: "12px", color: "#166534", textTransform: "uppercase", fontWeight: "700" }}>Net Payable Amount</div>
              <div style={{ fontSize: "22px", fontWeight: "900", color: "#15803d", fontVariantNumeric: "tabular-nums" }}>
                {formatCurrency(selectedPayroll.netPayable)}
              </div>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Payment Method</label>
              <select className="input-field" value={salaryPayMethod} onChange={(e) => setSalaryPayMethod(e.target.value as any)}>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="CASH">Cash</option>
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Bank Reference / Check # (optional)</label>
              <input type="text" className="input-field" placeholder="e.g. SLT-TRF-98231" value={salaryPayRef} onChange={(e) => setSalaryPayRef(e.target.value)} />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsRecordSalaryPayOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Settling…" : "Confirm Paid"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
