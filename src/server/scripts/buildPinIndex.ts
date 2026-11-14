/**
 * Carga el índice de PINs del Kiosco (pinIndex) a partir de un CSV "nombre,usuario,pin,..."
 * y, con --rules, publica firestore.rules en la base de datos de la app.
 *
 *   npx tsx src/server/scripts/buildPinIndex.ts pins.csv [--rules]
 *
 * Requiere FIREBASE_SERVICE_ACCOUNT_JSON o FIREBASE_SERVICE_ACCOUNT_PATH.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminApp, getAdminFirestore } from "../firebaseAdmin";
import { PIN_INDEX_COLLECTION, isValidPin, pinHash } from "../../shared/auth/pinIndex";

const PROJECT = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0801522147";
const DATABASE = process.env.FIRESTORE_DATABASE_ID || "ai-studio-70226889-530b-4929-a655-5b3dffe66368";

async function deployRules() {
  const token = (await getAdminApp().options.credential!.getAccessToken()).access_token;
  const api = "https://firebaserules.googleapis.com/v1";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const content = readFileSync("firestore.rules", "utf8");

  const rs = await fetch(`${api}/projects/${PROJECT}/rulesets`, {
    method: "POST",
    headers,
    body: JSON.stringify({ source: { files: [{ name: "firestore.rules", content }] } }),
  });
  if (!rs.ok) throw new Error(`Ruleset: ${rs.status} ${await rs.text()}`);
  const rulesetName = ((await rs.json()) as { name: string }).name;

  const releaseName = `projects/${PROJECT}/releases/cloud.firestore/${DATABASE}`;
  let res = await fetch(`${api}/${releaseName}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ release: { name: releaseName, rulesetName } }),
  });
  if (res.status === 404) {
    res = await fetch(`${api}/projects/${PROJECT}/releases`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: releaseName, rulesetName }),
    });
  }
  if (!res.ok) throw new Error(`Release: ${res.status} ${await res.text()}`);
  console.log(`Reglas publicadas (${rulesetName}) → ${releaseName}`);
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) throw new Error("Falta la ruta del CSV.");
  const db = getAdminFirestore();

  const users = await db.collection("users").get();
  const byUsername = new Map(users.docs.map((d) => [String(d.data().username), d]));

  const lines = readFileSync(csvPath, "utf8").trim().split("\n").slice(1);
  const seen = new Set<string>();
  for (const line of lines) {
    const cols = line.match(/("[^"]*"|[^,]+)/g)!.map((c) => c.replace(/^"|"$/g, ""));
    const [, username, pin] = cols;
    const user = byUsername.get(username);
    if (!user || !isValidPin(pin)) {
      console.warn(`OMITIR ${username}: ${!user ? "usuario no existe" : "PIN inválido"}`);
      continue;
    }
    const hash = await pinHash(pin);
    if (seen.has(hash)) throw new Error(`PIN repetido en ${username}`);
    seen.add(hash);

    const old = await db.collection(PIN_INDEX_COLLECTION).where("userId", "==", user.id).get();
    await Promise.all(old.docs.filter((d) => d.id !== hash).map((d) => d.ref.delete()));
    await db.collection(PIN_INDEX_COLLECTION).doc(hash).set({ userId: user.id, updatedAt: FieldValue.serverTimestamp() });
    console.log(`OK ${user.data().name} (${username})`);
  }

  if (process.argv.includes("--rules")) await deployRules();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
