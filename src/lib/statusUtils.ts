import { TransactionDetail } from '@/types';

/** True when every line item of the order is DONE. */
export function isOrderFullyDone(details: TransactionDetail[]): boolean {
  return details.length > 0 && details.every((d) => d.ITEM_STATUS === 'DONE');
}

/** Orders where every line item currently has the given status. */
export function filterOrdersByStatus<T extends { details: TransactionDetail[] }>(
  orders: T[],
  status: string
): T[] {
  return orders.filter(
    (o) => o.details.length > 0 && o.details.every((d) => d.ITEM_STATUS === status)
  );
}
