"use client";

import { Form } from "antd";
import { useState } from "react";
import ItemPesananCollapse from "./ItemPesananCollapse";

/** Wrapper Form.List untuk "details" — jembatan antara antd Form.List dan ItemPesananCollapse. */
export default function ItemPesananList({
  expandAllSignal,
}: {
  expandAllSignal: number;
}) {
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  return (
    <Form.List name="details">
      {(fields, { add, remove }) => {
        return (
          <ItemPesananCollapse
            fields={fields}
            addAction={add}
            removeAction={remove}
            activeKeys={activeKeys}
            setActiveKeysAction={setActiveKeys}
            expandAllSignal={expandAllSignal}
          />
        );
      }}
    </Form.List>
  );
}
