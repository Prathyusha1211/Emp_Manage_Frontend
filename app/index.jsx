import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";
import {
  AddIcon,
  CalendarMonthIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  CurrencyRupeeIcon,
  DeleteIcon,
  EditIcon,
  ExpandMoreIcon,
  FileDownloadIcon,
  GroupsIcon,
  HomeIcon,
  MuiAppIcon,
  MuiLogoutIcon,
  PersonAddAlt1Icon,
  RemoveIcon,
  VisibilityIcon,
  VisibilityOffIcon
} from "./AppIcons";
import {
  addWorker,
  deleteBill,
  deleteWorker,
  editWorker,
  getAttendanceByDate,
  getBillById,
  getBills,
  loginUser,
  markAttendance,
  registerUser,
  resetUserPassword,
  storeBill
} from "../src/api";
import { PINEntry } from "./components/PINEntry";

const palette = {
  bg: "#F7FBFF",
  surface: "#FFFFFF",
  surfaceTint: "#DEEBF7",
  surfaceSoft: "#EDEBF7",
  blue400: "#6BAED6",
  blue500: "#4292C6",
  blue700: "#2171B5",
  blue800: "#08519C",
  blue900: "#08306B",
  textMuted: "#5D7394",
  border: "#D6E5F2",
  dangerBg: "#EDEBF7",
  success: "#2E9B57",
  danger: "#D24B5A"
};

const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];
const monthLabels = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const SESSION_STORAGE_KEY = "emp-manage-session";
const USER_NAME_STORAGE_KEY = "emp-manage-user-names";

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  return new Date(`${dateKey}T00:00:00`);
}

function formatDisplayDate(dateKey) {
  if (!dateKey || typeof dateKey !== "string") {
    return "Unknown date";
  }

  const date = parseDateKey(dateKey);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatMonthHeading(monthKey) {
  if (!monthKey || typeof monthKey !== "string") {
    return "UNKNOWN MONTH";
  }

  const [year, month] = monthKey.split("-");
  const monthIndex = Number(month) - 1;
  const label = monthLabels[monthIndex];
  return label ? `${label.toUpperCase()} ${year}` : "UNKNOWN MONTH";
}

function getMonthKey(dateKey) {
  if (!dateKey || typeof dateKey !== "string" || dateKey.length < 7) {
    return "";
  }

  return dateKey.slice(0, 7);
}

function normalizeStoredDateKey(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("/");
    return `${year}-${month}-${day}`;
  }

  return "";
}

