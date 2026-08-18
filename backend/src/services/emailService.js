const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_PASS;

  if (user && pass) {
    if (host) {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === "true" || port === 465,
        auth: { user, pass },
      });
    } else {
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
      });
    }
  }

  return transporter;
}

/**
 * Send 2FA verification code to user's email
 */
async function send2FAEmail({ toEmail, code, deviceDetails = {} }) {
  const mailTransporter = getTransporter();
  const fromAddress = process.env.SMTP_FROM || `"FawterX Security" <no-reply@fawterx.com>`;

  const htmlContent = `
  <!DOCTYPE html>
  <html dir="rtl" lang="ar">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>رمز التحقق الأمني - FawterX</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b0d19; color: #e8eaf6; margin: 0; padding: 20px; direction: rtl; text-align: right; }
      .card { max-width: 520px; margin: 0 auto; background: #14182b; border: 1px solid rgba(255, 215, 0, 0.3); border-radius: 16px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
      .header { text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 20px; margin-bottom: 25px; }
      .logo { font-size: 24px; font-weight: 900; color: #FFD700; letter-spacing: 1px; }
      .title { font-size: 18px; font-weight: 700; color: #ffffff; margin-top: 10px; }
      .otp-box { background: rgba(255, 215, 0, 0.08); border: 2px dashed #FFD700; border-radius: 12px; padding: 18px; text-align: center; margin: 25px 0; }
      .otp-code { font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #00e0a1; font-family: monospace; }
      .info-text { font-size: 14px; color: #a4b0be; line-height: 1.6; }
      .device-box { background: rgba(0,0,0,0.25); border-radius: 8px; padding: 12px 16px; margin: 20px 0; font-size: 12px; color: #747d8c; }
      .footer { text-align: center; font-size: 12px; color: #57606f; margin-top: 25px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px; }
      .warn { color: #ff6b6b; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header">
        <div class="logo">⚡ FawterX Security</div>
        <div class="title">تأكيد أمان تسجيل الدخول (2FA)</div>
      </div>
      <p class="info-text">
        مرحباً، تم رصد محاولة تسجيل دخول جديدة إلى حسابك في منصة <strong>FawterX</strong> من متصفح أو جهاز غير موثق مسبقاً.
      </p>
      <div class="otp-box">
        <div style="font-size: 13px; color: #ffd700; margin-bottom: 8px; font-weight: 600;">رمز التحقق الخاص بك:</div>
        <div class="otp-code">${code}</div>
        <div style="font-size: 11px; color: #a4b0be; margin-top: 8px;">صالح لمدة 15 دقيقة فقط</div>
      </div>
      <div class="device-box">
        <div>🖥️ المتصفح / الجهاز: <strong>${deviceDetails.userAgent || "متصفح غير معروف"}</strong></div>
        <div>⏱️ الوقت: <strong>${new Date().toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}</strong></div>
      </div>
      <p class="info-text warn">
        ⚠️ تنبيه أمني: لا تشارك هذا الرمز مطلقاً مع أي شخص. فريق FawterX لن يطلب منك هذا الرمز أبداً.
      </p>
      <div class="footer">
        إذا لم تكن أنت من قام بهذه المحاولة، يرجى تغيير كلمة مرور بريدك وتأمين حسابك فوراً.<br>
        © ${new Date().getFullYear()} FawterX. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `;

  if (mailTransporter) {
    try {
      const info = await mailTransporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject: `🛡️ رمز التحقق الأمني الخاص بك: ${code} - FawterX`,
        html: htmlContent,
      });
      console.log(`[EmailService] 📧 2FA OTP sent to ${toEmail} (MessageId: ${info.messageId})`);
      return { success: true, method: "smtp" };
    } catch (err) {
      console.error(`[EmailService Error] Failed to send email via SMTP:`, err.message);
      console.log(`[EmailService Fallback] 2FA OTP for ${toEmail}: [${code}]`);
      return { success: true, method: "fallback", error: err.message };
    }
  } else {
    console.warn(`[EmailService Notice] SMTP credentials not set in environment. 2FA OTP generated for ${toEmail}: [${code}]`);
    return { success: true, method: "unconfigured_smtp" };
  }
}

module.exports = {
  send2FAEmail,
};
