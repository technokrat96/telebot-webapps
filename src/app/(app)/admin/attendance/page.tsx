"use client";

import { useState } from "react";
import {
  Card,
  DatePicker,
  Table,
  Tag,
  Typography,
  Input,
  Space,
  App,
} from "antd";
import useSWR from "swr";
import RoleGuard from "@/components/common/RoleGuard";
import { apiClient } from "@/lib/apiClient";
import { Attendance } from "@/types";
import clientDayJs from "@/lib/cleint.dayjs";
import { Dayjs } from "dayjs";

const { Title, Paragraph } = Typography;
const { RangePicker } = DatePicker;

type AttendanceAllResponse = { attendance: Attendance[]; total: number };

const fetcher = (url: string) => apiClient.get<AttendanceAllResponse>(url);

export default function AdminAbsensiPage() {
  return (
    <RoleGuard allow={["ADMIN"]}>
      <AdminAbsensiContent />
    </RoleGuard>
  );
}

function AdminAbsensiContent() {
  const { message } = App.useApp();
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    clientDayJs().startOf("month"),
    clientDayJs().endOf("month"),
  ]);
  const [username, setUsername] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const from = range[0].format("YYYY-MM-DD");
  const to = range[1].format("YYYY-MM-DD");

  const { data, isLoading, error } = useSWR<AttendanceAllResponse>(
    `/api/attendance/all?from=${from}&to=${to}${username ? `&username=${encodeURIComponent(username)}` : ""}&page=${page}&pageSize=${pageSize}`,
    fetcher,
    { keepPreviousData: true }, // biar pas ganti halaman/filter gak flash loading
  );

  if (error) message.error(error.message);

  return (
    <div>
      <Title level={3}>Rekap Absensi</Title>
      <Paragraph type="secondary">
        Rekap kehadiran seluruh tim (Admin, Florist, Kurir).
      </Paragraph>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker
            value={range}
            onChange={(v) => {
              if (v && v[0] && v[1]) {
                setRange([v[0], v[1]]);
                setPage(1); // filter berubah -> balik ke halaman 1
              }
            }}
            format="YYYY-MM-DD"
          />
          <Input
            placeholder="Filter username (opsional)"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setPage(1);
            }}
            style={{ width: 220 }}
            allowClear
          />
        </Space>
      </Card>

      <Table
        rowKey={(r) => `${r.USERNAME}-${r.DATE}`}
        dataSource={data?.attendance ?? []}
        loading={isLoading}
        scroll={{ x: true }}
        pagination={{
          current: page,
          pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (t) => `Total ${t} data`,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
          onShowSizeChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
        columns={[
          {
            title: "Tanggal",
            dataIndex: "DATE",
            render: (v) => clientDayJs(v).format("DD MMM YYYY"),
          },
          { title: "Nama", dataIndex: "NAME" },
          { title: "Username", dataIndex: "USERNAME", render: (v) => `@${v}` },
          {
            title: "Masuk",
            dataIndex: "CHECK_IN_AT",
            render: (v) => (v ? clientDayJs(v).format("HH:mm") : "-"),
          },
          {
            title: "Pulang",
            dataIndex: "CHECK_OUT_AT",
            render: (v) => (v ? clientDayJs(v).format("HH:mm") : "-"),
          },
          {
            title: "Status",
            key: "status",
            render: (_, r) => {
              if (r.CHECK_IN_AT && r.CHECK_OUT_AT)
                return <Tag color="green">Lengkap</Tag>;
              if (r.CHECK_IN_AT) return <Tag color="gold">Belum Pulang</Tag>;
              return <Tag>-</Tag>;
            },
          },
        ]}
      />
    </div>
  );
}
