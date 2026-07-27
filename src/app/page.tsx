'use client';

import {App, Button, Card, Col, Row, Space, Tag, Typography} from 'antd';
import {
  CarOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  LoginOutlined,
  LogoutOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import {useRouter} from 'next/navigation';
import {useTelegramAuth} from '@/components/common/TelegramProvider';
import {useAttendanceGate} from "@/components/common/AttendanceGate";
import clientDayJs from "@/lib/cleint.dayjs";

const { Title, Paragraph, Text } = Typography;


export default function HomePage() {
  const { name, roles } = useTelegramAuth();
  const { message } = App.useApp();
  const router = useRouter();
  const { checkedIn, checkedOut, handleCheckOut, handleCheckIn, attendanceData, loading, busy} = useAttendanceGate();


  const shortcuts: Record<
    string,
    { title: string; desc: string; icon: React.ReactNode; path: string }[]
  > = {
    ADMIN: [
      {
        title: 'Transaksi',
        desc: 'Lihat, buat, dan ubah transaksi pelanggan',
        icon: <ShoppingOutlined style={{ fontSize: 28 }} />,
        path: '/admin/transaction',
      },
      {
        title: 'Invoice',
        desc: 'Lihat dan buat invoice dari transaksi',
        icon: <FileTextOutlined style={{ fontSize: 28 }} />,
        path: '/admin/invoice',
      },
    ],
    FLORIST: [
      {
        title: 'Pekerjaan Florist',
        desc: 'Kerjakan item bunga & update status pesanan',
        icon: <ShoppingOutlined style={{ fontSize: 28 }} />,
        path: '/florist',
      },
    ],
    KURIR: [
      {
        title: 'Pengiriman',
        desc: 'Lihat pesanan siap kirim & update status antar',
        icon: <CarOutlined style={{ fontSize: 28 }} />,
        path: '/kurir',
      },
    ],
  };

  const cards = roles.flatMap((r) => shortcuts[r] ?? []);

  return (
    <div>
      <Title level={3}>Halo, {name} 👋</Title>
      <Paragraph type="secondary">
        Selamat datang di aplikasi manajemen toko bunga. Pilih menu di bawah untuk mulai.
      </Paragraph>
      <Paragraph type="secondary">Halo, {name}. Catat kehadiranmu hari ini.</Paragraph>
      <Card loading={loading} style={{ marginBottom: 16 }}>
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Text strong>{clientDayJs().format('dddd, D MMMM YYYY')}</Text>

          <Space wrap>
            <Tag icon={<ClockCircleOutlined />} color={checkedIn ? 'green' : 'default'}>
              Masuk: {(checkedIn && attendanceData) ? clientDayJs(attendanceData!.CHECK_IN_AT).format('HH:mm') : '-'}
            </Tag>
            <Tag icon={<ClockCircleOutlined />} color={checkedOut ? 'blue' : 'default'}>
              Pulang: {(checkedOut && attendanceData) ? clientDayJs(attendanceData!.CHECK_OUT_AT).format('HH:mm') : '-'}
            </Tag>
          </Space>

          <Space wrap>
            <Button
              type="primary"
              icon={<LoginOutlined />}
              disabled={checkedIn}
              loading={busy}
              onClick={handleCheckIn}
            >
              Check-in
            </Button>
            <Button
              danger
              icon={<LogoutOutlined />}
              disabled={!checkedIn || checkedOut}
              loading={busy}
              onClick={handleCheckOut}
            >
              Check-out
            </Button>
          </Space>
        </Space>
      </Card>
      {
        (checkedIn && !checkedOut) && (
          <Row gutter={[16, 16]}>
            {cards.map((c) => (
              <Col xs={24} sm={12} key={c.path}>
                <Card hoverable onClick={() => router.push(c.path)}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    {c.icon}
                    <div>
                      <Title level={5} style={{ margin: 0 }}>
                        {c.title}
                      </Title>
                      <Paragraph type="secondary" style={{ margin: 0 }}>
                        {c.desc}
                      </Paragraph>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )
      }
    </div>
  );
}
