// src/lib/payroll-math.ts
import {
  Employee,
  SalaryHistory,
  EmployeePayment,
  LeaveRecord,
  PayrollDeduction,
} from "@/types";

/**
 * Returns total days in a given year and month (1-indexed month, 1-12)
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Parses "YYYY-MM" string into year and month (1-12)
 */
export function parseYearMonth(monthStr: string): { year: number; month: number } {
  const parts = monthStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  return { year, month };
}

/**
 * Formats a timestamp into "YYYY-MM" in Asia/Colombo (+05:30)
 */
export function formatYearMonth(timestamp: number): string {
  const d = new Date(timestamp);
  // Convert to Colombo time
  const colomboTime = new Date(d.getTime() + (330 + d.getTimezoneOffset()) * 60000);
  const y = colomboTime.getFullYear();
  const m = String(colomboTime.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Derives the effective fixed monthly salary for a given month from employee history
 */
export function getEffectiveSalaryForMonth(
  employee: Employee,
  salaryHistories: SalaryHistory[],
  month: string
): number {
  const employeeHistories = salaryHistories
    .filter((h) => h.employeeId === employee.id && h.effectiveFrom <= month)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

  if (employeeHistories.length > 0) {
    return employeeHistories[0].monthlySalary;
  }
  return employee.monthlySalary;
}

/**
 * Computes calendar pro-rated salary if employee joined or left during the month
 */
export function calculateProRatedSalary(
  monthlySalary: number,
  month: string,
  joinDate: number,
  leaveDate?: number | null
): { proRatedSalary: number; totalDays: number; activeDays: number } {
  const { year, month: m } = parseYearMonth(month);
  const totalDays = getDaysInMonth(year, m);

  // Month start and end timestamps in Colombo time
  const monthStartMs = Date.UTC(year, m - 1, 1, 0, 0, 0) - (5.5 * 3600000);
  const monthEndMs = Date.UTC(year, m - 1, totalDays, 23, 59, 59, 999) - (5.5 * 3600000);

  let startDay = 1;
  let endDay = totalDays;

  // If joined after month start
  if (joinDate > monthStartMs) {
    const jDate = new Date(joinDate + (5.5 * 3600000));
    if (jDate.getUTCFullYear() === year && jDate.getUTCMonth() + 1 === m) {
      startDay = jDate.getUTCDate();
    } else if (joinDate > monthEndMs) {
      // Joined in future month
      return { proRatedSalary: 0, totalDays, activeDays: 0 };
    }
  }

  // If left before month end
  if (leaveDate && leaveDate < monthEndMs) {
    const lDate = new Date(leaveDate + (5.5 * 3600000));
    if (lDate.getUTCFullYear() === year && lDate.getUTCMonth() + 1 === m) {
      endDay = lDate.getUTCDate();
    } else if (leaveDate < monthStartMs) {
      // Left in previous month
      return { proRatedSalary: 0, totalDays, activeDays: 0 };
    }
  }

  const activeDays = Math.max(0, Math.min(totalDays, endDay - startDay + 1));
  if (activeDays >= totalDays) {
    return { proRatedSalary: monthlySalary, totalDays, activeDays: totalDays };
  }

  const proRatedSalary = Math.round((monthlySalary / totalDays) * activeDays);
  return { proRatedSalary, totalDays, activeDays };
}

export interface PayrollCalculationResult {
  effectiveMonthlySalary: number;
  proRatedSalary: number;
  totalDaysInMonth: number;
  activeDays: number;
  dailyWagesPaid: number;
  remainingSalary: number;
  staffCreditOutstanding: number;
  staffCreditRecovered: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  leaveDeduction: number;
  otherDeductions: PayrollDeduction[];
  totalDeductions: number;
  netPayable: number;
  isOverpaid: boolean;
  overpaidAmount: number;
}

/**
 * Pure calculation function for monthly payroll:
 * Net payable = Monthly salary − Daily wages already paid − Staff credit recovery − Leave deduction − Other deductions
 */
export function calculateMonthlyPayroll(params: {
  employee: Employee;
  month: string;
  salaryHistories?: SalaryHistory[];
  payments?: EmployeePayment[];
  staffCreditOutstanding?: number;
  staffCreditRecoveryChosen?: number;
  leaveRecords?: LeaveRecord[];
  otherDeductions?: PayrollDeduction[];
}): PayrollCalculationResult {
  const { employee, month } = params;
  const salaryHistories = params.salaryHistories || [];
  const payments = params.payments || [];
  const staffCreditOutstanding = Math.max(0, params.staffCreditOutstanding || 0);
  const leaveRecords = params.leaveRecords || [];
  const otherDeductions = params.otherDeductions || [];

  // 1. Effective Monthly Salary
  const effectiveMonthlySalary = getEffectiveSalaryForMonth(
    employee,
    salaryHistories,
    month
  );

  // 2. Pro-rating by calendar days
  const { proRatedSalary, totalDays, activeDays } = calculateProRatedSalary(
    effectiveMonthlySalary,
    month,
    employee.joinDate,
    employee.leaveDate
  );

  // 3. Daily wages already paid this month
  const monthWages = payments.filter(
    (p) =>
      p.employeeId === employee.id &&
      p.month === month &&
      (p.type === "DAILY_WAGE" || p.type === "WAGE_REVERSAL")
  );

  const dailyWagesPaid = monthWages.reduce((sum, p) => {
    if (p.type === "WAGE_REVERSAL") {
      return sum - Math.abs(p.amount);
    }
    return sum + p.amount;
  }, 0);

  // 4. Remaining salary before deductions
  const remainingSalary = proRatedSalary - dailyWagesPaid;

  // 5. Staff credit recovery
  // Default is the smaller of outstanding credit and remaining pay
  let staffCreditRecovered = 0;
  if (params.staffCreditRecoveryChosen !== undefined) {
    staffCreditRecovered = Math.max(0, params.staffCreditRecoveryChosen);
  } else {
    staffCreditRecovered = Math.max(
      0,
      Math.min(staffCreditOutstanding, Math.max(0, remainingSalary))
    );
  }

  // 6. Leave days and deductions
  // In CR02 Decision D7: unpaid leave does not change pay automatically unless client chooses a rule. Default 0.
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  for (const lr of leaveRecords) {
    if (lr.employeeId === employee.id && lr.status === "APPROVED") {
      if (lr.type === "UNPAID") {
        unpaidLeaveDays += lr.days;
      } else {
        paidLeaveDays += lr.days;
      }
    }
  }
  const leaveDeduction = 0; // Default none per D7

  // 7. Other deductions
  const otherDeductionsSum = otherDeductions.reduce(
    (acc, d) => acc + (d.amount || 0),
    0
  );

  // 8. Total Deductions
  const totalDeductions =
    staffCreditRecovered + leaveDeduction + otherDeductionsSum;

  // 9. Net Payable & Overpayment
  const rawNet = remainingSalary - totalDeductions;

  let netPayable = 0;
  let isOverpaid = false;
  let overpaidAmount = 0;

  if (rawNet < 0) {
    netPayable = 0;
    isOverpaid = true;
    overpaidAmount = Math.abs(rawNet);
  } else {
    netPayable = rawNet;
    isOverpaid = false;
    overpaidAmount = 0;
  }

  return {
    effectiveMonthlySalary,
    proRatedSalary,
    totalDaysInMonth: totalDays,
    activeDays,
    dailyWagesPaid,
    remainingSalary,
    staffCreditOutstanding,
    staffCreditRecovered,
    paidLeaveDays,
    unpaidLeaveDays,
    leaveDeduction,
    otherDeductions,
    totalDeductions,
    netPayable,
    isOverpaid,
    overpaidAmount,
  };
}

