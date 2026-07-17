'use client';

import {Button, Flex, Layout, Menu, Tag, Typography} from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  CarOutlined,
  UserOutlined, MenuUnfoldOutlined, MenuFoldOutlined,
} from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import { useTelegramAuth } from './TelegramProvider';
import useBreakpoint from "antd/lib/grid/hooks/useBreakpoint";
import Sider from "antd/lib/layout/Sider";
import {useState} from "react";

const { Header, Content, Footer } = Layout;
const { Text } = Typography;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { name, roles } = useTelegramAuth();
  const breakpoint = useBreakpoint();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const items = [
    { key: '/', icon: <DashboardOutlined />, label: 'Home' },
    ...(roles.includes('ADMIN')
      ? [
          { key: '/admin/transaction', icon: <ShoppingOutlined />, label: 'Transaksi' },
          { key: '/admin/invoice', icon: <FileTextOutlined />, label: 'Invoice' },
        ]
      : []),
    ...(roles.includes('FLORIST')
      ? [{ key: '/florist', icon: <ShoppingOutlined />, label: 'Florist' }]
      : []),
    ...(roles.includes('KURIR')
      ? [{ key: '/kurir', icon: <CarOutlined />, label: 'Kurir' }]
      : []),
    { key: '/whoami', icon: <UserOutlined />, label: 'Who Am I' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} collapsedWidth="0" breakpoint="lg">
        <div>
          <Text style={{ color: '#fff', whiteSpace: 'nowrap', display: "block" }}>
            {name}
          </Text>
          {roles.map((r) => (
            <Tag key={r} color={r === 'ADMIN' ? 'gold' : r === 'FLORIST' ? 'green' : 'blue'}>
              {r}
            </Tag>
          ))}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          items={items}
          onClick={(e) => router.push(e.key)}
        />
      </Sider>
      <Layout style={{ minHeight: '100vh' }}>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            paddingInline: 16,
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          {
            breakpoint.xl ? (
              <>
                <Text strong style={{ color: '#fff', whiteSpace: 'nowrap' }}>
                  🌸 Florist App
                </Text>
                <Menu
                  theme="dark"
                  mode="horizontal"
                  selectedKeys={[pathname]}
                  items={items}
                  onClick={(e) => router.push(e.key)}
                  style={{ flex: 1, minWidth: 0 }}
                />
                {roles.length > 0 && (
                  <Text style={{ color: '#fff', whiteSpace: 'nowrap' }}>
                    {name}{' '}
                    {roles.map((r) => (
                      <Tag key={r} color={r === 'ADMIN' ? 'gold' : r === 'FLORIST' ? 'green' : 'blue'}>
                        {r}
                      </Tag>
                    ))}
                  </Text>
                )}
              </>
            ) : (
              <>
                <Flex justify={"space-between"}>
                  <Text strong style={{ color: '#fff', whiteSpace: 'nowrap' }}>
                    🌸 Florist App
                  </Text>
                  <Button
                    type="text"
                    icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                    onClick={() => setCollapsed(!collapsed)}
                    style={{
                      fontSize: '16px',
                      width: 64,
                      height: 64,
                    }}
                  />
                </Flex>
              </>
            )
          }
        </Header>
        <Content style={{ padding: '16px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>{children}</div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>Florist Telegram Mini App</Footer>
      </Layout>
    </Layout>
  );
}
