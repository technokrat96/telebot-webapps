import { Transaction, TransactionDetail } from "@/types";
import { Dayjs } from "dayjs";

export type TransactionFormValues = Omit<Transaction, "ORDER_ID"> &
  Pick<
    TransactionDetail,
    | "RECEIVER_NAME"
    | "RECEIVER_ADDRESS"
    | "RECEIVER_PHONE"
    | "CARD_TO"
    | "CARD_FROM"
    | "CARD_MESSAGE"
    | "CARD_NOTE"
    | "CARD_CREATED_BY"
    | "DELIVERY_METHOD"
    | "SHIPPING_FEE"
  > & {
    ORDER_ID?: string;
    DELIVERY_DATE?: Dayjs;
    DELIVERY_TIME?: Dayjs;
    details: (Omit<
      TransactionDetail,
      | "ORDER_ID"
      | "ORDER_ITEM_ID"
      | "ITEM_STATUS"
      | "FLORIST_NAME"
      | "CARD_STATUS"
    > & {
      // Kosong untuk item baru (belum pernah disimpan). Untuk item lama yang
      // sedang diedit, ini dibawa balik lewat hidden Form.Item supaya saat
      // submit, backend tahu row mana yang harus di-UPDATE (bukan dianggap
      // item baru / bikin row baru).
      ORDER_ITEM_ID?: string;
      // Dipakai sementara di client sebelum submit: foto-foto yang dipilih
      // tapi belum diupload ke Blob storage. clientId cuma buat React key
      // (stabil walau urutan berubah). Selalu di-strip di handleFinish
      // sebelum diteruskan ke onSubmitAction.
      IMAGE_FILES?: { clientId: string; file: File }[];
    })[];
  };
