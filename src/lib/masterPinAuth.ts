import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "./firebase";
import {
  getMasterPinActiveDate,
  isMasterPinActive,
  getReportTimezone,
} from "../shared/auth/masterPinPolicy";
import { validateEmployeeSecret } from "../shared/auth/validateEmployeeSecret";

export function masterPinStatus() {
  const timeZone = getReportTimezone();
  return {
    activeToday: isMasterPinActive(new Date(), timeZone),
    activeDate: getMasterPinActiveDate(),
    timeZone,
  };
}

export async function findUserByUsername(username: string) {
  const normalized = username.toLowerCase().trim();
  if (!normalized) return null;
  const snap = await getDocs(
    query(collection(db, "users"), where("username", "==", normalized), limit(1)),
  );
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, data: doc.data() as Record<string, unknown> };
}

export function checkMasterPinForUser(
  userData: Record<string, unknown>,
  pin: string,
): ReturnType<typeof validateEmployeeSecret> {
  return validateEmployeeSecret(userData, pin, { timeZone: getReportTimezone() });
}
