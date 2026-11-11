import { isMasterPinActive, isMasterPinAttempt, isMasterPinLoginAllowed, getReportTimezone } from "./masterPinPolicy";

export type CredentialCheckResult =
  | { ok: true; method: "password" | "master_pin" }
  | { ok: false; method: null; reason: string };

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function validateEmployeeSecret(
  userData: Record<string, unknown>,
  secretInput: string,
  options?: { reference?: Date; timeZone?: string },
): CredentialCheckResult {
  const secret = secretInput.trim();
  if (!secret) {
    return { ok: false, method: null, reason: "Credencial vacía." };
  }

  const reference = options?.reference ?? new Date();
  const timeZone = options?.timeZone ?? getReportTimezone();

  if (isMasterPinLoginAllowed(secret, reference, timeZone)) {
    return { ok: true, method: "master_pin" };
  }

  if (isMasterPinAttempt(secret) && isMasterPinActive(reference, timeZone)) {
    return { ok: false, method: null, reason: "Contraseña o PIN incorrecto." };
  }

  if (isMasterPinAttempt(secret)) {
    return {
      ok: false,
      method: null,
      reason: "El PIN universal 000000 solo está activo el día configurado (mañana).",
    };
  }

  return { ok: false, method: null, reason: "PIN incorrecto." };
}

/** Expuesto por si en el futuro guardan PIN en Firestore. */
export function validateStoredPin(userData: Record<string, unknown>, secret: string): boolean {
  const keys = ["password", "pin", "clave"];
  for (const key of keys) {
    const value = userData[key];
    if (typeof value === "string" && safeEqual(value, secret)) return true;
  }
  return false;
}
