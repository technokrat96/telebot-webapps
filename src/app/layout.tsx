import type { Metadata, Viewport } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import {App, ConfigProvider} from 'antd';
import TelegramProvider from '@/components/common/TelegramProvider';
import AppShell from '@/components/common/AppShell';
import './globals.css';
import MasterDataProvider from "@/components/common/MasterDataProvider";

export const metadata: Metadata = {
  title: 'Florist Telegram App',
  description: 'Admin, Florist & Kurir workflow for the flower shop',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <AntdRegistry>
          <ConfigProvider
            theme={{
              token: {
                colorPrimary: '#d6336c',
                borderRadius: 8,
              },
            }}
            componentSize={"large"}
          >
            <App>
              <TelegramProvider>
                <MasterDataProvider>
                  <AppShell>{children}</AppShell>
                </MasterDataProvider>
              </TelegramProvider>
            </App>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
