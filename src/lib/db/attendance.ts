import "server-only";
import { prisma } from "@/lib/prismaClient";
import { Attendance } from "@/types";
import { AttendanceModel } from "@/generated/prisma/models/Attendance";
import serverDayJs from "@/lib/server.dayjs";

function toAttendance(row: AttendanceModel): Attendance {
  return {
    USERNAME: row.username,
    NAME: row.name,
    DATE: serverDayJs(row.date).format("YYYY-MM-DD"),
    CHECK_IN_AT: row.checkInAt
      ? serverDayJs(row.checkInAt).format("YYYY-MM-DD HH:mm:ss")
      : "",
    CHECK_OUT_AT: row.checkOutAt
      ? serverDayJs(row.checkOutAt).format("YYYY-MM-DD HH:mm:ss")
      : "",
  };
}

// Disimpan sebagai tanggal (tanpa jam) berdasarkan waktu server. Kalau
// server production TZ-nya bukan Asia/Jakarta, set env TZ=Asia/Jakarta
// supaya "hari ini" konsisten dengan jam toko.
function todayDateOnly(): Date {
  return serverDayJs(serverDayJs().format("YYYY-MM-DD")).toDate();
}

export async function getTodayAttendance(
  username: string,
): Promise<Attendance | null> {
  const row = await prisma.attendance.findUnique({
    where: { username_date: { username, date: todayDateOnly() } },
  });
  return row ? toAttendance(row) : null;
}

export async function checkIn(
  username: string,
  name: string,
): Promise<Attendance> {
  const date = todayDateOnly();
  const existing = await prisma.attendance.findUnique({
    where: { username_date: { username, date } },
  });
  if (existing?.checkInAt) {
    throw new Error("Kamu sudah check-in hari ini.");
  }

  const row = existing
    ? await prisma.attendance.update({
        where: { username_date: { username, date } },
        data: { checkInAt: new Date(), name },
      })
    : await prisma.attendance.create({
        data: { username, name, date, checkInAt: new Date() },
      });

  return toAttendance(row);
}

export async function checkOut(username: string): Promise<Attendance> {
  const date = todayDateOnly();
  const existing = await prisma.attendance.findUnique({
    where: { username_date: { username, date } },
  });
  if (!existing?.checkInAt) {
    throw new Error("Kamu belum check-in hari ini.");
  }
  if (existing.checkOutAt) {
    throw new Error("Kamu sudah check-out hari ini.");
  }

  const row = await prisma.attendance.update({
    where: { username_date: { username, date } },
    data: { checkOutAt: new Date() },
  });
  return toAttendance(row);
}

export async function listMyAttendance(
  username: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<{ attendance: Attendance[]; total: number }> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 10)); // cap 100 biar gak disalahgunakan

  const [rows, total] = await Promise.all([
    prisma.attendance.findMany({
      where: { username },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.attendance.count({ where: { username } }),
  ]);

  return { attendance: rows.map(toAttendance), total };
}

export async function listAllAttendance(
  options: {
    from?: string; // 'YYYY-MM-DD'
    to?: string;
    username?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{ attendance: Attendance[]; total: number }> {
  const from = options.from
    ? serverDayJs(options.from).toDate()
    : serverDayJs().startOf("month").toDate();
  const to = options.to
    ? serverDayJs(options.to).toDate()
    : serverDayJs().endOf("month").toDate();
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 10));

  const where = {
    date: { gte: from, lte: to },
    ...(options.username ? { username: options.username } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      orderBy: [{ date: "desc" }, { username: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.attendance.count({ where }),
  ]);

  return { attendance: rows.map(toAttendance), total };
}
