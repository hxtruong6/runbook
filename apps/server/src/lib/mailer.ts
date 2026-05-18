import nodemailer from 'nodemailer'

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST) return null
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  })
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  const from = process.env['SMTP_FROM'] ?? 'Runbook <noreply@runbook.app>'
  const transport = createTransport()

  if (!transport) {
    console.log(`[mailer] SMTP not configured — reset link for ${to}:\n  ${resetUrl}`)
    return
  }

  await transport.sendMail({
    from,
    to,
    subject: 'Reset your Runbook password',
    text: `Click the link below to reset your password (expires in 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
    html: `
      <p>Click the button below to reset your password. The link expires in <strong>1 hour</strong>.</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#7048e8;color:#fff;border-radius:6px;text-decoration:none">Reset password</a></p>
      <p style="color:#888;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
    `,
  })
}