function getMonthsForYear(date) {
  return Array.from({ length: date.getMonth() + 1 }, (_, index) => {
    const monthDate = new Date(date.getFullYear(), index, 1);
    return {
      key: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`,
      date: monthDate
    };
  }).reverse();
}

function getMonthMatrix(baseDate) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const calendarStart = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });
}

function getMonthDateKeys(baseDate) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isFutureMonth =
    year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth());
  const visibleDays =
    year === today.getFullYear() && month === today.getMonth()
      ? today.getDate()
      : isFutureMonth
        ? 0
        : lastDate;

  return Array.from({ length: visibleDays }, (_, index) =>
    formatDateKey(new Date(year, month, index + 1))
  );
}

function getDateRangeKeys(startDateKey, endDateKey) {
  if (!startDateKey || !endDateKey) {
    return [];
  }

  const start = startDateKey <= endDateKey ? parseDateKey(startDateKey) : parseDateKey(endDateKey);
  const end = startDateKey <= endDateKey ? parseDateKey(endDateKey) : parseDateKey(startDateKey);
  const dates = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function createExpenseRowId(monthKey, sequence) {
  return `expense-${monthKey}-${sequence}`;
}

function isFutureDateKey(dateKey, todayKey) {
  return dateKey > todayKey;
}

function hasRecordedAttendance(workers) {
  return workers.some(
    (worker) => worker.attendanceStatus === "present" || worker.attendanceStatus === "absent"
  );
}

function normalizeStoredBillPayload(storedBill) {
  const payload = storedBill?.generatedBillData || storedBill?.billData || {};
  const rawRows = Array.isArray(payload?.rows)
    ? payload.rows
    : Array.isArray(payload?.items)
      ? payload.items
      : [];
  const rows = rawRows.map((row, index) => ({
    id: row.id || row._id || `${storedBill?._id || "bill"}-${index}`,
    name: row.name || row.workerName || "Worker",
    wage: Number(row.wage) || 0,
    days:
      row.days == null || row.days === ""
        ? undefined
        : Number(row.days),
    total: Number(row.total) || Number(row.amount) || Number(row.wage) || 0
  }));
  const extraExpenses = Array.isArray(payload?.extraExpenses)
    ? payload.extraExpenses.map((item, index) => ({
      id: item.id || `${storedBill?._id || "bill"}-expense-${index}`,
      reason: String(item.reason || "").trim() || `Expense ${index + 1}`,
      amount: Number(item.amount) || 0
    }))
    : [];
  const presentCount = Number(payload?.presentCount) || rows.length;
  const absentCount = Number(payload?.absentCount) || 0;
  const workerTotal =
    Number(payload?.workerTotal) || rows.reduce((sum, row) => sum + row.total, 0);
  const extraExpensesTotal =
    Number(payload?.extraExpensesTotal) ||
    extraExpenses.reduce((sum, item) => sum + item.amount, 0);
  const totalAmount =
    Number(payload?.totalAmount) ||
    Number(payload?.grandTotal) ||
    Number(payload?.total) ||
    workerTotal + extraExpensesTotal;
  const fromDateKey = normalizeStoredDateKey(payload?.fromDateKey);
  const toDateKey = normalizeStoredDateKey(payload?.toDateKey);
  const generatedDateKey =
    normalizeStoredDateKey(payload?.generatedDateKey) ||
    normalizeStoredDateKey(storedBill?.date) ||
    normalizeStoredDateKey(storedBill?.generatedDate);
  const dateKey = generatedDateKey || toDateKey || fromDateKey;
  const rangeToDateKey = toDateKey || dateKey;
  const displayDate = formatDisplayDate(dateKey);
  const rangeDisplayDate =
    fromDateKey && rangeToDateKey && fromDateKey !== rangeToDateKey
      ? `${formatDisplayDate(fromDateKey)} to ${formatDisplayDate(rangeToDateKey)}`
      : fromDateKey
        ? formatDisplayDate(fromDateKey)
        : displayDate;
  const monthKey = getMonthKey(dateKey);

  return {
    id: storedBill?._id,
    dateKey,
    displayDate,
    rangeDisplayDate,
    monthKey,
    rows,
    presentCount,
    absentCount,
    fromDateKey,
    toDateKey: rangeToDateKey,
    workerTotal,
    extraExpenses,
    extraExpensesTotal,
    totalAmount,
    name: storedBill?.name || `Bill ${formatDisplayDate(dateKey)}`
  };
}

function createStoredBillPayload(bill) {
  return {
    rows: bill.rows,
    items: bill.rows,
    presentCount: bill.presentCount,
    absentCount: bill.absentCount,
    workerTotal: bill.workerTotal ?? bill.totalAmount,
    extraExpenses: bill.extraExpenses || [],
    extraExpensesTotal: bill.extraExpensesTotal || 0,
    fromDateKey: bill.fromDateKey || bill.dateKey,
    toDateKey: bill.toDateKey || bill.dateKey,
    generatedDateKey: bill.dateKey,
    totalAmount: bill.totalAmount,
    grandTotal: bill.totalAmount,
    total: bill.totalAmount
  };
}

function getGeneratedBillKey(bill) {
  return (
    bill?.id ||
    [
      bill?.dateKey || "bill",
      bill?.fromDateKey || "",
      bill?.toDateKey || "",
      bill?.totalAmount ?? "",
      bill?.rows?.length ?? ""
    ].join("|")
  );
}

function buildBillDocumentHtml(bill, contractorName) {
  const rowMarkup = bill.rows.length
    ? bill.rows
      .map(
        (worker, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${worker.name}</td>
              <td>${worker.wage}</td>
              <td>${worker.days ?? "-"}</td>
              <td>${worker.total}</td>
            </tr>
          `
      )
      .join("")
    : `
      <tr>
        <td colspan="5">No workers were marked present for this bill.</td>
      </tr>
    `;
  const expenseMarkup = bill.extraExpenses?.length
    ? bill.extraExpenses
      .map(
        (expense, index) => `
            <tr>
              <td>${index + 1}</td>
              <td colspan="3">${expense.reason}</td>
              <td>${expense.amount}</td>
            </tr>
          `
      )
      .join("")
    : `
      <tr>
        <td colspan="5">No other expenses were saved for this bill.</td>
      </tr>
    `;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Bill ${bill.displayDate}</title>
        <style>
          body {
            margin: 0;
            padding: 32px;
            font-family: Arial, sans-serif;
            background: #f7fbff;
            color: #08306b;
          }
          .sheet {
            max-width: 780px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #d6e5f2;
            border-radius: 18px;
            padding: 28px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 24px;
          }
          .eyebrow {
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
            color: #2171b5;
          }
          h1 {
            margin: 6px 0 0;
            font-size: 28px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th,
          td {
            padding: 12px;
            border-bottom: 1px solid #d6e5f2;
            text-align: left;
          }
          th {
            background: #deebf7;
            font-size: 13px;
          }
          .summary {
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
            gap: 16px;
            font-weight: 700;
            padding: 16px 18px;
            border-radius: 16px;
            background: #deebf7;
          }
          .worker-summary {
            margin-bottom: 18px;
          }
          .expense-summary {
            margin-bottom: 18px;
          }
          .grand-summary {
            background: #2171b5;
            color: #ffffff;
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <div>
              <div class="eyebrow">Generated Bill</div>
              <h1>${bill.displayDate}</h1>
            </div>
            <div>
              <div class="eyebrow">User</div>
              <div>${contractorName}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Worker</th>
                <th>Wage</th>
                <th>Days</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${rowMarkup}</tbody>
          </table>

          <div class="summary worker-summary">
            <span>Worker Total</span>
            <span>${bill.workerTotal ?? bill.totalAmount}</span>
          </div>

          <table style="margin-top: 20px;">
            <thead>
              <tr>
                <th>#</th>
                <th colspan="3">Other Expense</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>${expenseMarkup}</tbody>
          </table>

          <div class="summary expense-summary">
            <span>Other Expenses</span>
            <span>${bill.extraExpensesTotal || 0}</span>
          </div>

          <div class="summary grand-summary">
            <span>Grand Total</span>
            <span>${bill.totalAmount}</span>
          </div>
        </div>
      </body>
    </html>
  `;
}

function escapeMarkup(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildBillImageSvg(bill, contractorName) {
  const width = 1200;
  const baseHeight = 260;
  const rowHeight = 52;
  const expenseRows = bill.extraExpenses?.length || 0;
  const expenseHeaderHeight = 60;
  const summaryHeight = 184;
  const workerSummaryHeight = 54;
  const blockGap = 20;
  const finalGap = 12;
  const height =
    baseHeight +
    Math.max(bill.rows.length, 1) * rowHeight +
    workerSummaryHeight +
    blockGap +
    expenseHeaderHeight +
    Math.max(expenseRows, 1) * rowHeight +
    workerSummaryHeight +
    finalGap +
    summaryHeight;
  const rows = bill.rows.length
    ? bill.rows
      .map(
        (worker, index) => `
            <g transform="translate(0, ${232 + index * rowHeight})">
              <rect x="60" y="0" width="1080" height="52" fill="#ffffff" />
              <text x="90" y="33" font-size="20" font-weight="700" fill="#08519C">${index + 1}</text>
              <text x="170" y="33" font-size="20" font-weight="700" fill="#08306B">${escapeMarkup(worker.name)}</text>
              <text x="760" y="33" font-size="20" font-weight="700" text-anchor="middle" fill="#08519C">${worker.wage}</text>
              <text x="920" y="33" font-size="20" font-weight="700" text-anchor="middle" fill="#08519C">${worker.days ?? "-"}</text>
              <text x="1065" y="33" font-size="20" font-weight="700" text-anchor="end" fill="#08306B">${worker.total}</text>
              <line x1="60" y1="51" x2="1140" y2="51" stroke="#D6E5F2" stroke-width="1" />
            </g>
          `
      )
      .join("")
    : `
      <g transform="translate(0, 232)">
        <rect x="60" y="0" width="1080" height="52" fill="#ffffff" />
        <text x="90" y="33" font-size="20" font-weight="700" fill="#5D7394">No workers were marked present for this bill.</text>
        <line x1="60" y1="51" x2="1140" y2="51" stroke="#D6E5F2" stroke-width="1" />
      </g>
    `;
  const workerSummaryY = 252 + Math.max(bill.rows.length, 1) * rowHeight;
  const expenseStartY = workerSummaryY + workerSummaryHeight + blockGap;
  const expenseRowsMarkup = expenseRows
    ? bill.extraExpenses
      .map(
        (expense, index) => `
            <g transform="translate(0, ${expenseStartY + 52 + index * rowHeight})">
              <rect x="60" y="0" width="1080" height="52" fill="#ffffff" />
              <text x="90" y="33" font-size="20" font-weight="700" fill="#08519C">${index + 1}</text>
              <text x="170" y="33" font-size="20" font-weight="700" fill="#08306B">${escapeMarkup(expense.reason)}</text>
              <text x="1065" y="33" font-size="20" font-weight="700" text-anchor="end" fill="#08306B">${expense.amount}</text>
              <line x1="60" y1="51" x2="1140" y2="51" stroke="#D6E5F2" stroke-width="1" />
            </g>
          `
      )
      .join("")
    : `
      <g transform="translate(0, ${expenseStartY + 52})">
        <rect x="60" y="0" width="1080" height="52" fill="#ffffff" />
        <text x="90" y="33" font-size="20" font-weight="700" fill="#5D7394">No other expenses were saved for this bill.</text>
        <line x1="60" y1="51" x2="1140" y2="51" stroke="#D6E5F2" stroke-width="1" />
      </g>
    `;
  const expenseSummaryY = expenseStartY + 52 + Math.max(expenseRows, 1) * rowHeight + 20;
  const grandSummaryY = expenseSummaryY + workerSummaryHeight + finalGap;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="#F7FBFF" />
      <rect x="40" y="40" width="1120" height="${height - 80}" rx="28" fill="#FFFFFF" stroke="#D6E5F2" />
      <text x="70" y="96" font-size="18" font-weight="800" fill="#2171B5">GENERATED BILL</text>
      <text x="70" y="144" font-size="40" font-weight="900" fill="#08306B">${escapeMarkup(
    bill.displayDate
  )}</text>
      <text x="840" y="96" font-size="18" font-weight="800" fill="#2171B5">CONTRACTOR</text>
      <text x="840" y="136" font-size="28" font-weight="800" fill="#08306B">${escapeMarkup(
    contractorName
  )}</text>

      <rect x="60" y="180" width="1080" height="52" fill="#DEEBF7" />
      <text x="90" y="213" font-size="20" font-weight="800" fill="#08519C">#</text>
      <text x="170" y="213" font-size="20" font-weight="800" fill="#08519C">Worker</text>
      <text x="760" y="213" font-size="20" font-weight="800" text-anchor="middle" fill="#08519C">Wage</text>
      <text x="920" y="213" font-size="20" font-weight="800" text-anchor="middle" fill="#08519C">Days</text>
      <text x="1065" y="213" font-size="20" font-weight="800" text-anchor="end" fill="#08519C">Total</text>

      ${rows}

      <rect x="60" y="${workerSummaryY}" width="1080" height="54" rx="18" fill="#DEEBF7" />
      <text x="90" y="${workerSummaryY + 34}" font-size="22" font-weight="900" fill="#08306B">Worker Total</text>
      <text x="1110" y="${workerSummaryY + 34}" font-size="24" font-weight="900" text-anchor="end" fill="#08306B">${bill.workerTotal ?? bill.totalAmount
    }</text>

      <rect x="60" y="${expenseStartY}" width="1080" height="52" fill="#DEEBF7" />
      <text x="90" y="${expenseStartY + 33}" font-size="20" font-weight="800" fill="#08519C">#</text>
      <text x="170" y="${expenseStartY + 33}" font-size="20" font-weight="800" fill="#08519C">Other Expense</text>
      <text x="1065" y="${expenseStartY + 33}" font-size="20" font-weight="800" text-anchor="end" fill="#08519C">Amount</text>

      ${expenseRowsMarkup}

      <rect x="60" y="${expenseSummaryY}" width="1080" height="54" rx="18" fill="#DEEBF7" />
      <text x="90" y="${expenseSummaryY + 34}" font-size="22" font-weight="900" fill="#08306B">Other Expenses</text>
      <text x="1110" y="${expenseSummaryY + 34}" font-size="24" font-weight="900" text-anchor="end" fill="#08306B">${bill.extraExpensesTotal || 0
    }</text>

      <rect x="60" y="${grandSummaryY}" width="1080" height="74" rx="18" fill="#2171B5" />
      <text x="90" y="${grandSummaryY + 45}" font-size="24" font-weight="900" fill="#FFFFFF">Grand Total</text>
      <text x="1110" y="${grandSummaryY + 45}" font-size="28" font-weight="900" text-anchor="end" fill="#FFFFFF">${bill.totalAmount}</text>
    </svg>
  `;
}

function extractAttendanceList(result) {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.data)) {
    return result.data;
  }

  if (Array.isArray(result?.workers)) {
    return result.workers;
  }

  return [];
}

function decodeTokenName(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return "";
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded =
      typeof atob === "function"
        ? atob(normalized)
        : Buffer.from(normalized, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    return parsed.fullName || parsed.name || "";
  } catch {
    return "";
  }
}

function isLikelyPhoneValue(value) {
  const normalized = String(value || "").trim();
  return normalized.length > 0 && /^[0-9+\-\s()]+$/.test(normalized);
}

function resolveDisplayName(session) {
  const storedName = String(session?.name || "").trim();
  const tokenName = decodeTokenName(session?.token || "").trim();
  const mappedName = getStoredUserName(session?.mobile || "").trim();

  if (storedName && !isLikelyPhoneValue(storedName)) {
    return storedName;
  }

  if (tokenName && !isLikelyPhoneValue(tokenName)) {
    return tokenName;
  }

  if (mappedName && !isLikelyPhoneValue(mappedName)) {
    return mappedName;
  }

  return "User";
}

function decodeTokenPayload(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded =
      typeof atob === "function"
        ? atob(normalized)
        : Buffer.from(normalized, "base64").toString("utf8");

    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function isTokenExpired(token) {
  const payload = decodeTokenPayload(token);

  if (!payload?.exp) {
    return false;
  }

  return payload.exp * 1000 <= Date.now();
}

function readStoredSession() {
  try {
    if (!globalThis.localStorage) {
      return null;
    }

    const raw = globalThis.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

function persistSession(session) {
  try {
    if (!globalThis.localStorage) {
      return;
    }

    globalThis.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage failures and continue with in-memory session.
  }
}

function clearPersistedSession() {
  try {
    if (!globalThis.localStorage) {
      return;
    }

    globalThis.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures during logout cleanup.
  }
}

function readStoredUserNames() {
  try {
    if (!globalThis.localStorage) {
      return {};
    }

    const raw = globalThis.localStorage.getItem(USER_NAME_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistUserName(mobile, fullName) {
  try {
    if (!globalThis.localStorage) {
      return;
    }

    const normalizedMobile = String(mobile || "").trim();
    const normalizedName = String(fullName || "").trim();

    if (!normalizedMobile || !normalizedName || isLikelyPhoneValue(normalizedName)) {
      return;
    }

    const current = readStoredUserNames();
    current[normalizedMobile] = normalizedName;
    globalThis.localStorage.setItem(USER_NAME_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage failures and continue.
  }
}

function getStoredUserName(mobile) {
  const normalizedMobile = String(mobile || "").trim();
  if (!normalizedMobile) {
    return "";
  }

  const storedNames = readStoredUserNames();
  return String(storedNames[normalizedMobile] || "").trim();
}

function AnimatedField({
  label,
  placeholder,
  value,
  secureTextEntry = false,
  inputStyle,
  rightAccessory,
  editable = true,
  keyboardType = "default",
  autoCapitalize = "none",
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  onChangeText
}) {
  const focus = useSharedValue(0);

  const containerStyle = useAnimatedStyle(() => ({
    borderColor: focus.value ? palette.blue500 : palette.border,
    backgroundColor: focus.value ? "rgba(247, 251, 255, 1)" : "rgba(247, 251, 255, 0.9)",
    transform: [{ scale: withTiming(focus.value ? 1.01 : 1, { duration: 180 }) }]
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: focus.value ? palette.blue800 : palette.textMuted
  }));

  return (
    <View style={styles.fieldBlock}>
      <Animated.Text style={[styles.fieldLabel, labelStyle]}>{label}</Animated.Text>
      <Animated.View style={[styles.inputShell, !editable && styles.inputShellLocked, containerStyle]}>
        <TextInput
          value={value}
          placeholder={placeholder}
          placeholderTextColor="#87A0BF"
          style={[styles.input, inputStyle]}
          secureTextEntry={secureTextEntry}
          editable={editable}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => {
            focus.value = 1;
          }}
          onBlur={() => {
            focus.value = 0;
          }}
          onChangeText={onChangeText}
        />
        {rightAccessory ? <View style={styles.inputAccessory}>{rightAccessory}</View> : null}
      </Animated.View>
    </View>
  );
}

function TrashIcon() {
  return <MuiAppIcon icon={DeleteIcon} color={palette.danger} size={20} />;
}

function EyeIcon({ hidden = false }) {
  return (
    <MuiAppIcon
      icon={hidden ? VisibilityOffIcon : VisibilityIcon}
      color={palette.blue800}
      size={21}
    />
  );
}

function DownloadIcon({ active = false }) {
  return <MuiAppIcon icon={FileDownloadIcon} color={active ? palette.blue700 : palette.blue800} size={25} />;
}

function BrandLogo() {
  return (
    <View style={styles.brandBadge}>
      <View style={styles.brandMark}>
        <MuiAppIcon icon={HomeIcon} color="#F7FBFF" size={25} />
      </View>
    </View>
  );
}

function LogoutIcon() {
  return <MuiAppIcon icon={MuiLogoutIcon} color="#F7FBFF" size={25} />;
}

function PencilEditIcon() {
  return <MuiAppIcon icon={EditIcon} color={palette.blue700} size={23} />;
}

function ChevronIcon({ expanded = false }) {
  return (
    <MuiAppIcon
      icon={ExpandMoreIcon}
      color={palette.blue800}
      size={22}
      style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
    />
  );
}

function AttendanceTabIcon({ active = false }) {
  return <MuiAppIcon icon={CalendarMonthIcon} color={active ? palette.blue700 : palette.blue800} size={25} />;
}

function ManageTabIcon({ active = false }) {
  return <MuiAppIcon icon={GroupsIcon} color={active ? palette.blue700 : palette.blue800} size={26} />;
}

function BillingTabIcon({ active = false }) {
  return <MuiAppIcon icon={CurrencyRupeeIcon} color={active ? palette.blue700 : palette.blue800} size={25} />;
}

function AddWorkerIcon() {
  return <MuiAppIcon icon={PersonAddAlt1Icon} color={palette.blue800} size={31} />;
}

function RupeeIcon() {
  return <MuiAppIcon icon={CurrencyRupeeIcon} color={palette.blue800} size={21} />;
}

function CheckActionIcon() {
  return <MuiAppIcon icon={CheckCircleIcon} color={palette.blue800} size={30} />;
}

function CloseChipIcon() {
  return <MuiAppIcon icon={CloseIcon} color={palette.blue800} size={17} />;
}

function CalendarPreviousIcon() {
  return <MuiAppIcon icon={ChevronLeftIcon} color={palette.blue800} size={22} />;
}

function CalendarNextIcon() {
  return <MuiAppIcon icon={ChevronRightIcon} color={palette.blue800} size={22} />;
}

function AttendanceStatusIcon({ status, active = false }) {
  return (
    <MuiAppIcon
      icon={status === "present" ? CheckIcon : CloseIcon}
      color={active ? "#FFFFFF" : palette.textMuted}
      size={24}
    />
  );
}

function ExpenseActionIcon({ action }) {
  return <MuiAppIcon icon={action === "add" ? AddIcon : RemoveIcon} color={palette.blue800} size={22} />;
}

function BottomTabs({ activeTab, onChange }) {
  const tabs = [
    { key: "attendance", label: "Attendance" },
    { key: "manage", label: "Manage" },
    { key: "billing", label: "Billing" },
    { key: "generated-bills", label: "Bills" }
  ];

  return (
    <View style={styles.bottomTabs}>
      {tabs.map((tab) => {
        const active = activeTab === tab.key;

        return (
          <Pressable
            key={tab.key}
            style={({ hovered, pressed }) => [
              styles.bottomTabPressable,
              hovered && styles.bottomTabPressableHover,
              pressed && styles.bottomTabPressablePressed
            ]}
            onPress={() => onChange(tab.key)}
          >
            <View style={[styles.bottomTab, active && styles.bottomTabActive]}>
              <View style={styles.bottomTabIconSlot}>
                {tab.key === "attendance" ? (
                  <AttendanceTabIcon active={active} />
                ) : tab.key === "manage" ? (
                  <ManageTabIcon active={active} />
                ) : tab.key === "billing" ? (
                  <BillingTabIcon active={active} />
                ) : tab.key === "generated-bills" ? (
                  <DownloadIcon active={active} />
                ) : (
                  <View style={[styles.bottomTabDot, active && styles.bottomTabDotActive]} />
                )}
              </View>
              <Text
                style={[styles.bottomTabText, active && styles.bottomTabTextActive]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function AttendanceHome({ displayName, token, onLogout }) {
  const [activeTab, setActiveTab] = useState("attendance");
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [billingFromDate, setBillingFromDate] = useState("");
  const [billingToDate, setBillingToDate] = useState("");
  const [billingPickerTarget, setBillingPickerTarget] = useState(null);
  const [billingPickerMonth, setBillingPickerMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [workers, setWorkers] = useState([]);
  const [attendanceDraft, setAttendanceDraft] = useState({});
  const [savedDateKeys, setSavedDateKeys] = useState({});
  const [billingRows, setBillingRows] = useState([]);
  const [extraExpensesByMonth, setExtraExpensesByMonth] = useState({});
  const [workerName, setWorkerName] = useState("");
  const [workerWage, setWorkerWage] = useState("");
  const [isWorkerWageFocused, setIsWorkerWageFocused] = useState(false);
  const [showAddWorkerForm, setShowAddWorkerForm] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [workerDeleteTarget, setWorkerDeleteTarget] = useState(null);
  const [isDeletingWorker, setIsDeletingWorker] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [savingBillingToBackend, setSavingBillingToBackend] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [addingWorker, setAddingWorker] = useState(false);
  const [billingEditMode, setBillingEditMode] = useState(false);
  const [billingDraftsByMonth, setBillingDraftsByMonth] = useState({});
  const [generatedBillsByMonth, setGeneratedBillsByMonth] = useState({});
  const [generatedBillCache, setGeneratedBillCache] = useState({});
  const [selectedGeneratedBill, setSelectedGeneratedBill] = useState(null);
  const [loadingGeneratedBills, setLoadingGeneratedBills] = useState(false);
  const [loadingGeneratedBillAction, setLoadingGeneratedBillAction] = useState("");
  const [deletingGeneratedBills, setDeletingGeneratedBills] = useState(false);
  const [expandedGeneratedMonth, setExpandedGeneratedMonth] = useState("");
  const [generatedMonthDeleteTarget, setGeneratedMonthDeleteTarget] = useState(null);
  const [generatedBillDeleteTarget, setGeneratedBillDeleteTarget] = useState(null);
  const expenseRowSequence = useRef(1);
  const [todayKey, setTodayKey] = useState(() => formatDateKey(new Date()));

  const calendarDays = useMemo(() => getMonthMatrix(calendarMonth), [calendarMonth]);
  const isLockedDate = isFutureDateKey(selectedDate, todayKey);
  const selectedDateText = useMemo(() => {
    const current = new Date(`${selectedDate}T00:00:00`);
    return current.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }, [selectedDate]);

  const pendingCount = useMemo(
    () => workers.filter((worker) => attendanceDraft[worker._id] == null).length,
    [workers, attendanceDraft]
  );
  const hasBillingFilter = Boolean(billingFromDate && billingToDate);
  const billingRangeKey = useMemo(
    () => (hasBillingFilter ? `${billingFromDate}_${billingToDate}` : "default"),
    [billingFromDate, billingToDate, hasBillingFilter]
  );
  const extraExpenses = useMemo(
    () =>
      extraExpensesByMonth[billingRangeKey] || [
        { id: createExpenseRowId(billingRangeKey, 1), reason: "", amount: "" }
      ],
    [billingRangeKey, extraExpensesByMonth]
  );
  const billingDrafts = useMemo(
    () => billingDraftsByMonth[billingRangeKey] || {},
    [billingRangeKey, billingDraftsByMonth]
  );
  const billingPickerDays = useMemo(() => getMonthMatrix(billingPickerMonth), [billingPickerMonth]);
  const displayBillingRows = useMemo(
    () =>
      billingRows.map((worker) => {
        const workerDraft = billingDrafts[worker.id] || {};
        const resolvedWage =
          workerDraft.wage == null || workerDraft.wage === ""
            ? worker.wage
            : Number(workerDraft.wage);
        const resolvedDays =
          workerDraft.days == null || workerDraft.days === ""
            ? worker.totalDays
            : Number(workerDraft.days);
        const wage = Number.isFinite(resolvedWage) ? resolvedWage : worker.wage;
        const totalDays = Number.isFinite(resolvedDays) ? resolvedDays : worker.totalDays;

        return {
          ...worker,
          displayDays: totalDays,
          displayWage: wage,
          totalWage: wage * totalDays
        };
      }),
    [billingRows, billingDrafts]
  );
  const billingGrandTotal = useMemo(
    () => displayBillingRows.reduce((sum, worker) => sum + worker.totalWage, 0),
    [displayBillingRows]
  );
  const extraExpensesTotal = useMemo(
    () =>
      extraExpenses.reduce((sum, item) => {
        const amount = Number(item.amount);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [extraExpenses]
  );
  const overallPayableTotal = billingGrandTotal + extraExpensesTotal;
  const generatedBillMonths = useMemo(
    () => Object.values(generatedBillsByMonth).filter((month) => month.bills.length > 0),
    [generatedBillsByMonth]
  );

  function updateBillingWorkerField(workerId, key, value) {
    if (!billingEditMode) {
      return;
    }

    const normalizedValue = value.replace(/[^0-9.]/g, "");

    setBillingDraftsByMonth((current) => ({
      ...current,
      [billingRangeKey]: {
        ...(current[billingRangeKey] || {}),
        [workerId]: {
          ...(current[billingRangeKey]?.[workerId] || {}),
          [key]: normalizedValue
        }
      }
    }));
  }

  function cacheGeneratedBill(bill) {
    const billKey = getGeneratedBillKey(bill);

    setGeneratedBillCache((current) => ({
      ...current,
      [billKey]: bill
    }));
  }

  function upsertGeneratedBill(bill) {
    const billKey = getGeneratedBillKey(bill);

    cacheGeneratedBill(bill);

    setGeneratedBillsByMonth((current) => {
      const monthKey = bill.monthKey;
      const nextMonth = current[monthKey]
        ? {
          ...current[monthKey],
          bills: current[monthKey].bills
            .filter((item) => getGeneratedBillKey(item) !== billKey)
            .concat(bill)
            .sort(
              (left, right) =>
                right.dateKey.localeCompare(left.dateKey) ||
                (right.id || "").localeCompare(left.id || "") ||
                (right.rangeDisplayDate || "").localeCompare(left.rangeDisplayDate || "")
            )
        }
        : {
          monthKey,
          label: formatMonthHeading(monthKey),
          bills: [bill]
        };

      return {
        ...current,
        [monthKey]: nextMonth
      };
    });

    setExpandedGeneratedMonth(bill.monthKey);
  }

  function removeGeneratedBillFromState(bill) {
    const billKey = getGeneratedBillKey(bill);

    setGeneratedBillCache((current) => {
      const nextCache = { ...current };
      delete nextCache[billKey];
      return nextCache;
    });

    setGeneratedBillsByMonth((current) => {
      const monthKey = bill.monthKey;
      const month = current[monthKey];

      if (!month) {
        return current;
      }

      const nextBills = month.bills.filter((item) => getGeneratedBillKey(item) !== billKey);
      const nextMonths = { ...current };

      if (nextBills.length > 0) {
        nextMonths[monthKey] = {
          ...month,
          bills: nextBills
        };
      } else {
        delete nextMonths[monthKey];
      }

      return nextMonths;
    });
  }

  async function getGeneratedBillForKey(billKey) {
    if (generatedBillCache[billKey]) {
      const cachedBill = generatedBillCache[billKey];

      if (cachedBill.id) {
        const billResult = await getBillById(cachedBill.id, token);
        const normalizedBill = normalizeStoredBillPayload(billResult?.bill);
        cacheGeneratedBill(normalizedBill);
        return normalizedBill;
      }

      return cachedBill;
    }

    const existingBillsResult = await getBills(token);
    const existingBills = Array.isArray(existingBillsResult?.bills) ? existingBillsResult.bills : [];
    const storedBill = existingBills
      .map((item) => normalizeStoredBillPayload(item))
      .filter((item) => getGeneratedBillKey(item) === billKey)
      .sort((left, right) => (right.id || "").localeCompare(left.id || ""))[0];
    let bill = storedBill;

    if (bill?.id) {
      const billResult = await getBillById(bill.id, token);
      bill = normalizeStoredBillPayload(billResult?.bill);
    }

    if (!bill) {
      throw new Error("This bill is not available in backend storage yet.");
    }

    cacheGeneratedBill(bill);
    return bill;
  }

  async function loadGeneratedBills() {
    setLoadingGeneratedBills(true);
    setErrorMessage("");

    try {
      const months = getMonthsForYear(parseDateKey(todayKey));
      const nextGeneratedBills = {};
      const nextGeneratedBillCache = {};
      const result = await getBills(token);
      const storedBills = Array.isArray(result?.bills) ? result.bills : [];

      storedBills
        .map((bill) => normalizeStoredBillPayload(bill))
        .filter((bill) => bill.dateKey && bill.monthKey)
        .sort(
          (left, right) =>
            right.dateKey.localeCompare(left.dateKey) || (right.id || "").localeCompare(left.id || "")
        )
        .forEach((bill) => {
          const monthKey = bill.monthKey;
          const billKey = getGeneratedBillKey(bill);

          if (!nextGeneratedBills[monthKey]) {
            nextGeneratedBills[monthKey] = {
              monthKey,
              label: formatMonthHeading(monthKey),
              bills: []
            };
          }

          nextGeneratedBills[monthKey].bills.push(bill);
          nextGeneratedBillCache[billKey] = bill;
        });

      Object.values(nextGeneratedBills).forEach((month) => {
        month.bills.sort(
          (left, right) =>
            right.dateKey.localeCompare(left.dateKey) ||
            (right.id || "").localeCompare(left.id || "") ||
            (right.rangeDisplayDate || "").localeCompare(left.rangeDisplayDate || "")
        );
      });

      setGeneratedBillsByMonth(nextGeneratedBills);
      setGeneratedBillCache(nextGeneratedBillCache);
      setExpandedGeneratedMonth((current) =>
        current && nextGeneratedBills[current] ? current : Object.keys(nextGeneratedBills)[0] || ""
      );
    } catch (error) {
      setGeneratedBillsByMonth({});
      setGeneratedBillCache({});
      setErrorMessage(error.message || "Failed to load generated bills.");
    } finally {
      setLoadingGeneratedBills(false);
    }
  }

  // function downloadGeneratedBillFile(bill) {
  //   const filename = `bill-${bill.displayDate}.png`;

  //   if (Platform.OS === "web" && globalThis.document && globalThis.URL && globalThis.Image) {
  //     const svgMarkup = buildBillImageSvg(bill, displayName);
  //     const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  //     const svgUrl = globalThis.URL.createObjectURL(svgBlob);

  //     return new Promise((resolve, reject) => {
  //       const image = new globalThis.Image();
  //       image.onload = () => {
  //         try {
  //           const canvas = globalThis.document.createElement("canvas");
  //           canvas.width = image.width;
  //           canvas.height = image.height;
  //           const context = canvas.getContext("2d");

  //           if (!context) {
  //             throw new Error("Canvas is not available for image export.");
  //           }

  //           context.fillStyle = "#F7FBFF";
  //           context.fillRect(0, 0, canvas.width, canvas.height);
  //           context.drawImage(image, 0, 0);

  //           const pngUrl = canvas.toDataURL("image/png");
  //           const link = globalThis.document.createElement("a");
  //           link.href = pngUrl;
  //           link.download = filename;
  //           globalThis.document.body.appendChild(link);
  //           link.click();
  //           globalThis.document.body.removeChild(link);
  //           globalThis.URL.revokeObjectURL(svgUrl);
  //           resolve();
  //         } catch (error) {
  //           globalThis.URL.revokeObjectURL(svgUrl);
  //           reject(error);
  //         }
  //       };

  //       image.onerror = () => {
  //         globalThis.URL.revokeObjectURL(svgUrl);
  //         reject(new Error("Failed to generate bill image."));
  //       };

  //       image.src = svgUrl;
  //     });
  //   }

  //   throw new Error("Image download is available in the browser build for now.");
  // }

  async function downloadGeneratedBillFile(bill) {
    const filename = `bill-${bill.displayDate}.png`;
    const svgMarkup = buildBillImageSvg(bill, displayName);

    // WEB path — unchanged
    if (Platform.OS === "web" && globalThis.document && globalThis.URL && globalThis.Image) {
      const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = globalThis.URL.createObjectURL(svgBlob);

      return new Promise((resolve, reject) => {
        const image = new globalThis.Image();
        image.onload = () => {
          try {
            const canvas = globalThis.document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext("2d");

            if (!context) throw new Error("Canvas is not available for image export.");

            context.fillStyle = "#F7FBFF";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0);

            const pngUrl = canvas.toDataURL("image/png");
            const link = globalThis.document.createElement("a");
            link.href = pngUrl;
            link.download = filename;
            globalThis.document.body.appendChild(link);
            link.click();
            globalThis.document.body.removeChild(link);
            globalThis.URL.revokeObjectURL(svgUrl);
            resolve();
          } catch (error) {
            globalThis.URL.revokeObjectURL(svgUrl);
            reject(error);
          }
        };
        image.onerror = () => {
          globalThis.URL.revokeObjectURL(svgUrl);
          reject(new Error("Failed to generate bill image."));
        };
        image.src = svgUrl;
      });
    }

    // MOBILE path — SVG saved as file and shared
    try {
      const FileSystem = await import("expo-file-system");
      const Sharing = await import("expo-sharing");

      const svgPath = `${FileSystem.cacheDirectory}${filename.replace(".png", ".svg")}`;
      await FileSystem.writeAsStringAsync(svgPath, svgMarkup, {
        encoding: FileSystem.EncodingType.UTF8
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error("Sharing is not available on this device.");
      }

      await Sharing.shareAsync(svgPath, {
        mimeType: "image/svg+xml",
        dialogTitle: `Bill ${bill.displayDate}`,
        UTI: "public.svg-image"
      });
    } catch (error) {
      throw new Error(error.message || "Failed to share bill on mobile.");
    }
  }

  async function handleViewGeneratedBill(billKey) {
    setLoadingGeneratedBillAction(`view-${billKey}`);
    setErrorMessage("");

    try {
      const bill = await getGeneratedBillForKey(billKey);
      setSelectedGeneratedBill(bill);
    } catch (error) {
      setErrorMessage(error.message || "Failed to open generated bill.");
    } finally {
      setLoadingGeneratedBillAction("");
    }
  }

  async function handleDownloadGeneratedBill(billKey) {
    setLoadingGeneratedBillAction(`download-${billKey}`);
    setErrorMessage("");

    try {
      const bill = await getGeneratedBillForKey(billKey);
      await downloadGeneratedBillFile(bill);
    } catch (error) {
      setErrorMessage(error.message || "Failed to download generated bill.");
    } finally {
      setLoadingGeneratedBillAction("");
    }
  }

  function toggleGeneratedMonth(monthKey) {
    setExpandedGeneratedMonth((current) => (current === monthKey ? "" : monthKey));
  }

  function requestGeneratedMonthDelete(month) {
    setGeneratedMonthDeleteTarget(month);
  }

  function cancelGeneratedMonthDelete() {
    setGeneratedMonthDeleteTarget(null);
  }

  async function confirmGeneratedMonthDelete() {
    if (!generatedMonthDeleteTarget || deletingGeneratedBills) {
      return;
    }

    const billsToDelete = generatedMonthDeleteTarget.bills.filter((bill) => bill.id);

    if (billsToDelete.length === 0) {
      setGeneratedMonthDeleteTarget(null);
      setErrorMessage("These bills do not have backend IDs yet, so they cannot be deleted.");
      return;
    }

    setDeletingGeneratedBills(true);
    setLoadingGeneratedBillAction(`delete-month-${generatedMonthDeleteTarget.monthKey}`);
    setErrorMessage("");

    try {
      await Promise.all(billsToDelete.map((bill) => deleteBill(bill.id, token)));
      billsToDelete.forEach(removeGeneratedBillFromState);
      setGeneratedMonthDeleteTarget(null);
      setSelectedGeneratedBill((current) =>
        current && billsToDelete.some((bill) => bill.id === current.id) ? null : current
      );
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete generated bills.");
    } finally {
      setDeletingGeneratedBills(false);
      setLoadingGeneratedBillAction("");
    }
  }

  function requestGeneratedBillDelete(bill) {
    setGeneratedBillDeleteTarget(bill);
  }

  function cancelGeneratedBillDelete() {
    setGeneratedBillDeleteTarget(null);
  }

  async function confirmGeneratedBillDelete() {
    if (!generatedBillDeleteTarget || deletingGeneratedBills) {
      return;
    }

    if (!generatedBillDeleteTarget.id) {
      setGeneratedBillDeleteTarget(null);
      setErrorMessage("This bill does not have a backend ID yet, so it cannot be deleted.");
      return;
    }

    const billToDelete = generatedBillDeleteTarget;

    setDeletingGeneratedBills(true);
    setLoadingGeneratedBillAction(`delete-${getGeneratedBillKey(billToDelete)}`);
    setErrorMessage("");

    try {
      await deleteBill(billToDelete.id, token);
      removeGeneratedBillFromState(billToDelete);
      setGeneratedBillDeleteTarget(null);
      setSelectedGeneratedBill((current) => (current?.id === billToDelete.id ? null : current));
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete generated bill.");
    } finally {
      setDeletingGeneratedBills(false);
      setLoadingGeneratedBillAction("");
    }
  }

  async function saveBillToBackend(savedBill) {
    const storeResult = await storeBill(
      {
        generatedBillData: createStoredBillPayload(savedBill),
        name:
          `Bill ${savedBill.displayDate}`,
        date: savedBill.dateKey
      },
      token
    );

    const normalizedSavedBill = storeResult?.bill
      ? normalizeStoredBillPayload(storeResult.bill)
      : savedBill;

    upsertGeneratedBill(normalizedSavedBill);
    return normalizedSavedBill;
  }

  async function handleSaveBillingToBackend() {
    if (loadingBilling || savingBillingToBackend) {
      return;
    }

    if (!billingFromDate || !billingToDate) {
      setErrorMessage("Select both From and To dates before generating a bill.");
      return;
    }

    if (displayBillingRows.length === 0) {
      setErrorMessage("No billing rows are available to generate.");
      return;
    }

    setSavingBillingToBackend(true);
    setErrorMessage("");

    try {
      const normalizedExtraExpenses = extraExpenses
        .map((item) => ({
          id: item.id,
          reason: String(item.reason || "").trim(),
          amount: Number(item.amount) || 0
        }))
        .filter((item) => item.reason || item.amount > 0);

      const fromDateKey = billingFromDate;
      const toDateKey = billingToDate;
      const billDateKey = todayKey;
      const savedBill = {
        dateKey: billDateKey,
        displayDate: formatDisplayDate(billDateKey),
        rangeDisplayDate:
          fromDateKey !== toDateKey
            ? `${formatDisplayDate(fromDateKey)} to ${formatDisplayDate(toDateKey)}`
            : formatDisplayDate(fromDateKey),
        monthKey: getMonthKey(billDateKey),
        fromDateKey,
        toDateKey,
        rows: displayBillingRows.map((worker) => ({
          id: worker.id,
          name: worker.name,
          wage: worker.displayWage,
          days: worker.displayDays,
          total: worker.totalWage
        })),
        presentCount: displayBillingRows.filter((worker) => worker.displayDays > 0).length,
        absentCount: 0,
        workerTotal: billingGrandTotal,
        extraExpenses: normalizedExtraExpenses,
        extraExpensesTotal,
        totalAmount: overallPayableTotal
      };

      await saveBillToBackend(savedBill);
      await loadGeneratedBills();
    } catch (error) {
      setErrorMessage(error.message || "Failed to save billing to backend.");
    } finally {
      setSavingBillingToBackend(false);
    }
  }

  async function loadAttendance(date) {
    setLoadingList(true);
    setErrorMessage("");

    try {
      const result = await getAttendanceByDate(date, token);
      const data = extractAttendanceList(result);
      setWorkers(data);

      const nextDraft = {};
      for (const worker of data) {
        nextDraft[worker._id] = worker.attendanceStatus ?? null;
      }
      setAttendanceDraft(nextDraft);

      if (hasRecordedAttendance(data)) {
        setSavedDateKeys((current) => ({
          ...current,
          [date]: true
        }));
      }
    } catch (error) {
      setWorkers([]);
      setAttendanceDraft({});
      setErrorMessage(error.message || "Failed to load attendance.");
    } finally {
      setLoadingList(false);
    }
  }

  async function loadSavedDatesForMonth(targetMonth) {
    const dateKeys = getMonthDateKeys(targetMonth);

    try {
      const responses = await Promise.all(
        dateKeys.map((date) =>
          getAttendanceByDate(date, token)
            .then((result) => ({ date, workers: extractAttendanceList(result) }))
            .catch(() => ({ date, workers: [] }))
        )
      );

      setSavedDateKeys((current) => {
        const nextSavedDates = { ...current };
        const visibleMonthPrefix = `${targetMonth.getFullYear()}-${String(
          targetMonth.getMonth() + 1
        ).padStart(2, "0")}`;

        Object.keys(nextSavedDates).forEach((dateKey) => {
          if (dateKey.startsWith(visibleMonthPrefix)) {
            delete nextSavedDates[dateKey];
          }
        });

        responses.forEach(({ date, workers }) => {
          if (hasRecordedAttendance(workers)) {
            nextSavedDates[date] = true;
          }
        });

        return nextSavedDates;
      });
    } catch {
      // Keep the current saved-date markers if the background month scan fails.
    }
  }

  async function handleSaveAttendance() {
    if (isLockedDate) {
      setErrorMessage("Future dates are locked. You can edit today and previous dates.");
      return;
    }

    const entriesToSave = workers
      .map((worker) => ({
        workerId: worker._id,
        status: attendanceDraft[worker._id]
      }))
      .filter((item) => item.status === "present" || item.status === "absent");

    if (entriesToSave.length === 0) {
      setErrorMessage("Select at least one tick or cross before saving.");
      return;
    }

    setSavingAttendance(true);
    setErrorMessage("");

    try {
      const saveResponses = [];

      for (const entry of entriesToSave) {
        console.log(
          "Saving attendance for worker",
          entry.workerId,
          "with status",
          entry.status,
          "for date",
          selectedDate
        );

        const response = await markAttendance(
          {
            workerId: entry.workerId,
            date: selectedDate,
            status: entry.status
          },
          token
        );

        saveResponses.push(response);
        console.log("Attendance save response:", response);
      }

      setSavedDateKeys((current) => ({
        ...current,
        [selectedDate]: true
      }));
      console.log(
        "Attendance save summary:",
        saveResponses.map((item) => item?.message).filter(Boolean)
      );
      await loadAttendance(selectedDate);
      if (hasBillingFilter && selectedDate >= billingFromDate && selectedDate <= billingToDate) {
        await loadBillingSummary(billingFromDate, billingToDate);
      } else if (!hasBillingFilter && activeTab === "billing") {
        setBillingRows([]);
      }

      if (activeTab === "generated-bills") {
        await loadGeneratedBills();
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to save attendance.");
    } finally {
      setSavingAttendance(false);
    }
  }

  async function handleAddWorker() {
    if (!workerName.trim() || !workerWage.trim() || addingWorker) {
      return;
    }

    setAddingWorker(true);
    setErrorMessage("");

    try {
      await addWorker(
        {
          workersData: {
            name: workerName.trim(),
            wage: Number(workerWage)
          }
        },
        token
      );

      resetWorkerForm();
      await loadAttendance(selectedDate);
      if (activeTab === "billing") {
        if (hasBillingFilter) {
          await loadBillingSummary(billingFromDate, billingToDate);
        } else {
          setBillingRows([]);
        }
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to add worker.");
    } finally {
      setAddingWorker(false);
    }
  }

  async function handleEditWorker() {
    if (!editingWorker?._id || !workerName.trim() || !workerWage.trim() || addingWorker) {
      return;
    }

    setAddingWorker(true);
    setErrorMessage("");

    try {
      await editWorker(
        editingWorker._id,
        {
          name: workerName.trim(),
          wage: Number(workerWage)
        },
        token
      );

      resetWorkerForm();
      await loadAttendance(selectedDate);
      if (activeTab === "billing") {
        if (hasBillingFilter) {
          await loadBillingSummary(billingFromDate, billingToDate);
        } else {
          setBillingRows([]);
        }
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to update worker.");
    } finally {
      setAddingWorker(false);
    }
  }

  function resetWorkerForm() {
    setWorkerName("");
    setWorkerWage("");
    setEditingWorker(null);
    setShowAddWorkerForm(false);
  }

  async function handleDeleteWorker() {
    if (!editingWorker?._id) {
      return;
    }
    setWorkerDeleteTarget(editingWorker);
  }

  async function confirmDeleteWorker() {
    if (!workerDeleteTarget?._id) {
      return;
    }

    setIsDeletingWorker(true);
    setErrorMessage("");

    try {
      await deleteWorker(workerDeleteTarget._id, token);
      setWorkerDeleteTarget(null);
      resetWorkerForm();
      await loadAttendance(selectedDate);
      if (activeTab === "billing") {
        if (hasBillingFilter) {
          await loadBillingSummary(billingFromDate, billingToDate);
        } else {
          setBillingRows([]);
        }
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete worker.");
    } finally {
      setIsDeletingWorker(false);
    }
  }

  function cancelDeleteWorker() {
    setWorkerDeleteTarget(null);
  }

  function showDeleteConfirmation(worker) {
    setWorkerDeleteTarget(worker);
  }

  function openAddWorkerForm() {
    setErrorMessage("");
    setEditingWorker(null);
    setWorkerName("");
    setWorkerWage("");
    setShowAddWorkerForm(true);
  }

  function openEditWorkerForm(worker) {
    setErrorMessage("");
    setEditingWorker(worker);
    setWorkerName(worker.name || "");
    setWorkerWage(String(worker.wage ?? ""));
    setShowAddWorkerForm(true);
  }

  async function handleWorkerSubmit() {
    if (editingWorker) {
      await handleEditWorker();
      return;
    }

    await handleAddWorker();
  }

  async function loadBillingSummary(fromDateKey, toDateKey) {
    setLoadingBilling(true);
    setErrorMessage("");

    try {
      const dateKeys = getDateRangeKeys(fromDateKey, toDateKey);
      const responses = await Promise.all(
        dateKeys.map((date) =>
          getAttendanceByDate(date, token)
            .then((result) => extractAttendanceList(result))
            .catch(() => [])
        )
      );

      const summaryMap = new Map();

      for (const dailyWorkers of responses) {
        for (const worker of dailyWorkers) {
          const existing = summaryMap.get(worker._id) || {
            id: worker._id,
            name: worker.name,
            wage: Number(worker.wage) || 0,
            totalDays: 0
          };

          existing.name = worker.name;
          existing.wage = Number(worker.wage) || 0;

          if (worker.attendanceStatus === "present") {
            existing.totalDays += 1;
          }

          summaryMap.set(worker._id, existing);
        }
      }

      const nextRows = Array.from(summaryMap.values())
        .map((worker) => ({
          ...worker,
          totalWage: worker.totalDays * worker.wage
        }))
        .sort((left, right) => left.name.localeCompare(right.name));

      setBillingRows(nextRows);
    } catch (error) {
      setBillingRows([]);
      setErrorMessage(error.message || "Failed to load monthly billing.");
    } finally {
      setLoadingBilling(false);
    }
  }

  useEffect(() => {
    const syncTodayKey = () => {
      setTodayKey(formatDateKey(new Date()));
    };

    syncTodayKey();

    const intervalId = setInterval(syncTodayKey, 60 * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    void loadAttendance(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (activeTab === "attendance") {
      void loadSavedDatesForMonth(calendarMonth);
    }
  }, [activeTab, calendarMonth, token]);

  useEffect(() => {
    if (activeTab === "billing") {
      if (hasBillingFilter) {
        void loadBillingSummary(billingFromDate, billingToDate);
      } else {
        setBillingRows([]);
      }
    }
  }, [activeTab, billingFromDate, billingToDate, todayKey]);

  useEffect(() => {
    if (activeTab === "generated-bills") {
      void loadGeneratedBills();
    }
  }, [activeTab, todayKey]);

  function setWorkerAttendance(workerId, status) {
    if (isLockedDate) {
      setErrorMessage("Future dates are locked. You can change today and previous dates.");
      return;
    }

    setErrorMessage("");
    setAttendanceDraft((current) => ({
      ...current,
      [workerId]: status
    }));
  }

  function addExpenseRow() {
    setExtraExpensesByMonth((current) => {
      const currentRows = current[billingRangeKey] || [
        { id: createExpenseRowId(billingRangeKey, 1), reason: "", amount: "" }
      ];
      expenseRowSequence.current += 1;
      const nextRow = {
        id: createExpenseRowId(billingRangeKey, expenseRowSequence.current),
        reason: "",
        amount: ""
      };

      return {
        ...current,
        [billingRangeKey]: [...currentRows, nextRow]
      };
    });
  }

  // function removeExpenseRow() {
  //   setExtraExpensesByMonth((current) => {
  //     const currentRows = current[billingRangeKey] || [
  //       { id: createExpenseRowId(billingRangeKey, 1), reason: "", amount: "" }
  //     ];
  //     const nextRows =
  //       currentRows.length > 1
  //         ? currentRows.slice(0, -1)
  //         : [{ id: createExpenseRowId(billingRangeKey, 1), reason: "", amount: "" }];

  //     return {
  //       ...current,
  //       [billingRangeKey]: nextRows
  //     };
  //   });
  // }

  function removeExpenseRow(rowId) {
    setExtraExpensesByMonth((current) => {
      const currentRows = current[billingRangeKey] || [
        { id: createExpenseRowId(billingRangeKey, 1), reason: "", amount: "" }
      ];

      if (currentRows.length <= 1) {
        // Reset to a single blank row instead of removing the last one
        return {
          ...current,
          [billingRangeKey]: [{ id: createExpenseRowId(billingRangeKey, 1), reason: "", amount: "" }]
        };
      }

      return {
        ...current,
        [billingRangeKey]: currentRows.filter((row) => row.id !== rowId)
      };
    });
  }

  function updateExpenseRow(rowId, key, value) {
    setExtraExpensesByMonth((current) => {
      const currentRows = current[billingRangeKey] || [
        { id: createExpenseRowId(billingRangeKey, 1), reason: "", amount: "" }
      ];

      return {
        ...current,
        [billingRangeKey]: currentRows.map((row) =>
          row.id === rowId ? { ...row, [key]: value } : row
        )
      };
    });
  }

  function openBillingPicker(target) {
    const selectedDateKey = target === "from" ? billingFromDate : billingToDate;
    const targetDate = selectedDateKey ? parseDateKey(selectedDateKey) : todayKey;

    setBillingPickerTarget(target);
    setBillingPickerMonth(
      new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
    );
  }

  function handleBillingDatePick(dateKey) {
    if (billingPickerTarget === "from") {
      setBillingFromDate(dateKey);
      if (dateKey > billingToDate) {
        setBillingToDate(dateKey);
      }
    }

    if (billingPickerTarget === "to") {
      setBillingToDate(dateKey);
      if (dateKey < billingFromDate) {
        setBillingFromDate(dateKey);
      }
    }

    setBillingPickerTarget(null);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <ScrollView
        style={styles.homeScroll}
        contentContainerStyle={styles.homeScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.duration(450)} style={styles.shell}>
          <View style={styles.headerTop}>
            <View style={styles.brandRow}>
              <BrandLogo />
              <View style={styles.brandCopy}>
                <Text style={styles.brandEyebrow}>Mark Mate</Text>
                <Text style={styles.brandTitle}>{displayName}</Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Logout"
              onPress={onLogout}
              style={({ hovered, pressed }) => [
                styles.logoutButton,
                hovered && styles.logoutButtonHover,
                pressed && styles.logoutButtonPressed
              ]}
            >
              <LogoutIcon />
            </Pressable>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.heading}>
                  {activeTab === "attendance"
                    ? "Daily attendance"
                    : activeTab === "manage"
                      ? "Manage workers"
                      : activeTab === "billing"
                        ? "Billing"
                        : "Generated bills"}
                </Text>
                {activeTab === "attendance" ? (
                  <Text style={styles.subheading}>{selectedDateText}</Text>
                ) : null}
              </View>
            </View>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {activeTab === "attendance" ? (
              <>
                <View style={styles.calendarCard}>
                  <View style={styles.calendarHeader}>
                    <Pressable
                      onPress={() =>
                        setCalendarMonth(
                          (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                        )
                      }
                    >
                      <View style={styles.calendarNavButton}>
                        <CalendarPreviousIcon />
                      </View>
                    </Pressable>

                    <Text style={styles.calendarTitle}>
                      {monthLabels[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                    </Text>

                    <Pressable
                      onPress={() =>
                        setCalendarMonth(
                          (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                        )
                      }
                    >
                      <View style={styles.calendarNavButton}>
                        <CalendarNextIcon />
                      </View>
                    </Pressable>
                  </View>

                  <View style={styles.weekdayRow}>
                    {weekdayLabels.map((label, index) => (
                      <Text key={`${label}-${index}`} style={styles.weekdayLabel}>
                        {label}
                      </Text>
                    ))}
                  </View>

                  <View style={styles.dayGrid}>
                    {calendarDays.map((date) => {
                      const dateKey = formatDateKey(date);
                      const isCurrentMonth = date.getMonth() === calendarMonth.getMonth();
                      const isSelected = dateKey === selectedDate;
                      const isToday = dateKey === todayKey;
                      const isSavedDate = Boolean(savedDateKeys[dateKey]);
                      const isFutureDate = isFutureDateKey(dateKey, todayKey);

                      return (
                        <Pressable
                          key={dateKey}
                          style={styles.dayPressable}
                          disabled={isFutureDate}
                          onPress={() => {
                            setSelectedDate(dateKey);
                            setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                          }}
                        >
                          <View
                            style={[
                              styles.dayCell,
                              !isCurrentMonth && styles.dayCellMuted,
                              isFutureDate && styles.dayCellDisabled,
                              isSavedDate && styles.dayCellSaved,
                              isSelected && styles.dayCellSelected,
                              isToday && !isSelected && styles.dayCellToday
                            ]}
                          >
                            <Text
                              style={[
                                styles.dayLabel,
                                (!isCurrentMonth || isFutureDate) && styles.dayLabelMuted,
                                isSelected && styles.dayLabelSelected
                              ]}
                            >
                              {date.getDate()}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {workers.length === 0 && !loadingList ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No workers for this date yet</Text>
                    <Text style={styles.emptyText}>
                      Add workers from the Manage tab first, then mark attendance here.
                    </Text>
                  </View>
                ) : null}

                {workers.map((worker) => {
                  const draftStatus = attendanceDraft[worker._id] ?? null;

                  return (
                    <View key={worker._id} style={styles.workerCard}>
                      <View style={styles.workerTopRow}>
                        <View style={styles.workerInfo}>
                          <Text style={styles.workerName}>{worker.name}</Text>
                          <Text style={styles.workerWage}>Wage: {worker.wage}</Text>
                        </View>

                        <View style={styles.symbolActions}>
                          <Pressable onPress={() => setWorkerAttendance(worker._id, "present")}>
                            <View
                              style={[
                                styles.symbolButton,
                                styles.symbolButtonIdle,
                                draftStatus === "present" && styles.symbolButtonPresent
                              ]}
                            >
                              <AttendanceStatusIcon
                                status="present"
                                active={draftStatus === "present"}
                              />
                            </View>
                          </Pressable>

                          <Pressable onPress={() => setWorkerAttendance(worker._id, "absent")}>
                            <View
                              style={[
                                styles.symbolButton,
                                styles.symbolButtonIdle,
                                draftStatus === "absent" && styles.symbolButtonAbsent
                              ]}
                            >
                              <AttendanceStatusIcon
                                status="absent"
                                active={draftStatus === "absent"}
                              />
                            </View>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })}

                {workers.length > 0 ? (
                  <View style={styles.saveSection}>
                    <Text style={styles.saveHint}>
                      {isLockedDate
                        ? "Future dates cannot be edited."
                        : pendingCount > 0
                          ? `${pendingCount} worker${pendingCount > 1 ? "s" : ""} still not marked.`
                          : "All visible workers are marked for this date."}
                    </Text>

                    <Pressable
                      disabled={isLockedDate || savingAttendance}
                      onPress={handleSaveAttendance}
                    >
                      <View
                        style={[
                          styles.loginButton,
                          (isLockedDate || savingAttendance) && styles.disabledButton
                        ]}
                      >
                        <Text style={styles.loginButtonText}>
                          {isLockedDate ? "Future dates are locked" : savingAttendance ? "Saving..." : "Save"}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                ) : null}
              </>
            ) : null}

            {activeTab === "manage" ? (
              <>
                <View style={styles.workerSectionHeader}>
                  <Text style={styles.workerSectionTitle}>Workers</Text>
                  <View style={styles.workerHeaderActions}>
                    {loadingList ? <ActivityIndicator color={palette.blue700} /> : null}
                    <Pressable
                      style={({ hovered, pressed }) => [
                        styles.addChipPressable,
                        hovered && styles.addChipPressableHover,
                        pressed && styles.addChipPressablePressed
                      ]}
                      onPress={() => {
                        if (showAddWorkerForm && !editingWorker) {
                          resetWorkerForm();
                          return;
                        }

                        openAddWorkerForm();
                      }}
                    >
                      <View style={styles.addChip}>
                        {showAddWorkerForm && !editingWorker ? (
                          <View style={styles.closeChipContent}>
                            <CloseChipIcon />
                            <Text style={styles.addChipText}>Close</Text>
                          </View>
                        ) : (
                          <AddWorkerIcon />
                        )}
                      </View>
                    </Pressable>
                  </View>
                </View>

                {showAddWorkerForm ? (
                  <View style={styles.addWorkerCard}>
                    <Text style={styles.addWorkerTitle}>
                      {editingWorker ? "Edit worker" : "Add worker"}
                    </Text>
                    <View style={styles.addWorkerFields}>
                      <View style={styles.compactField}>
                        <Text style={styles.compactLabel}>Name</Text>
                        <TextInput
                          value={workerName}
                          onChangeText={setWorkerName}
                          placeholder="Worker name"
                          placeholderTextColor="#87A0BF"
                          style={styles.compactInput}
                        />
                      </View>
                      <View style={styles.compactField}>
                        <Text style={styles.compactLabel}>Wage</Text>
                        <View
                          style={[
                            styles.compactInputShell,
                            isWorkerWageFocused && styles.compactInputShellFocused
                          ]}
                        >
                          <TextInput
                            value={workerWage}
                            onChangeText={setWorkerWage}
                            onFocus={() => setIsWorkerWageFocused(true)}
                            onBlur={() => setIsWorkerWageFocused(false)}
                            placeholder="500"
                            placeholderTextColor="#87A0BF"
                            style={[
                              styles.compactInput,
                              styles.compactInputWithIcon,
                              isWorkerWageFocused && styles.compactInputFocused
                            ]}
                            keyboardType="numeric"
                          />
                          <View
                            style={[
                              styles.compactInputIcon,
                              isWorkerWageFocused && styles.compactInputIconFocused
                            ]}
                          >
                            <RupeeIcon />
                          </View>
                        </View>
                      </View>
                    </View>
                    <View style={styles.workerFormActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={editingWorker ? "Update worker" : "Save worker"}
                        disabled={!workerName.trim() || !workerWage.trim() || addingWorker}
                        onPress={handleWorkerSubmit}
                        style={({ hovered, pressed }) => [
                          styles.workerSubmitPressable,
                          { flex: editingWorker ? 1 : 1 },
                          hovered && !addingWorker && styles.workerSubmitPressableHover,
                          pressed && !addingWorker && styles.workerSubmitPressablePressed
                        ]}
                      >
                        <View
                          style={[
                            styles.secondaryButton,
                            (!workerName.trim() || !workerWage.trim() || addingWorker) && styles.disabledButton
                          ]}
                        >
                          {addingWorker ? (
                            <ActivityIndicator color={palette.blue800} />
                          ) : (
                            <CheckActionIcon />
                          )}
                        </View>
                      </Pressable>

                      {editingWorker ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Delete worker"
                          disabled={addingWorker}
                          onPress={handleDeleteWorker}
                          style={({ hovered, pressed }) => [
                            styles.workerDeleteFormPressable,
                            hovered && !addingWorker && styles.workerDeleteFormPressableHover,
                            pressed && !addingWorker && styles.workerDeleteFormPressablePressed
                          ]}
                        >
                          <View
                            style={[
                              styles.dangerButton,
                              addingWorker && styles.disabledButton
                            ]}
                          >
                            <MuiAppIcon icon={DeleteIcon} color={palette.danger} size={20} />
                          </View>
                        </Pressable>
                      ) : null}

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Close form"
                        disabled={addingWorker}
                        onPress={resetWorkerForm}
                        style={({ hovered, pressed }) => [
                          styles.workerClosePressable,
                          hovered && !addingWorker && styles.workerClosePressableHover,
                          pressed && !addingWorker && styles.workerClosePressablePressed
                        ]}
                      >
                        <View
                          style={[
                            styles.tertiaryButton,
                            addingWorker && styles.disabledButton
                          ]}
                        >
                          <CloseChipIcon />
                        </View>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {workers.length === 0 && !loadingList ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No workers added yet</Text>
                    <Text style={styles.emptyText}>
                      Use the + Add button to create your worker list first.
                    </Text>
                  </View>
                ) : null}

                {workers.map((worker) => (
                  <View key={worker._id} style={styles.workerCard}>
                    <View style={styles.workerTopRow}>
                      <View style={styles.workerInfo}>
                        <Text style={styles.workerName}>{worker.name}</Text>
                        <Text style={styles.workerWage}>Daily wage: {worker.wage}</Text>
                      </View>
                      <View style={styles.workerActions}>
                        <Pressable
                          accessibilityLabel={`Edit ${worker.name}`}
                          title="Edit"
                          onPress={() => openEditWorkerForm(worker)}
                          style={({ hovered, pressed }) => [
                            styles.workerEditButton,
                            hovered && styles.workerEditButtonHover,
                            pressed && styles.workerEditButtonPressed
                          ]}
                        >
                          <PencilEditIcon />
                        </Pressable>
                        <Pressable
                          accessibilityLabel={`Delete ${worker.name}`}
                          title="Delete"
                          onPress={() => showDeleteConfirmation(worker)}
                          style={({ hovered, pressed }) => [
                            styles.workerDeleteButton,
                            hovered && styles.workerDeleteButtonHover,
                            pressed && styles.workerDeleteButtonPressed
                          ]}
                        >
                          <MuiAppIcon icon={DeleteIcon} color={palette.danger} size={20} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            ) : null}

            {activeTab === "billing" ? (
              <Pressable
                style={styles.billingDismissArea}
                onPress={() => {
                  if (billingPickerTarget) {
                    setBillingPickerTarget(null);
                  }
                }}
              >
                <View style={styles.billingCard}>
                  <View style={styles.billingHeader}>
                    <View>
                      <Text style={styles.billingTodayLabel}>Generated date</Text>
                      <Text style={styles.billingTitle}>{formatDisplayDate(todayKey)}</Text>
                    </View>
                  </View>

                  <View style={styles.billingFilterRow}>
                    <Pressable style={styles.billingFilterField} onPress={() => openBillingPicker("from")}>
                      <View style={styles.billingFilterBox}>
                        <Text style={styles.billingFilterLabel}>From</Text>
                        <Text
                          style={[
                            styles.billingFilterValue,
                            !billingFromDate && styles.billingFilterPlaceholder
                          ]}
                        >
                          {billingFromDate ? formatDisplayDate(billingFromDate) : "dd/mm/yyyy"}
                        </Text>
                      </View>
                    </Pressable>

                    <Pressable style={styles.billingFilterField} onPress={() => openBillingPicker("to")}>
                      <View style={styles.billingFilterBox}>
                        <Text style={styles.billingFilterLabel}>To</Text>
                        <Text
                          style={[
                            styles.billingFilterValue,
                            !billingToDate && styles.billingFilterPlaceholder
                          ]}
                        >
                          {billingToDate ? formatDisplayDate(billingToDate) : "dd/mm/yyyy"}
                        </Text>
                      </View>
                    </Pressable>
                  </View>

                  {billingPickerTarget ? (
                    <Pressable onPress={() => { }}>
                      <View style={styles.billingPickerCard}>
                        <View style={styles.calendarHeader}>
                          <Pressable
                            onPress={() =>
                              setBillingPickerMonth(
                                (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                              )
                            }
                          >
                            <View style={styles.calendarNavButton}>
                              <CalendarPreviousIcon />
                            </View>
                          </Pressable>

                          <Text style={styles.calendarTitle}>
                            {monthLabels[billingPickerMonth.getMonth()]} {billingPickerMonth.getFullYear()}
                          </Text>

                          <Pressable
                            onPress={() =>
                              setBillingPickerMonth(
                                (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                              )
                            }
                          >
                            <View style={styles.calendarNavButton}>
                              <CalendarNextIcon />
                            </View>
                          </Pressable>
                        </View>

                        <View style={styles.weekdayRow}>
                          {weekdayLabels.map((label, index) => (
                            <Text key={`billing-${label}-${index}`} style={styles.weekdayLabel}>
                              {label}
                            </Text>
                          ))}
                        </View>

                        <View style={styles.dayGrid}>
                          {billingPickerDays.map((date) => {
                            const dateKey = formatDateKey(date);
                            const isCurrentMonth = date.getMonth() === billingPickerMonth.getMonth();
                            const isSelected =
                              dateKey === billingFromDate || dateKey === billingToDate;
                            const isToday = dateKey === todayKey;
                            const isFutureDate = isFutureDateKey(dateKey, todayKey);

                            return (
                              <Pressable
                                key={`billing-picker-${dateKey}`}
                                style={styles.dayPressable}
                                disabled={isFutureDate}
                                onPress={() => handleBillingDatePick(dateKey)}
                              >
                                <View
                                  style={[
                                    styles.dayCell,
                                    !isCurrentMonth && styles.dayCellMuted,
                                    isFutureDate && styles.dayCellDisabled,
                                    isSelected && styles.dayCellSelected,
                                    isToday && !isSelected && styles.dayCellToday
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.dayLabel,
                                      (!isCurrentMonth || isFutureDate) && styles.dayLabelMuted,
                                      isSelected && styles.dayLabelSelected
                                    ]}
                                  >
                                    {date.getDate()}
                                  </Text>
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    </Pressable>
                  ) : null}

                  {billingEditMode ? (
                    <Text style={styles.billingEditHint}>
                      Edit the wage and days cells in the table to adjust totals for this date range.
                    </Text>
                  ) : null}

                  <View style={styles.billingActionRow}>
                    <Text style={styles.billingActionLabel}>Monthly wage table</Text>
                    <View style={styles.billingActionButtons}>
                      <Pressable
                        accessibilityLabel={billingEditMode ? "Finish editing billing" : "Edit billing"}
                        title={billingEditMode ? "Done" : "Edit"}
                        onPress={() => setBillingEditMode((current) => !current)}
                        style={({ hovered, pressed }) => [
                          styles.workerEditButton,
                          billingEditMode && styles.billingEditButtonActive,
                          hovered && styles.workerEditButtonHover,
                          pressed && styles.workerEditButtonPressed
                        ]}
                      >
                        <PencilEditIcon />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.billingTable}>
                    <View style={styles.billingTableHeader}>
                      <Text style={[styles.billingHeaderCell, styles.billingNameCell]}>Name</Text>
                      <Text style={[styles.billingHeaderCell, styles.billingWageCell]}>Wage</Text>
                      <Text style={[styles.billingHeaderCell, styles.billingDaysCell]}>Days</Text>
                      <Text style={[styles.billingHeaderCell, styles.billingAmountCell]}>Total</Text>
                    </View>

                    {loadingBilling ? (
                      <View style={styles.billingState}>
                        <ActivityIndicator color={palette.blue700} />
                        <Text style={styles.billingStateText}>Loading billing...</Text>
                      </View>
                    ) : displayBillingRows.length === 0 ? (
                      <View style={styles.billingState}>
                        <Text style={styles.billingStateText}>
                          {hasBillingFilter
                            ? "No billing data for this date range yet."
                            : "Select From and To dates to generate a bill."}
                        </Text>
                      </View>
                    ) : (
                      displayBillingRows.map((worker) => (
                        <View
                          key={worker.id}
                          style={[
                            styles.billingTableRow,
                            billingEditMode && styles.billingTableRowEditing
                          ]}
                        >
                          <Text
                            style={[styles.billingCell, styles.billingNameCell]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {worker.name}
                          </Text>

                          {billingEditMode ? (
                            <View style={styles.billingEditFieldsRow}>
                              <View style={styles.billingEditField}>
                                <Text style={styles.billingEditFieldLabel}>Wage</Text>
                                <TextInput
                                  value={String(billingDrafts[worker.id]?.wage ?? worker.displayWage)}
                                  onChangeText={(value) =>
                                    updateBillingWorkerField(worker.id, "wage", value)
                                  }
                                  style={[styles.billingCell, styles.billingInput]}
                                  keyboardType="decimal-pad"
                                  placeholder="0"
                                  placeholderTextColor="#87A0BF"
                                />
                              </View>

                              <View style={styles.billingEditFieldSmall}>
                                <Text style={styles.billingEditFieldLabel}>Days</Text>
                                <TextInput
                                  value={String(billingDrafts[worker.id]?.days ?? worker.displayDays)}
                                  onChangeText={(value) =>
                                    updateBillingWorkerField(worker.id, "days", value)
                                  }
                                  style={[styles.billingCell, styles.billingInput]}
                                  keyboardType="decimal-pad"
                                  placeholder="0"
                                  placeholderTextColor="#87A0BF"
                                />
                              </View>

                              <View style={styles.billingEditTotalBlock}>
                                <Text style={styles.billingEditFieldLabel}>Total</Text>
                                <Text style={[styles.billingCell, styles.billingEditTotalValue]}>
                                  {worker.totalWage}
                                </Text>
                              </View>
                            </View>
                          ) : (
                            <>
                              <Text style={[styles.billingCell, styles.billingWageCell]}>
                                {worker.displayWage}
                              </Text>
                              <Text style={[styles.billingCell, styles.billingDaysCell]}>
                                {worker.displayDays}
                              </Text>
                              <Text style={[styles.billingCell, styles.billingAmountCell]}>
                                {worker.totalWage}
                              </Text>
                            </>
                          )}
                        </View>
                      ))
                    )}

                    {!loadingBilling && displayBillingRows.length > 0 ? (
                      <View style={styles.billingTotalRow}>
                        <Text style={[styles.billingTotalText, styles.billingNameCell]}>
                          Worker total
                        </Text>
                        <Text style={styles.billingWageCell} />
                        <Text style={styles.billingDaysCell} />
                        <Text style={[styles.billingTotalText, styles.billingAmountCell]}>
                          {billingGrandTotal}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.expenseCard}>
                    <View style={styles.expenseHeader}>
                      <Text style={styles.expenseTitle}>Other expenses</Text>
                      <View style={styles.billingActionButtons}>
                        <Pressable onPress={addExpenseRow}>
                          <View style={styles.manageBadge}>
                            <ExpenseActionIcon action="add" />
                          </View>
                        </Pressable>

                      </View>
                    </View>

                    {extraExpenses.map((row, index) => (
                      <View key={row.id} style={styles.expenseRow}>
                        <View style={[styles.compactField, styles.expenseReasonField]}>
                          <Text style={styles.compactLabel}>Reason {index + 1}</Text>
                          <TextInput
                            value={row.reason}
                            onChangeText={(value) => updateExpenseRow(row.id, "reason", value)}
                            placeholder="Transport, food, materials..."
                            placeholderTextColor="#87A0BF"
                            style={styles.compactInput}
                          />
                        </View>
                        <View style={[styles.compactField, styles.expenseAmountField]}>
                          <Text style={styles.compactLabel}>Amount</Text>
                          <TextInput
                            value={row.amount}
                            onChangeText={(value) => updateExpenseRow(row.id, "amount", value)}
                            placeholder="0"
                            placeholderTextColor="#87A0BF"
                            style={styles.compactInput}
                            keyboardType="numeric"
                          />
                        </View>
                        <Pressable
                          onPress={() => removeExpenseRow(row.id)}
                          style={({ hovered, pressed }) => [
                            styles.expenseRemovePressable,
                            hovered && styles.expenseRemovePressableHover,
                            pressed && styles.expenseRemovePressablePressed
                          ]}
                        >
                          <View style={styles.manageBadge}>
                            <ExpenseActionIcon action="remove" />
                          </View>
                        </Pressable>
                      </View>
                    ))}
                    <View style={styles.expenseFooter}>
                      <View style={styles.expenseTotalBlock}>
                        <Text style={styles.expenseFooterLabel}>Other expenses total</Text>
                        <Text style={styles.expenseFooterAmount}>{extraExpensesTotal}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.billingGrandCard}>
                    <Text style={styles.billingGrandLabel}>Total payable amount</Text>
                    <Text style={styles.billingGrandAmount}>{overallPayableTotal}</Text>
                  </View>
                </View>

                <Pressable
                  disabled={savingBillingToBackend}
                  onPress={() => void handleSaveBillingToBackend()}
                  style={({ hovered, pressed }) => [
                    styles.updateBillButton,
                    hovered && !savingBillingToBackend && styles.updateBillButtonHover,
                    pressed && !savingBillingToBackend && styles.updateBillButtonPressed,
                    savingBillingToBackend && styles.disabledButton
                  ]}
                >
                  <Text style={styles.updateBillButtonText}>
                    {savingBillingToBackend ? "Generating..." : "Generate Bill"}
                  </Text>
                </Pressable>
              </Pressable>
            ) : null}

            {activeTab === "generated-bills" ? (
              <>
                {loadingGeneratedBills ? (
                  <View style={styles.generatedBillsState}>
                    <ActivityIndicator color={palette.blue700} />
                    <Text style={styles.generatedBillsStateText}>Loading generated bills...</Text>
                  </View>
                ) : generatedBillMonths.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No generated bills yet</Text>
                    <Text style={styles.emptyText}>
                      Bills will appear here after you save a billing summary to the backend.
                    </Text>
                  </View>
                ) : (
                  generatedBillMonths.map((month) => (
                    <View key={month.monthKey} style={styles.generatedMonthCard}>
                      <Pressable onPress={() => toggleGeneratedMonth(month.monthKey)}>
                        <View style={styles.generatedMonthBar}>
                          <View style={styles.generatedMonthBarMain}>
                            <Text style={styles.generatedMonthTitle}>{month.label}</Text>
                            <Text style={styles.generatedMonthCount}>
                              {month.bills.length} bill{month.bills.length > 1 ? "s" : ""}
                            </Text>
                          </View>

                          <View style={styles.generatedMonthBarActions}>
                            <Pressable
                              onPress={(event) => {
                                event.stopPropagation();
                                requestGeneratedMonthDelete(month);
                              }}
                              style={({ hovered, pressed }) => [
                                styles.generatedMonthDeletePressable,
                                hovered && styles.generatedMonthDeletePressableHover,
                                pressed && styles.generatedMonthDeletePressablePressed
                              ]}
                            >
                              <TrashIcon />
                            </Pressable>

                            <View style={styles.generatedMonthArrowChip}>
                              <ChevronIcon expanded={expandedGeneratedMonth === month.monthKey} />
                            </View>
                          </View>
                        </View>
                      </Pressable>

                      {expandedGeneratedMonth === month.monthKey
                        ? month.bills.map((bill) => {
                          const billKey = getGeneratedBillKey(bill);
                          const isViewing = loadingGeneratedBillAction === `view-${billKey}`;
                          const isDeleting = loadingGeneratedBillAction === `delete-${billKey}`;

                          return (
                            <View key={billKey} style={styles.generatedBillRow}>
                              <View style={styles.generatedBillInfo}>
                                <Text style={styles.generatedBillDate}>{bill.displayDate}</Text>
                                <Text style={styles.generatedBillMeta}>
                                  {bill.rangeDisplayDate && bill.rangeDisplayDate !== bill.displayDate
                                    ? `Range: ${bill.rangeDisplayDate} | `
                                    : ""}
                                  Workers: {bill.rows.length} | Total: {bill.totalAmount}
                                </Text>
                              </View>

                              <View style={styles.generatedBillActions}>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={`Delete generated bill for ${bill.displayDate}`}
                                  disabled={isDeleting || deletingGeneratedBills}
                                  onPress={() => requestGeneratedBillDelete(bill)}
                                  style={({ hovered, pressed }) => [
                                    styles.generatedBillDeletePressable,
                                    hovered && styles.generatedBillDeletePressableHover,
                                    pressed && styles.generatedBillDeletePressablePressed
                                  ]}
                                >
                                  {isDeleting ? (
                                    <ActivityIndicator color={palette.danger} size="small" />
                                  ) : (
                                    <TrashIcon />
                                  )}
                                </Pressable>

                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="View generated bill"
                                  disabled={isViewing}
                                  onPress={() => handleViewGeneratedBill(billKey)}
                                  style={({ hovered, pressed }) => [
                                    styles.generatedBillActionPressable,
                                    hovered && styles.generatedBillActionPressableHover,
                                    pressed && styles.generatedBillActionPressablePressed,
                                    isViewing && styles.generatedBillActionChipBusy
                                  ]}
                                >
                                  {isViewing ? (
                                    <ActivityIndicator color={palette.blue800} size="small" />
                                  ) : (
                                    <EyeIcon />
                                  )}
                                </Pressable>
                              </View>
                            </View>
                          );
                        })
                        : null}
                    </View>
                  ))
                )}

              </>
            ) : null}
          </View>
        </Animated.View>
      </ScrollView>

      <View style={styles.bottomTabsDock}>
        <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
      </View>

      {selectedGeneratedBill ? (
        <View style={styles.generatedPreviewOverlay}>
          <Pressable style={styles.generatedPreviewBackdrop} onPress={() => setSelectedGeneratedBill(null)} />
          <View style={styles.generatedPreviewPopup}>
            <View style={styles.generatedPreviewHeader}>
              <View>
                <Text style={styles.generatedPreviewEyebrow}>Bill Preview</Text>
                <Text style={styles.generatedPreviewTitle}>{selectedGeneratedBill.displayDate}</Text>
              </View>

              <View style={styles.generatedPreviewHeaderActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Download generated bill"
                  disabled={loadingGeneratedBillAction === `download-${getGeneratedBillKey(selectedGeneratedBill)}`}
                  onPress={() => handleDownloadGeneratedBill(getGeneratedBillKey(selectedGeneratedBill))}
                  style={({ hovered, pressed }) => [
                    styles.generatedPreviewActionButton,
                    hovered && styles.generatedPreviewActionButtonHover,
                    pressed && styles.generatedPreviewActionButtonPressed,
                    loadingGeneratedBillAction === `download-${getGeneratedBillKey(selectedGeneratedBill)}` &&
                    styles.generatedBillActionChipBusy
                  ]}
                >
                  {loadingGeneratedBillAction === `download-${getGeneratedBillKey(selectedGeneratedBill)}` ? (
                    <ActivityIndicator color={palette.blue800} size="small" />
                  ) : (
                    <DownloadIcon />
                  )}
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close bill preview"
                  onPress={() => setSelectedGeneratedBill(null)}
                >
                  <View style={[styles.manageBadge, styles.generatedPreviewCloseButton]}>
                    <CloseChipIcon />
                    <Text style={styles.manageBadgeText}>Close</Text>
                  </View>
                </Pressable>
              </View>
            </View>

            <ScrollView style={styles.generatedPreviewScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.billingTable}>
                <View style={styles.billingTableHeader}>
                  <Text style={[styles.billingHeaderCell, styles.billingNumberCell]}>#</Text>
                  <Text style={[styles.billingHeaderCell, styles.billingNameCell]}>Name</Text>
                  <Text style={[styles.billingHeaderCell, styles.billingWageCell]}>Wage</Text>
                  <Text style={[styles.billingHeaderCell, styles.billingDaysCell]}>Days</Text>
                  <Text style={[styles.billingHeaderCell, styles.billingAmountCell]}>Total</Text>
                </View>

                {selectedGeneratedBill.rows.length === 0 ? (
                  <View style={styles.billingState}>
                    <Text style={styles.billingStateText}>
                      No worker rows were saved for this bill.
                    </Text>
                  </View>
                ) : (
                  selectedGeneratedBill.rows.map((worker, index) => (
                    <View key={worker.id} style={styles.billingTableRow}>
                      <Text style={[styles.billingCell, styles.billingNumberCell]}>{index + 1}</Text>
                      <Text style={[styles.billingCell, styles.billingNameCell]}>{worker.name}</Text>
                      <Text style={[styles.billingCell, styles.billingWageCell]}>{worker.wage}</Text>
                      <Text style={[styles.billingCell, styles.billingDaysCell]}>
                        {worker.days ?? "-"}
                      </Text>
                      <Text style={[styles.billingCell, styles.billingAmountCell]}>{worker.total}</Text>
                    </View>
                  ))
                )}

                {selectedGeneratedBill.extraExpenses?.length ? (
                  <>
                    <View style={styles.billingTableHeader}>
                      <Text style={[styles.billingHeaderCell, styles.billingNameCell]}>Expense</Text>
                      <Text style={[styles.billingHeaderCell, styles.billingAmountCell]}>Amount</Text>
                    </View>

                    {selectedGeneratedBill.extraExpenses.map((expense) => (
                      <View key={expense.id} style={styles.billingTableRow}>
                        <Text style={[styles.billingCell, styles.billingNameCell]}>{expense.reason}</Text>
                        <Text style={[styles.billingCell, styles.billingAmountCell]}>{expense.amount}</Text>
                      </View>
                    ))}
                  </>
                ) : null}
              </View>

              <View style={styles.generatedPreviewTotals}>
                <View style={styles.generatedPreviewTotalCard}>
                  <Text style={styles.generatedPreviewTotalLabel}>Worker total</Text>
                  <Text style={styles.generatedPreviewTotalValue}>
                    {selectedGeneratedBill.workerTotal ?? selectedGeneratedBill.totalAmount}
                  </Text>
                </View>

                <View style={styles.generatedPreviewTotalCard}>
                  <Text style={styles.generatedPreviewTotalLabel}>Other expenses total</Text>
                  <Text style={styles.generatedPreviewTotalValue}>
                    {selectedGeneratedBill.extraExpensesTotal || 0}
                  </Text>
                </View>

                <View style={styles.generatedPreviewGrandTotalCard}>
                  <Text style={styles.generatedPreviewGrandTotalLabel}>Grand total</Text>
                  <Text style={styles.generatedPreviewGrandTotalValue}>
                    {selectedGeneratedBill.totalAmount}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}

      {generatedMonthDeleteTarget ? (
        <View style={styles.generatedPreviewOverlay}>
          <Pressable style={styles.generatedPreviewBackdrop} onPress={cancelGeneratedMonthDelete} />
          <View style={styles.generatedConfirmPopup}>
            <Text style={styles.generatedConfirmTitle}>Delete {generatedMonthDeleteTarget.label}?</Text>
            <Text style={styles.generatedConfirmText}>
              This will permanently delete every saved bill in this month.
            </Text>

            <View style={styles.generatedConfirmActions}>
              <Pressable disabled={deletingGeneratedBills} onPress={cancelGeneratedMonthDelete}>
                <View style={styles.generatedConfirmSecondary}>
                  <Text style={styles.generatedConfirmSecondaryText}>Cancel</Text>
                </View>
              </Pressable>

              <Pressable disabled={deletingGeneratedBills} onPress={confirmGeneratedMonthDelete}>
                <View style={[styles.generatedConfirmPrimary, deletingGeneratedBills && styles.disabledButton]}>
                  <Text style={styles.generatedConfirmPrimaryText}>
                    {deletingGeneratedBills ? "Deleting..." : "Confirm"}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {generatedBillDeleteTarget ? (
        <View style={styles.generatedPreviewOverlay}>
          <Pressable style={styles.generatedPreviewBackdrop} onPress={cancelGeneratedBillDelete} />
          <View style={styles.generatedConfirmPopup}>
            <Text style={styles.generatedConfirmTitle}>
              Delete {generatedBillDeleteTarget.displayDate}?
            </Text>
            <Text style={styles.generatedConfirmText}>
              This will permanently delete this saved bill from the backend.
            </Text>

            <View style={styles.generatedConfirmActions}>
              <Pressable disabled={deletingGeneratedBills} onPress={cancelGeneratedBillDelete}>
                <View style={styles.generatedConfirmSecondary}>
                  <Text style={styles.generatedConfirmSecondaryText}>Cancel</Text>
                </View>
              </Pressable>

              <Pressable disabled={deletingGeneratedBills} onPress={confirmGeneratedBillDelete}>
                <View style={[styles.generatedConfirmPrimary, deletingGeneratedBills && styles.disabledButton]}>
                  <Text style={styles.generatedConfirmPrimaryText}>
                    {deletingGeneratedBills ? "Deleting..." : "Confirm"}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {workerDeleteTarget ? (
        <View style={styles.generatedPreviewOverlay}>
          <Pressable style={styles.generatedPreviewBackdrop} onPress={cancelDeleteWorker} />
          <View style={styles.generatedConfirmPopup}>
            <Text style={styles.generatedConfirmTitle}>
              Delete {workerDeleteTarget.name}?
            </Text>
            <Text style={styles.generatedConfirmText}>
              Are you sure you want to delete this worker?
            </Text>

            <View style={styles.generatedConfirmActions}>
              <Pressable disabled={isDeletingWorker} onPress={cancelDeleteWorker}>
                <View style={styles.generatedConfirmSecondary}>
                  <Text style={styles.generatedConfirmSecondaryText}>Cancel</Text>
                </View>
              </Pressable>

              <Pressable disabled={isDeletingWorker} onPress={confirmDeleteWorker}>
                <View style={[styles.generatedConfirmPrimary, isDeletingWorker && styles.disabledButton]}>
                  <Text style={styles.generatedConfirmPrimaryText}>
                    {isDeletingWorker ? "Deleting..." : "Confirm"}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

    </View>
  );
}

export default function LoginScreen() {
  const [authMode, setAuthMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [resetFormKey, setResetFormKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [session, setSession] = useState(null);

  const cardLift = useSharedValue(0);
  const buttonPress = useSharedValue(0);
  const checkboxPress = useSharedValue(0);
  const passwordTogglePress = useSharedValue(0);

  useEffect(() => {
    const storedSession = readStoredSession();

    if (!storedSession) {
      return;
    }

    if (isTokenExpired(storedSession.token)) {
      clearPersistedSession();
      return;
    }

    const nextSession = {
      ...storedSession,
      fullName: resolveDisplayName(storedSession)
    };

    setSession(nextSession);
    persistSession(nextSession);
  }, []);

  const isFormReady = useMemo(() => {
    if (authMode === "register") {
      return fullName.trim().length > 0 && mobile.trim().length > 0 && password.length > 0;
    }

    return mobile.trim().length > 0 && password.length > 0;
  }, [authMode, fullName, mobile, password]);

  const resetPasswordsMatch =
    resetNewPassword.length > 0 &&
    resetConfirmPassword.length > 0 &&
    resetNewPassword === resetConfirmPassword;
  const resetPasswordMismatch =
    resetConfirmPassword.length > 0 && resetNewPassword !== resetConfirmPassword;
  const isResetReady = mobile.trim().length > 0 && resetPasswordsMatch && !isResettingPassword;
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(cardLift.value, [0, 1], [0, -8]) },
      { scale: interpolate(cardLift.value, [0, 1], [1, 1.01]) }
    ]
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(buttonPress.value, [0, 1], [1, 0.97]) }],
    opacity: withTiming(isFormReady && !isSubmitting ? 1 : 0.6, { duration: 160 })
  }));

  const resetButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(buttonPress.value, [0, 1], [1, 0.97]) }],
    opacity: withTiming(isResetReady ? 1 : 0.6, { duration: 160 })
  }));

  const checkboxStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(checkboxPress.value, [0, 1], [1, 0.92]) }]
  }));

  const passwordToggleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(passwordTogglePress.value, [0, 1], [1, 0.92]) }]
  }));

  async function handleLogin() {
    if (!isFormReady || isSubmitting || isResetOpen) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setAuthNotice("");
    Keyboard.dismiss();

    try {
      const result = await loginUser({
        mobile: mobile.trim(),
        password
      });

      const nextSession = {
        token: result?.token || "",
        mobile: result?.user?.mobile || mobile.trim(),
        rememberMe: true,
        fullName: result?.user?.fullName || getStoredUserName(mobile.trim()) || "User"
      };

      setSession(nextSession);
      persistUserName(nextSession.mobile, nextSession.fullName);
      persistSession(nextSession);
    } catch (error) {
      const message = error.message || "Login failed";
      setErrorMessage(message);

      if (/not found|register|user/i.test(message)) {
        setAuthMode("register");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegister() {
    if (!isFormReady || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setAuthNotice("");
    Keyboard.dismiss();

    try {
      await registerUser({
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        password
      });

      const result = await loginUser({
        mobile: mobile.trim(),
        password
      });

      const nextSession = {
        token: result?.token || "",
        mobile: result?.user?.mobile || mobile.trim(),
        rememberMe: true,
        fullName: result?.user?.fullName || fullName.trim() || "User"
      };

      setSession(nextSession);
      persistUserName(nextSession.mobile, nextSession.fullName);
      persistSession(nextSession);
    } catch (error) {
      setErrorMessage(error.message || "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleForgotPassword() {
    setErrorMessage("");
    setAuthNotice("");
    setResetMessage("");
    setPassword("");
    setResetNewPassword("");
    setResetConfirmPassword("");
    setShowResetNewPassword(false);
    setShowResetConfirmPassword(false);
    setResetFormKey((current) => current + 1);
    setIsResetOpen(true);
  }

  function closeResetPassword() {
    setIsResetOpen(false);
    setResetMessage("");
    setResetNewPassword("");
    setResetConfirmPassword("");
    setShowResetNewPassword(false);
    setShowResetConfirmPassword(false);
  }

  async function handleResetPassword() {
    if (!isResetReady) {
      return;
    }

    setIsResettingPassword(true);
    setResetMessage("");
    Keyboard.dismiss();

    try {
      await resetUserPassword({
        mobile: mobile.trim(),
        newPassword: resetNewPassword
      });

      setAuthMode("login");
      setPassword("");
      setShowPassword(false);
      setIsResetOpen(false);
      setAuthNotice("Password changed successfully. Please sign in with your new password.");
      setResetMessage("");
      setResetNewPassword("");
      setResetConfirmPassword("");
      setShowResetNewPassword(false);
      setShowResetConfirmPassword(false);
    } catch (error) {
      setResetMessage(error.message || "Unable to reset password right now.");
    } finally {
      setIsResettingPassword(false);
    }
  }

  if (session) {
    return (
      <AttendanceHome
        displayName={resolveDisplayName(session)}
        token={session.token}
        onLogout={() => {
          clearPersistedSession();
          setSession(null);
          setAuthMode("login");
          setPassword("");
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: undefined })}
        style={styles.keyboardArea}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInUp.duration(650).easing(Easing.out(Easing.cubic))}
            style={styles.shell}
          >
            <Animated.View entering={FadeInDown.delay(120).duration(550)} style={styles.brandRow}>
              <BrandLogo />
              <View style={styles.brandCopy}>
                <Text style={styles.brandEyebrow}>Employee Management</Text>
                <Text style={styles.brandTitle}>
                  {authMode === "register" ? "Create account" : "Welcome back"}
                </Text>
              </View>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(190).duration(600)}
              style={[styles.card, cardStyle]}
            >
              <Text style={styles.heading}>{authMode === "register" ? "Register" : "Sign in"}</Text>

              {authMode === "register" ? (
                <AnimatedField
                  label="Name"
                  placeholder="Enter your name"
                  value={fullName}
                  autoCapitalize="words"
                  textContentType="name"
                  returnKeyType="next"
                  onChangeText={setFullName}
                  onSubmitEditing={() => {
                    cardLift.value = withSpring(1, { damping: 16, stiffness: 180 });
                  }}
                />
              ) : null}

              <AnimatedField
                label="Mobile number"
                placeholder="Enter mobile number"
                value={mobile}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                returnKeyType="next"
                onChangeText={(value) => {
                  setMobile(value);
                  setResetMessage("");
                  setAuthNotice("");
                }}
                onSubmitEditing={() => {
                  cardLift.value = withSpring(1, { damping: 16, stiffness: 180 });
                }}
              />

              {!isResetOpen ? (
                <PINEntry
                  label="Password"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setAuthNotice("");
                  }}
                />
              ) : (
                <Animated.View entering={FadeInDown.duration(260)} style={styles.resetPanel}>
                  <View style={styles.resetPanelHeader}>
                    <View>
                      <Text style={styles.resetPanelTitle}>Reset password</Text>
                      <Text style={styles.resetPanelText}>Create a new password for this mobile number.</Text>
                    </View>
                    <Pressable onPress={closeResetPassword}>
                      <Text style={styles.resetPanelClose}>Cancel</Text>
                    </Pressable>
                  </View>

                  <PINEntry
                    key={`reset-new-${resetFormKey}`}
                    label="New Password"
                    value={resetNewPassword}
                    onChangeText={(value) => {
                      setResetNewPassword(value);
                      setResetMessage("");
                    }}
                  />

                  <PINEntry
                    key={`reset-confirm-${resetFormKey}`}
                    label="Confirm New Password"
                    value={resetConfirmPassword}
                    onChangeText={(value) => {
                      setResetConfirmPassword(value);
                      setResetMessage("");
                    }}
                  />

                  {resetPasswordMismatch ? (
                    <Text style={styles.resetValidationText}>Passwords do not match.</Text>
                  ) : null}
                  {!mobile.trim() ? (
                    <Text style={styles.resetValidationText}>Enter your mobile number, then open reset again.</Text>
                  ) : null}
                  {resetMessage ? <Text style={styles.resetMessageText}>{resetMessage}</Text> : null}

                  <Pressable
                    disabled={!isResetReady}
                    onPress={handleResetPassword}
                    onPressIn={() => {
                      buttonPress.value = withTiming(1, { duration: 90 });
                    }}
                    onPressOut={() => {
                      buttonPress.value = withTiming(0, { duration: 120 });
                    }}
                  >
                    <Animated.View
                      style={[
                        styles.resetButton,
                        resetButtonStyle,
                        !isResetReady && styles.disabledButton
                      ]}
                    >
                      <Text style={styles.resetButtonText}>
                        {isResettingPassword ? "Resetting..." : "Reset Password"}
                      </Text>
                    </Animated.View>
                  </Pressable>
                </Animated.View>
              )}

              {authMode === "login" && !isResetOpen ? (
                <View style={styles.loginOptionsRow}>
                  <Pressable
                    onPress={() => setRememberMe((current) => !current)}
                    onPressIn={() => {
                      checkboxPress.value = withTiming(1, { duration: 90 });
                    }}
                    onPressOut={() => {
                      checkboxPress.value = withTiming(0, { duration: 120 });
                    }}
                  >
                    <Animated.View style={[styles.rememberRow, checkboxStyle]}>
                      <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                        {rememberMe ? <View style={styles.checkboxDot} /> : null}
                      </View>
                      <Text style={styles.rememberText}>Remember me</Text>
                    </Animated.View>
                  </Pressable>

                  <Pressable
                    onPress={handleForgotPassword}
                    style={({ hovered, pressed }) => [
                      styles.forgotPasswordLink,
                      hovered && styles.forgotPasswordLinkHover,
                      pressed && styles.forgotPasswordLinkPressed
                    ]}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  </Pressable>
                </View>
              ) : null}

              {authNotice ? (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>{authNotice}</Text>
                </View>
              ) : null}

              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {!isResetOpen ? (
                authMode === "login" ? (
                  <Pressable onPress={() => setAuthMode("register")}>
                    <Text style={styles.switchText}>
                      Mobile number not registered? <Text style={styles.switchTextStrong}>Register</Text>
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => setAuthMode("login")}>
                    <Text style={styles.switchText}>
                      Already registered? <Text style={styles.switchTextStrong}>Sign in</Text>
                    </Text>
                  </Pressable>
                )
              ) : null}

              {!isResetOpen ? (
                <Pressable
                  disabled={!isFormReady || isSubmitting}
                  onPress={authMode === "register" ? handleRegister : handleLogin}
                  onPressIn={() => {
                    buttonPress.value = withTiming(1, { duration: 100 });
                  }}
                  onPressOut={() => {
                    buttonPress.value = withTiming(0, { duration: 120 });
                  }}
                >
                  <Animated.View style={[styles.loginButton, buttonStyle]}>
                    <Text style={styles.loginButtonText}>
                      {isSubmitting
                        ? authMode === "register"
                          ? "Creating..."
                          : "Signing in..."
                        : authMode === "register"
                          ? "Register"
                          : "Login"}
                    </Text>
                  </Animated.View>
                </Pressable>
              ) : null}
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg
  },
  keyboardArea: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24
  },
  homeScroll: {
    flex: 1
  },
  homeScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 118
  },
  glowTop: {
    position: "absolute",
    top: -80,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: "rgba(222, 235, 247, 0.95)"
  },
  glowBottom: {
    position: "absolute",
    right: -90,
    bottom: -120,
    width: 260,
    height: 260,
    borderRadius: 260,
    backgroundColor: "rgba(107, 174, 214, 0.22)"
  },
  shell: {
    width: "100%",
    maxWidth: 390,
    alignSelf: "center",
    gap: 18
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 6
  },
  brandCopy: {
    flex: 1
  },
  brandBadge: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.blue700
  },
  brandEyebrow: {
    color: palette.blue700,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.4
  },
  brandTitle: {
    marginTop: 4,
    color: palette.blue900,
    fontSize: 24,
    fontWeight: "800"
  },
  brandSubtitle: {
    marginTop: 4,
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  card: {
    width: "100%",
    backgroundColor: palette.surface,
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(8, 48, 107, 0.08)",
    shadowColor: palette.blue900,
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8
  },
  heading: {
    color: palette.blue900,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.7
  },
  subheading: {
    marginTop: 8,
    marginBottom: 0,
    color: palette.textMuted,
    fontSize: 16,
    lineHeight: 24
  },
  fieldBlock: {
    marginBottom: 16
  },
  fieldLabel: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "700"
  },
  inputShell: {
    borderWidth: 1,
    borderRadius: 20,
    position: "relative",
    justifyContent: "center"
  },
  inputShellLocked: {
    opacity: 0.78
  },
  input: {
    height: 58,
    paddingHorizontal: 16,
    color: palette.blue900,
    fontSize: 16,
    fontWeight: "600"
  },
  lockedInput: {
    color: palette.textMuted
  },
  passwordInput: {
    paddingRight: 58
  },
  inputAccessory: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center"
  },
  passwordToggle: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(222, 235, 247, 0.48)",
    borderWidth: 1,
    borderColor: "rgba(8, 48, 107, 0.08)",
    opacity: 0.88,
    cursor: "pointer",
    transform: [{ scale: 1 }],
    transitionProperty: "background-color, opacity, transform, border-color",
    transitionDuration: "0.18s",
    transitionTimingFunction: "ease"
  },
  passwordToggleHover: {
    backgroundColor: "rgba(222, 235, 247, 0.86)",
    borderColor: "rgba(33, 113, 181, 0.16)",
    opacity: 1,
    transform: [{ scale: 1.04 }]
  },
  passwordTogglePressed: {
    transform: [{ scale: 0.96 }]
  },
  loginOptionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: palette.blue400,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  checkboxChecked: {
    borderColor: palette.blue700,
    backgroundColor: palette.surfaceTint
  },
  checkboxDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: palette.blue700
  },
  rememberText: {
    color: palette.textMuted,
    fontSize: 15,
    fontWeight: "700"
  },
  forgotPasswordLink: {
    paddingVertical: 6,
    paddingLeft: 8,
    opacity: 0.86,
    cursor: "pointer",
    transitionProperty: "opacity, transform",
    transitionDuration: "0.18s",
    transitionTimingFunction: "ease"
  },
  forgotPasswordLinkHover: {
    opacity: 1,
    transform: [{ scale: 1.02 }]
  },
  forgotPasswordLinkPressed: {
    transform: [{ scale: 0.98 }]
  },
  forgotPasswordText: {
    color: palette.blue800,
    fontSize: 13,
    fontWeight: "800",
    textDecorationLine: "underline",
    textDecorationColor: "rgba(33, 113, 181, 0.35)"
  },
  resetPanel: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 22,
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: "rgba(8, 48, 107, 0.08)"
  },
  resetPanelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14
  },
  resetPanelTitle: {
    color: palette.blue900,
    fontSize: 16,
    fontWeight: "900"
  },
  resetPanelText: {
    marginTop: 4,
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600"
  },
  resetPanelClose: {
    color: palette.blue800,
    fontSize: 12,
    fontWeight: "900"
  },
  resetValidationText: {
    marginTop: -4,
    marginBottom: 10,
    color: palette.danger,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700"
  },
  resetMessageText: {
    marginTop: -4,
    marginBottom: 10,
    color: palette.blue800,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700"
  },
  resetButton: {
    minHeight: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.blue700,
    shadowColor: palette.blue700,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  resetButtonText: {
    color: "#F7FBFF",
    fontSize: 15,
    fontWeight: "900"
  },
  errorBox: {
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: palette.dangerBg,
    borderWidth: 1,
    borderColor: "rgba(8, 48, 107, 0.08)"
  },
  errorText: {
    color: palette.blue900,
    fontSize: 14,
    fontWeight: "600"
  },
  successBox: {
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(46, 155, 87, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(46, 155, 87, 0.22)"
  },
  successText: {
    color: palette.success,
    fontSize: 14,
    fontWeight: "700"
  },
  switchText: {
    marginBottom: 16,
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center"
  },
  switchTextStrong: {
    color: palette.blue800,
    fontWeight: "800"
  },
  loginButton: {
    minHeight: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.blue700
  },
  loginButtonText: {
    color: "#F7FBFF",
    fontSize: 17,
    fontWeight: "800"
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceTint,
    borderWidth: 1,
    borderColor: "rgba(33, 113, 181, 0.08)",
    shadowColor: palette.blue700,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  disabledButton: {
    opacity: 0.6
  },
  secondaryButtonText: {
    color: palette.blue800,
    fontSize: 16,
    fontWeight: "800"
  },
  workerSubmitPressable: {
    borderRadius: 18,
    transform: [{ scale: 1 }],
    transitionProperty: "opacity, transform",
    transitionDuration: "0.18s",
    transitionTimingFunction: "ease"
  },
  workerSubmitPressableHover: {
    transform: [{ scale: 1.025 }]
  },
  workerSubmitPressablePressed: {
    transform: [{ scale: 0.97 }]
  },
  workerActions: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center"
  },
  workerDeleteButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    backgroundColor: "rgba(210, 75, 90, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(210, 75, 90, 0.12)",
    shadowColor: palette.danger,
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
    cursor: "pointer",
    transform: [{ scale: 1 }],
    transitionProperty: "background-color, box-shadow, transform, border-color",
    transitionDuration: "0.18s",
    transitionTimingFunction: "ease"
  },
  workerDeleteButtonHover: {
    backgroundColor: "rgba(210, 75, 90, 0.14)",
    borderColor: "rgba(210, 75, 90, 0.2)",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    transform: [{ scale: 1.06 }]
  },
  workerDeleteButtonPressed: {
    transform: [{ scale: 0.97 }]
  },
  workerFormActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16
  },
  workerDeleteFormPressable: {
    flex: 0.45,
    borderRadius: 18,
    transform: [{ scale: 1 }],
    transitionProperty: "opacity, transform",
    transitionDuration: "0.18s",
    transitionTimingFunction: "ease"
  },
  workerDeleteFormPressableHover: {
    transform: [{ scale: 1.025 }]
  },
  workerDeleteFormPressablePressed: {
    transform: [{ scale: 0.97 }]
  },
  workerClosePressable: {
    flex: 0.35,
    borderRadius: 18,
    transform: [{ scale: 1 }],
    transitionProperty: "opacity, transform",
    transitionDuration: "0.18s",
    transitionTimingFunction: "ease"
  },
  workerClosePressableHover: {
    transform: [{ scale: 1.025 }]
  },
  workerClosePressablePressed: {
    transform: [{ scale: 0.97 }]
  },
  dangerButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(210, 75, 90, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(210, 75, 90, 0.16)",
    shadowColor: palette.danger,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  tertiaryButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F7FA",
    borderWidth: 1,
    borderColor: "#E0E5EC",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  checkActionIcon: {
    width: 30,
    height: 22,
    position: "relative"
  },
  checkActionStroke: {
    position: "absolute",
    height: 4,
    borderRadius: 999,
    backgroundColor: palette.blue800
  },
  checkActionShort: {
    left: 4,
    top: 11,
    width: 11,
    transform: [{ rotate: "45deg" }]
  },
  checkActionLong: {
    right: 2,
    top: 9,
    width: 21,
    transform: [{ rotate: "-45deg" }]
  },
  sectionHeader: {
    marginBottom: 18
  },
  logoutButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.blue700,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.68)",
    shadowColor: palette.blue700,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
    cursor: "pointer",
    transform: [{ scale: 1 }],
    transitionProperty: "background-color, box-shadow, transform",
    transitionDuration: "0.18s",
    transitionTimingFunction: "ease"
  },
  logoutButtonHover: {
    backgroundColor: palette.blue500,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    transform: [{ scale: 1.06 }]
  },
  logoutButtonPressed: {
    transform: [{ scale: 0.96 }]
  },
  logoutIcon: {
    width: 25,
    height: 25,
    position: "relative"
  },
  logoutDoor: {
    position: "absolute",
    left: 2,
    top: 4,
    width: 11,
    height: 17,
    borderLeftWidth: 2.5,
    borderTopWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: "#F7FBFF",
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4
  },
  logoutArrowShaft: {
    position: "absolute",
    left: 9,
    top: 11,
    width: 13,
    height: 2.8,
    borderRadius: 999,
    backgroundColor: "#F7FBFF"
  },
  logoutArrowHead: {
    position: "absolute",
    right: 2,
    top: 11,
    width: 8,
    height: 2.8,
    borderRadius: 999,
    backgroundColor: "#F7FBFF"
  },
  logoutArrowHeadTop: {
    transform: [{ rotate: "45deg" }],
    top: 8
  },
  logoutArrowHeadBottom: {
    transform: [{ rotate: "-45deg" }],
    top: 14
  },
  bottomTabsDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 26 : 16,
    backgroundColor: "rgba(247, 251, 255, 0.96)",
    borderTopWidth: 1,
    borderTopColor: "rgba(8, 48, 107, 0.08)"
  },
  bottomTabs: {
    width: "100%",
    maxWidth: 390,
    flexDirection: "row",
    gap: 8,
    padding: 8,
    borderRadius: 24,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: "rgba(8, 48, 107, 0.08)",
    shadowColor: palette.blue900,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10
  },
  bottomTabPressable: {
    flex: 1,
    transform: [{ scale: 1 }],
    transitionProperty: "opacity, transform",
    transitionDuration: "0.18s",
    transitionTimingFunction: "ease"
  },
  bottomTabPressableHover: {
    opacity: 0.94,
    transform: [{ scale: 1.03 }]
  },
  bottomTabPressablePressed: {
    transform: [{ scale: 0.96 }]
  },
  bottomTab: {
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 4,
    backgroundColor: "transparent",
    shadowColor: palette.blue700,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    transitionProperty: "background-color, box-shadow",
    transitionDuration: "0.2s",
    transitionTimingFunction: "ease"
  },
  bottomTabActive: {
    backgroundColor: palette.surfaceTint,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 }
  },
  bottomTabIconSlot: {
    width: 28,
    height: 24,
    alignItems: "center",
    justifyContent: "center"
  },
  bottomTabDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "transparent"
  },
  bottomTabDotActive: {
    backgroundColor: palette.blue700
  },
  bottomTabText: {
    color: palette.blue800,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  bottomTabTextActive: {
    color: palette.blue900
  },
  attendanceTabIcon: {
    width: 28,
    height: 24,
    position: "relative",
    alignItems: "center",
    justifyContent: "center"
  },
  attendanceCalendar: {
    position: "absolute",
    left: 3,
    top: 4,
    width: 22,
    height: 18,
    borderRadius: 5.5,
    borderWidth: 2.8,
    borderColor: palette.blue800,
    backgroundColor: "transparent",
    opacity: 0.9
  },
  attendanceCalendarActive: {
    borderColor: palette.blue700,
    opacity: 1
  },
  attendanceCalendarRing: {
    position: "absolute",
    top: -8,
    width: 3.2,
    height: 8,
    borderRadius: 1.6,
    backgroundColor: palette.blue800
  },
  attendanceCalendarRingActive: {
    backgroundColor: palette.blue700
  },
  attendanceCalendarRingLeft: {
    left: 4
  },
  attendanceCalendarRingRight: {
    right: 4
  },
  manageTabIcon: {
    width: 28,
    height: 24,
    position: "relative",
    alignItems: "center",
    justifyContent: "center"
  },
  manageHead: {
    position: "absolute",
    top: 2,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: palette.blue800,
    opacity: 0.9
  },
  manageHeadPrimary: {
    left: 5
  },
  manageHeadSecondary: {
    right: 5
  },
  manageBody: {
    position: "absolute",
    bottom: 3,
    height: 10,
    backgroundColor: palette.blue800,
    opacity: 0.9
  },
  manageBodyPrimary: {
    left: 1,
    width: 21,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2
  },
  manageBodySecondary: {
    right: 1,
    width: 15,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1
  },
  manageIconActive: {
    backgroundColor: palette.blue700,
    opacity: 1
  },
  billingTabIcon: {
    width: 28,
    height: 24,
    position: "relative",
    alignItems: "center",
    justifyContent: "center"
  },
  billingReceipt: {
    position: "absolute",
    left: 5,
    top: 2,
    width: 18,
    height: 20,
    backgroundColor: palette.blue800,
    opacity: 0.9
  },
  billingReceiptActive: {
    backgroundColor: palette.blue700,
    opacity: 1
  },
  billingZig: {
    position: "absolute",
    width: 7,
    height: 7,
    backgroundColor: palette.surface,
    transform: [{ rotate: "45deg" }]
  },
  billingZigTopOne: {
    top: -5,
    left: 0
  },
  billingZigTopTwo: {
    top: -5,
    left: 6
  },
  billingZigTopThree: {
    top: -5,
    right: 0
  },
  billingZigBottomOne: {
    bottom: -5,
    left: 0
  },
  billingZigBottomTwo: {
    bottom: -5,
    left: 6
  },
  billingZigBottomThree: {
    bottom: -5,
    right: 0
  },
  billingLine: {
    position: "absolute",
    left: 4,
    top: 6,
    width: 10,
    height: 2.5,
    borderRadius: 999,
    backgroundColor: palette.surface
  },
  billingLineMiddle: {
    top: 11
  },
  billingLineLower: {
    top: 16
  },
  calendarCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 24,
    backgroundColor: palette.surfaceSoft
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14
  },
  calendarTitle: {
    color: palette.blue900,
    fontSize: 16,
    fontWeight: "800"
  },
  calendarNavButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surface
  },
  calendarNavText: {
    color: palette.blue800,
    fontSize: 16,
    fontWeight: "800"
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 10
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  dayPressable: {
    width: `${100 / 7}%`,
    paddingVertical: 4,
    alignItems: "center"
  },
  dayCell: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  dayCellSelected: {
    backgroundColor: palette.blue700
  },
  dayCellSaved: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: "#D9E3EE"
  },
  dayCellToday: {
    backgroundColor: palette.surface
  },
  dayCellMuted: {
    opacity: 0.42
  },
  dayCellDisabled: {
    opacity: 0.28
  },
  dayLabel: {
    color: palette.blue900,
    fontSize: 14,
    fontWeight: "700"
  },
  dayLabelSelected: {
    color: "#F7FBFF"
  },
  dayLabelMuted: {
    color: palette.textMuted
  },
  workerSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  workerHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  workerSectionTitle: {
    color: palette.blue900,
    fontSize: 18,
    fontWeight: "800"
  },
  addChipPressable: {
    borderRadius: 16,
    transform: [{ scale: 1 }],
    transitionProperty: "opacity, transform",
    transitionDuration: "0.18s",
    transitionTimingFunction: "ease"
  },
  addChipPressableHover: {
    transform: [{ scale: 1.04 }]
  },
  addChipPressablePressed: {
    transform: [{ scale: 0.96 }]
  },
  addChip: {
    minWidth: 48,
    height: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceTint,
    shadowColor: palette.blue700,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  closeChipContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7
  },
  addChipText: {
    color: palette.blue800,
    fontSize: 14,
    fontWeight: "800"
  },
  closeChipIcon: {
    width: 14,
    height: 14,
    position: "relative"
  },
  closeChipIconStroke: {
    position: "absolute",
    left: 1,
    top: 6,
    width: 12,
    height: 2.4,
    borderRadius: 999,
    backgroundColor: palette.blue800
  },
  closeChipIconStrokeOne: {
    transform: [{ rotate: "45deg" }]
  },
  closeChipIconStrokeTwo: {
    transform: [{ rotate: "-45deg" }]
  },
  addWorkerIcon: {
    width: 34,
    height: 26,
    position: "relative"
  },
  addWorkerIconHead: {
    position: "absolute",
    left: 8,
    top: 0,
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: palette.blue800
  },
  addWorkerIconBody: {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: 26,
    height: 12,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    backgroundColor: palette.blue800
  },
  addWorkerIconPlusHorizontal: {
    position: "absolute",
    right: 0,
    top: 9,
    width: 14,
    height: 3.5,
    borderRadius: 999,
    backgroundColor: palette.blue800
  },
  addWorkerIconPlusVertical: {
    position: "absolute",
    right: 5.25,
    top: 3.75,
    width: 3.5,
    height: 14,
    borderRadius: 999,
    backgroundColor: palette.blue800
  },
  addWorkerCard: {
    marginBottom: 18,
    borderRadius: 20,
    padding: 16,
    backgroundColor: palette.surfaceSoft
  },
  addWorkerTitle: {
    color: palette.blue900,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12
  },
  addWorkerFields: {
    gap: 12,
    marginBottom: 14
  },
  compactField: {
    gap: 6
  },
  compactLabel: {
    color: palette.blue800,
    fontSize: 13,
    fontWeight: "700"
  },
  compactInputShell: {
    position: "relative",
    justifyContent: "center",
    borderRadius: 16,
    shadowColor: palette.blue700,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 }
  },
  compactInputShellFocused: {
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  compactInput: {
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    color: palette.blue900,
    fontSize: 15,
    fontWeight: "600"
  },
  compactInputFocused: {
    borderColor: "#B9DDF4"
  },
  compactInputWithIcon: {
    paddingRight: 48
  },
  compactInputIcon: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    width: 28,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.72
  },
  compactInputIconFocused: {
    opacity: 1
  },
  rupeeIcon: {
    color: palette.blue800,
    fontSize: 19,
    lineHeight: 22,
    fontWeight: "800",
    textAlign: "center"
  },
  emptyCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: palette.surfaceSoft
  },
  emptyTitle: {
    color: palette.blue900,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6
  },
  emptyText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 21
  },
  workerCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor: palette.surfaceSoft
  },
  workerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  workerInfo: {
    flex: 1
  },
  workerName: {
    color: palette.blue900,
    fontSize: 16,
    fontWeight: "800"
  },
  workerWage: {
    marginTop: 4,
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  workerEditButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    backgroundColor: palette.surfaceTint,
    borderWidth: 1,
    borderColor: "rgba(8, 48, 107, 0.06)",
    shadowColor: palette.blue700,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
    cursor: "pointer",
    transform: [{ scale: 1 }],
    transitionProperty: "background-color, box-shadow, transform, border-color",
    transitionDuration: "0.18s",
    transitionTimingFunction: "ease"
  },
  workerEditButtonHover: {
    backgroundColor: "#E6F1FA",
    borderColor: "rgba(33, 113, 181, 0.14)",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    transform: [{ scale: 1.06 }]
  },
  billingEditButtonActive: {
    backgroundColor: "#DDEBFA",
    borderColor: "rgba(33, 113, 181, 0.18)",
    shadowOpacity: 0.1
  },
  workerEditButtonPressed: {
    transform: [{ scale: 0.97 }]
  },
  pencilEditIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  pencilEditOutline: {
    position: "absolute",
    left: 2,
    bottom: 2,
    width: 17,
    height: 17,
    borderLeftWidth: 2.4,
    borderBottomWidth: 2.4,
    borderRightWidth: 2.4,
    borderColor: "#B9D0EF",
    borderRadius: 6
  },
  pencilEditMark: {
    position: "absolute",
    width: 20,
    height: 8,
    right: 1,
    top: 6,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-42deg" }]
  },
  pencilEditBody: {
    position: "absolute",
    left: 4,
    width: 12,
    height: 7,
    borderRadius: 1.5,
    backgroundColor: "#2F69D0"
  },
  pencilEditTip: {
    position: "absolute",
    left: -1,
    width: 0,
    height: 0,
    borderTopWidth: 3.5,
    borderBottomWidth: 3.5,
    borderLeftWidth: 5,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "#2F69D0",
    transform: [{ rotate: "180deg" }]
  },
  pencilEditEraser: {
    position: "absolute",
    right: 0,
    width: 5,
    height: 7,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: "#2F69D0"
  },
  symbolActions: {
    flexDirection: "row",
    gap: 10
  },
  symbolButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  symbolButtonIdle: {
    backgroundColor: "#D7DFEA"
  },
  symbolButtonPresent: {
    backgroundColor: palette.success
  },
  symbolButtonAbsent: {
    backgroundColor: palette.danger
  },
  symbolText: {
    color: "#6F7D92",
    fontSize: 20,
    fontWeight: "900"
  },
  symbolTextActive: {
    color: "#FFFFFF"
  },
  saveSection: {
    marginTop: 18,
    gap: 10
  },
  saveHint: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center"
  },
  manageBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.surfaceTint
  },
  manageBadgeText: {
    color: palette.blue800,
    fontSize: 12,
    fontWeight: "800"
  },
  expenseActionText: {
    color: palette.blue800,
    fontSize: 22,
    lineHeight: 22,
    fontWeight: "900"
  },
  billingCard: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: palette.surfaceSoft
  },
  billingDismissArea: {
    width: "100%"
  },
  billingHeader: {
    alignItems: "center",
    marginBottom: 14
  },
  billingTodayLabel: {
    color: palette.blue700,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center"
  },
  billingFilterRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10
  },
  billingFilterField: {
    flex: 1
  },
  billingFilterBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  billingFilterLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 3
  },
  billingFilterValue: {
    color: palette.blue900,
    fontSize: 14,
    fontWeight: "800"
  },
  billingFilterPlaceholder: {
    color: palette.textMuted
  },
  billingPickerCard: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border
  },
  billingTitle: {
    color: palette.blue900,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center"
  },
  billingEditHint: {
    color: palette.blue700,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
    marginBottom: 12
  },
  billingActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  billingActionLabel: {
    color: palette.blue900,
    fontSize: 15,
    fontWeight: "800"
  },
  billingActionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  expenseCard: {
    marginBottom: 14,
    borderRadius: 20,
    padding: 14,
    backgroundColor: palette.surface
  },
  expenseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  expenseTitle: {
    color: palette.blue900,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 0
  },
  expenseRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginBottom: 12
  },
  expenseReasonField: {
    flex: 1.5
  },
  expenseAmountField: {
    flex: 1
  },
  expenseFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(8, 48, 107, 0.08)"
  },
  expenseTotalBlock: {
    flex: 1,
    minWidth: 132
  },
  expenseFooterLabel: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  expenseFooterAmount: {
    color: palette.blue900,
    fontSize: 15,
    fontWeight: "900"
  },
  updateBillButton: {
    minHeight: 44,
    minWidth: 128,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.blue700,
    borderWidth: 1,
    borderColor: "rgba(8, 48, 107, 0.08)",
    shadowColor: palette.blue700,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    cursor: "pointer",
    transform: [{ scale: 1 }],
    transitionProperty: "background-color, box-shadow, transform",
    transitionDuration: "0.18s",
    transitionTimingFunction: "ease"
  },
  updateBillButtonHover: {
    backgroundColor: palette.blue800,
    shadowOpacity: 0.24,
    shadowRadius: 16,
    transform: [{ scale: 1.04 }]
  },
  updateBillButtonPressed: {
    transform: [{ scale: 0.98 }]
  },
  updateBillButtonText: {
    color: "#F7FBFF",
    fontSize: 13,
    fontWeight: "900"
  },
  billingTable: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: palette.surface,
    marginBottom: 14
  },
  billingTableHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.surfaceTint,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  billingTableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: palette.border
  },
  billingTableRowEditing: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 10
  },
  billingHeaderCell: {
    color: palette.blue800,
    fontSize: 12,
    fontWeight: "800"
  },
  billingCell: {
    color: palette.blue800,
    fontSize: 13,
    fontWeight: "700"
  },
  billingInput: {
    minHeight: 32,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: palette.bg
  },
  billingNameCell: {
    flex: 1.45,
    paddingRight: 10,
    color: palette.blue900
  },
  billingEditFieldsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8
  },
  billingEditField: {
    flex: 1.15
  },
  billingEditFieldSmall: {
    width: 74
  },
  billingEditFieldLabel: {
    marginBottom: 4,
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: "700"
  },
  billingEditTotalBlock: {
    width: 78,
    alignItems: "flex-end"
  },
  billingEditTotalValue: {
    color: palette.blue900,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right"
  },
  billingNumberCell: {
    flex: 0.7,
    textAlign: "center"
  },
  billingWageCell: {
    flex: 0.9,
    textAlign: "center"
  },
  billingDaysCell: {
    flex: 0.55,
    textAlign: "center"
  },
  billingAmountCell: {
    flex: 0.8,
    textAlign: "right"
  },
  billingTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.surfaceTint
  },
  billingTotalText: {
    flex: 1,
    color: palette.blue900,
    fontSize: 14,
    fontWeight: "900"
  },
  billingSpacerCell: {
    flex: 1
  },
  billingState: {
    paddingHorizontal: 16,
    paddingVertical: 22,
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  billingStateText: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: "600"
  },
  billingGrandCard: {
    marginTop: 14,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: palette.blue500,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  billingGrandLabel: {
    color: "#F7FBFF",
    fontSize: 15,
    fontWeight: "800"
  },
  billingGrandAmount: {
    color: "#F7FBFF",
    fontSize: 20,
    fontWeight: "900"
  },
  generatedBillsState: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  generatedBillsStateText: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: "600"
  },
  generatedMonthCard: {
    marginBottom: 16,
    borderRadius: 22,
    backgroundColor: palette.surfaceSoft
  },
  generatedMonthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 22,
    backgroundColor: "#E8E9F7"
  },
  generatedMonthBarMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  generatedMonthBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  generatedMonthTitle: {
    color: palette.blue900,
    fontSize: 16,
    fontWeight: "900"
  },
  generatedMonthCount: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  generatedMonthDeletePressable: {
    minWidth: 36,
    minHeight: 36,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F1F2",
    borderWidth: 1,
    borderColor: "#EADDE0",
    shadowColor: palette.blue900,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    cursor: "pointer",
    transform: [{ scale: 1 }],
    transitionProperty: "background-color, transform, border-color",
    transitionDuration: "0.2s",
    transitionTimingFunction: "ease"
  },
  generatedMonthDeletePressableHover: {
    backgroundColor: "#F1E3E6",
    borderColor: "#E5D1D6",
    transform: [{ scale: 1.05 }]
  },
  generatedMonthDeletePressablePressed: {
    transform: [{ scale: 0.98 }]
  },
  generatedMonthDeleteText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "800"
  },
  generatedMonthArrowChip: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surface
  },
  chevronIcon: {
    width: 12,
    height: 12,
    transform: [{ rotate: "0deg" }]
  },
  chevronIconExpanded: {
    transform: [{ rotate: "180deg" }]
  },
  chevronIconStroke: {
    position: "absolute",
    top: 5,
    width: 8,
    height: 2,
    borderRadius: 999,
    backgroundColor: palette.blue800
  },
  chevronIconStrokeLeft: {
    left: 0,
    transform: [{ rotate: "45deg" }]
  },
  chevronIconStrokeRight: {
    right: 0,
    transform: [{ rotate: "-45deg" }]
  },
  trashIcon: {
    width: 16,
    height: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  trashIconHandle: {
    width: 5,
    height: 2,
    borderWidth: 1.6,
    borderBottomWidth: 0,
    borderColor: "#DC2626",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    marginBottom: 1
  },
  trashIconLid: {
    width: 14,
    height: 4,
    borderWidth: 1.6,
    borderColor: "#DC2626",
    borderRadius: 3,
    marginBottom: 1
  },
  trashIconBody: {
    width: 11,
    height: 11,
    borderWidth: 1.6,
    borderTopWidth: 1.2,
    borderColor: "#DC2626",
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 1.5
  },
  trashIconLine: {
    width: 1.5,
    height: 5.5,
    borderRadius: 999,
    backgroundColor: "#DC2626"
  },
  generatedBillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border
  },
  generatedBillInfo: {
    flex: 1
  },
  generatedBillDate: {
    color: palette.blue900,
    fontSize: 15,
    fontWeight: "800"
  },
  generatedBillMeta: {
    marginTop: 4,
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  generatedBillActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  generatedBillActionPressable: {
    minWidth: 36,
    minHeight: 36,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF3F8",
    borderWidth: 1,
    borderColor: "#E2EAF2",
    shadowColor: palette.blue900,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    cursor: "pointer",
    transform: [{ scale: 1 }],
    transitionProperty: "background-color, transform, border-color",
    transitionDuration: "0.2s",
    transitionTimingFunction: "ease"
  },
  generatedBillActionPressableHover: {
    backgroundColor: "#E2EAF2",
    borderColor: "#D3DFEC",
    transform: [{ scale: 1.05 }]
  },
  generatedBillActionPressablePressed: {
    transform: [{ scale: 0.98 }]
  },
  generatedBillActionChipBusy: {
    opacity: 0.72,
    cursor: "default"
  },
  generatedBillDeletePressable: {
    minWidth: 36,
    minHeight: 36,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F1F2",
    borderWidth: 1,
    borderColor: "#EADDE0",
    shadowColor: palette.blue900,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    cursor: "pointer",
    transform: [{ scale: 1 }],
    transitionProperty: "background-color, transform, border-color",
    transitionDuration: "0.2s",
    transitionTimingFunction: "ease"
  },
  generatedBillDeletePressableHover: {
    backgroundColor: "#F1E3E6",
    borderColor: "#E5D1D6",
    transform: [{ scale: 1.05 }]
  },
  generatedBillDeletePressablePressed: {
    transform: [{ scale: 0.98 }]
  },
  eyeIcon: {
    width: 20,
    height: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  eyeIconOutline: {
    width: 18,
    height: 12,
    borderWidth: 1.8,
    borderColor: palette.blue800,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  eyeIconPupil: {
    width: 4.5,
    height: 4.5,
    borderRadius: 999,
    backgroundColor: palette.blue800
  },
  eyeIconSlash: {
    position: "absolute",
    width: 21,
    height: 2,
    borderRadius: 999,
    backgroundColor: palette.blue800,
    transform: [{ rotate: "-42deg" }]
  },
  downloadIcon: {
    width: 24,
    height: 22,
    alignItems: "center",
    justifyContent: "center"
  },
  downloadIconArrowStem: {
    position: "absolute",
    top: 1,
    width: 3.2,
    height: 11,
    borderRadius: 999,
    backgroundColor: palette.blue800
  },
  downloadIconArrowHeadStroke: {
    position: "absolute",
    top: 10,
    width: 9,
    height: 3.2,
    borderRadius: 999,
    backgroundColor: palette.blue800
  },
  downloadIconArrowHeadLeft: {
    left: 5,
    transform: [{ rotate: "45deg" }]
  },
  downloadIconArrowHeadRight: {
    right: 5,
    transform: [{ rotate: "-45deg" }]
  },
  downloadIconStrokeActive: {
    backgroundColor: palette.blue700
  },
  downloadIconTray: {
    position: "absolute",
    bottom: 1,
    width: 20,
    height: 7,
    borderWidth: 3.2,
    borderTopWidth: 0,
    borderColor: palette.blue800,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6
  },
  downloadIconTrayActive: {
    borderColor: palette.blue700
  },
  generatedPreviewCard: {
    marginTop: 6,
    borderRadius: 24,
    padding: 18,
    backgroundColor: palette.surfaceSoft
  },
  generatedPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 24
  },
  generatedPreviewBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 48, 107, 0.28)"
  },
  generatedPreviewPopup: {
    width: "100%",
    maxWidth: 720,
    maxHeight: "82%",
    borderRadius: 24,
    padding: 18,
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: palette.blue900,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10
  },
  generatedPreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12
  },
  generatedPreviewHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  generatedPreviewActionButton: {
    minWidth: 42,
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF3F8",
    borderWidth: 1,
    borderColor: "#E2EAF2",
    shadowColor: palette.blue900,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    cursor: "pointer",
    transform: [{ scale: 1 }],
    transitionProperty: "background-color, transform, border-color",
    transitionDuration: "0.2s",
    transitionTimingFunction: "ease"
  },
  generatedPreviewActionButtonHover: {
    backgroundColor: "#E2EAF2",
    borderColor: "#D3DFEC",
    transform: [{ scale: 1.05 }]
  },
  generatedPreviewActionButtonPressed: {
    transform: [{ scale: 0.98 }]
  },
  generatedPreviewCloseButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7
  },
  generatedPreviewEyebrow: {
    color: palette.blue700,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1
  },
  generatedPreviewTitle: {
    marginTop: 4,
    color: palette.blue900,
    fontSize: 20,
    fontWeight: "900"
  },
  generatedPreviewScroll: {
    maxHeight: 420
  },
  generatedPreviewTotals: {
    marginTop: 14,
    gap: 10
  },
  generatedPreviewTotalCard: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: palette.surfaceTint,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  generatedPreviewTotalLabel: {
    color: palette.blue900,
    fontSize: 14,
    fontWeight: "800"
  },
  generatedPreviewTotalValue: {
    color: palette.blue900,
    fontSize: 18,
    fontWeight: "900"
  },
  generatedPreviewGrandTotalCard: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: palette.blue700,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  generatedPreviewGrandTotalLabel: {
    color: "#F7FBFF",
    fontSize: 15,
    fontWeight: "900"
  },
  generatedPreviewGrandTotalValue: {
    color: "#F7FBFF",
    fontSize: 20,
    fontWeight: "900"
  },
  generatedConfirmPopup: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    padding: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: palette.blue900,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10
  },
  generatedConfirmTitle: {
    color: palette.blue900,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 10
  },
  generatedConfirmText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 22
  },
  generatedConfirmActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 18
  },
  generatedConfirmSecondary: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceSoft
  },
  generatedConfirmSecondaryText: {
    color: palette.blue800,
    fontSize: 14,
    fontWeight: "800"
  },
  generatedConfirmPrimary: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.blue700
  },
  generatedConfirmPrimaryText: {
    color: "#F7FBFF",
    fontSize: 14,
    fontWeight: "800"
  },
  expenseRemovePressable: {
    alignSelf: "flex-end",
    marginBottom: 4,
    marginLeft: 4,
  },
  expenseRemovePressableHover: {
    opacity: 0.75,
  },
  expenseRemovePressablePressed: {
    opacity: 0.5,
  },
});
