import { google, sheets_v4 } from 'googleapis';

/**
 * Generic helper layer on top of the Google Sheets API.
 * Every "table" in this app is one sheet/tab. The first row of each
 * sheet is treated as the header row and used as the object keys.
 *
 * This is intentionally simple (full-sheet read + in-memory find) since
 * these sheets are expected to stay in the hundreds/low-thousands of rows
 * range for an operational tool like this. If it needs to scale further,
 * swap this module for a real database without touching the callers in
 * src/lib/sheets/*.
 */

let cachedClient: sheets_v4.Sheets | null = null;

function getClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !key) {
    throw new Error(
      'Missing GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY env vars'
    );
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  cachedClient = google.sheets({ version: 'v4', auth });
  return cachedClient;
}

function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('Missing GOOGLE_SHEET_ID env var');
  return id;
}

/** Reads a whole sheet and returns rows as objects keyed by the header row. */
export async function readSheet<T = Record<string, string>>(
  sheetName: string
): Promise<T[]> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: sheetName,
  });

  const rows = res.data.values ?? [];
  if (rows.length === 0) return [];

  const [header, ...body] = rows;
  return body.map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((key, i) => {
      obj[key] = row[i] ?? '';
    });
    return obj as T;
  });
}

/** Appends one row at the end of the sheet, matching column order to the header row. */
export async function appendRow<T = Record<string, any>>(
  sheetName: string,
  rowObject: T
): Promise<void> {
  const sheets = getClient();
  const header = await getHeader(sheetName);
  const row = header.map((key) => String(rowObject[key] ?? ''));

  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

/**
 * Updates the first row where `matchColumn` equals `matchValue` with the
 * fields present in `updates` (partial update, other columns are kept).
 * Returns false if no matching row was found.
 */
export async function updateRow(
  sheetName: string,
  matchColumn: string,
  matchValue: string,
  updates: Record<string, string | number>
): Promise<boolean> {
  const sheets = getClient();
  const header = await getHeader(sheetName);
  const matchIndex = header.indexOf(matchColumn);
  if (matchIndex === -1) {
    throw new Error(`Column ${matchColumn} not found in sheet ${sheetName}`);
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: sheetName,
  });
  const rows = res.data.values ?? [];

  const rowIndex = rows.findIndex(
    (row, i) => i > 0 && row[matchIndex] === matchValue
  );
  if (rowIndex === -1) return false;

  const currentRow = rows[rowIndex];
  const mergedRow = header.map((key, i) => {
    if (key in updates) return String(updates[key]);
    return currentRow[i] ?? '';
  });

  const sheetRowNumber = rowIndex + 1; // 1-based, header is row 1
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `${sheetName}!A${sheetRowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [mergedRow] },
  });

  return true;
}

async function getHeader(sheetName: string): Promise<string[]> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${sheetName}!1:1`,
  });
  const header = res.data.values?.[0];
  if (!header) throw new Error(`Sheet ${sheetName} has no header row`);
  return header;
}

/**
 * Reads a sheet organized as columns of independent lists (not row-records).
 * Each header is a category name, and every non-empty cell below it in that
 * column is one value of that category. Columns can have different lengths
 * (shorter columns just have blank cells below their last value) — blank
 * cells are filtered out, not treated as valid entries.
 *
 * Used for the `MasterData` sheet: ROLE | PAYMENT_METHOD | ORDER_SOURCE | ...
 */
export async function readSheetColumns(
  sheetName: string
): Promise<Record<string, string[]>> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: sheetName,
  });

  const rows = res.data.values ?? [];
  if (rows.length === 0) return {};

  const [header, ...body] = rows;
  const result: Record<string, string[]> = {};

  header.forEach((key, colIndex) => {
    if (!key) return;
    const values = body
      .map((row) => row[colIndex])
      .filter((v): v is string => !!v && v.trim() !== '');
    result[key] = values;
  });

  return result;
}
