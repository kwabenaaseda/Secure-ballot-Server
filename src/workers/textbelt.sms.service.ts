export async function sendOTPSMS_TextBelt(phone: string, message: string): Promise<void> {
    try {
        const response = await fetch('https://textbelt.com/text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone,
                message,
                key: 'textbelt', // Use your API key here
            }),
        });

        const data = await response.json();
        if (!data.success) {
            throw new Error(`Failed to send SMS: ${data.error}`);
        }
    } catch (error) {
        console.error(`Error sending SMS`);
        throw error; // Re-throw the error after logging
    }
}