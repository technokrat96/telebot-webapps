"use client";

import {
  Table,
  Tag,
  Button,
  Typography,
  Space,
  GetProp,
  Progress,
  Tooltip,
  TablePaginationConfig,
} from "antd";
import { useRouter } from "next/navigation";
import {
  TransactionDetail,
  TransactionDetailWithAssignments,
  TransactionWithDetails,
  TransactionWithDetailsAndAssignments,
} from "@/types";

const { Text } = Typography;

const STATUS_COLORS: Record<string, GetProp<typeof Tag, "color">> = {
  "NEW ORDER": "default",
  "WORK IN PROGRESS": "processing",
  "READY TO PICKUP": "blue",
  "ON DELIVERY": "gold",
  DONE: "success",
  CANCELLED: "red",
  PENDING: "cyan",
  RESCHEDULED: "gold",
};

const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: "Diproses",
  COMPLETED: "Selesai",
  RELEASED: "Dilepas",
};

const ASSIGNMENT_STATUS_COLORS: Record<string, GetProp<typeof Tag, "color">> = {
  ASSIGNED: "processing",
  COMPLETED: "success",
  RELEASED: "default",
};

const DELIVERY_STATUS_COLORS: Record<string, GetProp<typeof Tag, "color">> = {
  PICKUP: "blue",
  "ON DELIVERY": "gold",
  RETURNED: "red",
  DELIVERED: "green",
};

// Warna segmen progress bar (bukan warna preset Tag) -- hijau = selesai,
// biru = sedang dikerjakan, sisanya (standby) dibiarkan warna track default.
const PROGRESS_DONE_COLOR = "#52c41a";
const PROGRESS_ON_PROGRESS_COLOR = "#1677ff";

// Type guard kecil: cek apakah detail ini datang dari endpoint yang sudah
// nge-join florist assignment (/api/transactions), atau dari endpoint lain
// (invoice-details, transaction-details) yang tidak membawa data itu.
function hasAssignments(
  d: TransactionDetail | TransactionDetailWithAssignments,
): d is TransactionDetailWithAssignments {
  return Array.isArray((d as TransactionDetailWithAssignments).assignments);
}

type AssignmentLike = { STATUS: string; QUANTITY_ASSIGNED: number };

/**
 * Ringkasan progress berbasis QTY (bukan jumlah baris item) -- tiap item
 * menyumbang QUANTITY-nya ke total, lalu dipecah jadi qty yang sudah
 * selesai (assignment COMPLETED), sedang dikerjakan (ASSIGNED), atau masih
 * standby (belum ada yang megang / sudah dilepas).
 */
function summarizeQtyProgress(
  details: (TransactionDetail | TransactionDetailWithAssignments)[],
  getAssignments: (d: TransactionDetailWithAssignments) => AssignmentLike[],
) {
  let total = 0;
  let done = 0;
  let onProgress = 0;

  details.filter(hasAssignments).forEach((d) => {
    const qty = Number(d.QUANTITY || 0);
    const assignments = getAssignments(d);
    const completedQty = assignments
      .filter((a) => a.STATUS === "COMPLETED")
      .reduce((s, a) => s + Number(a.QUANTITY_ASSIGNED || 0), 0);
    const activeQty = assignments
      .filter((a) => a.STATUS === "ASSIGNED")
      .reduce((s, a) => s + Number(a.QUANTITY_ASSIGNED || 0), 0);

    const doneQty = Math.min(completedQty, qty);
    const progressQty = Math.min(activeQty, qty - doneQty);

    total += qty;
    done += doneQty;
    onProgress += progressQty;
  });

  const standby = total - done - onProgress;
  return { total, done, onProgress, standby };
}

function summarizeItemStatus(
  details: (TransactionDetail | TransactionDetailWithAssignments)[],
) {
  return summarizeQtyProgress(details, (d) => d.assignments);
}

function summarizeKurirStatus(
  details: (TransactionDetail | TransactionDetailWithAssignments)[],
) {
  return summarizeQtyProgress(details, (d) => d.deliveryAssignments);
}

