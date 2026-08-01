'use client';

import {Form, FormListFieldData, Input, Select, Space, Typography} from 'antd';
import {useEffect, useMemo} from 'react';
import {useMasterData} from '@/components/common/MasterDataProvider';
import MoneyInput from '@/components/MoneyInput';
import NumberInput from '@/components/NumberInput';
import ItemImagesField from './ItemImagesField';
import ProductNameField from './ProductNameField';
import type {TransactionFormValues} from './types';

/** Field-field untuk satu baris Item Pesanan (di dalam satu panel Collapse). */
export default function ItemPesananFields({
                             field,
                             form,
                           }: {
  field: Omit<FormListFieldData, "key">;
  form: ReturnType<typeof Form.useFormInstance<TransactionFormValues>>;
}) {
  const { data: { CURRENCY } } = useMasterData();
  const quantity = Form.useWatch(['details', field.name, 'QUANTITY'], form);
  const unitPrice = Form.useWatch(['details', field.name, 'UNIT_PRICE'], form);
  const currency = Form.useWatch(['details', field.name, 'CURRENCY'], form);

  const currencyData = useMemo(() => {
    return CURRENCY.find(e => e.value == currency);
  }, [CURRENCY, currency]);

  useEffect(() => {
    const subtotal = Number(quantity || 0) * (Number(unitPrice || 0) * (currencyData?.rate ?? 1));
    const currentDetails = form.getFieldValue('details') ?? [];
    // Hindari infinite loop: cuma set kalau nilainya memang berubah.
    if (currentDetails[field.name]?.SUBTOTAL !== subtotal) {
      const next = [...currentDetails];
      next[field.name] = {...next[field.name], SUBTOTAL: subtotal};
      form.setFieldsValue({details: next});
    }
  }, [currencyData, quantity, unitPrice, field.name, form]);

  useEffect(() => {
    const currentDetails = form.getFieldValue('details') ?? [];
    // Hindari infinite loop: cuma set kalau nilainya memang berubah.
    const next = [...currentDetails];
    if (currentDetails[field.name]?.CURRENCY_RATE !== currencyData?.rate) {
      next[field.name] = {...next[field.name], CURRENCY_RATE: currencyData?.rate};
      form.setFieldsValue({details: next});
    }
  }, [currencyData, field.name, form]);

  return (
    <>
      <Form.Item {...field} name={[field.name, 'ORDER_ITEM_ID']} key={[field.name, 'ORDER_ITEM_ID'].join("-")} hidden>
        <Input/>
      </Form.Item>
      <ProductNameField field={field} form={form}/>
      <Form.Item
        {...field}
        label="Qty"
        name={[field.name, 'QUANTITY']}
        key={[field.name, 'QUANTITY'].join("-")}
        initialValue={0}
        rules={[
          {
            validator: (_, value) =>
              Number(value) > 0 ? Promise.resolve() : Promise.reject(new Error('Qty wajib diisi')),
          },
        ]}
      >
        <NumberInput style={{width: '100%'}} min={1}/>
      </Form.Item>
      <Form.Item
        label="Harga Satuan"
        style={{ width: '100%' }}
        required
      >
        <Space.Compact style={{ width: '100%' }}>
          <Form.Item {...field} name={[field.name, 'CURRENCY']} key={[field.name, 'CURRENCY'].join("-")} initialValue={"IDR"}>
            <Select
              options={CURRENCY.map(({ label, value }) => ({ label, value }))}
              style={{ width: 80 }}
            />
          </Form.Item>
          <Form.Item {...field} name={[field.name, 'CURRENCY_RATE']} key={[field.name, 'CURRENCY_RATE'].join("-")} hidden>
            <Input/>
          </Form.Item>
          <Form.Item
            {...field}
            name={[field.name, 'UNIT_PRICE']}
            key={[field.name, 'UNIT_PRICE'].join("-")}
            style={{ width: '100%' }}
            initialValue={0}
            rules={[
              {
                validator: (_, value) =>
                  Number(value) > 0 ? Promise.resolve() : Promise.reject(new Error('Harga satuan wajib diisi')),
              },
            ]}
          >
            <MoneyInput currency={currency} />
          </Form.Item>
        </Space.Compact>
        {currencyData?.value != "IDR" && (
          <Typography.Text>Rate: {Number(currencyData?.rate ?? '1').toLocaleString("id-ID")}</Typography.Text>
        )}
      </Form.Item>
      <Form.Item {...field} label="Subtotal" name={[field.name, 'SUBTOTAL']} key={[field.name, 'SUBTOTAL'].join("-")} initialValue={0}>
        <MoneyInput currency={currency} disabled/>
      </Form.Item>
      <Form.Item {...field} label="Catatan Custom" name={[field.name, 'CUSTOM_NOTES']}
                 key={[field.name, 'CUSTOM_NOTES'].join("-")}>
        <Input.TextArea rows={2}/>
      </Form.Item>
      <ItemImagesField field={field} form={form}/>
    </>
  );
}
