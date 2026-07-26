import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getInvoicePdfData } from '@/lib/db/invoice';
import { generateInvoicePdf } from '@/lib/pdf/invoicePdf';

// Next.js 15+: dynamic route `params` is now a Promise and must be awaited.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const data = await getInvoicePdfData(id);
  if (!data) return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 });

  const pdfBuffer = await generateInvoicePdf(data);
  const responseBody = new Uint8Array(pdfBuffer);

  return new NextResponse(responseBody, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${data.INVOICE_NUMBER || data.INVOICE_ID}.pdf"`,
      'Content-Length': String(pdfBuffer.byteLength),
    },
  });
}