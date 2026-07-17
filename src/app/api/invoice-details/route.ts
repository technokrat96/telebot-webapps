import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listTransactionsWithDetails } from '@/lib/sheets/transaction';
import { listInvoiceDetails } from '@/lib/sheets/invoice';

// Returns transaction line items that aren't fully billed yet, grouped by
// order, so the "Create Invoice" form can let the admin pick which items
// to put on a new invoice.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [orders, invoiceDetails] = await Promise.all([
    listTransactionsWithDetails(),
    listInvoiceDetails(),
  ]);

  const billedItemIds = new Set(invoiceDetails.map((d) => d.ORDER_ITEM_ID));

  const billable = orders
    .map((order) => ({
      ...order,
      details: order.details.filter(
        (d) => !billedItemIds.has(d.ORDER_ITEM_ID)
      ),
    }))
    .filter((order) => order.details.length > 0);

  return NextResponse.json({ orders: billable });
}
