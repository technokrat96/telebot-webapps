import 'server-only';
import { prisma } from '@/lib/prismaClient';
import { Decimal } from '@prisma/client-runtime-utils';

export async function listCurrencyCodes(): Promise<string[]> {
  const rows = await prisma.currency.findMany({ select: { code: true } });
  return rows.map((r) => r.code);
}

export async function updateCurrencyRate(code: string, rate: number): Promise<void> {
  await prisma.currency.upsert({
    where: { code },
    create: {
      code,
      label: code,
      rate: new Decimal(rate),
      locale: code == 'IDR' ? 'id-ID' : 'en-US'
    },
    update: { rate: new Decimal(rate) },
  });
}
