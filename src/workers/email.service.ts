import { Resend } from 'resend';
import { ENV } from './env_validater';

const resend = new Resend(ENV("RESEND_API_KEY"));
const MAIL_FROM = ENV("MAIL_FROM") || 'onboarding@resend.dev';

// ─── TYPES ───────────────────────────────────────────
interface WelcomeEmailPayload {
  to: string;
  username: string;
}

interface OTPEmailPayload {
  to: string;
  username: string;
  otp: string;
}

// ─── SEND WELCOME + VALIDATION EMAIL ─────────────────
export async function sendWelcomeEmail(payload: WelcomeEmailPayload) {
  const { to, username } = payload;

  const { data, error } = await resend.emails.send({
    from: MAIL_FROM,
    to,
    subject: 'Welcome to SecureBallot 🗳️',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to SecureBallot, ${username}!</h2>
        <p>Your account has been created successfully.</p>
        <p>SecureBallot is a secure, anonymous voting platform. 
           Your votes are private by design — no one can link 
           your identity to your choices.</p>
        <p>Get started by joining an organization or creating your own.</p>
        <br/>
        <p>— The SecureBallot Team</p>
      </div>
    `,
  });

  if (error) {
    console.error('Welcome email error:', error);
    throw new Error(`Failed to send welcome email: ${error.message}`);
  }

  return data;
}

// ─── SEND OTP EMAIL ───────────────────────────────────
export async function sendOTPEmail(payload: OTPEmailPayload) {
  const { to, username, otp } = payload;

  const { data, error } = await resend.emails.send({
    from: MAIL_FROM,
    to,
    subject: 'Your SecureBallot Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hi ${username},</h2>
        <p>Your verification code is:</p>
        <div style="
          font-size: 36px; 
          font-weight: bold; 
          letter-spacing: 8px;
          color: #1a1a2e;
          background: #f4f4f4;
          padding: 20px;
          text-align: center;
          border-radius: 8px;
          margin: 20px 0;
        ">
          ${otp}
        </div>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p>If you didn't request this, ignore this email.</p>
        <br/>
        <p>— The SecureBallot Team</p>
      </div>
    `,
  });

  if (error) {
    console.error('OTP email error:', error);
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }

  return data;
}

// ─── SEND PASSWORD RESET EMAIL ────────────────────────
export async function sendPasswordResetEmail(payload: OTPEmailPayload) {
  const { to, username, otp } = payload;

  const { data, error } = await resend.emails.send({
    from: MAIL_FROM,
    to,
    subject: 'SecureBallot Password Reset',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hi ${username},</h2>
        <p>You requested a password reset. Your code is:</p>
        <div style="
          font-size: 36px;
          font-weight: bold;
          letter-spacing: 8px;
          color: #1a1a2e;
          background: #f4f4f4;
          padding: 20px;
          text-align: center;
          border-radius: 8px;
          margin: 20px 0;
        ">
          ${otp}
        </div>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p>If you didn't request this, secure your account immediately.</p>
        <br/>
        <p>— The SecureBallot Team</p>
      </div>
    `,
  });

  if (error) {
    console.error('Password reset email error:', error);
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }

  return data;
}

export default {
  sendWelcomeEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
};