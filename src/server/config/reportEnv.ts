export function getReportTimezone(): string {
  return process.env.REPORT_TIMEZONE?.trim() || "America/Port-au-Prince";
}

export function getPunctualTimeLimit(): string {
  return process.env.PUNCTUAL_TIME_LIMIT?.trim() || "08:15";
}

export function getReportRecipients(): string[] {
  const raw = process.env.REPORT_EMAIL_TO?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

export function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, "").trim();
  const port = Number(process.env.SMTP_PORT ?? "465");
  const secure =
    process.env.SMTP_SECURE === undefined
      ? port === 465
      : process.env.SMTP_SECURE === "true";

  return { host, user, pass, port, secure };
}

export function isSmtpConfigured(): boolean {
  const cfg = getSmtpConfig();
  return Boolean(cfg.host && cfg.user && cfg.pass);
}

export function getCronExpression(): string {
  return process.env.REPORT_CRON_SCHEDULE?.trim() || "0 9 * * *";
}
