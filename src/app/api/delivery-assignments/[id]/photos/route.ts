import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { addProofImages } from "@/lib/db/deliveryDriverAssignment";

// POST body: { imageUrls: string[] }
// Tambah foto bukti kirim ke satu assignment (harus milik kurir yang login).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req, ["KURIR", "ADMIN"]);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { imageUrls } = await req.json();
  const ok = await addProofImages(
    id,
    auth.TELEGRAM_USER,
    Array.isArray(imageUrls) ? imageUrls : [],
  );
  if (!ok)
    return NextResponse.json(
      { error: "Assignment tidak ditemukan / bukan milik kamu" },
      { status: 404 },
    );
  return NextResponse.json({ ok: true });
}
