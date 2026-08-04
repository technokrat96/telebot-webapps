'use client';

import {useState} from 'react';
import {Empty, Table, Tag, Typography} from 'antd';
import useSWR from 'swr';
import {apiClient} from '@/lib/apiClient';
import {useAuth} from '@/components/common/AuthProvider';
import {Attendance} from '@/types';
import clientDayJs from "@/lib/cleint.dayjs";

const { Title, Paragraph } = Typography;

type AttendanceHistoryResponse = {
  today: Attendance | null;
  history: Attendance[];
  total: number;
};

const fetcher = (url: string) => apiClient.get<AttendanceHistoryResponse>(url);

export default function AbsensiPage() {
  const { name } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading } = useSWR<AttendanceHistoryResponse>(
    `/api/attendance?page=${page}&pageSize=${pageSize}`,
    fetcher,
    { keepPreviousData: true } // biar pas ganti halaman gak flash loading
  );

  const history = data?.history ?? [];

  return (
    <div>
      <Title level={4}>Riwayat Absensi Saya</Title>
      <Paragraph type="secondary">Halo, {name}. Catat kehadiranmu hari ini.</Paragraph>
      <Table
        rowKey="DATE"
        scroll={{ x: true }}
        dataSource={history}
        loading={isLoading}
        pagination={{
          current: page,
          pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (t) => `Total ${t} absensi`,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
          onShowSizeChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
        locale={{ emptyText: <Empty description="Belum ada riwayat absensi" /> }}
        columns={[
          { title: 'Tanggal', dataIndex: 'DATE', render: (v) => clientDayJs(v).format('DD MMM YYYY') },
          { title: 'Masuk', dataIndex: 'CHECK_IN_AT', render: (v) => (v ? clientDayJs(v).format('HH:mm') : '-') },
          { title: 'Pulang', dataIndex: 'CHECK_OUT_AT', render: (v) => (v ? clientDayJs(v).format('HH:mm') : '-') },
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
