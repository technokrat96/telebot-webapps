import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getInvoicePdfData } from '@/lib/db/invoice';
import { generateInvoicePdf } from '@/lib/pdf/invoicePdf';
import { verifyPdfToken } from '@/lib/pdfToken';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  // Dibuka via openLink() Telegram (gak ada header custom) -> pakai signed token.
  // Dipanggil internal via apiClient (ada header) -> pakai auth biasa.
  const authorizedByToken = token ? verifyPdfToken(token, id) : false;
  if (!authorizedByToken) {
    const auth = await requireAuth(req, ['ADMIN']);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await getInvoicePdfData(id);
  if (!data) return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 });

  const pdfBuffer = await generateInvoicePdf(data);
  const responseBody = new Uint8Array(pdfBuffer);

  return new NextResponse(responseBody, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${data.INVOICE_NUMBER || data.INVOICE_ID}.pdf"`,
      'Content-Length': String(pdfBuffer.byteLength),
    },
  });
}