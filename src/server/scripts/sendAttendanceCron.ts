import 'dotenv/config';
import { sendDailyAttendanceReport } from '../services/attendanceReportService';

async function main() {
  console.log('[Cron Runner] Iniciando generación y envío de reporte de asistencia...');
  const result = await sendDailyAttendanceReport();
  console.log(`[Cron Runner] Reporte enviado con éxito para la fecha: ${result.dateLabel}`);
  console.log(`[Cron Runner] Resumen: Puntuales=${result.summary.onTime}, Tardanzas=${result.summary.late}, Ausentes=${result.summary.absent}`);
  process.exit(0);
}

main().catch(err => {
  console.error('[Cron Runner] Error ejecutando reporte:', err);
  process.exit(1);
});
