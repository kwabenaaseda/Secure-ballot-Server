import { ENV } from './env_validator';

const BREVO_API_KEY = ENV('BREVO_API_KEY');
const MAIL_FROM = ENV('MAIL_FROM') || ENV('GMAIL_USER');
const MAIL_FROM_NAME = ENV('MAIL_FROM_NAME');
const BREVO_URL = ENV('BREVO_URL');

export async function Brevo_send(to: string, subject: string, html: string) {
  try {
    const response = await fetch(BREVO_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: MAIL_FROM_NAME, email: MAIL_FROM },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(`Brevo API error (${response.status}): ${JSON.stringify(errBody)}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Email send error (${subject}):`, error);
    throw new Error(
      `Failed to send email: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
