import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { advanceAssignmentDeliveryStatus } from "@/lib/db/deliveryDriverAssignment";
import { getMasterData } from "@/lib/db/masterData";

// PATCH body: { deliveryStatus: string, imageUrls: string[] }
// Majukan status delivery satu assignment (harus milik kurir yang login).
// Foto bukti (imageUrls) WAJIB diisi tepat 1 di setiap perubahan status.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req, ["KURIR", "ADMIN"]);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { DELIVERY_STATUSES } = await getMasterData();
  const { id } = await params;
  const { deliveryStatus, imageUrls } = await req.json();

  if (!DELIVERY_STATUSES.includes(deliveryStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (!Array.isArray(imageUrls) || imageUrls.length !== 1) {
    return NextResponse.json(
      { error: "Wajib upload tepat 1 foto bukti sebelum ganti status" },
      { status: 400 },
    );
  }

  try {
    const ok = await advanceAssignmentDeliveryStatus(
      id,
      auth.TELEGRAM_USER,
      deliveryStatus,
      imageUrls,
    );
    if (!ok)
      return NextResponse.json(
        { error: "Assignment tidak ditemukan / bukan milik kamu" },
        { status: 404 },
      );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 },
    );
  }
}
