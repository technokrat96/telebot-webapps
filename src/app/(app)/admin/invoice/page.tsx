"use client";

import { useState } from "react";
import { Button, Typography, App } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/common/RoleGuard";
import InvoiceListTable from "@/components/invoice/InvoiceListTable";
import { apiClient } from "@/lib/apiClient";
import { InvoiceWithDetails } from "@/types";
import useSWR from "swr";

const { Title } = Typography;

type InvoiceListResponse = {
  invoices: InvoiceWithDetails[];
  total: number;
};

const fetcher = (url: string) => apiClient.get<InvoiceListResponse>(url);

export default function AdminInvoicePage() {
  return (
    <RoleGuard allow={["ADMIN"]}>
      <InvoiceListContent />
    </RoleGuard>
  );
}

function InvoiceListContent() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const router = useRouter();
  const { message } = App.useApp();

  const { data, isLoading, error } = useSWR<InvoiceListResponse>(
    `/api/invoices?page=${page}&pageSize=${pageSize}`,
    fetcher,
    { keepPreviousData: true }, // biar pas ganti halaman gak flash loading, tabel lama tetep kelihatan
  );

  if (error) message.error(error.message);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          Invoice
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push("/admin/invoice/create")}
        >
          Buat Invoice
        </Button>
      </div>
      <InvoiceListTable
        data={data?.invoices ?? []}
        loading={isLoading}
        pagination={{
          current: page,
          pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (t) => `Total ${t} invoice`,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
          onShowSizeChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
      />
    </div>
  );
}
