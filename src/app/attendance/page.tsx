'use client';

import {Empty, Table, Tag, Typography} from 'antd';
import useSWR from 'swr';
import dayjs from 'dayjs';
import {apiClient} from '@/lib/apiClient';
import {useTelegramAuth} from '@/components/common/TelegramProvider';
import {Attendance} from '@/types';

const { Title, Text, Paragraph } = Typography;

const fetcher = (url: string) =>
  apiClient.get<{ today: Attendance | null; history: Attendance[] }>(url);

export default function AbsensiPage() {
  const { name } = useTelegramAuth();
  const { data, mutate, isLoading } = useSWR('/api/attendance', fetcher);

  const history = data?.history ?? [];

  return (
    <div>
      <Title level={4}>Riwayat Absensi Saya</Title>
      <Paragraph type="secondary">Halo, {name}. Catat kehadiranmu hari ini.</Paragraph>
      <Table
        rowKey="DATE"
        dataSource={history}
        loading={isLoading}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="Belum ada riwayat absensi" /> }}
        columns={[
          { title: 'Tanggal', dataIndex: 'DATE', render: (v) => dayjs(v).format('DD MMM YYYY') },
          { title: 'Masuk', dataIndex: 'CHECK_IN_AT', render: (v) => (v ? dayjs(v).format('HH:mm') : '-') },
          { title: 'Pulang', dataIndex: 'CHECK_OUT_AT', render: (v) => (v ? dayjs(v).format('HH:mm') : '-') },
          {
            title: 'Status',
            key: 'status',
            render: (_, r) => {
              if (r.CHECK_IN_AT && r.CHECK_OUT_AT) return <Tag color="green">Lengkap</Tag>;
              if (r.CHECK_IN_AT) return <Tag color="gold">Belum Pulang</Tag>;
              return <Tag>-</Tag>;
            },
          },
        ]}
      />
    </div>
  );
}