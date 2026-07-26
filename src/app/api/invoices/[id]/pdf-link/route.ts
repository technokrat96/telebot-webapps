import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { generatePdfToken } from '@/lib/pdfToken';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const token = generatePdfToken(id);
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/invoices/${id}/pdf?token=${token}`;

  return NextResponse.json({ url });
}