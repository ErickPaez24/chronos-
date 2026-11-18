import { timingSafeEqual } from "node:crypto";
import type { Express, Request, Response, NextFunction } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "./firebaseAdmin.ts";

/**
 * Ingesta de ponches desde el reloj biométrico (Realand) vía un agente local.
 *
 * Seguridad: requiere la variable CLOCK_API_KEY en el servidor y el header
 * "x-api-key" en cada petición. Sin CLOCK_API_KEY el endpoint queda deshabilitado.
 *
 * Mapeo reloj -> usuario de Chronos:
 *   1) colección `clock_users/{numeroReloj}` con { userId }
 *   2) si no existe, usuario cuyo `username` == numeroReloj
 *
 * Tipo de ponche: se asigna por el orden de marcas del día (zona REPORT_TIMEZONE)
 * según CLOCK_SEQUENCE (por defecto "ENTRADA,SALIDA"; para almuerzo usar
 * "ENTRADA,ALMUERZO_IN,ALMUERZO_OUT,SALIDA"). Marcas extra repiten la última.
 */

const TIMEZONE = process.env.REPORT_TIMEZONE?.trim() || "America/Santo_Domingo";
const VALID_TYPES = ["ENTRADA", "SALIDA", "ALMUERZO_IN", "ALMUERZO_OUT"];
const MAX_BATCH = 500;

function getSequence(): string[] {
  const raw = (process.env.CLOCK_SEQUENCE || "ENTRADA,SALIDA")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => VALID_TYPES.includes(s));
  return raw.length ? raw : ["ENTRADA", "SALIDA"];
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.CLOCK_API_KEY?.trim();
  if (!expected) {
    res.status(503).json({ ok: false, error: "Ingesta del reloj deshabilitada (falta CLOCK_API_KEY)." });
    return;
  }
  const given = typeof req.headers["x-api-key"] === "string" ? req.headers["x-api-key"] : "";
  if (!given || !safeEqual(given, expected)) {
    res.status(401).json({ ok: false, error: "Clave inválida." });
    return;
  }
  next();
}

function dayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

interface IncomingPunch {
  /** Número del usuario en el reloj (se mapea a Chronos), o vacío si viene userId. */
  deviceUserId: string;
  /** ID directo del usuario en Chronos (agente del lector USB 2Connect). */
  userId?: string;
  timestamp: Date;
  deviceSerial: string;
}

function parsePunches(body: any): { punches: IncomingPunch[]; errors: string[] } {
  const errors: string[] = [];
  const out: IncomingPunch[] = [];
  const serial = typeof body?.deviceSerial === "string" ? body.deviceSerial.replace(/[^a-zA-Z0-9]/g, "") : "reloj";
  const list = Array.isArray(body?.punches) ? body.punches : [];
  if (list.length > MAX_BATCH) errors.push(`Máximo ${MAX_BATCH} ponches por envío.`);
  for (const p of list.slice(0, MAX_BATCH)) {
    const ts = new Date(p?.timestamp);
    const directUser = typeof p?.userId === "string" ? p.userId.trim() : "";
    if (directUser) {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(directUser) || isNaN(ts.getTime())) {
        errors.push(`Ponche inválido: ${JSON.stringify(p)}`);
        continue;
      }
      out.push({ deviceUserId: "", userId: directUser, timestamp: ts, deviceSerial: serial });
      continue;
    }
    const id = String(p?.deviceUserId ?? "").trim();
    if (!/^[0-9]{1,12}$/.test(id) || isNaN(ts.getTime())) {
      errors.push(`Ponche inválido: ${JSON.stringify(p)}`);
      continue;
    }
    out.push({ deviceUserId: id, timestamp: ts, deviceSerial: serial });
  }
  out.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return { punches: out, errors };
}

