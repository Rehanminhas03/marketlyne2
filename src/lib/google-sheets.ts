import { google } from "googleapis";

const SHEET_NAME = "Client Database";

const getGoogleSheetsClient = async () => {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Google Sheets credentials not configured");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
};

export const appendToGoogleSheet = async (data: (string | number | boolean)[]) => {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("Google Sheets spreadsheet ID not configured");
  }

  const sheets = await getGoogleSheetsClient();

  // Read column A to find the last row that actually has data (ignores empty rows)
  const colA = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${SHEET_NAME}'!A:A`,
  });

  const rows = colA.data.values || [];
  // Find last non-empty row index (0-based), then convert to 1-based sheet row
  let lastDataRow = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i] && rows[i][0] && String(rows[i][0]).trim() !== "") {
      lastDataRow = i + 1; // convert to 1-based
      break;
    }
  }
  const nextRow = lastDataRow + 1;

  console.log(`Writing to row ${nextRow} (last data row was ${lastDataRow})`);

  // Write directly to the exact next row
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${SHEET_NAME}'!A${nextRow}:R${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [data.map(String)],
    },
  });

  console.log("Written to range:", response.data.updatedRange);
  return response.data;
};

export const getGoogleSheetData = async () => {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("Google Sheets spreadsheet ID not configured");
  }

  const sheets = await getGoogleSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${SHEET_NAME}'!A:R`,
  });

  return response.data.values || [];
};
