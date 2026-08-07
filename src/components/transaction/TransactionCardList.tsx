"use client";

import {
  Card,
  Descriptions,
  Space,
  Tag,
  Typography,
  Button,
  Empty,
  Pagination,
  Divider,
  Skeleton,
  GetProp,
  TablePaginationConfig,
} from "antd";
import { useRouter } from "next/navigation";
import {
  TransactionDetailWithAssignments,
  TransactionWithDetailsAndAssignments,
} from "@/types";

const { Text } = Typography;

// Alur utama ITEM_STATUS per TransactionDetail -- lihat CLAUDE.md/diskusi
// status: NEW ORDER -> WORK IN PROGRESS -> READY TO PICKUP -> ON DELIVERY ->
// DONE. CANCELED/RESCHEDULED belum ditangani (nanti), jadi kalau ITEM_STATUS
// di luar daftar ini, ditampilkan sebagai Tag polos, bukan panel step.
const ITEM_STAGES = [
  "NEW ORDER",
  "WORK IN PROGRESS",
  "READY TO PICKUP",
  "ON DELIVERY",
  "DONE",
];
// Satu warna beda per tahap, biar sekali lirik langsung ke-baca lagi di
// tahap mana tanpa perlu baca teksnya.
const ITEM_STAGE_COLORS = [
  "#8c8c8c",
  "#1677ff",
  "#fa8c16",
  "#722ed1",
  "#52c41a",
];
const READY_TO_PICKUP_INDEX = ITEM_STAGES.indexOf("READY TO PICKUP");

/**
 * Order dianggap "sudah bisa dipegang kurir" begitu MINIMAL SATU item
 * detail-nya sudah mencapai READY TO PICKUP (atau tahap sesudahnya --
 * ON DELIVERY/DONE juga berarti sudah pernah lewat READY TO PICKUP).
 * Dipakai buat nentuin kapan Progress Kurir mulai ditampilkan.
 */
function hasAnyItemReadyToPickup(
  details: TransactionDetailWithAssignments[],
): boolean {
  return details.some(
    (d) => ITEM_STAGES.indexOf(d.ITEM_STATUS) >= READY_TO_PICKUP_INDEX,
  );
}

/**
 * Order dianggap "udah mulai dikirim" begitu ada assignment kurir aktif
 * (bukan RELEASED) yang DELIVERY_STATUS-nya udah lewat PICKUP (ON
 * DELIVERY/DELIVERED/RETURNED) -- kurir udah pegang barangnya di jalan.
 * Tombol "Ubah" transaksi disembunyikan begitu ini true, biar admin gak
 * ubah-ubah order yang barangnya udah di jalan.
 */
function hasDeliveryPastPickup(
  details: TransactionDetailWithAssignments[],
): boolean {
  return details.some((d) =>
    d.deliveryAssignments.some(
      (a) => a.STATUS !== "RELEASED" && a.DELIVERY_STATUS !== "PICKUP",
    ),
  );
}

const OFF_PIPELINE_STATUS_COLORS: Record<
  string,
  GetProp<typeof Tag, "color">
> = {
  CANCELLED: "red",
  PENDING: "cyan",
  RESCHEDULED: "gold",
};

type PanelStep = { label: string; color: string; description?: string };

/**
 * Pengganti antd `Steps` -- tiap tahap dirender sebagai panel kotak warna
 * sendiri-sendiri (bukan cuma garis/ikon biru-abu-abu bawaan Steps), supaya
 * tahapnya langsung kebaca dari warnanya. Tahap yang sudah lewat & tahap
 * yang sedang aktif tampil solid (warna penuh + teks putih); tahap yang
 * belum sampai tampil pudar (tint tipis dari warna yang sama) supaya tetap
 * kelihatan itu tahap apa tapi jelas belum kejadian.
 */
