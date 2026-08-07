"use client";

import { Alert, Card, Descriptions, Tag, Typography, Space } from "antd";
import { useAuth } from "@/components/common/AuthProvider";

const { Title } = Typography;

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

export default function AccountPage() {
  const { name, roles, username } = useAuth();

  return (
    <div>
      <Title level={3}>Who Am I</Title>
      <Card>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Nama">{name}</Descriptions.Item>
          <Descriptions.Item label="Telegram Username">
            @{username}
          </Descriptions.Item>
          <Descriptions.Item label="Role">
            <Space wrap>
              {roles.map((r) => (
                <Tag
                  key={r}
                  color={
                    r === "ADMIN" ? "gold" : r === "FLORIST" ? "green" : "blue"
                  }
                >
                  {r}
                </Tag>
              ))}
            </Space>
          </Descriptions.Item>
        </Descriptions>
      </Card>
      <Alert
        style={{ marginTop: 16 }}
        type="info"
        showIcon
        message="Mau ganti password?"
        description={
          <span>
            Buka bot Telegram{BOT_USERNAME ? ` @${BOT_USERNAME}` : ""}, kirim{" "}
            <code>/start</code>, lalu ketuk tombol &quot;Set / Ganti Password
            Webapp&quot;.
          </span>
        }
      />
    </div>
  );
}
