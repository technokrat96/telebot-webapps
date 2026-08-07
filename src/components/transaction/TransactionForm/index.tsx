"use client";

import {
  App,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Form,
  FormInstance,
  Input,
  Row,
  Select,
  TimePicker,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import PhoneNumberInput from "@/components/PhoneNumberInput";
import MoneyInput from "@/components/MoneyInput";
import { useMasterData } from "@/components/common/MasterDataProvider";
import { parseOrderText } from "@/lib/orderTextParser";
import { apiClient } from "@/lib/apiClient";
import { ValidateErrorEntity } from "@rc-component/form";
import ItemPesananList from "./ItemPesananList";
import type { TransactionFormValues } from "./types";

export type { TransactionFormValues } from "./types";

const { Title } = Typography;

export default function TransactionForm({
  initialValues,
  onSubmitAction,
  submitting,
  isEdit = false,
  form: externalForm,
}: {
  initialValues?: Partial<TransactionFormValues>;
  // Boleh return `false` (atau Promise yang resolve `false`) kalau proses
  // simpannya gagal, supaya foto yang sudah kadung terupload bisa
  // di-rollback (dihapus lagi dari Blob storage).
  onSubmitAction: (
    values: TransactionFormValues,
  ) => void | boolean | Promise<void | boolean>;
  submitting?: boolean;
  isEdit?: boolean;
  // Opsional: kalau parent butuh kontrol form instance-nya sendiri (mis.
  // halaman edit yang isi datanya baru datang async lewat form.setFieldsValue
  // setelah fetch selesai — initialValues antd tidak reaktif setelah mount
  // pertama, jadi harus lewat instance form yang sama). Kalau tidak dikasih,
  // component ini bikin form instance sendiri (dipakai di halaman create).
  form?: FormInstance<TransactionFormValues>;
}) {
  const {
    data: { DELIVERY_METHODS, ORDER_SOURCES, PAYMENT_METHODS },
  } = useMasterData();
  const { message } = App.useApp();
  const [form] = Form.useForm<TransactionFormValues>(externalForm);
  const [receiverSameAsCustomer, setReceiverSameAsCustomer] = useState(true);
  const [orderText, setOrderText] = useState("");
  const [expandAllSignal, setExpandAllSignal] = useState(0);
  // True selama proses upload foto (yang baru dipilih, belum pernah diupload)
  // ke Blob storage tepat sebelum submit beneran jalan.
  const [uploadingImages, setUploadingImages] = useState(false);

  // Foto item pesanan sengaja BARU diupload ke Blob storage di sini (saat
  // submit), bukan saat user memilih filenya — biar kalau transaksinya batal
  // dibuat, tidak ada file yang kadung nyampah di storage.
  async function handleFinish(values: TransactionFormValues) {
    setUploadingImages(true);

    // Dicatat manual (bukan cuma dari resolvedDetails) supaya kalau salah
    // satu upload gagal di tengah jalan, upload lain yang sempat sukses
    // duluan tetap kebawa buat di-rollback juga.
    const uploadedUrls: string[] = [];
    let resolvedDetails: TransactionFormValues["details"];
    try {
      resolvedDetails = await Promise.all(
        (values.details ?? []).map(async (d) => {
          const { IMAGE_FILES, ...rest } = d;
          const pendingFiles = IMAGE_FILES ?? [];
          if (pendingFiles.length === 0) return rest;
          const newUrls = await Promise.all(
            pendingFiles.map(async ({ file }) => {
              const { url } = await apiClient.uploadFile("/api/upload", file);
              uploadedUrls.push(url);
              return url;
            }),
          );
          return {
            ...rest,
            IMAGE_URLS: [...(rest.IMAGE_URLS ?? []), ...newUrls],
          };
        }),
      );
    } catch (err) {
      message.error(`Gagal upload foto: ${(err as Error).message}`);
      rollbackUploadedImages(uploadedUrls);
      setUploadingImages(false);
      return;
    }
    setUploadingImages(false);

    const result = await onSubmitAction({
      ...values,
      details: resolvedDetails,
    });
    if (result === false) {
      // Transaksi gagal disimpan padahal foto sudah kadung terupload —
      // rollback biar tidak nyampah di Blob storage. Field IMAGE_FILE di
      // form sendiri tidak disentuh, jadi user bisa langsung coba submit
      // ulang tanpa perlu pilih ulang fotonya.
      rollbackUploadedImages(uploadedUrls);
    }
  }

  function rollbackUploadedImages(urls: string[]) {
    urls.forEach((url) => {
      apiClient.delete("/api/upload", { url }).catch(() => {});
    });
  }

  const detailsWatch = Form.useWatch("details", form);
  const downPaymentWatch = Form.useWatch("DOWN_PAYMENT", form);
  const shippingFeeWatch = Form.useWatch("SHIPPING_FEE", form);

  const customerNameWatch = Form.useWatch("CUSTOMER_NAME", form);
  const customerAddressWatch = Form.useWatch("CUSTOMER_ADDRESS", form);
  const customerPhoneWatch = Form.useWatch("CUSTOMER_PHONE", form);

  function handleReceiverSameAsCustomerChange(checked: boolean) {
    setReceiverSameAsCustomer(checked);
    if (checked) {
      // Langsung sync begitu dicentang (tidak perlu tunggu watch berubah)
      form.setFieldsValue({
        RECEIVER_NAME: form.getFieldValue("CUSTOMER_NAME"),
        RECEIVER_ADDRESS: form.getFieldValue("CUSTOMER_ADDRESS"),
        RECEIVER_PHONE: form.getFieldValue("CUSTOMER_PHONE"),
      });
    } else {
      // Uncheck -> kosongkan, biar USER isi manual dari blank.
      form.setFieldsValue({
        RECEIVER_NAME: "",
        RECEIVER_ADDRESS: "",
        RECEIVER_PHONE: "",
      });
    }
  }

  useEffect(() => {
    // SUBTOTAL tiap item masih dalam currency item itu sendiri (lihat
    // ItemPesananFields.tsx) -- baru dikonversi ke IDR di sini, pakai
    // CURRENCY_RATE baris masing-masing, sebelum dijumlah jadi GRAND_TOTAL.
    const grandTotal = (detailsWatch ?? []).reduce(
      (sum, d) =>
        sum + Number(d?.SUBTOTAL || "0") * Number(d?.CURRENCY_RATE || "1"),
      0,
    );
    const remaining =
      grandTotal +
      Number(shippingFeeWatch || 0) -
      Number(downPaymentWatch || 0);
    form.setFieldsValue({
      GRAND_TOTAL: grandTotal,
      REMAINING_BALANCE: remaining,
    });
  }, [shippingFeeWatch, detailsWatch, downPaymentWatch, form]);

  useEffect(() => {
    if (!receiverSameAsCustomer) return;
    form.setFieldsValue({
      RECEIVER_NAME: customerNameWatch,
      RECEIVER_ADDRESS: customerAddressWatch,
      RECEIVER_PHONE: customerPhoneWatch,
    });
  }, [
    receiverSameAsCustomer,
    customerNameWatch,
    customerAddressWatch,
    customerPhoneWatch,
    form,
  ]);

  function handleApplyOrderText() {
    if (!orderText.trim()) {
      message.warning("Tempel teks order dulu");
      return;
    }

    const parsed = parseOrderText(orderText);

    // Isi hanya field yang berhasil terdeteksi, biar field lain yang sudah
    // diisi manual tidak ketiban kosong.
    const fieldsToSet: Partial<TransactionFormValues> = {};
    if (parsed.CUSTOMER_NAME !== undefined)
      fieldsToSet.CUSTOMER_NAME = parsed.CUSTOMER_NAME;
    if (parsed.CUSTOMER_ADDRESS !== undefined)
      fieldsToSet.CUSTOMER_ADDRESS = parsed.CUSTOMER_ADDRESS;
    if (parsed.CUSTOMER_PHONE !== undefined)
      fieldsToSet.CUSTOMER_PHONE = parsed.CUSTOMER_PHONE;
    if (parsed.CUSTOMER_EMAIL !== undefined)
      fieldsToSet.CUSTOMER_EMAIL = parsed.CUSTOMER_EMAIL;
    if (parsed.DELIVERY_METHOD !== undefined)
      fieldsToSet.DELIVERY_METHOD = parsed.DELIVERY_METHOD;
    if (parsed.DELIVERY_DATE !== undefined)
      fieldsToSet.DELIVERY_DATE = parsed.DELIVERY_DATE as never;
    if (parsed.DELIVERY_TIME !== undefined)
      fieldsToSet.DELIVERY_TIME = parsed.DELIVERY_TIME as never;
    if (parsed.CARD_TO !== undefined) fieldsToSet.CARD_TO = parsed.CARD_TO;
    if (parsed.CARD_MESSAGE !== undefined)
      fieldsToSet.CARD_MESSAGE = parsed.CARD_MESSAGE;
    if (parsed.CARD_FROM !== undefined)
      fieldsToSet.CARD_FROM = parsed.CARD_FROM;

    const hasReceiverInfo =
      parsed.RECEIVER_NAME !== undefined ||
      parsed.RECEIVER_ADDRESS !== undefined ||
      parsed.RECEIVER_PHONE !== undefined;

    if (hasReceiverInfo) {
      // Set dulu supaya effect sinkronisasi "sama dengan pelanggan" tidak
      // menimpa nilai penerima yang baru saja di-parse.
      setReceiverSameAsCustomer(false);
      fieldsToSet.RECEIVER_NAME = parsed.RECEIVER_NAME ?? "";
      fieldsToSet.RECEIVER_ADDRESS = parsed.RECEIVER_ADDRESS ?? "";
      fieldsToSet.RECEIVER_PHONE = parsed.RECEIVER_PHONE ?? "";
    }

    if (parsed.ITEM_NAME !== undefined) {
      const currentDetails = form.getFieldValue("details") ?? [{}];
      const nextDetails = [...currentDetails];
      nextDetails[0] = { ...nextDetails[0], ITEM_NAME: parsed.ITEM_NAME };
      fieldsToSet.details = nextDetails;
    }

    form.setFieldsValue(fieldsToSet);
    message.success(
      "Form terisi dari teks order. Cek Qty, Harga Satuan, dan Metode Pembayaran sebelum submit.",
    );
  }

  function handleFinishFailed({
    errorFields,
  }: ValidateErrorEntity<TransactionFormValues>) {
    console.log(errorFields);
    if (!errorFields.length) return;

    message.error(
      "Ada input yang belum lengkap/valid, cek field yang ditandai merah.",
    );

    // Buka semua panel Item Pesanan (kalau ada yang collapsed) supaya field
    // yang error tidak tersembunyi.
    setExpandAllSignal((n) => n + 1);

    // Tunggu re-render (panel expand + animasi Collapse) baru scroll & fokus
    // ke field pertama yang error.
    setTimeout(() => {
      const firstErrorName = errorFields[0].name;
      form.scrollToField(firstErrorName, {
        behavior: "smooth",
        block: "center",
      });
      const instance = form.getFieldInstance(firstErrorName);
      instance?.focus?.();
    }, 350);
  }

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        details: [{}],
        ...initialValues,
      }}
      onFinish={handleFinish}
      onFinishFailed={handleFinishFailed}
    >
      {!isEdit && (
        <Card style={{ marginBottom: 16 }}>
          <Title level={5}>Import dari Teks Order</Title>
          <Form.Item
            label="Tempel teks order (format WA)"
            style={{ marginBottom: 12 }}
          >
            <Input.TextArea
              rows={6}
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              placeholder={
                "Thank you for placing your order!\nMohon diisi order form berikut:\nDetail PEMBELI:\nNama: ...\n..."
              }
            />
          </Form.Item>
          <Button onClick={handleApplyOrderText}>Parse &amp; Isi Form</Button>
        </Card>
      )}
      <Card style={{ marginBottom: 16 }}>
        <Title level={5}>Transaksi</Title>
        {isEdit && (
          <Form.Item label="Order ID" name="ORDER_ID">
            <Input disabled />
          </Form.Item>
        )}

        <Form.Item label="Sumber Order" name="ORDER_SOURCE" initialValue="WA">
          <Select
            placeholder="Pilih sumber order"
            options={ORDER_SOURCES.map((s) => ({ label: s, value: s }))}
          />
        </Form.Item>
        <Form.Item label="Nama Sales" name="SALES_NAME">
          <Input disabled />
        </Form.Item>
      </Card>
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={24} xl={12}>
          <Card style={{ height: "100%" }}>
            <Title level={5}>Pelanggan</Title>
            <Form.Item
              label="Nama Pelanggan"
              name="CUSTOMER_NAME"
              rules={[
                { required: true, message: "Nama pelanggan wajib diisi" },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item label="Alamat Pelanggan" name="CUSTOMER_ADDRESS">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item label="Telepon Pelanggan" name="CUSTOMER_PHONE">
              <PhoneNumberInput />
            </Form.Item>
            <Form.Item label="Email Pelanggan" name="CUSTOMER_EMAIL">
              <Input type="email" />
            </Form.Item>
          </Card>
        </Col>
        <Col span={24} xl={12}>
          <Card style={{ height: "100%" }}>
            <Title level={5}>Penerima</Title>
            <Checkbox
              checked={receiverSameAsCustomer}
              onChange={(e) =>
                handleReceiverSameAsCustomerChange(e.target.checked)
              }
              style={{ marginBottom: 16 }}
            >
              Sama dengan Pelanggan
            </Checkbox>
            <Form.Item label="Nama Penerima" name="RECEIVER_NAME">
              <Input disabled={receiverSameAsCustomer} />
            </Form.Item>
            <Form.Item label="Alamat Penerima" name="RECEIVER_ADDRESS">
              <Input.TextArea rows={2} disabled={receiverSameAsCustomer} />
            </Form.Item>
            <Form.Item label="Telepon Penerima" name="RECEIVER_PHONE">
              <PhoneNumberInput disabled={receiverSameAsCustomer} />
            </Form.Item>
          </Card>
        </Col>
      </Row>

      {/* ================= KARTU UCAPAN ================= */}
      <Card style={{ marginBottom: 16 }}>
        <Title level={5}>Kartu Ucapan</Title>
        <Form.Item label="Untuk" name="CARD_TO">
          <Input />
        </Form.Item>
        <Form.Item label="Dari" name="CARD_FROM">
          <Input />
        </Form.Item>
        <Form.Item label="Pesan Kartu Ucapan" name="CARD_MESSAGE">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item label="Note untuk Kartu Ucapan" name="CARD_NOTE">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Card>

      {/* ================= PENGIRIMAN ================= */}
      <Card style={{ marginBottom: 16 }}>
        <Title level={5}>Pengiriman</Title>
        <Form.Item label="Metode Pengiriman" name="DELIVERY_METHOD">
          <Select
            placeholder="Pilih metode pengiriman"
            options={DELIVERY_METHODS.map((m) => ({ label: m, value: m }))}
          />
        </Form.Item>
        <Form.Item label="Tanggal Pengiriman" name="DELIVERY_DATE">
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="Jam Pengiriman" name="DELIVERY_TIME">
          <TimePicker style={{ width: "100%" }} format="HH:mm" />
        </Form.Item>
        <Form.Item label="Ongkos Kirim" name="SHIPPING_FEE" initialValue={0}>
          <MoneyInput />
        </Form.Item>
      </Card>
      <Card style={{ marginBottom: 16 }}>
        <Title level={5}>Item Pesanan</Title>
        <ItemPesananList expandAllSignal={expandAllSignal} />
      </Card>

      {/* ================= PEMBAYARAN ================= */}
      <Card style={{ marginBottom: 16 }}>
        <Title level={5}>Pembayaran</Title>
        <Form.Item
          label="Metode Pembayaran"
          name="PAYMENT_METHOD"
          rules={[{ required: true, message: "Metode pembayaran wajib diisi" }]}
        >
          <Select
            placeholder="Pilih metode pembayaran"
            options={PAYMENT_METHODS.map((p) => ({ label: p, value: p }))}
          />
        </Form.Item>
        <Form.Item label="Uang Muka (DP)" name="DOWN_PAYMENT" initialValue={0}>
          <MoneyInput />
        </Form.Item>
      </Card>

      {/* ================= SUMMARY ================= */}
      <Card style={{ marginBottom: 16 }}>
        <Title level={5}>Summary</Title>
        <Form.Item label="Grand Total" name="GRAND_TOTAL" initialValue={0}>
          <MoneyInput disabled />
        </Form.Item>
        <Form.Item
          label="Sisa Pembayaran"
          name="REMAINING_BALANCE"
          initialValue={0}
        >
          <MoneyInput disabled />
        </Form.Item>
      </Card>

      <Form.Item style={{ marginTop: 16 }}>
        <Button
          type="primary"
          htmlType="submit"
          loading={submitting || uploadingImages}
          block
        >
          {uploadingImages
            ? "Mengupload foto…"
            : isEdit
              ? "Simpan Perubahan"
              : "Buat Transaksi"}
        </Button>
      </Form.Item>
    </Form>
  );
}
