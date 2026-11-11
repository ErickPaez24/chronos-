import type { Express, Request, Response } from "express";
import { getAdminAuth, getAdminFirestore } from "./firebaseAdmin";

const MASTER_PIN = process.env.TEMP_MASTER_PIN?.trim() || "000000";
const MASTER_PIN_DATE = process.env.TEMP_MASTER_PIN_DATE?.trim() || "2026-11-12";
const TIMEZONE = process.env.REPORT_TIMEZONE?.trim() || "America/Port-au-Prince";

function todayInZone(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isMasterPinDay(): boolean {
  return todayInZone() === MASTER_PIN_DATE;
}

export function registerMasterPinRoutes(app: Express) {
  app.get("/api/auth/master-pin-status", (_req: Request, res: Response) => {
    res.json({
      activeToday: isMasterPinDay(),
      activeDate: MASTER_PIN_DATE,
      timeZone: TIMEZONE,
    });
  });

  app.post("/api/auth/custom-token", async (req: Request, res: Response) => {
    try {
      const username =
        typeof req.body?.username === "string" ? req.body.username.toLowerCase().trim() : "";
      const pin = typeof req.body?.pin === "string" ? req.body.pin.trim() : "";

      if (!username || pin.length !== 6) {
        res.status(400).json({ ok: false, error: "Usuario y PIN de 6 dígitos requeridos." });
        return;
      }

      if (!isMasterPinDay() || pin !== MASTER_PIN) {
        res.status(401).json({ ok: false, error: "PIN universal no disponible." });
        return;
      }

      const db = getAdminFirestore();
      const snap = await db
        .collection("users")
        .where("username", "==", username)
        .limit(1)
        .get();

      if (snap.empty) {
        res.status(404).json({ ok: false, error: "Usuario no encontrado." });
        return;
      }

      const userDoc = snap.docs[0]!;
      const data = userDoc.data();
      if (data.isActive === false) {
        res.status(403).json({ ok: false, error: "Usuario inactivo." });
        return;
      }

      const token = await getAdminAuth().createCustomToken(userDoc.id);
      console.warn(`[auth] PIN universal: custom token para ${username} (${userDoc.id})`);
      res.json({ ok: true, token, method: "master_pin" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error interno";
      console.error("[custom-token]", message);
      res.status(500).json({ ok: false, error: message });
    }
  });
}
