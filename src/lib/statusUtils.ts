import {TransactionDetail} from '@/types';

export function isOrderFullyDone(details: TransactionDetail[]): boolean {
  return details.length > 0 && details.every((d) => d.ITEM_STATUS === 'DONE');
}

export function filterOrdersByDeliveryStatus<T extends { details: TransactionDetail[] }>(
  orders: T[],
  status: string,
): T[] {
  return orders.filter(
    (o) => o.details.length > 0 && o.details.every((d) => d.DELIVERY_STATUS === status)
  );
}
