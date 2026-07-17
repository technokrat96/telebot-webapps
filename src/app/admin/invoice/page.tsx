'use client';

import { useEffect, useState } from 'react';
import {Button, Typography, App} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import RoleGuard from '@/components/common/RoleGuard';
import InvoiceListTable from '@/components/invoice/InvoiceListTable';
import { apiClient } from '@/lib/apiClient';
import { InvoiceWithDetails } from '@/types';

const { Title } = Typography;

export default function AdminInvoicePage() {
  return (
    <RoleGuard allow={['ADMIN']}>
      <InvoiceListContent />
    </RoleGuard>
  );
}

function InvoiceListContent() {
  const [data, setData] = useState<InvoiceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { message } = App.useApp();

  useEffect(() => {
    apiClient
      .get<{ invoices: InvoiceWithDetails[] }>('/api/invoices')
      .then((res) => setData(res.invoices))
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          Invoice
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push('/admin/invoice/create')}
        >
          Buat Invoice
        </Button>
      </div>
      <InvoiceListTable data={data} loading={loading} />
    </div>
  );
}
