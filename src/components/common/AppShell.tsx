'use client';

import {Avatar, Button, Divider, Flex, Layout, Menu, Tag, Typography} from 'antd';
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
import {useEffect, useState} from "react";

const { Header, Content, Footer } = Layout;
const { Text } = Typography;


const layoutStyle: React.CSSProperties = {
  position: 'relative',
  minHeight: "100vh",
};

const siderStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  bottom: 0,
  insetInlineStart: 0,
  zIndex: 10,
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { name, roles } = useTelegramAuth();
  const breakpoint = useBreakpoint();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true);

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
  ];

  useEffect(() => {
    if (!collapsed) setCollapsed(true);
  }, [breakpoint.xl]);

  return (
    <Layout hasSider={!breakpoint.xl} style={{position:"relative" }}>
      {!breakpoint.xl && (<Sider trigger={null} style={siderStyle} styles={{ body: { maxHeight: "100vh", overflowY: "auto", } }} collapsible collapsed={collapsed} width={"100%"} collapsedWidth="0">
        <div style={{ padding: "12px" }}>
          <Flex align={"center"} justify={"space-between"}>
            <Button type={"text"} onClick={() => {
              router.push("/whoami")
              setCollapsed(!collapsed)
            }}>
              <Avatar icon={<UserOutlined/>} shape={"circle"} />
              <Flex align={"start"} justify={"center"} vertical>
                <div>
                  <Text style={{color: '#fff', whiteSpace: 'nowrap', display: "block"}}>
                    {name}
                  </Text>
                </div>
                <div>
                  {roles.map((r) => (
                    <Tag key={r} color={r === 'ADMIN' ? 'gold' : r === 'FLORIST' ? 'green' : 'blue'}>
                      {r}
                    </Tag>
                  ))}
                </div>
              </Flex>
            </Button>
            {!collapsed && (<Button
              type="text"
              variant={"solid"}
              color={"primary"}
              size={"large"}
              icon={collapsed ? <MenuUnfoldOutlined/> : <MenuFoldOutlined/>}
              onClick={() => setCollapsed(!collapsed)}
            />)}
          </Flex>
        </div>
        <Divider style={{ borderColor: 'white' }} size={"small"} />
        <Menu
          theme="dark"
          mode="inline"
          items={items}
          selectedKeys={[pathname]}
          onClick={(e) => {
            router.push(e.key)
            setCollapsed(!collapsed)
          }}
        />
      </Sider>)}
      <Layout style={{ minHeight: "100vh", maxHeight: "100vh", overflowY: "auto",  marginBottom: '16px' }}>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            paddingInline: 16,
            position: 'sticky',
            top: 0,
            zIndex: 9,
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
                  <Button type={"text"} onClick={() => router.push("/whoami")}>
                    <Avatar icon={<UserOutlined/>} shape={"circle"} />
                    <Text style={{ color: '#fff', whiteSpace: 'nowrap' }}>
                      {name}{' '}
                      {roles.map((r) => (
                        <Tag key={r} color={r === 'ADMIN' ? 'gold' : r === 'FLORIST' ? 'green' : 'blue'}>
                          {r}
                        </Tag>
                      ))}
                    </Text>
                  </Button>
                )}
              </>
            ) : (
              <>
                <Flex align={"center"} justify={"space-between"} style={{ width: "100%" }}>
                  <Text strong style={{ color: '#fff', whiteSpace: 'nowrap' }}>
                    🌸 Florist App
                  </Text>
                  {collapsed && (<Button
                    type="text"
                    variant={"solid"}
                    color={"primary"}
                    size={"large"}
                    icon={collapsed ? <MenuUnfoldOutlined/> : <MenuFoldOutlined/>}
                    onClick={() => setCollapsed(!collapsed)}
                  />)}
                </Flex>
              </>
            )
          }
        </Header>
        <Content style={{ padding: '16px', minHeight: 'auto' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
}
