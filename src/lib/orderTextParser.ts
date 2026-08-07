import dayjs, { Dayjs } from "dayjs";

const INDONESIAN_MONTHS: Record<string, number> = {
  januari: 0,
  februari: 1,
  maret: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  agustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  desember: 11,
};

function parseIndonesianDate(value: string): Dayjs | undefined {
  const match = value.trim().match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/);
  if (!match) return undefined;
  const [, day, monthName, year] = match;
  const month = INDONESIAN_MONTHS[monthName.toLowerCase()];
  if (month === undefined) return undefined;
  return dayjs(new Date(Number(year), month, Number(day)));
}

function parseTime(value: string): Dayjs | undefined {
  const match = value.trim().match(/^(\d{1,2})[.:](\d{2})$/);
  if (!match) return undefined;
  const [, hour, minute] = match;
  return dayjs()
    .hour(Number(hour))
    .minute(Number(minute))
    .second(0)
    .millisecond(0);
}

function cleanValue(value: string): string {
  const v = value.trim();
  return v === "" || v === "-" ? "" : v;
}

export type ParsedOrderText = {
  CUSTOMER_NAME?: string;
  CUSTOMER_ADDRESS?: string;
  CUSTOMER_PHONE?: string;
  CUSTOMER_EMAIL?: string;
  RECEIVER_NAME?: string;
  RECEIVER_ADDRESS?: string;
  RECEIVER_PHONE?: string;
  ITEM_NAME?: string;
  DELIVERY_METHOD?: string;
  DELIVERY_DATE?: Dayjs;
  DELIVERY_TIME?: Dayjs;
  CARD_TO?: string;
  CARD_MESSAGE?: string;
  CARD_FROM?: string;
};

type Section = "HEADER" | "PEMBELI" | "PENERIMA" | "ORDER" | "CARD";

// Parses order-form text pasted from WhatsApp (format: "Label: value" per
// line, grouped under "Detail PEMBELI:", "Detail PENERIMA:", "Detail Order:",
// "Custom Greeting Card:" headers) into fields matching TransactionFormValues.
export function parseOrderText(rawText: string): ParsedOrderText {
  const result: ParsedOrderText = {};
  let section: Section = "HEADER";

  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const label = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (label.startsWith("detail pembeli")) {
      section = "PEMBELI";
      continue;
    }
    if (label.startsWith("detail penerima")) {
      section = "PENERIMA";
      continue;
    }
    if (label.startsWith("detail order")) {
      section = "ORDER";
      result.ITEM_NAME = cleanValue(value);
      continue;
    }
    if (label.startsWith("custom greeting card")) {
      section = "CARD";
      continue;
    }

    if (section === "PEMBELI") {
      if (label === "nama") result.CUSTOMER_NAME = cleanValue(value);
      else if (label === "alamat") result.CUSTOMER_ADDRESS = cleanValue(value);
      else if (label === "no hp") result.CUSTOMER_PHONE = cleanValue(value);
      else if (label === "email") result.CUSTOMER_EMAIL = cleanValue(value);
    } else if (section === "PENERIMA") {
      if (label === "nama") result.RECEIVER_NAME = cleanValue(value);
      else if (label === "alamat") result.RECEIVER_ADDRESS = cleanValue(value);
      else if (label === "no hp") result.RECEIVER_PHONE = cleanValue(value);
    } else if (section === "ORDER") {
      if (label === "date") {
        const parsedDate = parseIndonesianDate(value);
        if (parsedDate) result.DELIVERY_DATE = parsedDate;
      } else if (label.startsWith("pada pukul berapa")) {
        // Diisi hanya untuk opsi delivery -> kalau terisi berarti delivery.
        const parsedTime = parseTime(value);
        if (parsedTime) {
          result.DELIVERY_TIME = parsedTime;
          result.DELIVERY_METHOD = "Delivery";
        }
      }
    } else if (section === "CARD") {
      if (label === "to") result.CARD_TO = cleanValue(value);
      else if (label === "isi pesan") result.CARD_MESSAGE = cleanValue(value);
      else if (label === "from") result.CARD_FROM = cleanValue(value);
    }
  }

  return result;
}
