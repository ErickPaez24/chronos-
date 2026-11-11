import type { AttendanceReportPayload } from "../services/attendanceReportService";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderRows(
  rows: AttendanceReportPayload["onTime"],
  emptyMessage: string,
): string {
  if (rows.length === 0) {
    return `<tr><td colspan="3" style="padding:12px;color:#64748b;text-align:center;">${emptyMessage}</td></tr>`;
  }
  return rows
    .map(
      (r) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.name)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.roleOrUsername)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.entryTimeLabel)}</td>
    </tr>`,
    )
    .join("");
}

export function buildPunctualityReportHtml(data: AttendanceReportPayload): string {
  const { summary, onTime, late, absent, dateLabel, punctualLimitLabel, generatedAtLabel } = data;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reporte de Puntualidad</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0f766e 0%,#115e59 100%);padding:28px 24px;color:#ffffff;">
              <div style="font-size:13px;opacity:0.9;text-transform:uppercase;letter-spacing:0.06em;">Chronos · Kiosko</div>
              <h1 style="margin:12px 0 8px;font-size:22px;font-weight:700;line-height:1.3;">Reporte Diario de Puntualidad y Asistencia — 9:00 AM</h1>
              <p style="margin:0;font-size:15px;opacity:0.95;">${escapeHtml(dateLabel)}</p>
              <p style="margin:8px 0 0;font-size:12px;opacity:0.85;">Hora límite puntual: ${escapeHtml(punctualLimitLabel)} · Generado: ${escapeHtml(generatedAtLabel)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="33%" style="padding:8px;">
                    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:16px;text-align:center;">
                      <div style="font-size:28px;font-weight:700;color:#047857;">${summary.onTime}</div>
                      <div style="font-size:12px;color:#065f46;margin-top:4px;">Temprano / Puntuales</div>
                    </div>
                  </td>
                  <td width="33%" style="padding:8px;">
                    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px;text-align:center;">
                      <div style="font-size:28px;font-weight:700;color:#c2410c;">${summary.late}</div>
                      <div style="font-size:12px;color:#9a3412;margin-top:4px;">Tardanzas</div>
                    </div>
                  </td>
                  <td width="33%" style="padding:8px;">
                    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px;text-align:center;">
                      <div style="font-size:28px;font-weight:700;color:#b91c1c;">${summary.absent}</div>
                      <div style="font-size:12px;color:#991b1b;margin-top:4px;">Ausentes</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 4px;">
              <h2 style="font-size:16px;color:#047857;margin:16px 0 8px;">✓ Llegaron temprano o a tiempo</h2>
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;background:#f0fdf4;border-radius:8px;overflow:hidden;">
                <thead>
                  <tr style="background:#059669;color:#ffffff;">
                    <th align="left" style="padding:10px 12px;">Nombre</th>
                    <th align="left" style="padding:10px 12px;">Cargo / Usuario</th>
                    <th align="left" style="padding:10px 12px;">Hora de entrada</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderRows(onTime, "Nadie registró entrada puntual hoy.")}
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 24px;">
              <h2 style="font-size:16px;color:#c2410c;margin:20px 0 8px;">Tardanzas y ausencias</h2>
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;">
                <thead>
                  <tr style="background:#334155;color:#ffffff;">
                    <th align="left" style="padding:10px 12px;">Nombre</th>
                    <th align="left" style="padding:10px 12px;">Cargo / Usuario</th>
                    <th align="left" style="padding:10px 12px;">Estado / Hora</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    [...late, ...absent].length === 0
                      ? `<tr><td colspan="3" style="padding:12px;color:#64748b;text-align:center;">Sin tardanzas ni ausencias registradas.</td></tr>`
                      : [
                          ...late.map(
                            (r) => `
                    <tr>
                      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.name)}</td>
                      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.roleOrUsername)}</td>
                      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#c2410c;">Tarde — ${escapeHtml(r.entryTimeLabel)}</td>
                    </tr>`,
                          ),
                          ...absent.map(
                            (r) => `
                    <tr>
                      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.name)}</td>
                      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.roleOrUsername)}</td>
                      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#b91c1c;">Sin registro antes de las 9:00 AM</td>
                    </tr>`,
                          ),
                        ].join("")
                  }
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;">
              Mensaje automático de Chronos. No responder a este correo.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
