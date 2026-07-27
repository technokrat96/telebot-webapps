import {NextRequest, NextResponse} from 'next/server';
import {requireAuth} from '@/lib/auth';
import {updateAllDeliveryStatusForOrder} from '@/lib/db/transaction';
import {getMasterData} from "@/lib/db/masterData";

// PATCH body: { status: ItemStatus }
// Applies the status to every line item of the order at once. Used by:
// - Florist: "Update Transaction to Done" -> READY_TO_PICKUP
// - Kurir: ON_DELIVERY | DELIVERED | RECEIVED | RETURNED
// Next.js 15+: dynamic route `params` is now a Promise and must be awaited.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, ['FLORIST', 'KURIR', 'ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const {DELIVERY_STATUSES} = await getMasterData();

  const { id } = await params;
  const {deliveryStatus} = await req.json();
  if (!DELIVERY_STATUSES.includes(deliveryStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  await updateAllDeliveryStatusForOrder(id, deliveryStatus);
  return NextResponse.json({ ok: true });
}
