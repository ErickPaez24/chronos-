import { todayDateKey } from "../../shared/utils/dateKey";

export { todayDateKey } from "../../shared/utils/dateKey";

export function formatDateInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatTimeInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * Parse HH:mm (24h) into minutes since midnight in the report timezone context.
 */
export function parseTimeLimitToMinutes(limit: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(limit.trim());
  if (!match) {
    throw new Error(`PUNCTUAL_TIME_LIMIT inválido: "${limit}" (use HH:mm)`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new Error(`PUNCTUAL_TIME_LIMIT fuera de rango: "${limit}"`);
  }
  return hours * 60 + minutes;
}

/**
 * Minutes since local midnight in `timeZone` for a given instant.
 */
export function minutesSinceLocalMidnight(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function startOfLocalDayUtc(timeZone: string, reference = new Date()): Date {
  const key = todayDateKey(timeZone, reference);
  const [y, m, d] = key.split("-").map(Number);
  const guess = new Date(Date.UTC(y!, m! - 1, d!, 0, 0, 0, 0));

  for (let offsetHours = -14; offsetHours <= 14; offsetHours++) {
    const candidate = new Date(guess.getTime() + offsetHours * 60 * 60 * 1000);
    if (todayDateKey(timeZone, candidate) === key && minutesSinceLocalMidnight(candidate, timeZone) === 0) {
      return candidate;
    }
  }

  return guess;
}

export function localDayUpperBound9Am(timeZone: string, reference = new Date()): Date {
  const start = startOfLocalDayUtc(timeZone, reference);
  const nineAmMinutes = 9 * 60;
  let low = start.getTime();
  let high = low + 36 * 60 * 60 * 1000;

  while (high - low > 60_000) {
    const mid = Math.floor((low + high) / 2);
    const mins = minutesSinceLocalMidnight(new Date(mid), timeZone);
    if (mins < nineAmMinutes) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return new Date(high);
}
