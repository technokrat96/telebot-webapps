'use client';

import {Button, Collapse, Form, FormListFieldData, FormListOperation, Space} from 'antd';
import {MinusCircleOutlined, PlusOutlined} from '@ant-design/icons';
import {Dispatch, SetStateAction, useEffect, useRef} from 'react';
import ItemPesananFields from './ItemPesananFields';
import type {TransactionFormValues} from './types';

/** Daftar Item Pesanan sebagai panel-panel Collapse yang bisa ditambah/dihapus. */
export default function ItemPesananCollapse({fields, addAction, removeAction, activeKeys, setActiveKeysAction, expandAllSignal}: {
  fields: FormListFieldData[],
  addAction: FormListOperation["add"]
  removeAction: FormListOperation["add"],
  activeKeys: string[],
  setActiveKeysAction: Dispatch<SetStateAction<string[]>>,
  expandAllSignal: number,
}) {
  const form = Form.useFormInstance<TransactionFormValues>();
  const isFirstExpandSignal = useRef(true);

  // Buka item pertama otomatis saat baru pertama kali render dengan 1 item.
  useEffect(() => {
    if (fields.length === 1) {
      const onlyKey = fields[0].key.toString();
      setActiveKeysAction((prev: string[]) =>
        prev.includes(onlyKey) ? prev : [onlyKey]
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.length]);

  // Dipicu dari parent saat submit gagal validasi: buka semua panel item
  // biar field yang error (mis. Qty/Harga di item yang collapsed) kelihatan.
  useEffect(() => {
    if (isFirstExpandSignal.current) {
      isFirstExpandSignal.current = false;
      return;
    }
    setActiveKeysAction(fields.map((f) => f.key.toString()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandAllSignal]);

  return (
    <>
      {fields.length > 0 && (
        <Collapse activeKey={activeKeys} onChange={(keys) => setActiveKeysAction(keys as string[])}
                  style={{marginBottom: 16}}
                  items={
                    fields.map((field, idx) => {
                      const {key, ...inputField} = field;
                      const panelKey = field.key.toString();
                      const isOnlyOneItem = fields.length === 1;
                      return {
                        key: panelKey,
                        collapsible: isOnlyOneItem ? 'disabled' : 'header',
                        showArrow: !isOnlyOneItem,
                        label: (
                          <>
                            <Space style={{width: '100%', justifyContent: 'space-between'}}>
                              <span style={{fontWeight: 'bold'}}>Item {idx + 1}</span>
                              {fields.length > 1 && (
                                <MinusCircleOutlined
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeAction(field.name);
                                  }}
                                  style={{color: '#ff4d4f'}}
                                />
                              )}
                            </Space>
                          </>
                        ),
                        children: (
                          <ItemPesananFields field={inputField} form={form}/>
                        )
                      };
                    })
                  }
        >
          {}
        </Collapse>
      )}
      <Button
        type="dashed"
        onClick={() => {
          addAction();
          // key baru dari antd biasanya = max(existing keys) + 1
          setActiveKeysAction((prev: string[]) => {
            const maxKey = fields.length > 0 ? Math.max(...fields.map((f: any) => f.key)) : -1;
            return [...prev, (maxKey + 1).toString()];
          });
        }}
        block
        icon={<PlusOutlined/>}
      >
        Tambah Item
      </Button>
    </>
  );
}
