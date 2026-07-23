import {prisma} from "@/lib/prismaClient";
import {MasterData} from "@/types";

type CurrencyFindManyFunctionType = typeof prisma.currency.findMany;
type CurrencyList = Awaited<ReturnType<CurrencyFindManyFunctionType>>;
type MasterDataFindManyFunctionType = typeof prisma.masterData.findMany;
type MasterDataList = Awaited<ReturnType<MasterDataFindManyFunctionType>>;

function mapCurrency(list: CurrencyList): MasterData["CURRENCY"] {
  return list.map(e => ({
    label: e.label,
    locale: e.locale,
    value: e.code,
    rate: Number(e.rate).valueOf()
  }))
}

function groupCategory(category: string, list: MasterDataList): string[] {
  return list.filter((item) => category === item.category)
    .sort((a,b)=> a.sortOrder - b.sortOrder)
    .map(e => e.value)
}

export async function getMasterData(): Promise<MasterData> {
  const masterDataItems = await prisma.masterData.findMany();
  const currencyItems = await prisma.currency.findMany();

  const res: MasterData = {
    ROLES: groupCategory("ROLE", masterDataItems),
    PAYMENT_METHODS: groupCategory("PAYMENT_METHOD", masterDataItems),
    ORDER_SOURCES: groupCategory("ORDER_SOURCE", masterDataItems),
    ITEM_STATUSES: groupCategory("ITEM_STATUS", masterDataItems),
    DELIVERY_METHODS: groupCategory("DELIVERY_METHOD", masterDataItems),
    DELIVERY_STATUSES: groupCategory("DELIVERY_STATUS", masterDataItems),
    CARD_STATUSES: groupCategory("CARD_STATUS", masterDataItems),
    INVOICE_STATUSES: groupCategory("INVOICE_STATUS", masterDataItems),
    FLORIST_ASSIGNMENT_STATUSES: groupCategory("FLORIST_ASSIGNMENT_STATUS", masterDataItems),
    CURRENCY: mapCurrency(currencyItems),
  };

  return res;
}