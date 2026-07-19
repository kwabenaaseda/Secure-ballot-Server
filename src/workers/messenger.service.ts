/* // ─── SMS SERVICE ──────────────────────────────────────
// Provider: ArkeselSMS (Ghana)
// Status: API key pending — will be activated when Arkesel 
//         captcha issue is resolved

import { ENV } from "./env_validater";

const ARKESEL_API_KEY = ENV("ARKESEL_API_KEY") || '';
const ARKESEL_SENDER_ID = ENV("ARKESEL_SENDER_ID") || 'SecureBall';
const ARKESEL_BASE_URL = 'https://sms.arkesel.com/api/v2/sms/send';

interface SMSPayload {
  to: string;    // Format: 233XXXXXXXXX (Ghana)
  message: string;
}

export async function sendSMS(payload: SMSPayload): Promise<boolean> {
  const { to, message } = payload;

  if (!ARKESEL_API_KEY) {
    console.warn('⚠️  ARKESEL_API_KEY not set. SMS not sent.');
    console.log(`[SMS MOCK] To: ${to} | Message: ${message}`);
    return true; // Don't fail signup because SMS is not configured yet
  }

  try {
    const response = await fetch(ARKESEL_BASE_URL, {
      method: 'POST',
      headers: {
        'api-key': ARKESEL_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: ARKESEL_SENDER_ID,
        message,
        recipients: [to],
      }),
    });

    const data = await response.json() as { status: string; message: string };

    if (data.status !== 'success') {
      console.error('SMS error:', data.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('SMS send error:', error);
    return false;
  }
}

export async function sendOTPSMS(to: string, otp: string): Promise<boolean> {
  return sendSMS({
    to,
    message: `Your SecureBallot verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
  });
}

export default {
  sendSMS,
  sendOTPSMS,
}; */

// ─── MESSENGER SERVICE ────────────────────────────────
// Provider: Vonage (SMS + WhatsApp)
// SMS:      live via @vonage/server-sdk basic auth (API key + secret)
// WhatsApp: scaffolded via @vonage/messages — requires a Vonage
//           Application (applicationId + private.key) before it
//           can send for real. Falls back to mock log until then.

import { Vonage } from "@vonage/server-sdk";
import { Channels, WhatsAppText } from "@vonage/messages";
import { ENV } from "./env_validator";

// ── SMS CLIENT (basic auth: api key + secret) ──────────
const VONAGE_API_KEY = ENV("VONAGE_API_KEY") || '';
const VONAGE_API_SECRET = ENV("VONAGE_API_SECRET") || '';
const VONAGE_BRAND_NAME = ENV("VONAGE_BRAND_NAME") || 'SecureBallot';

const smsClient = new Vonage({
  apiKey: VONAGE_API_KEY,
  apiSecret: VONAGE_API_SECRET,
});

// ── WHATSAPP CLIENT (JWT auth: application id + private key) ──
// Set VONAGE_WHATSAPP_ENABLED=true only once you have created a
// Vonage Application and downloaded its private.key file.
const VONAGE_WHATSAPP_ENABLED = ENV("VONAGE_WHATSAPP_ENABLED") === 'true';
const VONAGE_APPLICATION_ID = ENV("VONAGE_APPLICATION_ID") || '';
const VONAGE_PRIVATE_KEY_PATH = ENV("VONAGE_PRIVATE_KEY_PATH") || './private.key';
const VONAGE_WHATSAPP_NUMBER = ENV("VONAGE_WHATSAPP_NUMBER") || '14157386102'; // sandbox default
const VONAGE_MESSAGES_API_HOST = ENV("VONAGE_MESSAGES_API_HOST") || 'https://messages-sandbox.nexmo.com';

let whatsappClient: Vonage | null = null;
if (VONAGE_WHATSAPP_ENABLED && VONAGE_APPLICATION_ID) {
  whatsappClient = new Vonage(
    {
      applicationId: VONAGE_APPLICATION_ID,
      privateKey: VONAGE_PRIVATE_KEY_PATH,
    },
    {
      apiHost: VONAGE_MESSAGES_API_HOST,
    }
  );
}

interface SMSPayload {
  to: string;      // Format: 233XXXXXXXXX (Ghana) — no leading + or 00
  message: string;
}

interface WhatsAppPayload {
  to: string;
  message: string;
}

// ── SMS ─────────────────────────────────────────────────
export async function sendSMS(payload: SMSPayload): Promise<boolean> {
  const { to, message } = payload;

  if (!VONAGE_API_KEY || !VONAGE_API_SECRET) {
    console.warn('⚠️  VONAGE_API_KEY / VONAGE_API_SECRET not set. SMS not sent.');
    console.log(`[SMS MOCK] To: ${to} | Message: ${message}`);
    return true; // Don't fail signup because SMS is not configured yet
  }

  try {
    const resp = await smsClient.sms.send({
      to,
      from: VONAGE_BRAND_NAME,
      text: message,
    });

    const result = resp.messages?.[0];

    if (!result || result.status !== '0') {
      console.error('SMS error:', result?.errorText ?? 'Unknown error');
      return false;
    }

    return true;
  } catch (error) {
    console.error('SMS send error:', error);
    return false;
  }
}

export async function sendOTPSMS(to: string, otp: string): Promise<boolean> {
  return sendSMS({
    to,
    message: `Your SecureBallot verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
  });
}

// ── WHATSAPP ────────────────────────────────────────────
export async function sendWhatsApp(payload: WhatsAppPayload): Promise<boolean> {
  const { to, message } = payload;

  if (!whatsappClient) {
    console.warn('⚠️  WhatsApp not configured (VONAGE_WHATSAPP_ENABLED is false or app id missing).');
    console.log(`[WHATSAPP MOCK] To: ${to} | Message: ${message}`);
    return true;
  }

  try {
    await whatsappClient.messages.send(
      new WhatsAppText({
        to,
        from: VONAGE_WHATSAPP_NUMBER,
        text: message,
      })
    );
    return true;
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return false;
  }
}

export async function sendOTPWhatsApp(to: string, otp: string): Promise<boolean> {
  return sendWhatsApp({
    to,
    message: `Your SecureBallot verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
  });
}

export default {
  sendSMS,
  sendOTPSMS,
  sendWhatsApp,
  sendOTPWhatsApp,
};