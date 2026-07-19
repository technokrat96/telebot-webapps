'use client';

import { Result } from 'antd';
import { useTelegramAuth } from './TelegramProvider';

export default function RoleGuard({
  allow,
  children,
}: {
  allow: string[];
  children: React.ReactNode;
}) {
  const { roles, name } = useTelegramAuth();
  const authorized = roles.some((r) => allow.includes(r));

  if (!authorized) {
    return (
      <Result
        status="403"
        title="Akses ditolak"
        subTitle={`Halaman ini khusus untuk ${allow.join('/')}. Akun kamu (${
          name ?? 'tidak dikenal'
        }) tidak punya akses.`}
      />
    );
  }

  return <>{children}</>;
}
