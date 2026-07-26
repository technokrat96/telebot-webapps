import serverDayJs from "@/lib/server.dayjs";

export function generateOrderId(): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${serverDayJs().valueOf()}-${rand}`;
}

export function generateFloristAssignmentId(): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ASG-${serverDayJs().valueOf()}-${rand}`;
}

export function generateInvoiceId(): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${serverDayJs().valueOf()}-${rand}`;
}

export function generateOrderItemId(orderId: string, index: number): string {
  return `${orderId}-${String(index + 1).padStart(2, '0')}`;
}

export function generateInvoiceItemId(invoiceId: string, orderItemId: string): string {
  return `${invoiceId}-${orderItemId}`;
}