/** Total qty yang sudah COMPLETED oleh florist, dijumlah dari semua item di order ini. */
function floristCompletedQty(
  details: (TransactionDetail | TransactionDetailWithAssignments)[],
): number {
  return details
    .filter(hasAssignments)
    .reduce(
      (sum, d) =>
        sum +
        d.assignments
          .filter((a) => a.STATUS === "COMPLETED")
          .reduce((s, a) => s + Number(a.QUANTITY_ASSIGNED || 0), 0),
      0,
    );
}

export default function TransactionListTable({
  data,
  loading,
  showEditAction = true,
  pagination,
}: {
  data: TransactionWithDetailsAndAssignments[];
  loading?: boolean;
  showEditAction?: boolean;
  pagination?: TablePaginationConfig | false;
}) {
  const router = useRouter();

  return (
    <Table
      rowKey="ORDER_ID"
      loading={loading}
      dataSource={data}
      scroll={{ x: true }}
      pagination={pagination}
      columns={[
        { title: "Order ID", dataIndex: "ORDER_ID" },
        { title: "Sumber", dataIndex: "ORDER_SOURCE" },
        { title: "Sales", dataIndex: "SALES_NAME" },
        { title: "Pelanggan", dataIndex: "CUSTOMER_NAME" },
        {
          title: "Progress Florist",
          key: "itemProgress",
          width: 220,
          render: (_: unknown, record: TransactionWithDetails) => {
            const { total, done, onProgress, standby } = summarizeItemStatus(
              record.details,
            );
            if (total === 0) return <Text type="secondary">-</Text>;

            const donePercent = Math.round((done / total) * 100);
            const touchedPercent = Math.round(
              ((done + onProgress) / total) * 100,
            );

            return (
              <Tooltip
                title={
                  <Space orientation="vertical" size={0}>
                    <Text style={{ color: "inherit" }}>Selesai: {done}</Text>
                    <Text style={{ color: "inherit" }}>
                      Proses: {onProgress}
                    </Text>
                    <Text style={{ color: "inherit" }}>Standby: {standby}</Text>
                  </Space>
                }
              >
                <Progress
                  percent={touchedPercent}
                  success={{
                    percent: donePercent,
                    strokeColor: PROGRESS_DONE_COLOR,
                  }}
                  strokeColor={PROGRESS_ON_PROGRESS_COLOR}
                  format={() => `${done}/${total} selesai`}
                />
              </Tooltip>
            );
          },
        },
        {
          title: "Progress Kurir",
          key: "kurirProgress",
          width: 220,
          render: (_: unknown, record: TransactionWithDetails) => {
            if (floristCompletedQty(record.details) === 0)
              return <Tag>None</Tag>;

            const { total, done, onProgress, standby } = summarizeKurirStatus(
              record.details,
            );
            if (total === 0) return <Text type="secondary">-</Text>;

            return (
              <Space orientation="vertical" size={4} style={{ width: "100%" }}>
                <Progress
                  percent={Math.round((done / total) * 100)}
                  format={() => `${done}/${total} selesai`}
                />
                <Space size={4} wrap>
                  {done > 0 && (
                    <Tag color={STATUS_COLORS.DONE}>Selesai: {done}</Tag>
                  )}
                  {onProgress > 0 && (
                    <Tag color={STATUS_COLORS["WORK IN PROGRESS"]}>
                      Proses: {onProgress}
                    </Tag>
                  )}
                  {standby > 0 && (
                    <Tag color={STATUS_COLORS["NEW ORDER"]}>
                      Standby: {standby}
                    </Tag>
                  )}
                </Space>
              </Space>
            );
          },
        },
        {
          title: "Grand Total",
          dataIndex: "GRAND_TOTAL",
          render: (v, r) => (r.GRAND_TOTAL || 0).toLocaleString("id-ID"),
        },
        {
          title: "Sisa Bayar",
          dataIndex: "REMAINING_BALANCE",
          render: (v, r) => (r.REMAINING_BALANCE || 0).toLocaleString("id-ID"),
        },
        ...(showEditAction
          ? [
              {
                title: "Aksi",
                key: "action",
                render: (_: unknown, record: TransactionWithDetails) => (
                  <Space size={4}>
                    <Button
                      onClick={() =>
                        router.push(`/admin/transaction/${record.ORDER_ID}`)
                      }
                    >
                      Detail
                    </Button>
                    <Button
                      onClick={() =>
                        router.push(
                          `/admin/transaction/${record.ORDER_ID}/edit`,
                        )
                      }
                    >
                      Ubah
                    </Button>
                  </Space>
                ),
              },
            ]
          : []),
      ]}
      expandable={{
        expandedRowRender: (record) => (
          <Table
            rowKey="ORDER_ITEM_ID"
            dataSource={record.details}
            pagination={false}
            columns={[
              { title: "Item", dataIndex: "ITEM_NAME" },
              { title: "Qty", dataIndex: "QUANTITY" },
              {
                title: "Harga Satuan",
                dataIndex: "UNIT_PRICE",
                render: (v, r) => (r.UNIT_PRICE || 0).toLocaleString("id-ID"),
              },
              {
                title: "Subtotal",
                dataIndex: "SUBTOTAL",
                render: (v, r) => (r.SUBTOTAL || 0).toLocaleString("id-ID"),
              },
              {
                title: "Status",
                dataIndex: "ITEM_STATUS",
                render: (v, r) => (
                  <Tag color={STATUS_COLORS[r.ITEM_STATUS] ?? "default"}>
                    {r.ITEM_STATUS}
                  </Tag>
                ),
              },
              {
                title: "Florist",
                key: "florist",
                render: (
                  _: unknown,
                  r: TransactionDetail | TransactionDetailWithAssignments,
                ) => {
                  if (!hasAssignments(r))
                    return <Text type="secondary">-</Text>;

                  const activeAssignments = r.assignments.filter(
                    (a) => a.STATUS !== "RELEASED",
                  );
                  if (activeAssignments.length === 0) {
                    return <Tag>Belum diambil</Tag>;
                  }

                  const qtyByStatus = new Map<string, number>();
                  activeAssignments.forEach((a) => {
                    qtyByStatus.set(
                      a.STATUS,
                      (qtyByStatus.get(a.STATUS) ?? 0) +
                        Number(a.QUANTITY_ASSIGNED || 0),
                    );
                  });

                  return (
                    <Space size={4} wrap>
                      {[...qtyByStatus.entries()].map(([status, qty]) => (
                        <Tag
                          key={status}
                          color={ASSIGNMENT_STATUS_COLORS[status] ?? "default"}
                        >
                          {ASSIGNMENT_STATUS_LABELS[status] ?? status} · {qty}
                        </Tag>
                      ))}
                    </Space>
                  );
                },
              },
              {
                title: "Kurir",
                key: "kurir",
                render: (
                  _: unknown,
                  r: TransactionDetail | TransactionDetailWithAssignments,
                ) => {
                  if (!hasAssignments(r))
                    return <Text type="secondary">-</Text>;

                  const activeAssignments = r.deliveryAssignments.filter(
                    (a) => a.STATUS !== "RELEASED",
                  );
                  if (activeAssignments.length === 0) {
                    return <Tag>Belum diambil</Tag>;
                  }

                  const qtyByStatus = new Map<string, number>();
                  activeAssignments.forEach((a) => {
                    const key = a.DELIVERY_STATUS || a.STATUS;
                    qtyByStatus.set(
                      key,
                      (qtyByStatus.get(key) ?? 0) +
                        Number(a.QUANTITY_ASSIGNED || 0),
                    );
                  });

                  return (
                    <Space size={4} wrap>
                      {[...qtyByStatus.entries()].map(([status, qty]) => (
                        <Tag
                          key={status}
                          color={
                            DELIVERY_STATUS_COLORS[status] ??
                            ASSIGNMENT_STATUS_COLORS[status] ??
                            "default"
                          }
                        >
                          {status} · {qty}
                        </Tag>
                      ))}
                    </Space>
                  );
                },
              },
              {
                title: "Kartu Ucapan",
                key: "card",
                render: (v, r) => (
                  <Space orientation="vertical" size={0}>
                    {r.CARD_TO && <Text>To: {r.CARD_TO}</Text>}
                    {r.CARD_MESSAGE && (
                      <Text type="secondary">{r.CARD_MESSAGE}</Text>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        ),
      }}
    />
  );
}
