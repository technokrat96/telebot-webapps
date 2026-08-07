import { TransactionDetail } from "@/types";

export function isOrderFullyDone(details: TransactionDetail[]): boolean {
  return details.length > 0 && details.every((d) => d.ITEM_STATUS === "DONE");
}

// filterOrdersByDeliveryStatus dulu ada di sini (filter berdasarkan
// TransactionDetail.DELIVERY_STATUS). Field itu sudah dipindah ke
// DeliveryDriverAssignment.DELIVERY_STATUS -- lihat
// src/lib/db/deliveryDriverAssignment.ts untuk query kurir yang baru
// (available/mine, berbasis klaim per order).
