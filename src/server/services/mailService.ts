import nodemailer from "nodemailer";
import { getReportRecipients, getSmtpConfig } from "../config/reportEnv";

export async function sendAttendanceReportEmail(subject: string, html: string): Promise<void> {
  const recipients = getReportRecipients();
  if (recipients.length === 0) {
    throw new Error("REPORT_EMAIL_TO no está configurado o está vacío.");
  }

  const smtp = getSmtpConfig();
  if (!smtp.host || !smtp.user || !smtp.pass) {
    throw new Error("SMTP_HOST, SMTP_USER o SMTP_PASS no están configurados.");
  }

  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  await transport.sendMail({
    from: `"Chronos ABC" <${smtp.user}>`,
    to: recipients.join(", "),
    subject,
    html,
  });
}
