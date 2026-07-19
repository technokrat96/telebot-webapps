export function generateOrderId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${y}${m}${d}-${rand}`;
}

/** Order Item ID derived from its parent Order ID + 1-based position. */
export function generateOrderItemId(orderId: string, index: number): string {
  return `${orderId}-${String(index + 1).padStart(2, '0')}`;
}