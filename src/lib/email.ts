import { Resend } from 'resend'
import { config } from '../config'

const resend = config.resend.apiKey ? new Resend(config.resend.apiKey) : null

export async function sendOtpEmail(to: string, otp: string) {
  if (!resend) {
    console.log(`[EMAIL MOCK] OTP for ${to}: ${otp}`)
    return
  }
  await resend.emails.send({
    from: config.resend.fromEmail,
    to,
    subject: 'NAMA - Password Reset OTP',
    html: `
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
    `,
  })
}