function ColorStepPanels({
  steps,
  current,
}: {
  steps: PanelStep[];
  current: number;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {steps.map((step, idx) => {
        const reached = idx <= current;
        const isCurrent = idx === current;
        return (
          <div
            key={step.label}
            style={{
              flex: "1 1 90px",
              minWidth: 84,
              padding: "6px 10px",
              borderRadius: 8,
              textAlign: "center",
              background: reached ? step.color : `${step.color}1F`,
              color: reached ? "#fff" : step.color,
              border: isCurrent
                ? `2px solid ${step.color}`
                : "2px solid transparent",
              boxShadow: isCurrent ? `0 1px 4px ${step.color}66` : undefined,
              fontWeight: isCurrent ? 600 : 500,
              transition: "all 0.2s ease",
            }}
          >
            <div
              style={{ fontSize: 11, lineHeight: 1.3, whiteSpace: "nowrap" }}
            >
              {step.label}
            </div>
            {step.description && (
              <div style={{ fontSize: 11, opacity: 0.9, marginTop: 2 }}>
                {step.description}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type AssignmentLike = { STATUS: string; QUANTITY_ASSIGNED: number };

/**
 * Ringkasan progress berbasis QTY (bukan jumlah baris item) untuk satu sisi
 * (florist atau kurir) di seluruh order -- tiap item detail menyumbang
 * QUANTITY-nya ke total, lalu dipecah jadi qty yang sudah selesai
 * (assignment COMPLETED), sedang dikerjakan (ASSIGNED), atau masih standby
 * (belum ada yang megang / sudah dilepas). Sama persis logikanya dengan
 * summarizeQtyProgress di TransactionListTable.tsx.
 */
function summarizeQtyProgress(
  details: TransactionDetailWithAssignments[],
  getAssignments: (d: TransactionDetailWithAssignments) => AssignmentLike[],
) {
  let total = 0;
  let done = 0;
  let onProgress = 0;

  details.forEach((d) => {
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

/**
 * Ringkasan qty kurir berbasis DELIVERY_STATUS (PICKUP -> ON DELIVERY ->
 * DELIVERED), bukan status assignment (ASSIGNED/COMPLETED) -- beda dari
 * florist karena kurir punya field status delivery sendiri yang lebih
 * granular. RETURNED sengaja tidak dihitung ke tahap manapun di sini (belum
 * ditangani, proses reschedule menyusul nanti).
 */
function summarizeDeliveryStatusQty(
  details: TransactionDetailWithAssignments[],
) {
  let total = 0;
  let pickup = 0;
  let onDelivery = 0;
  let delivered = 0;

  details.forEach((d) => {
    total += Number(d.QUANTITY || 0);
    d.deliveryAssignments
      .filter((a) => a.STATUS !== "RELEASED")
      .forEach((a) => {
        const qty = Number(a.QUANTITY_ASSIGNED || 0);
        if (a.DELIVERY_STATUS === "DELIVERED") delivered += qty;
        else if (a.DELIVERY_STATUS === "ON DELIVERY") onDelivery += qty;
        else if (a.DELIVERY_STATUS === "PICKUP") pickup += qty;
      });
  });

  return { total, pickup, onDelivery, delivered };
}

/** Panel 3-tahap berbasis qty, dipakai buat progress florist & kurir di level order (label & warnanya beda-beda, lihat pemanggilnya). */
function QtyAssignPanels({
  title,
  total,
  stage1Qty,
  stage1Label,
  stage1Color,
  stage2Qty,
  stage2Label,
  stage2Color,
  stage3Qty,
  stage3Label,
  stage3Color,
}: {
  title: string;
  total: number;
  stage1Qty: number;
  stage1Label: string;
  stage1Color: string;
  stage2Qty: number;
  stage2Label: string;
  stage2Color: string;
  stage3Qty: number;
  stage3Label: string;
  stage3Color: string;
}) {
  if (total === 0) {
    return (
      <div>
        <Text strong style={{ display: "block", marginBottom: 8 }}>
          {title}
        </Text>
        <Text type="secondary">Tidak ada item</Text>
      </div>
    );
  }

  const current =
    stage3Qty >= total ? 2 : stage3Qty > 0 || stage2Qty > 0 ? 1 : 0;
  const percent =
    current === 1
      ? Math.round(((stage3Qty + stage2Qty) / total) * 100)
      : undefined;

  return (
    <div>
      <Text strong style={{ display: "block", marginBottom: 8 }}>
        {title}
      </Text>
      <ColorStepPanels
        current={current}
        steps={[
          {
            label: stage1Label,
            color: stage1Color,
            description: `${stage1Qty} qty`,
          },
          {
            label: stage2Label,
            color: stage2Color,
            description: `${stage2Qty} qty${current === 1 && percent !== undefined ? ` · ${percent}%` : ""}`,
          },
          {
            label: stage3Label,
            color: stage3Color,
            description: `${stage3Qty} qty`,
          },
        ]}
      />
    </div>
  );
}

/** Panel 5-tahap dari ITEM_STATUS satu baris TransactionDetail. */
function ItemStatusSteps({ item }: { item: TransactionDetailWithAssignments }) {
  const current = ITEM_STAGES.indexOf(item.ITEM_STATUS);

  return (
    <div style={{ marginBottom: 16 }}>
      <Space wrap style={{ marginBottom: 6 }}>
        <Text>{item.ITEM_NAME}</Text>
        <Text type="secondary">qty {item.QUANTITY}</Text>
        {current === -1 && (
          <Tag
            color={OFF_PIPELINE_STATUS_COLORS[item.ITEM_STATUS] ?? "default"}
          >
            {item.ITEM_STATUS}
          </Tag>
        )}
      </Space>
      {current !== -1 && (
        <ColorStepPanels
          current={current}
          steps={ITEM_STAGES.map((label, idx) => ({
            label,
            color: ITEM_STAGE_COLORS[idx],
          }))}
        />
      )}
    </div>
  );
}

export default function TransactionCardList({
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

  if (loading && data.length === 0) {
    return (
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <Skeleton active />
          </Card>
        ))}
      </Space>
    );
  }

  if (!loading && data.length === 0) {
    return <Empty description="Tidak ada transaksi" />;
  }

  return (
    <div>
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        {data.map((t) => {
          const florist = summarizeQtyProgress(t.details, (d) => d.assignments);
          const kurir = summarizeDeliveryStatusQty(t.details);

          return (
            <Card
              key={t.ORDER_ID}
              loading={loading}
              title={
                <Space wrap>
                  <Text strong>{t.ORDER_ID}</Text>
                  <Text type="secondary">· {t.CUSTOMER_NAME}</Text>
                </Space>
              }
              extra={
                showEditAction ? (
                  <Space size={4}>
                    <Button
                      onClick={() =>
                        router.push(`/admin/transaction/${t.ORDER_ID}`)
                      }
                    >
                      Detail
                    </Button>
                    {/* Begitu ada kurir yang udah ON DELIVERY (atau lebih
                        jauh), transaksi ini gak boleh diubah lagi. */}
                    {!hasDeliveryPastPickup(t.details) && (
                      <Button
                        onClick={() =>
                          router.push(`/admin/transaction/${t.ORDER_ID}/edit`)
                        }
                      >
                        Ubah
                      </Button>
                    )}
                  </Space>
                ) : undefined
              }
            >
              <Descriptions column={{ xs: 1, sm: 2, md: 4 }}>
                <Descriptions.Item label="Sumber">
                  {t.ORDER_SOURCE || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Sales">
                  {t.SALES_NAME || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Grand Total">
                  {(t.GRAND_TOTAL || 0).toLocaleString("id-ID")}
                </Descriptions.Item>
                <Descriptions.Item label="Sisa Bayar">
                  {(t.REMAINING_BALANCE || 0).toLocaleString("id-ID")}
                </Descriptions.Item>
              </Descriptions>

              <Divider style={{ margin: "16px 0" }} />

              <Text strong style={{ display: "block", marginBottom: 12 }}>
                Status Item
              </Text>
              {t.details.length === 0 ? (
                <Text type="secondary">Tidak ada item</Text>
              ) : (
                t.details.map((d) => (
                  <ItemStatusSteps key={d.ORDER_ITEM_ID} item={d} />
                ))
              )}

              <Divider style={{ margin: "16px 0" }} />

              <Space orientation="vertical" size={20} style={{ width: "100%" }}>
                <QtyAssignPanels
                  title="Progress Florist"
                  total={florist.total}
                  stage1Qty={florist.standby}
                  stage1Label="STAND BY"
                  stage1Color="#8c8c8c"
                  stage2Qty={florist.onProgress}
                  stage2Label="IN PROGRESS"
                  stage2Color="#1677ff"
                  stage3Qty={florist.done}
                  stage3Label="DONE"
                  stage3Color="#52c41a"
                />
                {/* Belum ada item yang READY TO PICKUP -> belum ada yang bisa
                    diambil kurir sama sekali, jadi progress kurir gak usah
                    ditampilkan dulu. */}
                {hasAnyItemReadyToPickup(t.details) && (
                  <QtyAssignPanels
                    title="Progress Kurir"
                    total={kurir.total}
                    stage1Qty={kurir.pickup}
                    stage1Label="PICKUP"
                    stage1Color="#fa8c16"
                    stage2Qty={kurir.onDelivery}
                    stage2Label="ON DELIVERY"
                    stage2Color="#1677ff"
                    stage3Qty={kurir.delivered}
                    stage3Label="DELIVERED"
                    stage3Color="#52c41a"
                  />
                )}
              </Space>
            </Card>
          );
        })}
      </Space>

      {pagination && (
        <div
          style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}
        >
          <Pagination
            current={pagination.current}
            pageSize={pagination.pageSize}
            total={pagination.total}
            showSizeChanger={pagination.showSizeChanger}
            showTotal={pagination.showTotal}
            onChange={pagination.onChange}
            onShowSizeChange={pagination.onShowSizeChange}
          />
        </div>
      )}
    </div>
  );
}