export function registerClockRoutes(app: Express) {
  app.post("/api/clock/punches", requireApiKey, async (req: Request, res: Response) => {
    try {
      const { punches, errors } = parsePunches(req.body);
      const db = getAdminFirestore();
      const sequence = getSequence();

      const userCache = new Map<string, string | null>();
      const resolveUser = async (din: string): Promise<string | null> => {
        if (userCache.has(din)) return userCache.get(din)!;
        let userId: string | null = null;
        const map = await db.collection("clock_users").doc(din).get();
        if (map.exists && typeof map.data()?.userId === "string") {
          userId = map.data()!.userId;
        } else {
          const q = await db.collection("users").where("username", "==", din).limit(1).get();
          if (!q.empty) userId = q.docs[0].id;
        }
        userCache.set(din, userId);
        return userId;
      };

      // Conteo de ponches ya guardados por usuario/día (para asignar el tipo).
      const dayCounts = new Map<string, number>();
      const loadedDays = new Set<string>();
      const loadDay = async (day: string, from: Date) => {
        if (loadedDays.has(day)) return;
        loadedDays.add(day);
        const start = Timestamp.fromMillis(from.getTime() - 36 * 3600 * 1000);
        const end = Timestamp.fromMillis(from.getTime() + 36 * 3600 * 1000);
        const snap = await db
          .collection("ponches")
          .where("timestamp", ">=", start)
          .where("timestamp", "<=", end)
          .get();
        for (const d of snap.docs) {
          const data = d.data();
          const k = `${data.userId}|${dayKey((data.timestamp as Timestamp).toDate())}`;
          dayCounts.set(k, (dayCounts.get(k) || 0) + 1);
        }
      };

      let saved = 0;
      let duplicates = 0;
      const unknown = new Set<string>();

      const directCache = new Map<string, boolean>();
      const userExists = async (uid: string): Promise<boolean> => {
        if (!directCache.has(uid)) directCache.set(uid, (await db.collection("users").doc(uid).get()).exists);
        return directCache.get(uid)!;
      };

      for (const p of punches) {
        const userId = p.userId
          ? ((await userExists(p.userId)) ? p.userId : null)
          : await resolveUser(p.deviceUserId);
        if (!userId) {
          unknown.add(p.userId || p.deviceUserId);
          continue;
        }
        const day = dayKey(p.timestamp);
        await loadDay(day, p.timestamp);
        const docId = `clk_${p.deviceSerial}_${p.userId || p.deviceUserId}_${Math.floor(p.timestamp.getTime() / 1000)}`;
        const ref = db.collection("ponches").doc(docId);
        if ((await ref.get()).exists) {
          duplicates++;
          continue;
        }
        const key = `${userId}|${day}`;
        const n = dayCounts.get(key) || 0;
        const type = sequence[Math.min(n, sequence.length - 1)];
        await ref.create({
          userId,
          type,
          timestamp: Timestamp.fromDate(p.timestamp),
          notes: p.userId ? "Lector USB 2Connect" : "Reloj biométrico",
        });
        dayCounts.set(key, n + 1);
        saved++;
      }

      await db.collection("clock_meta").doc("status").set(
        {
          lastSyncAt: Timestamp.now(),
          lastSaved: saved,
          lastDuplicates: duplicates,
          lastUnknownUsers: Array.from(unknown),
        },
        { merge: true }
      );

      res.json({ ok: true, saved, duplicates, unknownDeviceUsers: Array.from(unknown), errors });
    } catch (err) {
      console.error("clock ingest error", err);
      res.status(500).json({ ok: false, error: "Error interno al guardar ponches." });
    }
  });

  // Huellas registradas (lector USB 2Connect) para identificación 1:N en el agente local.
  app.get("/api/clock/templates", requireApiKey, async (_req: Request, res: Response) => {
    try {
      const snap = await getAdminFirestore().collection("users").get();
      const templates = snap.docs
        .map((d) => ({ id: d.id, data: d.data() }))
        .filter(({ data }) => typeof data.usbFingerprint === "string" && data.usbFingerprint && data.isActive !== false)
        .map(({ id, data }) => ({
          userId: id,
          name: typeof data.name === "string" ? data.name : id,
          template: data.usbFingerprint as string,
        }));
      res.json({ ok: true, templates });
    } catch (err) {
      console.error("clock templates error", err);
      res.status(500).json({ ok: false, error: "Error interno." });
    }
  });

  app.get("/api/clock/status", requireApiKey, async (_req: Request, res: Response) => {
    try {
      const snap = await getAdminFirestore().collection("clock_meta").doc("status").get();
      const d = snap.data();
      res.json({
        ok: true,
        lastSyncAt: d?.lastSyncAt ? (d.lastSyncAt as Timestamp).toDate().toISOString() : null,
        lastSaved: d?.lastSaved ?? 0,
        lastDuplicates: d?.lastDuplicates ?? 0,
        lastUnknownUsers: d?.lastUnknownUsers ?? [],
      });
    } catch (err) {
      console.error("clock status error", err);
      res.status(500).json({ ok: false, error: "Error interno." });
    }
  });
}
