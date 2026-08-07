'use client';

import {createContext, useContext, useEffect, useState} from 'react';
import {App} from 'antd';
import {apiClient} from '@/lib/apiClient';
import {Attendance} from '@/types';
import clientDayJs from "@/lib/cleint.dayjs";

interface AttendanceGateContextValue {
  attendanceData: Attendance | null;
  checkedIn: boolean;
  checkedOut: boolean;
  loading: boolean;
  busy: boolean;
  handleCheckIn: () => Promise<void>;
  handleCheckOut: () => Promise<void>;
}

const AttendanceGateContext = createContext<AttendanceGateContextValue | null>(null);

export function useAttendanceGate() {
  const ctx = useContext(AttendanceGateContext);
  if (!ctx) {
    throw new Error('useAttendanceGate must be used inside AttendanceGate');
  }
  return ctx;
}

// Dev-mode selalu anggap sudah check-in dengan data statis — dihitung sekali
// di luar komponen (bukan lewat effect) supaya bisa langsung jadi nilai
// awal useState, tidak perlu setState sinkron pas mount.
const isDev = process.env.NODE_ENV !== 'production';
const DEV_ATTENDANCE: Attendance = {
  USERNAME: 'Dev',
  NAME: 'Dev',
  CHECK_IN_AT: '00:00',
  CHECK_OUT_AT: null,
  DATE: clientDayJs().format('YYYY-MM-DD'),
};

export default function AttendanceGate({ children }: { children: React.ReactNode }) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(!isDev);
  const [attendanceData, setAttendanceData] = useState<Attendance | null>(isDev ? DEV_ATTENDANCE : null);
  const [checkedIn, setCheckedIn] = useState(isDev);
  const [checkedOut, setCheckedOut] = useState(false);
  const [busy, setBusy] = useState(false);

  // Dipakai dari event handler (handleCheckIn/handleCheckOut) — aman pakai
  // async/await biasa karena bukan dipanggil langsung dari body useEffect.
  async function fetchAttendance() {
    if (isDev) return;
    try {
      const res = await apiClient.get<{ today: Attendance | null }>('/api/attendance');
      setCheckedIn(!!res.today?.CHECK_IN_AT);
      setCheckedOut(!!res.today?.CHECK_OUT_AT);
      setAttendanceData(res.today);
    } catch (err) {
      // Kalau API gagal (mis. server error), jangan sampai USER terkunci
      // total tanpa penjelasan — kasih tahu, tapi tetap anggap belum absen.
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Versi untuk reload manual (dipanggil dari event handler, bukan effect),
  // jadi aman untuk setLoading(true) di awal.
  async function reloadAttendance() {
    if (isDev) return;
    setLoading(true);
    await fetchAttendance();
  }

  useEffect(() => {
    if (isDev) return;
    // Ditulis inline pakai .then()/.catch()/.finally() (bukan panggil
    // `fetchAttendance` langsung) — react-hooks/set-state-in-effect tetap
    // menganggap panggilan langsung ke fungsi lokal yang isinya setState
    // sebagai "sinkron", walau fungsi itu async/pakai await. setState di
    // dalam callback .then() inline begini baru dianggap aman.
    apiClient
      .get<{ today: Attendance | null }>('/api/attendance')
      .then((res) => {
        setCheckedIn(!!res.today?.CHECK_IN_AT);
        setCheckedOut(!!res.today?.CHECK_OUT_AT);
        setAttendanceData(res.today);
      })
      .catch((err) => {
        message.error((err as Error).message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function handleCheckIn() {
    setBusy(true);
    try {
      await apiClient.post('/api/attendance/check-in', {});
      message.success('Check-in berhasil, selamat bekerja!');
      setCheckedIn(true);
      await reloadAttendance();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckOut() {
    setBusy(true);
    try {
      await apiClient.patch('/api/attendance/check-out', {});
      message.success('Check-out berhasil');
      setCheckedOut(true)
      await reloadAttendance();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AttendanceGateContext.Provider value={{ checkedIn, checkedOut, handleCheckIn, handleCheckOut, attendanceData, loading, busy }}>
      {children}
    </AttendanceGateContext.Provider>
  );
}

/*

{loading && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
          }}
        >
          <Spin size="large" />
        </div>
      )}
      {!checkedIn ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            padding: 24,
          }}
        >
          <Card style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
            <ClockCircleOutlined style={{ fontSize: 48, color: '#d6336c', marginBottom: 16 }} />
            <Title level={4} style={{ marginTop: 0 }}>
              Absen dulu, yuk!
            </Title>
            <Paragraph type="secondary">
              Halo {name}, kamu belum absen hari ini ({clientDayJs().format('dddd, D MMMM YYYY')}).
              Silakan check-in dulu untuk lanjut ke aplikasi.
            </Paragraph>
            <Button
              type="primary"
              size="large"
              icon={<LoginOutlined />}
              loading={busy}
              onClick={handleCheckIn}
              block
            >
              Check-in Sekarang
            </Button>
          </Card>
        </div>
      ) : (children)}

*/