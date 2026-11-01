// src/lib/__tests__/wp9-employees-payroll.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadLocalStore,
  saveLocalStore,
  getEmployees,
  createEmployee,
  updateEmployeeSalary,
  recordDailyWage,
  reverseDailyWage,
  finalisePayrollMonth,
  reopenPayrollMonth,
  recordSalaryPayment,
  getPayrollMonthSheet,
  assignLeaveRecord,
  requestLeave,
  decideLeaveRequest,
  getLeaveRecords,
} from "../firestore-service";
import {
  calculateMonthlyPayroll,
  calculateProRatedSalary,
  getEffectiveSalaryForMonth,
} from "../payroll-math";
import {
  renderEmployeePayslipHTML,
  renderPayrollSummaryHTML,
} from "../receipt-generator";
import { UserProfile, Shop, Employee, SalaryHistory, EmployeePayment, CustomerLedgerEntry } from "@/types";

describe("WP9: Employees, Wages, Payroll and Leave (Acceptance Criteria E1-E10)", () => {
  const adminUser: UserProfile = {
    uid: "admin_user_1",
    id: "admin_user_1",
    email: "admin@apexpos.lk",
    displayName: "Super Admin",
    role: "SUPER_ADMIN",
    allowedShopIds: ["rightway", "mega"],
    active: true,
  };

  const cashierUser: UserProfile = {
    uid: "cashier_rw_1",
    id: "cashier_rw_1",
    email: "cashier@apexpos.lk",
    displayName: "Saman Cashier",
    role: "CASHIER",
    allowedShopIds: ["rightway"],
    active: true,
  };

  const shopRightway: Shop = {
    id: "rightway",
    slug: "rightway",
    code: "RW",
    name: "RightWay Shoes",
    address: "Colombo 11",
    phone: "011-2345678",
    invoicePrefix: "RW-INV",
    shiftPrefix: "RW-SH",
    repairPrefix: "RW-REP",
    active: true,
  };

  beforeEach(() => {
    const store = loadLocalStore();
    store.employees = [];
    store.salaryHistory = [];
    store.employeePayments = [];
    store.leaveRecords = [];
    store.payrollMonths = [];
    saveLocalStore(store);
  });

  // E1: Create an employee with salary 60,000; give three daily wages of 1,500; the page shows wages paid 4,500 and remaining 55,500.
  it("E1: creates employee with salary 60,000, gives 3 daily wages of 1,500, shows 4,500 paid and 55,500 remaining", async () => {
    const emp = await createEmployee({
      name: "Saman Perera",
      phone: "0771234567",
      designation: "Sales Assistant",
      branchId: "rightway",
      joinDate: new Date("2026-11-01T00:00:00+05:30").getTime(),
      monthlySalary: 60000,
      dailyWageDefault: 1500,
      callingUser: adminUser,
    });

    expect(emp.name).toBe("Saman Perera");
    expect(emp.monthlySalary).toBe(60000);
    expect(emp.dailyWageDefault).toBe(1500);

    const targetDate = new Date("2026-11-05T10:00:00+05:30").getTime();
    const w1 = await recordDailyWage({
      employeeId: emp.id,
      date: targetDate,
      amount: 1500,
      method: "CASH",
      callingUser: adminUser,
    });
    expect(w1.totalWagesThisMonth).toBe(1500);
    expect(w1.remainingSalary).toBe(58500);

    const w2 = await recordDailyWage({
      employeeId: emp.id,
      date: targetDate + 86400000,
      amount: 1500,
      method: "CASH",
      callingUser: adminUser,
    });
    expect(w2.totalWagesThisMonth).toBe(3000);
    expect(w2.remainingSalary).toBe(57000);

    const w3 = await recordDailyWage({
      employeeId: emp.id,
      date: targetDate + 2 * 86400000,
      amount: 1500,
      method: "CASH",
      callingUser: adminUser,
    });
    expect(w3.totalWagesThisMonth).toBe(4500);
    expect(w3.remainingSalary).toBe(55500);
  });

  // E2: The payslip for that month shows each wage entry and net payable 55,500 when there are no other deductions.
  it("E2: payslip shows each wage entry and net payable 55,500 when there are no other deductions", async () => {
    const emp = await createEmployee({
      name: "Nadeeka Silva",
      phone: "0712345678",
      designation: "Cashier",
      branchId: "rightway",
      joinDate: new Date("2026-11-01T00:00:00+05:30").getTime(),
      monthlySalary: 60000,
      callingUser: adminUser,
    });

    const targetDate = new Date("2026-11-02T10:00:00+05:30").getTime();
    await recordDailyWage({ employeeId: emp.id, date: targetDate, amount: 1500, method: "CASH", callingUser: adminUser });
    await recordDailyWage({ employeeId: emp.id, date: targetDate + 86400000, amount: 1500, method: "CASH", callingUser: adminUser });
    await recordDailyWage({ employeeId: emp.id, date: targetDate + 2 * 86400000, amount: 1500, method: "CASH", callingUser: adminUser });

    const sheet = getPayrollMonthSheet("2026-11", adminUser);
    const payroll = sheet.payrollMonths.find((p) => p.employeeId === emp.id);
    expect(payroll).toBeDefined();
    expect(payroll?.proRatedSalary).toBe(60000);
    expect(payroll?.dailyWagesPaid).toBe(4500);
    expect(payroll?.netPayable).toBe(55500);

    // Finalise and render payslip
    const finalised = await finalisePayrollMonth({
      employeeId: emp.id,
      month: "2026-11",
      callingUser: adminUser,
    });
    expect(finalised.netPayable).toBe(55500);

    const store = loadLocalStore();
    const wages = store.employeePayments.filter((p) => p.employeeId === emp.id);
    const html = renderEmployeePayslipHTML(finalised, emp, shopRightway, wages, []);
    expect(html).toContain("MONTHLY SALARY PAYSLIP");
    expect(html).toContain("Nadeeka Silva");
    expect(html).toContain("55,500.00");
    expect(html).toContain("Daily Wages Received This Month");
  });

  // E3: With staff credit of 8,000 outstanding and recovery of 8,000, net payable is 47,500 and the customer ledger gains a SALARY_RECOVERY entry.
  it("E3: recovers staff credit of 8,000, gives net payable 47,500 and writes SALARY_RECOVERY in ledger", async () => {
    const emp = await createEmployee({
      name: "Kasun Perera",
      phone: "0751234567",
      designation: "Assistant",
      branchId: "rightway",
      joinDate: new Date("2026-11-01T00:00:00+05:30").getTime(),
      monthlySalary: 60000,
      createStaffCustomer: true,
      callingUser: adminUser,
    });

    expect(emp.customerAccountId).toBeDefined();

    // Give 3 daily wages of 1,500 (total 4,500)
    const targetDate = new Date("2026-11-02T10:00:00+05:30").getTime();
    await recordDailyWage({ employeeId: emp.id, date: targetDate, amount: 1500, method: "CASH", callingUser: adminUser });
    await recordDailyWage({ employeeId: emp.id, date: targetDate + 86400000, amount: 1500, method: "CASH", callingUser: adminUser });
    await recordDailyWage({ employeeId: emp.id, date: targetDate + 2 * 86400000, amount: 1500, method: "CASH", callingUser: adminUser });

    // Seed staff credit of 8,000 on the linked customer account
    const store = loadLocalStore();
    store.customerLedger.push({
      id: "credit_test_8000",
      customerId: emp.customerAccountId!,
      shopId: "rightway",
      type: "CREDIT_SALE",
      direction: "DEBIT",
      amount: 8000,
      referenceNumber: "POS Staff Shoes",
      createdBy: adminUser.uid,
      createdAt: Date.now(),
    });
    saveLocalStore(store);

    // Finalise with recovery of 8,000
    const finalised = await finalisePayrollMonth({
      employeeId: emp.id,
      month: "2026-11",
      staffCreditRecovery: 8000,
      callingUser: adminUser,
    });

    // 60,000 - 4,500 wages - 8,000 staff credit = 47,500
    expect(finalised.netPayable).toBe(47500);
    expect(finalised.staffCreditRecovered).toBe(8000);

    // Verify SALARY_RECOVERY entry in customer ledger
    const updatedStore = loadLocalStore();
    const recoveryEntry = updatedStore.customerLedger.find(
      (e) => e.customerId === emp.customerAccountId && e.type === "SALARY_RECOVERY"
    );
    expect(recoveryEntry).toBeDefined();
    expect(recoveryEntry?.amount).toBe(8000);
  });

  // E4: Wages above the salary produce the warning and "Overpaid" figure.
  it("E4: wages above salary produce the warning and overpaid figure", async () => {
    const emp = await createEmployee({
      name: "Sunil Shantha",
      phone: "0721234567",
      designation: "Trainee",
      branchId: "rightway",
      joinDate: new Date("2026-11-01T00:00:00+05:30").getTime(),
      monthlySalary: 30000,
      callingUser: adminUser,
    });

    const targetDate = new Date("2026-11-10T10:00:00+05:30").getTime();
    // Record wage of 35,000 (exceeds 30,000 by 5,000)
    const res = await recordDailyWage({
      employeeId: emp.id,
      date: targetDate,
      amount: 35000,
      method: "CASH",
      callingUser: adminUser,
    });

    expect(res.isOverpaid).toBe(true);
    expect(res.overpaidAmount).toBe(5000);
    expect(res.remainingSalary).toBe(-5000);

    const sheet = getPayrollMonthSheet("2026-11", adminUser);
    const payroll = sheet.payrollMonths.find((p) => p.employeeId === emp.id);
    expect(payroll?.netPayable).toBe(0);
    expect(payroll?.isOverpaid).toBe(true);
    expect(payroll?.overpaidAmount).toBe(5000);
  });

  // E5: A salary change effective from the 1st of next month does not change this month's payslip.
  it("E5: salary change effective from 1st of next month does not change this month's payslip", async () => {
    const emp = await createEmployee({
      name: "Priyantha Kumara",
      phone: "0781234567",
      designation: "Store Manager",
      branchId: "rightway",
      joinDate: new Date("2026-11-01T00:00:00+05:30").getTime(),
      monthlySalary: 70000,
      callingUser: adminUser,
    });

    // Update salary to 85,000 effective next month (2026-12)
    await updateEmployeeSalary({
      employeeId: emp.id,
      newSalary: 85000,
      effectiveFrom: "2026-12",
      reason: "Promoted to Senior Store Manager",
      callingUser: adminUser,
    });

    // November payroll must still reflect 70,000
    const novSheet = getPayrollMonthSheet("2026-11", adminUser);
    const novPayroll = novSheet.payrollMonths.find((p) => p.employeeId === emp.id);
    expect(novPayroll?.effectiveMonthlySalary).toBe(70000);

    // December payroll reflects 85,000
    const decSheet = getPayrollMonthSheet("2026-12", adminUser);
    const decPayroll = decSheet.payrollMonths.find((p) => p.employeeId === emp.id);
    expect(decPayroll?.effectiveMonthlySalary).toBe(85000);
  });

  // E6: Assigning an off day saves as Approved; a leave request from a linked cashier appears for approval and updates the calendar after approval.
  it("E6: assigns off day as Approved; cashier request requires approval and updates status", async () => {
    const emp = await createEmployee({
      name: "Linked Cashier Emp",
      phone: "0769998888",
      designation: "Cashier",
      branchId: "rightway",
      joinDate: new Date("2026-11-01T00:00:00+05:30").getTime(),
      monthlySalary: 50000,
      userId: cashierUser.uid,
      callingUser: adminUser,
    });

    // Super Admin assigns an off day directly -> Approved
    const offDay = await assignLeaveRecord({
      employeeId: emp.id,
      type: "OFF_DAY",
      fromDate: "2026-11-08",
      toDate: "2026-11-08",
      days: 1,
      reason: "Weekly off day",
      callingUser: adminUser,
    });
    expect(offDay.status).toBe("APPROVED");

    // Cashier requests casual leave -> REQUESTED
    const reqLeave = await requestLeave({
      employeeId: emp.id,
      type: "CASUAL",
      fromDate: "2026-11-15",
      toDate: "2026-11-15",
      days: 1,
      reason: "Family event",
      callingUser: cashierUser,
    });
    expect(reqLeave.status).toBe("REQUESTED");

    // Super Admin approves the request
    const approved = await decideLeaveRequest({
      leaveId: reqLeave.id,
      decision: "APPROVE",
      note: "Granted",
      callingUser: adminUser,
    });
    expect(approved.status).toBe("APPROVED");
    expect(approved.decidedBy).toBe(adminUser.uid);
  });

  // E7: Overlapping leave is refused; half days count as 0.5.
  it("E7: refuses overlapping leave and counts half days as 0.5", async () => {
    const emp = await createEmployee({
      name: "Leave Tester",
      phone: "0701112222",
      designation: "Assistant",
      branchId: "rightway",
      joinDate: new Date("2026-11-01T00:00:00+05:30").getTime(),
      monthlySalary: 45000,
      callingUser: adminUser,
    });

    // First leave: 2026-11-10 to 2026-11-12
    const l1 = await assignLeaveRecord({
      employeeId: emp.id,
      type: "HALF_DAY",
      fromDate: "2026-11-10",
      toDate: "2026-11-10",
      days: 0.5,
      callingUser: adminUser,
    });
    expect(l1.days).toBe(0.5);

    // Overlapping attempt on 2026-11-10 must be refused
    await expect(
      assignLeaveRecord({
        employeeId: emp.id,
        type: "CASUAL",
        fromDate: "2026-11-10",
        toDate: "2026-11-11",
        days: 2,
        callingUser: adminUser,
      })
    ).rejects.toThrow("Overlapping leave request already exists");
  });

  // E8: A finalised month cannot be edited without reopening; reopening needs a reason and is audited.
  it("E8: blocks edit on finalised month without reopening; reopening requires audited reason", async () => {
    const emp = await createEmployee({
      name: "Finalised Emp",
      phone: "0743334444",
      designation: "Senior Staff",
      branchId: "rightway",
      joinDate: new Date("2026-11-01T00:00:00+05:30").getTime(),
      monthlySalary: 65000,
      callingUser: adminUser,
    });

    // Finalise
    await finalisePayrollMonth({
      employeeId: emp.id,
      month: "2026-11",
      callingUser: adminUser,
    });

    // Attempt to finalise again without reopening -> blocked
    await expect(
      finalisePayrollMonth({
        employeeId: emp.id,
        month: "2026-11",
        callingUser: adminUser,
      })
    ).rejects.toThrow("already finalised");

    // Reopen without reason -> blocked
    await expect(
      reopenPayrollMonth({
        employeeId: emp.id,
        month: "2026-11",
        reason: "",
        callingUser: adminUser,
      })
    ).rejects.toThrow("requires an audited reason");

    // Reopen with reason -> succeeds
    const reopened = await reopenPayrollMonth({
      employeeId: emp.id,
      month: "2026-11",
      reason: "Correction of missed daily wage entry",
      callingUser: adminUser,
    });
    expect(reopened.status).toBe("OPEN");
    expect(reopened.reopenReason).toBe("Correction of missed daily wage entry");
  });

  // E9: A cashier cannot open Employees & Payroll or read its data (UI and data layer).
  it("E9: data layer strictly refuses cashier access to employee and payroll operations", async () => {
    expect(() => getEmployees(cashierUser)).toThrow("PERMISSION_DENIED");

    await expect(
      createEmployee({
        name: "Hacker Employee",
        phone: "0770000000",
        designation: "None",
        branchId: "rightway",
        joinDate: Date.now(),
        monthlySalary: 100000,
        callingUser: cashierUser,
      })
    ).rejects.toThrow("PERMISSION_DENIED");

    await expect(
      recordDailyWage({
        employeeId: "emp_any",
        date: Date.now(),
        amount: 5000,
        method: "CASH",
        callingUser: cashierUser,
      })
    ).rejects.toThrow("PERMISSION_DENIED");

    expect(() => getPayrollMonthSheet("2026-11", cashierUser)).toThrow("PERMISSION_DENIED");
  });

  // E10: Payroll maths unit tests pass for pro-rating, recovery capping and overpayment.
  it("E10: pure payroll math correctly handles pro-rating, recovery capping and overpayment", () => {
    const dummyEmp: Employee = {
      id: "emp_math_1",
      name: "Math Tester",
      phone: "0771112222",
      designation: "Tester",
      branchId: "rightway",
      joinDate: new Date("2026-11-16T00:00:00+05:30").getTime(), // Joined mid-month (15 days out of 30)
      status: "ACTIVE",
      monthlySalary: 60000,
      createdAt: Date.now(),
    };

    // 1. Pro-rating: November has 30 days. Joined on the 16th -> 15 active days.
    // Pro-rated = 60,000 / 30 * 15 = 30,000.
    const res1 = calculateMonthlyPayroll({
      employee: dummyEmp,
      month: "2026-11",
      payments: [],
      staffCreditOutstanding: 0,
    });
    expect(res1.proRatedSalary).toBe(30000);
    expect(res1.netPayable).toBe(30000);

    // 2. Recovery capping: Staff credit is 40,000, but remaining pay is 20,000 (after 10,000 wage).
    // Default recovery is capped at 20,000.
    const payments: EmployeePayment[] = [
      {
        id: "p1",
        employeeId: dummyEmp.id,
        month: "2026-11",
        type: "DAILY_WAGE",
        amount: 10000,
        date: Date.now(),
        method: "CASH",
        createdBy: "admin",
        createdAt: Date.now(),
      },
    ];
    const res2 = calculateMonthlyPayroll({
      employee: dummyEmp,
      month: "2026-11",
      payments,
      staffCreditOutstanding: 40000,
    });
    expect(res2.dailyWagesPaid).toBe(10000);
    expect(res2.remainingSalary).toBe(20000);
    expect(res2.staffCreditRecovered).toBe(20000);
    expect(res2.netPayable).toBe(0);

    // 3. Overpayment: daily wage 35,000 on a 30,000 salary
    const overPayments: EmployeePayment[] = [
      {
        id: "p2",
        employeeId: dummyEmp.id,
        month: "2026-11",
        type: "DAILY_WAGE",
        amount: 35000,
        date: Date.now(),
        method: "CASH",
        createdBy: "admin",
        createdAt: Date.now(),
      },
    ];
    const res3 = calculateMonthlyPayroll({
      employee: dummyEmp,
      month: "2026-11",
      payments: overPayments,
      staffCreditOutstanding: 0,
    });
    expect(res3.netPayable).toBe(0);
    expect(res3.isOverpaid).toBe(true);
    expect(res3.overpaidAmount).toBe(5000);
  });
});
