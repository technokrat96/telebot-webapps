import 'server-only';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function sendTelegramDocument(
  chatId: string,
  fileBuffer: Buffer,
  filename: string,
  caption?: string
): Promise<void> {
  if (!BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN env var');

  const form = new FormData();
  form.append('chat_id', chatId);
  if (caption) form.append('caption', caption);
  form.append('document', new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' }), filename);

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
    method: 'POST',
    body: form,
  });

  const data = await res.json();
  if (!data.ok) {
    // Error paling umum: "Forbidden: bot can't initiate conversation with a user"
    // -> artinya user itu belum pernah /start bot-nya.
    throw new Error(data.description ?? 'Gagal mengirim dokumen ke Telegram');
  }
}