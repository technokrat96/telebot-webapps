"use client";

import {
  Form,
  FormListFieldData,
  Input,
  Select,
  Space,
  Typography,
} from "antd";
import { useEffect, useMemo, useRef } from "react";
import { useMasterData } from "@/components/common/MasterDataProvider";
import MoneyInput from "@/components/MoneyInput";
import NumberInput from "@/components/NumberInput";
import ItemImagesField from "./ItemImagesField";
import ProductNameField from "./ProductNameField";
import type { TransactionFormValues } from "./types";
function SilentFieldRegistrar() {
  return null;
}
/** Field-field untuk satu baris Item Pesanan (di dalam satu panel Collapse). */
export default function ItemPesananFields({
  field,
  form,
}: {
  field: Omit<FormListFieldData, "key">;
  form: ReturnType<typeof Form.useFormInstance<TransactionFormValues>>;
}) {
  const {
    data: { CURRENCY },
  } = useMasterData();
  const quantity = Form.useWatch(["details", field.name, "QUANTITY"], form);
  const unitPrice = Form.useWatch(["details", field.name, "UNIT_PRICE"], form);
  const currency = Form.useWatch(["details", field.name, "CURRENCY"], form);

  const currencyData = useMemo(() => {
    return CURRENCY.find((e) => e.value == currency);
  }, [CURRENCY, currency]);

  // Simpan rate currency sebelumnya per baris ini, dipakai efek di bawah
  // buat konversi otomatis UNIT_PRICE saat CURRENCY diganti.
  const prevRateRef = useRef<number>(Number(currencyData?.rate ?? 1));

  // Kalau user ganti CURRENCY, konversi UNIT_PRICE supaya nilai realnya
  // tetap setara -- pivot lewat IDR: idrValue = harga lama x rate lama,
  // harga baru = idrValue / rate baru. Jadi ganti currency langsung 2x
  // (mis. USD -> SGD) pun otomatis benar karena tetap lewat IDR.
  useEffect(() => {
    const newRate = Number(currencyData?.rate ?? 1);
    const oldRate = prevRateRef.current;
    if (oldRate !== newRate) {
      const currentDetails = form.getFieldValue("details") ?? [];
      const oldUnitPrice = Number(currentDetails[field.name]?.UNIT_PRICE ?? 0);
      if (oldUnitPrice > 0) {
        const idrValue = oldUnitPrice * oldRate;
        const converted = idrValue / newRate;
        // Semua currency (termasuk IDR) sekarang boleh 2 desimal.
        const newUnitPrice = Math.round(converted * 100) / 100;
        const next = [...currentDetails];
        next[field.name] = {
          ...next[field.name],
          UNIT_PRICE: newUnitPrice,
          CURRENCY_RATE: newRate,
        };
        form.setFieldsValue({ details: next });
      }
    }
    prevRateRef.current = newRate;
  }, [currencyData, field.name, form]);

  useEffect(() => {
    // SUBTOTAL tetap dalam currency baris ini sendiri (sama seperti
    // UNIT_PRICE) -- BUKAN dikonversi ke IDR di sini. Konversi ke IDR baru
    // terjadi pas dijumlahkan jadi GRAND_TOTAL (lihat TransactionForm/index.tsx),
    // pakai CURRENCY_RATE baris ini.
    const newRate = Number(currencyData?.rate ?? 1);
    const subtotal = Number(quantity || 0) * Number(unitPrice || 0);
    const currentDetails = form.getFieldValue("details") ?? [];
    // Hindari infinite loop: cuma set kalau nilainya memang berubah.
    if (currentDetails[field.name]?.SUBTOTAL !== subtotal) {
      const next = [...currentDetails];
      next[field.name] = {
        ...next[field.name],
        SUBTOTAL: subtotal,
        CURRENCY_RATE: newRate,
      };
      form.setFieldsValue({ details: next });
    }
  }, [currencyData, quantity, unitPrice, field.name, form]);

  return (
    <>
      <Form.Item
        {...field}
        name={[field.name, "ORDER_ITEM_ID"]}
        key={[field.name, "ORDER_ITEM_ID"].join("-")}
        noStyle
      >
        <SilentFieldRegistrar />
      </Form.Item>
      <ProductNameField field={field} form={form} />
      <Form.Item
        {...field}
        label="Qty"
        name={[field.name, "QUANTITY"]}
        key={[field.name, "QUANTITY"].join("-")}
        initialValue={0}
        rules={[
          {
            validator: (_, value) =>
              Number(value) > 0
                ? Promise.resolve()
                : Promise.reject(new Error("Qty wajib diisi")),
          },
        ]}
      >
        <NumberInput style={{ width: "100%" }} min={1} />
      </Form.Item>
      <Form.Item label="Harga Satuan" style={{ width: "100%" }} required>
        <Space.Compact style={{ width: "100%" }}>
          <Form.Item
            {...field}
            name={[field.name, "CURRENCY"]}
            key={[field.name, "CURRENCY"].join("-")}
            initialValue={"IDR"}
          >
            <Select
              options={CURRENCY.map(({ label, value }) => ({ label, value }))}
              style={{ width: 80 }}
            />
          </Form.Item>
          <Form.Item
            {...field}
            name={[field.name, "CURRENCY_RATE"]}
            key={[field.name, "CURRENCY_RATE"].join("-")}
            noStyle
          >
            <SilentFieldRegistrar />
          </Form.Item>
          <Form.Item
            {...field}
            name={[field.name, "UNIT_PRICE"]}
            key={[field.name, "UNIT_PRICE"].join("-")}
            style={{ width: "100%" }}
            initialValue={0}
            rules={[
              {
                validator: (_, value) =>
                  Number(value) > 0
                    ? Promise.resolve()
                    : Promise.reject(new Error("Harga satuan wajib diisi")),
              },
            ]}
          >
            {/* showCurrencySymbol false: currency-nya sudah dipilih lewat
                Select di sebelah kiri (Space.Compact yang sama), jadi tidak
                perlu ditampilkan dobel di dalam MoneyInput ini. */}
            <MoneyInput currency={currency} showCurrencySymbol={false} />
          </Form.Item>
        </Space.Compact>
        {currencyData?.value != "IDR" && (
          <Typography.Text>
            Rate: {Number(currencyData?.rate ?? "1").toLocaleString("id-ID")}
          </Typography.Text>
        )}
      </Form.Item>
      <Form.Item
        {...field}
        label="Subtotal"
        name={[field.name, "SUBTOTAL"]}
        key={[field.name, "SUBTOTAL"].join("-")}
        initialValue={0}
      >
        {/* SUBTOTAL = quantity x UNIT_PRICE, jadi masih dalam currency baris
            ini (sama seperti UNIT_PRICE). Konversi ke IDR baru dilakukan pas
            dijumlah jadi GRAND_TOTAL di summary. */}
        <MoneyInput currency={currency} disabled />
      </Form.Item>
      <Form.Item
        {...field}
        label="Catatan Custom"
        name={[field.name, "CUSTOM_NOTES"]}
        key={[field.name, "CUSTOM_NOTES"].join("-")}
      >
        <Input.TextArea rows={2} />
      </Form.Item>
      <ItemImagesField field={field} form={form} />
    </>
  );
}
