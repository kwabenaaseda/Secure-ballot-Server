// src/workers/email.service.ts
import { transporter } from "./nodemailer.service";
import { ENV } from "./env_validator";

const MAIL_FROM = ENV("MAIL_FROM") || ENV("GMAIL_USER");

interface WelcomeEmailPayload { to: string; username: string; }
interface OTPEmailPayload { to: string; username: string; otp: string; }

async function send(to: string, subject: string, html: string) {
  try {
    return await transporter.sendMail({ from: MAIL_FROM, to, subject, html });
  } catch (error) {
    console.error(`Email send error (${subject}):`, error);
    throw new Error(`Failed to send email: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function sendWelcomeEmail({ to, username }: WelcomeEmailPayload) {
  return send(to, 'Welcome to SecureBallot 🗳', `
  <div style="margin:0;padding:0;background-color:#060610;background-image:radial-gradient(1200px 600px at 20% -10%, rgba(124,58,237,0.22), transparent), radial-gradient(900px 500px at 90% 0%, rgba(59,130,246,0.18), transparent);">
    <div style="padding:40px 16px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;">
        
        <!-- Logo -->
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;width:56px;height:56px;line-height:56px;text-align:center;background:linear-gradient(135deg,#7c3aed 0%,#3b82f6 100%);border-radius:16px;box-shadow:0 8px 32px rgba(124,58,237,0.35), inset 0 1px 0 rgba(255,255,255,0.2);font-size:26px;">🗳</div>
        </div>

        <!-- Glass Card -->
        <div style="background:linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%);border:1px solid rgba(255,255,255,0.12);border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);">
          <div style="padding:36px 32px 32px 32px;">
            
            <!-- Pill -->
            <div style="display:inline-block;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:100px;padding:6px 12px;margin-bottom:20px;">
              <span style="display:inline-block;width:6px;height:6px;background:#22c55e;border-radius:50%;margin-right:6px;vertical-align:middle;"></span>
              <span style="font-size:11px;letter-spacing:0.08em;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;vertical-align:middle;">Secure • Anonymous • Verifiable</span>
            </div>

            <h1 style="margin:0 0 8px 0;font-size:28px;line-height:1.2;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Welcome to SecureBallot, ${username}!</h1>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#a1a1b5;">Your secure voting account is ready.</p>

            <div style="height:1px;background:linear-gradient(90deg, rgba(255,255,255,0.08), transparent);margin:0 0 24px 0;"></div>

            <p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:#d4d4e0;">
              Your account has been created successfully. SecureBallot is a secure, anonymous voting platform built so <span style="color:#fff;font-weight:600;">no one can link your identity to your choices.</span>
            </p>

            <!-- Features -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 28px 0;">
              <tr>
                <td style="width:50%;padding:0 6px 12px 0;vertical-align:top;">
                  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:12px 14px;">
                    <div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:2px;">🔒 Encrypted</div>
                    <div style="font-size:12px;color:#8b8ba3;line-height:1.4;">End-to-end protection</div>
                  </div>
                </td>
                <td style="width:50%;padding:0 0 12px 6px;vertical-align:top;">
                  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:12px 14px;">
                    <div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:2px;">👤 Anonymous</div>
                    <div style="font-size:12px;color:#8b8ba3;line-height:1.4;">Private by design</div>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="width:50%;padding:0 6px 0 0;vertical-align:top;">
                  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:12px 14px;">
                    <div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:2px;">🛡️ Tamper-proof</div>
                    <div style="font-size:12px;color:#8b8ba3;line-height:1.4;">Verifiable integrity</div>
                  </div>
                </td>
                <td style="width:50%;padding:0 0 0 6px;vertical-align:top;">
                  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:12px 14px;">
                    <div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:2px;">⚡ Real-time</div>
                    <div style="font-size:12px;color:#8b8ba3;line-height:1.4;">Instant results</div>
                  </div>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <div style="text-align:center;margin:4px 0 24px 0;">
              <a href="${ENV("FRONTEND_URL") || "#"}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:14px 28px;border-radius:100px;box-shadow:0 8px 24px rgba(124,58,237,0.35), inset 0 1px 0 rgba(255,255,255,0.15);">Go to Dashboard →</a>
              <div style="margin-top:10px;font-size:12px;color:#6b7280;">Or join an organization to start voting</div>
            </div>

          </div>
        </div>

        <!-- Footer -->
        <div style="text-align:center;margin-top:20px;padding:0 16px;">
          <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">— The SecureBallot Team</p>
          <p style="margin:0;font-size:11px;color:#4b5563;">
            <a href="#" style="color:#6b7280;text-decoration:none;">Help Center</a> &nbsp;•&nbsp; 
            <a href="#" style="color:#6b7280;text-decoration:none;">Privacy</a> &nbsp;•&nbsp; 
            <a href="#" style="color:#6b7280;text-decoration:none;">Contact</a>
          </p>
        </div>

      </div>
    </div>
  </div>
  `);
}


export async function sendOTPEmail({ to, username, otp }: OTPEmailPayload) {
 return send(to, 'Your SecureBallot Verification Code', `
  <div style="margin:0;padding:0;background-color:#060610;background-image:radial-gradient(1200px 600px at 20% -10%, rgba(124,58,237,0.22), transparent), radial-gradient(900px 500px at 90% 0%, rgba(59,130,246,0.18), transparent);">
    <div style="padding:40px 16px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;">
        
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;width:56px;height:56px;line-height:56px;text-align:center;background:linear-gradient(135deg,#7c3aed 0%,#3b82f6 100%);border-radius:16px;box-shadow:0 8px 32px rgba(124,58,237,0.35), inset 0 1px 0 rgba(255,255,255,0.2);font-size:26px;">🗳</div>
        </div>

        <div style="background:linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%);border:1px solid rgba(255,255,255,0.12);border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);">
          <div style="padding:32px 32px 28px 32px;">
            
            <div style="display:inline-block;background:rgba(124,58,237,0.12);border:1px solid rgba(124,58,237,0.25);border-radius:100px;padding:6px 12px;margin-bottom:20px;">
              <span style="display:inline-block;width:6px;height:6px;background:#a78bfa;border-radius:50%;margin-right:6px;vertical-align:middle;box-shadow:0 0 8px #a78bfa;"></span>
              <span style="font-size:11px;letter-spacing:0.08em;font-weight:600;color:#c4b5fd;text-transform:uppercase;vertical-align:middle;">Verification Required • 10 Min Expiry</span>
            </div>

            <h1 style="margin:0 0 6px 0;font-size:26px;line-height:1.3;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Hi ${username},</h1>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#a1a1b5;">Your verification code is ready. Use it to complete your action:</p>

            <!-- OTP Vault -->
            <div style="background:linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.3) 100%);border:1px solid rgba(124,58,237,0.28);border-radius:16px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(124,58,237,0.08), 0 8px 32px rgba(0,0,0,0.4);padding:2px;margin-bottom:20px;position:relative;">
              <div style="background:radial-gradient(600px 200px at 50% 0%, rgba(124,58,237,0.15), transparent);border-radius:14px;padding:22px 20px;text-align:center;">
                <div style="font-size:11px;letter-spacing:0.12em;font-weight:600;color:#6b7280;text-transform:uppercase;margin-bottom:10px;">YOUR CODE</div>
                <div style="font-family:'SF Mono',Monaco,Consolas,monospace;font-size:40px;font-weight:800;letter-spacing:10px;color:#ffffff;line-height:1;text-shadow:0 0 24px rgba(124,58,237,0.5);">${otp}</div>
                <div style="margin-top:14px;display:flex;justify-content:center;gap:6px;">
                  <span style="width:28px;height:3px;background:rgba(124,58,237,0.5);border-radius:100px;display:inline-block;"></span>
                  <span style="width:28px;height:3px;background:rgba(124,58,237,0.5);border-radius:100px;display:inline-block;"></span>
                  <span style="width:28px;height:3px;background:rgba(255,255,255,0.15);border-radius:100px;display:inline-block;"></span>
                </div>
              </div>
            </div>

            <!-- Expiry -->
            <div style="background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.18);border-radius:12px;padding:10px 14px;display:flex;align-items:center;gap:10px;margin-bottom:24px;">
              <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background:rgba(251,191,36,0.15);border-radius:8px;font-size:14px;">⏱</span>
              <span style="font-size:13px;color:#fcd34d;line-height:1.4;"><strong style="color:#fbbf24;">Expires in 10 minutes</strong> — don't share this code with anyone.</span>
            </div>

            <div style="height:1px;background:linear-gradient(90deg, rgba(255,255,255,0.08), transparent);margin:0 0 20px 0;"></div>

            <div style="display:flex;gap:12px;align-items:flex-start;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:12px 14px;">
              <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background:rgba(255,255,255,0.06);border-radius:8px;font-size:13px;flex-shrink:0;">🛡️</span>
              <span style="font-size:13px;line-height:1.5;color:#8b8ba3;">If you didn't request this, you can safely ignore this email. Your account remains secure.</span>
            </div>

          </div>
        </div>

        <div style="text-align:center;margin-top:20px;padding:0 16px;">
          <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">— The SecureBallot Team</p>
          <p style="margin:0;font-size:11px;color:#4b5563;">Secure • Anonymous • Verifiable</p>
        </div>

      </div>
    </div>
  </div>
  `);
}


export async function sendPasswordResetEmail({ to, username, otp }: OTPEmailPayload) {
  return send(to, 'SecureBallot Password Reset', `
  <div style="margin:0;padding:0;background-color:#060610;background-image:radial-gradient(1000px 500px at 15% -10%, rgba(239,68,68,0.18), transparent), radial-gradient(1000px 500px at 85% 0%, rgba(124,58,237,0.16), transparent);">
    <div style="padding:40px 16px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;">
        
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;width:56px;height:56px;line-height:56px;text-align:center;background:linear-gradient(135deg,#ef4444 0%,#f59e0b 100%);border-radius:16px;box-shadow:0 8px 32px rgba(239,68,68,0.32), inset 0 1px 0 rgba(255,255,255,0.2);font-size:26px;">🔑</div>
        </div>

        <div style="background:linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%);border:1px solid rgba(255,255,255,0.12);border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);">
          <div style="padding:32px 32px 28px 32px;">
            
            <div style="display:inline-block;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.28);border-radius:100px;padding:6px 12px;margin-bottom:20px;">
              <span style="display:inline-block;width:6px;height:6px;background:#ef4444;border-radius:50%;margin-right:6px;vertical-align:middle;box-shadow:0 0 8px #ef4444;"></span>
              <span style="font-size:11px;letter-spacing:0.08em;font-weight:700;color:#fca5a5;text-transform:uppercase;vertical-align:middle;">Security Alert • Password Reset Requested</span>
            </div>

            <h1 style="margin:0 0 6px 0;font-size:26px;line-height:1.3;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Hi ${username},</h1>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#a1a1b5;">We received a request to reset your SecureBallot password. Your reset code is:</p>

            <!-- OTP Vault - Red Alert -->
            <div style="background:linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.35) 100%);border:1px solid rgba(239,68,68,0.28);border-radius:16px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(239,68,68,0.08), 0 8px 32px rgba(0,0,0,0.4);padding:2px;margin-bottom:20px;">
              <div style="background:radial-gradient(600px 200px at 50% 0%, rgba(239,68,68,0.14), transparent);border-radius:14px;padding:22px 20px;text-align:center;">
                <div style="font-size:11px;letter-spacing:0.12em;font-weight:600;color:#9ca3af;text-transform:uppercase;margin-bottom:10px;">RESET CODE</div>
                <div style="font-family:'SF Mono',Monaco,Consolas,monospace;font-size:40px;font-weight:800;letter-spacing:10px;color:#ffffff;line-height:1;text-shadow:0 0 24px rgba(239,68,68,0.45);">${otp}</div>
                <div style="margin-top:14px;display:flex;justify-content:center;gap:6px;">
                  <span style="width:28px;height:3px;background:rgba(239,68,68,0.6);border-radius:100px;display:inline-block;"></span>
                  <span style="width:28px;height:3px;background:rgba(239,68,68,0.6);border-radius:100px;display:inline-block;"></span>
                  <span style="width:28px;height:3px;background:rgba(255,255,255,0.15);border-radius:100px;display:inline-block;"></span>
                </div>
              </div>
            </div>

            <div style="background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.18);border-radius:12px;padding:10px 14px;display:flex;align-items:center;gap:10px;margin-bottom:20px;">
              <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background:rgba(251,191,36,0.15);border-radius:8px;font-size:14px;">⏱</span>
              <span style="font-size:13px;color:#fcd34d;line-height:1.4;"><strong style="color:#fbbf24;">Expires in 10 minutes</strong> — use it now or request a new one.</span>
            </div>

            <!-- Warning -->
            <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.18);border-radius:14px;padding:14px 14px;display:flex;gap:12px;align-items:flex-start;margin-bottom:20px;">
              <span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;background:rgba(239,68,68,0.15);border-radius:10px;font-size:16px;flex-shrink:0;">⚠️</span>
              <div>
                <div style="font-size:13px;font-weight:700;color:#fecaca;margin-bottom:3px;">Didn't request this?</div>
                <div style="font-size:13px;line-height:1.5;color:#d4d4e0;">If you didn't request a password reset, <strong style="color:#fff;">secure your account immediately.</strong> Someone may have access to your email.</div>
              </div>
            </div>

            <div style="height:1px;background:linear-gradient(90deg, rgba(255,255,255,0.08), transparent);margin:0 0 20px 0;"></div>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="width:50%;padding-right:6px;">
                  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:12px 12px;">
                    <div style="font-size:12px;font-weight:600;color:#fff;">🔒 Never share</div>
                    <div style="font-size:11px;color:#8b8ba3;margin-top:2px;line-height:1.4;">We never ask for this code</div>
                  </div>
                </td>
                <td style="width:50%;padding-left:6px;">
                  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:12px 12px;">
                    <div style="font-size:12px;font-weight:600;color:#fff;">🛡️ Stay safe</div>
                    <div style="font-size:11px;color:#8b8ba3;margin-top:2px;line-height:1.4;">Reset from official site only</div>
                  </div>
                </td>
              </tr>
            </table>

          </div>
        </div>

        <div style="text-align:center;margin-top:20px;padding:0 16px;">
          <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">— The SecureBallot Team</p>
          <p style="margin:0;font-size:11px;color:#4b5563;"><a href="#" style="color:#6b7280;text-decoration:none;">Security Center</a> &nbsp;•&nbsp; <a href="#" style="color:#6b7280;text-decoration:none;">Support</a></p>
        </div>

      </div>
    </div>
  </div>
  `);
}

export async function sendAccountRecoveryEmail(payload: OTPEmailPayload) {
  return sendPasswordResetEmail(payload);
}

export default { sendWelcomeEmail, sendOTPEmail, sendPasswordResetEmail, sendAccountRecoveryEmail };