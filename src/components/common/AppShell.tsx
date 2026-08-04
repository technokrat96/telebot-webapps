'use client';

import {Avatar, Button, Divider, Flex, Layout, Menu, Tag, Typography} from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  CarOutlined,
  UserOutlined, MenuUnfoldOutlined, MenuFoldOutlined, ScheduleOutlined, ClockCircleOutlined, LogoutOutlined,
} from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import useBreakpoint from "antd/lib/grid/hooks/useBreakpoint";
import Sider from "antd/lib/layout/Sider";
import {useEffect, useState} from "react";
import {useAttendanceGate} from "@/components/common/AttendanceGate";
import {take} from "lodash";

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

function toArrayPathname(pathname: string) {
  return pathname.split("/").filter(e => !!e).reduce((previousValue, currentValue, currentIndex, array) => {
    return [
      ...previousValue,
      ["", ...take(array, currentIndex + 1)].join("/"),
    ]
  }, [] as string[]);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { name, roles, logout } = useAuth();
  const breakpoint = useBreakpoint();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true);
  const { checkedIn, checkedOut} = useAttendanceGate();

  const items = [
    { key: '/', icon: <DashboardOutlined />, label: 'Home' },
    { key: '/attendance', icon: <ClockCircleOutlined />, label: 'Absensi' },
    ...(roles.includes('ADMIN')
      ? [
          { key: '/admin/transaction', icon: <ShoppingOutlined />, label: 'Transaksi' },
          { key: '/admin/invoice', icon: <FileTextOutlined />, label: 'Invoice' },
        { key: '/admin/attendance', icon: <ScheduleOutlined />, label: 'Rekap Absensi' },
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
              router.push("/account")
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
          <Button
            type="text"
            icon={<LogoutOutlined style={{color: '#fff'}}/>}
            onClick={logout}
            style={{marginTop: 8}}
          >
            <Text style={{color: '#fff'}}>Logout</Text>
          </Button>
        </div>
        <Divider style={{ borderColor: 'white' }} />
        {(checkedIn && !checkedOut) && (<Menu
          theme="dark"
          mode="inline"
          items={items}
          selectedKeys={[...toArrayPathname(pathname)]}
          onClick={(e) => {
            router.push(e.key)
            setCollapsed(!collapsed)
          }}
        />)}
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
                {(checkedIn && !checkedOut) ? (<Menu
                  theme="dark"
                  mode="horizontal"
                  selectedKeys={[...toArrayPathname(pathname)]}
                  items={items}
                  onClick={(e) => router.push(e.key)}
                  style={{flex: 1, minWidth: 0}}
                />) : <div style={{flex: 1, minWidth: 0}}/>}
                {roles.length > 0 && (
                  <Button type={"text"} onClick={() => router.push("/account")}>
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
                <Button type="text" icon={<LogoutOutlined style={{ color: '#fff' }} />} onClick={logout} />
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
          <div style={{ maxWidth: breakpoint.xl ? '80%' : '100%', margin: '0 auto' }}>{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
}
