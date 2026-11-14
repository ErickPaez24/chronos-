/**
 * Índice de PINs para el Kiosco: permite identificar al empleado solo con su PIN.
 *
 * Cada PIN se guarda como `pinIndex/{hash}` → { userId }. El documento se busca por
 * su id (get); la colección no se puede listar, así que los PINs no quedan expuestos.
 * Funciona en el navegador y en Node 20+ (Web Crypto).
 */
export const PIN_INDEX_COLLECTION = "pinIndex";
const PIN_SALT = "chronosabc-kiosk-pin-v1:";

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export async function pinHash(pin: string): Promise<string> {
  const data = new TextEncoder().encode(PIN_SALT + pin.trim());
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
