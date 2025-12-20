// app/lib/googleSheetsClient.ts
import { google } from "googleapis";
import { domainError } from "./openMeteoErrors";

export function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email) {
    throw domainError({
      code: "CONFIG",
      message: "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL",
      httpStatus: 500,
    });
  }

  if (!key) {
    throw domainError({
      code: "CONFIG",
      message: "Missing GOOGLE_PRIVATE_KEY",
      httpStatus: 500,
    });
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}
