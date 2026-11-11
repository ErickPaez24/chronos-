import type { DocumentData, Firestore, Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "../firebaseAdmin";
import {
  getPunctualTimeLimit,
  getReportTimezone,
} from "../config/reportEnv";
import { buildPunctualityReportHtml } from "../templates/punctualityReportHtml";
import { sendAttendanceReportEmail } from "./mailService";
import {
  formatDateInZone,
  formatTimeInZone,
  localDayUpperBound9Am,
  minutesSinceLocalMidnight,
  parseTimeLimitToMinutes,
  startOfLocalDayUtc,
  todayDateKey,
} from "../utils/timezone";

export type ReportEmployeeRow = {
  id: string;
  name: string;
  roleOrUsername: string;
  entryTimeLabel: string;
};

export type AttendanceReportPayload = {
  dateLabel: string;
  punctualLimitLabel: string;
  generatedAtLabel: string;
  summary: { onTime: number; late: number; absent: number };
  onTime: ReportEmployeeRow[];
  late: ReportEmployeeRow[];
  absent: ReportEmployeeRow[];
};

type UserRecord = {
  id: string;
  isActive: boolean;
  name: string;
  roleOrUsername: string;
};

type PoncheRecord = {
  userId: string;
  type: string;
  at: Date;
};

function readString(data: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const ts = value as Timestamp;
    if (typeof ts.toDate === "function") return ts.toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function mapUser(id: string, data: DocumentData): UserRecord | null {
  const isActive = data.isActive === true;
  if (!isActive) return null;

  const name =
    readString(data, ["nombre", "displayName", "name", "fullName"]) || "Sin nombre";
  const roleOrUsername =
    readString(data, ["cargo", "department", "departamento", "role"]) ||
    readString(data, ["username", "userName", "email"]) ||
    "—";

  return { id, isActive, name, roleOrUsername };
}

function mapPonche(data: DocumentData): PoncheRecord | null {
  const type = readString(data, ["type", "tipo", "Type"]).toUpperCase();
  if (type !== "ENTRADA") return null;

  const userId =
    readString(data, ["userId", "userID", "uid", "empleadoId", "employeeId"]);
  if (!userId) return null;

  const at =
    toDate(data.timestamp) ??
    toDate(data.hora) ??
    toDate(data.createdAt) ??
    toDate(data.fechaHora) ??
    toDate(data.date);
  if (!at) return null;

  return { userId, type, at };
}

async function fetchActiveUsers(db: Firestore): Promise<UserRecord[]> {
  const snapshot = await db.collection("users").where("isActive", "==", true).get();
  const users: UserRecord[] = [];
  for (const doc of snapshot.docs) {
    const mapped = mapUser(doc.id, doc.data());
    if (mapped) users.push(mapped);
  }
  return users;
}

async function fetchEntradaPunchesForMorning(
  db: Firestore,
  timeZone: string,
  reference: Date,
): Promise<PoncheRecord[]> {
  const dayStart = startOfLocalDayUtc(timeZone, reference);
  const nineAm = localDayUpperBound9Am(timeZone, reference);
  const dateKey = todayDateKey(timeZone, reference);

  const byRange = await db
    .collection("ponches")
    .where("type", "==", "ENTRADA")
    .where("timestamp", ">=", dayStart)
    .where("timestamp", "<", nineAm)
    .get()
    .catch(() => null);

  if (byRange && !byRange.empty) {
    const list: PoncheRecord[] = [];
    for (const doc of byRange.docs) {
      const mapped = mapPonche(doc.data());
      if (mapped && mapped.at >= dayStart && mapped.at < nineAm) list.push(mapped);
    }
    if (list.length > 0) return list;
  }

  const byDate = await db
    .collection("ponches")
    .where("fecha", "==", dateKey)
    .where("type", "==", "ENTRADA")
    .get()
    .catch(() => null);

  const fromDateQuery: PoncheRecord[] = [];
  if (byDate) {
    for (const doc of byDate.docs) {
      const mapped = mapPonche(doc.data());
      if (mapped && mapped.at >= dayStart && mapped.at < nineAm) fromDateQuery.push(mapped);
    }
  }

  if (fromDateQuery.length > 0) return fromDateQuery;

  const fallback = await db.collection("ponches").where("type", "==", "ENTRADA").limit(2500).get();
  const list: PoncheRecord[] = [];
  for (const doc of fallback.docs) {
    const mapped = mapPonche(doc.data());
    if (mapped && mapped.at >= dayStart && mapped.at < nineAm) list.push(mapped);
  }
  return list;
}

function firstEntradaByUser(punches: PoncheRecord[]): Map<string, Date> {
  const map = new Map<string, Date>();
  for (const punch of punches) {
    const existing = map.get(punch.userId);
    if (!existing || punch.at < existing) {
      map.set(punch.userId, punch.at);
    }
  }
  return map;
}

export function buildAttendanceReport(
  users: UserRecord[],
  firstEntry: Map<string, Date>,
  options: { timeZone: string; punctualLimit: string; reference?: Date },
): AttendanceReportPayload {
  const { timeZone, punctualLimit } = options;
  const reference = options.reference ?? new Date();
  const limitMinutes = parseTimeLimitToMinutes(punctualLimit);

  const onTime: ReportEmployeeRow[] = [];
  const late: ReportEmployeeRow[] = [];
  const absent: ReportEmployeeRow[] = [];

  for (const user of users) {
    const entry = firstEntry.get(user.id);
    const base = {
      id: user.id,
      name: user.name,
      roleOrUsername: user.roleOrUsername,
    };

    if (!entry) {
      absent.push({ ...base, entryTimeLabel: "—" });
      continue;
    }

    const entryMinutes = minutesSinceLocalMidnight(entry, timeZone);
    const label = formatTimeInZone(entry, timeZone);

    if (entryMinutes <= limitMinutes) {
      onTime.push({ ...base, entryTimeLabel: label });
    } else {
      late.push({ ...base, entryTimeLabel: label });
    }
  }

  onTime.sort((a, b) => a.name.localeCompare(b.name, "es"));
  late.sort((a, b) => a.name.localeCompare(b.name, "es"));
  absent.sort((a, b) => a.name.localeCompare(b.name, "es"));

  return {
    dateLabel: formatDateInZone(reference, timeZone),
    punctualLimitLabel: punctualLimit,
    generatedAtLabel: formatTimeInZone(reference, timeZone),
    summary: {
      onTime: onTime.length,
      late: late.length,
      absent: absent.length,
    },
    onTime,
    late,
    absent,
  };
}

export async function generateAttendanceReportPayload(
  reference = new Date(),
): Promise<AttendanceReportPayload> {
  const timeZone = getReportTimezone();
  const punctualLimit = getPunctualTimeLimit();
  const db = getAdminFirestore();

  const users = await fetchActiveUsers(db);
  const punches = await fetchEntradaPunchesForMorning(db, timeZone, reference);
  const firstEntry = firstEntradaByUser(punches);

  return buildAttendanceReport(users, firstEntry, {
    timeZone,
    punctualLimit,
    reference,
  });
}

export async function sendDailyAttendanceReport(reference = new Date()): Promise<AttendanceReportPayload> {
  const payload = await generateAttendanceReportPayload(reference);
  const html = buildPunctualityReportHtml(payload);
  const subject = `Chronos — Reporte de puntualidad (${payload.dateLabel})`;
  await sendAttendanceReportEmail(subject, html);
  return payload;
}
