import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getInvoicePdfData } from '@/lib/db/invoice';
import { generateInvoicePdf } from '@/lib/pdf/invoicePdf';
import { sendTelegramDocument } from '@/lib/telegramBot';
import { getTelegramIdByUsername } from '@/lib/db/users';

// Next.js 15+: dynamic route `params` is now a Promise and must be awaited.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const telegramId = auth.TELEGRAM_ID;

  const data = await getInvoicePdfData(id);
  if (!data) return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 });

  const pdfBuffer = await generateInvoicePdf(data);
  const filename = `${data.INVOICE_NUMBER || data.INVOICE_ID}.pdf`;

  try {
    await sendTelegramDocument(
      telegramId,
      pdfBuffer,
      filename,
      `Invoice ${data.INVOICE_NUMBER || data.INVOICE_ID} — Total: Rp ${data.TOTAL_AMOUNT.toLocaleString('id-ID')}`
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}