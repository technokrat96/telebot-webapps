'use client';

import { Card, Descriptions, Tag, Typography, Space } from 'antd';
import { useTelegramAuth } from '@/components/common/TelegramProvider';

const { Title } = Typography;

export default function WhoAmIPage() {
  const { name, roles, username } = useTelegramAuth();

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
                <Tag key={r} color={r === 'ADMIN' ? 'gold' : r === 'FLORIST' ? 'green' : 'blue'}>
                  {r}
                </Tag>
              ))}
            </Space>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
