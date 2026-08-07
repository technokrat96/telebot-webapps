import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkIn } from "@/lib/db/attendance";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const attendance = await checkIn(auth.TELEGRAM_USER, auth.USER.NAME);
    return NextResponse.json({ attendance });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 409 },
    );
  }
}
