/**
 * Mantenimiento de usuarios:
 *  1. Desactiva a Erlendy Ceballos (isActive=false).
 *  2. Borra a Niurka Almonte (Auth + documento en Firestore; los ponches históricos se conservan).
 *  3. Asigna un PIN de 6 dígitos distinto a cada usuario restante (reemplaza su contraseña actual).
 *  4. Comprueba cada PIN iniciando sesión en Firebase Auth igual que el Kiosco.
 *
 * Uso:
 *   npx tsx src/server/scripts/resetPins.ts            # simulación, no cambia nada
 *   npx tsx src/server/scripts/resetPins.ts --apply    # aplica los cambios
 *
 * Requiere FIREBASE_SERVICE_ACCOUNT_JSON o FIREBASE_SERVICE_ACCOUNT_PATH.
 * También actualiza el índice pinIndex que usa el Kiosco.
 * Los PINs se guardan en pins_<fecha>.csv (ignorado por git). Entrégalos y borra el archivo.
 */
import "dotenv/config";
import { randomInt } from "node:crypto";
import { writeFileSync } from "node:fs";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "../firebaseAdmin";
import firebaseConfig from "../../../firebase-applet-config.json";
import { PIN_INDEX_COLLECTION, pinHash } from "../../shared/auth/pinIndex";

const APPLY = process.argv.includes("--apply");
const DEACTIVATE = ["erlendy ceballos"];
const DELETE = ["niurka almonte"];
const EMAIL_DOMAIN = "chronosabc.com";
// Evitar el PIN universal y PINs triviales
const FORBIDDEN = new Set(["000000", "123456", "654321", "111111", "999999"]);

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const matches = (name: string, targets: string[]) =>
  targets.some((t) => t.split(" ").every((part) => name.includes(part)));

function generatePin(used: Set<string>): string {
  for (;;) {
    const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
    if (FORBIDDEN.has(pin) || /^(\d)\1{5}$/.test(pin) || used.has(pin)) continue;
    used.add(pin);
    return pin;
  }
}

async function verifyPin(email: string, pin: string): Promise<boolean> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pin, returnSecureToken: false }),
    },
  );
  return res.ok;
}

async function main() {
  const db = getAdminFirestore();
  const clearPins = async (uid: string) => {
    const old = await db.collection(PIN_INDEX_COLLECTION).where("userId", "==", uid).get();
    await Promise.all(old.docs.map((d) => d.ref.delete()));
  };
  const auth = getAdminAuth();
  const snap = await db.collection("users").get();
  console.log(`${APPLY ? "APLICANDO" : "SIMULACIÓN (usa --apply)"} — ${snap.size} usuarios\n`);

  const used = new Set<string>();
  const rows: string[] = ["nombre,usuario,pin,verificado"];
  let failures = 0;
  const found = { deactivate: 0, delete: 0 };

  for (const doc of snap.docs) {
    const data = doc.data();
    const name = norm(data.name);
    const username = String(data.username ?? "");
    const email = `${username}@${EMAIL_DOMAIN}`;

    if (matches(name, DELETE)) {
      found.delete++;
      console.log(`BORRAR      ${data.name} (${username})`);
      if (APPLY) {
        await auth.deleteUser(doc.id).catch((e) => console.warn(`  Auth: ${e.message}`));
        await doc.ref.delete();
        await clearPins(doc.id);
      }
      continue;
    }

    if (matches(name, DEACTIVATE)) {
      found.deactivate++;
      console.log(`DESACTIVAR  ${data.name} (${username})`);
      if (APPLY) {
        await doc.ref.update({ isActive: false, updatedAt: FieldValue.serverTimestamp() });
        await clearPins(doc.id);
        await auth.updateUser(doc.id, { disabled: true }).catch((e) => console.warn(`  Auth: ${e.message}`));
      }
      continue;
    }

    if (data.isActive === false) {
      console.log(`OMITIR      ${data.name} (${username}) — inactivo`);
      continue;
    }

    const pin = generatePin(used);
    let ok = false;
    if (APPLY) {
      try {
        await auth.updateUser(doc.id, { password: pin });
      } catch (e: any) {
        if (e?.code === "auth/user-not-found") {
          await auth.createUser({ uid: doc.id, email, password: pin, displayName: String(data.name) });
        } else throw e;
      }
      await clearPins(doc.id);
      await db.collection(PIN_INDEX_COLLECTION).doc(await pinHash(pin))
        .set({ userId: doc.id, updatedAt: FieldValue.serverTimestamp() });
      ok = await verifyPin(email, pin);
      if (!ok) failures++;
    }
    console.log(`PIN         ${data.name} (${username}) → ${APPLY ? pin : "******"} ${APPLY ? (ok ? "✔ verificado" : "✘ FALLÓ") : ""}`);
    rows.push(`"${data.name}",${username},${pin},${ok ? "si" : "no"}`);
  }

  if (!found.deactivate) console.warn("\n⚠ No se encontró a Erlendy Ceballos.");
  if (!found.delete) console.warn("⚠ No se encontró a Niurka Almonte.");

  if (APPLY) {
    const file = `pins_${new Date().toISOString().slice(0, 10)}.csv`;
    writeFileSync(file, rows.join("\n") + "\n");
    console.log(`\nPINs guardados en ${file}. Fallos de verificación: ${failures}`);
  }
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
