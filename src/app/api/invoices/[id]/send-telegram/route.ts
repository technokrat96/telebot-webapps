import {NextRequest, NextResponse} from 'next/server';
import {requireAuth} from '@/lib/auth';
import {getInvoicePdfData} from '@/lib/db/invoice';
import {generateInvoicePdf} from '@/lib/pdf/invoicePdf';
import telegramBot from '@/lib/telegramBot';
import {InputFile} from "grammy";
import {getTelegramIdByUsername} from "@/lib/db/users";

// Next.js 15+: dynamic route `params` is now a Promise and must be awaited.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { username } = (await req.json()) as { username?: string };

  if (!username) {
    return NextResponse.json({ error: 'Pilih tujuan pengiriman dulu' }, { status: 400 });
  }

  const targetUser = await getTelegramIdByUsername(username);

  if (!targetUser) {
    return NextResponse.json({ error: 'User is not found' }, { status: 400 });
  }

  const telegramId = targetUser?.telegramId ?? targetUser?.chatId ?? auth.TELEGRAM_ID;

  const data = await getInvoicePdfData(id);
  if (!data) return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 });

  const pdfBuffer = await generateInvoicePdf(data);
  const filename = `${data.INVOICE_NUMBER || data.INVOICE_ID}.pdf`;

  try {
    await telegramBot.api.sendDocument(
      telegramId,
      new InputFile(new Uint8Array(pdfBuffer), filename),
      {
        caption: `Invoice ${data.INVOICE_NUMBER || data.INVOICE_ID} — Total: Rp ${data.TOTAL_AMOUNT.toLocaleString('id-ID')}`,
      },
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}