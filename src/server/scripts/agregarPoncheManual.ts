/**
 * Agrega un ponche manual (p. ej. cuando el empleado aún no tiene la huella registrada).
 *
 * Uso:
 *   npx tsx src/server/scripts/agregarPoncheManual.ts jluna 2026-11-18 07:51 ENTRADA
 *
 * Requiere FIREBASE_SERVICE_ACCOUNT_PATH (o FIREBASE_SERVICE_ACCOUNT_JSON) como el servidor.
 * La hora se interpreta en REPORT_TIMEZONE (por defecto America/Santo_Domingo, UTC-4).
 */
import "dotenv/config";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "../firebaseAdmin";

const TIPOS = ["ENTRADA", "SALIDA", "ALMUERZO_IN", "ALMUERZO_OUT"];

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

async function main() {
  const [nombre, fecha, hora, tipo = "ENTRADA"] = process.argv.slice(2);
  if (!nombre || !/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? "") || !/^\d{1,2}:\d{2}$/.test(hora ?? "")) {
    console.error('Uso: npx tsx src/server/scripts/agregarPoncheManual.ts "usuario o nombre" AAAA-MM-DD HH:mm [TIPO]');
    process.exit(1);
  }
  if (!TIPOS.includes(tipo)) {
    console.error(`Tipo inválido. Use uno de: ${TIPOS.join(", ")}`);
    process.exit(1);
  }

  // Santo Domingo no tiene horario de verano: siempre UTC-4.
  const offset = process.env.PONCHE_UTC_OFFSET || "-04:00";
  const [h, m] = hora.split(":");
  const fechaHora = new Date(`${fecha}T${h.padStart(2, "0")}:${m}:00${offset}`);
  if (isNaN(fechaHora.getTime())) throw new Error("Fecha/hora inválida");

  const db = getAdminFirestore();
  const snap = await db.collection("users").get();
  const buscado = normalizar(nombre);
  // Primero por usuario exacto (p. ej. "jluna"); si no, por nombre.
  const porUsuario = snap.docs.filter((d) => normalizar(String(d.data().username ?? "")) === buscado);
  const coincidencias = porUsuario.length
    ? porUsuario
    : snap.docs.filter((d) => normalizar(String(d.data().name ?? "")).includes(buscado));

  if (coincidencias.length !== 1) {
    console.error(
      coincidencias.length === 0
        ? `No se encontró ningún usuario con nombre "${nombre}".`
        : `Hay varios usuarios que coinciden:\n${coincidencias.map((d) => `  ${d.id}  ${d.data().name}`).join("\n")}`
    );
    process.exit(1);
  }

  const user = coincidencias[0];
  const docId = `manual_${user.id}_${Math.floor(fechaHora.getTime() / 1000)}`;
  const ref = db.collection("ponches").doc(docId);
  if ((await ref.get()).exists) {
    console.log("Ese ponche ya existe; no se hizo nada.");
    return;
  }
  await ref.create({
    userId: user.id,
    type: tipo,
    timestamp: Timestamp.fromDate(fechaHora),
    notes: "Ponche manual (huella no registrada)",
  });
  console.log(`Listo: ${tipo} de ${user.data().name} el ${fecha} a las ${hora} (id ${docId}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
