// ─── SMS SERVICE ──────────────────────────────────────
// Provider: ArkeselSMS (Ghana)
// Status: API key pending — will be activated when Arkesel 
//         captcha issue is resolved

const ARKESEL_API_KEY = process.env.ARKESEL_API_KEY || '';
const ARKESEL_SENDER_ID = process.env.ARKESEL_SENDER_ID || 'SecureBall';
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
};