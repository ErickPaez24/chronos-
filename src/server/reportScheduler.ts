import cron, { type ScheduledTask } from "node-cron";
import { getCronExpression } from "./config/reportEnv";
import { sendDailyAttendanceReport } from "./services/attendanceReportService";

let scheduledTask: ScheduledTask | null = null;
let lastRunError: string | null = null;
let lastRunAt: Date | null = null;

export function getReportSchedulerStatus() {
  return {
    running: Boolean(scheduledTask),
    cron: getCronExpression(),
    lastRunAt: lastRunAt?.toISOString() ?? null,
    lastRunError,
  };
}

async function runScheduledReport(): Promise<void> {
  try {
    await sendDailyAttendanceReport();
    lastRunError = null;
    lastRunAt = new Date();
  } catch (error) {
    lastRunError = error instanceof Error ? error.message : String(error);
    lastRunAt = new Date();
    console.error("[reportScheduler] Error enviando reporte:", lastRunError);
  }
}

export function startReportScheduler(): void {
  if (scheduledTask) return;

  const expression = getCronExpression();
  if (!cron.validate(expression)) {
    throw new Error(`Expresión cron inválida: ${expression}`);
  }

  scheduledTask = cron.schedule(
    expression,
    () => {
      void runScheduledReport();
    },
    {
      timezone: process.env.REPORT_TIMEZONE?.trim() || "America/Santo_Domingo",
    },
  );

  console.log(`[reportScheduler] Programado: "${expression}"`);
}

export function stopReportScheduler(): void {
  scheduledTask?.stop();
  scheduledTask = null;
}
