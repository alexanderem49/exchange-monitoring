import { google } from "googleapis";
import { JWT } from "google-auth-library";
import { secrets } from "./aws-secrets";

let auth: JWT;
let sheetId: string;

export type TokenList = {
    network: string;
    tokensAddresses: string[];
}

export async function initGoogleApi() {
    const clientEmail = secrets["GOOGLE_APIS_CLIENT_EMAIL"];
    const privateKey = secrets["GOOGLE_APIS_PRIVATE_KEY"];
    sheetId = secrets["GOOGLE_APIS_SHEET_ID"] as string;

    if (clientEmail == null || privateKey == null || sheetId == null) {
        throw new Error("No Google API credentials found");
    }

    const buff = Buffer.from(privateKey, 'base64');
    const key = buff.toString('ascii');

    auth = new google.auth.JWT({
        email: clientEmail,
        key: key,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
}

export async function getTokens() {
    let result: TokenList[] = [];
    const sheets = google.sheets({ version: "v4", auth });

    let i: number = 0;

    while (true) {
        const colLetter = columnIndexToLetter((i++) * 2);
        let res = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `'Token addresses'!${colLetter}:${colLetter}`
        });

        if (res == null || res.data.values == null || res.data.values.length == 0) {
            break;
        }

        result.push({
            network: res.data.values[0][0],
            tokensAddresses: res.data.values.slice(1).map((row: string[]) => row[0]).filter((row: string) => row != null && row != "")
        });
    }

    return result;
}

export async function addDataToSheet(network:string, data: any[][]) {
    const sheets = google.sheets({ version: "v4", auth });

    await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `'${network} exchange'!A1`,
        valueInputOption: "RAW",
        requestBody: {
            values: data
        }
    });
}

export function columnIndexToLetter(n: number): string {
  let a: number;
  return (a = Math.floor(n / 26)) >= 0
    ? columnIndexToLetter(a-1) + String.fromCharCode(65 + (n % 26))
    : '';
}