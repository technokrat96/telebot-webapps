'use client';

import { Card, Col, Row, Typography } from 'antd';
import {
  ShoppingOutlined,
  FileTextOutlined,
  CarOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useTelegramAuth } from '@/components/common/TelegramProvider';

const { Title, Paragraph } = Typography;

export default function HomePage() {
  const { name, roles } = useTelegramAuth();
  const router = useRouter();

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
    </div>
  );
}
