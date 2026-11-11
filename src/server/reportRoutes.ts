import type { Express, Request, Response } from "express";
import { isSmtpConfigured } from "./config/reportEnv";
import { getReportSchedulerStatus, startReportScheduler } from "./reportScheduler";
import { sendDailyAttendanceReport } from "./services/attendanceReportService";

export function registerReportRoutes(app: Express): void {
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      smtpConfigured: isSmtpConfigured(),
      scheduler: getReportSchedulerStatus(),
    });
  });

  app.post("/api/send-attendance-report", async (_req: Request, res: Response) => {
    try {
      const payload = await sendDailyAttendanceReport();
      res.json({
        ok: true,
        message: "Reporte de puntualidad enviado correctamente.",
        summary: payload.summary,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      console.error("[POST /api/send-attendance-report]", message);
      res.status(500).json({ ok: false, error: message });
    }
  });
}

export function bootstrapAttendanceReports(): void {
  try {
    startReportScheduler();
  } catch (error) {
    console.error("[reportScheduler] No se pudo iniciar:", error);
  }
}
