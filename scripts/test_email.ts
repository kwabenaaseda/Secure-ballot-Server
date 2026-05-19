// scripts/test_email.ts
import { sendWelcomeEmail } from '../src/workers/email.service';

async function test() {
  try {
    const result = await sendWelcomeEmail({
      to: 'mr.mensahgibson@gmail.com',  // ← Change this
      username: 'Aseda',
    });
    console.log('✅ Email sent:', result);
  } catch (error) {
    console.error('❌ Email failed:', error);
  }
}

test();