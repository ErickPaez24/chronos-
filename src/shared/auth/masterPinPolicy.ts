function todayDateKey(timeZone: string, reference = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(reference);
}

const DEFAULT_MASTER_PIN = "000000";
const REPORT_TIMEZONE = "America/Santo_Domingo";

export function getMasterPinValue(): string {
  return import.meta.env.VITE_TEMP_MASTER_PIN?.trim() || DEFAULT_MASTER_PIN;
}

export function getMasterPinActiveDate(): string {
  return import.meta.env.VITE_TEMP_MASTER_PIN_DATE?.trim() || "2026-11-12";
}

export function getReportTimezone(): string {
  return import.meta.env.VITE_REPORT_TIMEZONE?.trim() || REPORT_TIMEZONE;
}

export function isMasterPinActive(reference = new Date(), timeZone?: string): boolean {
  const tz = timeZone ?? getReportTimezone();
  return todayDateKey(tz, reference) === getMasterPinActiveDate();
}

export function isMasterPinAttempt(secret: string): boolean {
  const normalized = secret.trim();
  return normalized.length > 0 && normalized === getMasterPinValue();
}

export function isMasterPinLoginAllowed(
  secret: string,
  reference = new Date(),
  timeZone?: string,
): boolean {
  return isMasterPinActive(reference, timeZone) && isMasterPinAttempt(secret);
}
