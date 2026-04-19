import { config } from '../config'

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

async function sendEmail(to: string, subject: string, html: string, mockLabel: string, mockBody: string) {
  if (!config.brevo.apiKey || !config.brevo.senderEmail) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[EMAIL MOCK] ${mockLabel} for ${to}: ${mockBody}`)
      return
    }
    throw new Error('Email service not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL.')
  }

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': config.brevo.apiKey,
      'content-type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: config.brevo.senderEmail, name: config.brevo.senderName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Brevo email send failed: ${response.status} ${body}`)
  }
}

export async function sendTempPasswordEmail(to: string, tempPassword: string) {
  const html = `
    <div style="font-family: Arial; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #02474E;">Welcome to NAMA</h2>
      <p>Your access request has been approved. Use the temporary password below to log in:</p>
      <div style="background: #f5f5f5; padding: 24px; text-align: center; border-radius: 8px; margin: 24px 0;">
        <span style="font-size: 18px; font-weight: bold; color: #02474E;">${tempPassword}</span>
      </div>
      <p style="color: #666;">Please change your password immediately after logging in.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">&copy; 2026 NAMA Water Services</p>
    </div>
  `
  await sendEmail(to, 'NAMA - Your Account Has Been Approved', html, 'Temp password', tempPassword)
}

export async function sendOtpEmail(to: string, otp: string) {
  const html = `
    <div style="font-family: Arial; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #02474E;">Password Reset</h2>
      <p>You requested a password reset. Use this OTP to reset your password:</p>
      <div style="background: #f5f5f5; padding: 24px; text-align: center; border-radius: 8px; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #02474E;">${otp}</span>
      </div>
      <p style="color: #666;">This OTP expires in <strong>10 minutes</strong>.</p>
      <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">&copy; 2026 NAMA Water Services</p>
    </div>
  `
  await sendEmail(to, 'NAMA - Password Reset OTP', html, 'OTP', otp)
}
