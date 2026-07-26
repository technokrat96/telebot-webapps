import 'server-only';
import { prisma } from '@/lib/prismaClient';
import { Attendance } from '@/types';
import dayjs from 'dayjs';
import {AttendanceModel} from "@/generated/prisma/models/Attendance";

function toAttendance(row: AttendanceModel): Attendance {
  return {
    USERNAME: row.username,
    NAME: row.name,
    DATE: dayjs(row.date).format('YYYY-MM-DD'),
    CHECK_IN_AT: row.checkInAt ? dayjs(row.checkInAt).format("YYYY-MM-DD HH:mm:ss") : "",
    CHECK_OUT_AT: row.checkOutAt ? dayjs(row.checkOutAt).format("YYYY-MM-DD HH:mm:ss") : "",
  };
}

// Disimpan sebagai tanggal (tanpa jam) berdasarkan waktu server. Kalau
// server production TZ-nya bukan Asia/Jakarta, set env TZ=Asia/Jakarta
// supaya "hari ini" konsisten dengan jam toko.
function todayDateOnly(): Date {
  return dayjs(dayjs().format('YYYY-MM-DD')).toDate();
}

export async function getTodayAttendance(username: string): Promise<Attendance | null> {
  const row = await prisma.attendance.findUnique({
    where: { username_date: { username, date: todayDateOnly() } },
  });
  return row ? toAttendance(row) : null;
}

export async function checkIn(username: string, name: string): Promise<Attendance> {
  const date = todayDateOnly();
  const existing = await prisma.attendance.findUnique({
    where: { username_date: { username, date } },
  });
  if (existing?.checkInAt) {
    throw new Error('Kamu sudah check-in hari ini.');
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
    throw new Error('Kamu belum check-in hari ini.');
  }
  if (existing.checkOutAt) {
    throw new Error('Kamu sudah check-out hari ini.');
  }

  const row = await prisma.attendance.update({
    where: { username_date: { username, date } },
    data: { checkOutAt: new Date() },
  });
  return toAttendance(row);
}

export async function listMyAttendance(username: string, limit = 30): Promise<Attendance[]> {
  const rows = await prisma.attendance.findMany({
    where: { username },
    orderBy: { date: 'desc' },
    take: limit,
  });
  return rows.map(toAttendance);
}

export async function listAllAttendance(options: {
  from?: string; // 'YYYY-MM-DD'
  to?: string;
  username?: string;
} = {}): Promise<Attendance[]> {
  const from = options.from ? dayjs(options.from).toDate() : dayjs().startOf('month').toDate();
  const to = options.to ? dayjs(options.to).toDate() : dayjs().endOf('month').toDate();

  const rows = await prisma.attendance.findMany({
    where: {
      date: { gte: from, lte: to },
      ...(options.username ? { username: options.username } : {}),
    },
    orderBy: [{ date: 'desc' }, { username: 'asc' }],
  });
  return rows.map(toAttendance);
}