// app/lib/openMeteoErrors.ts

import { OpenMeteoErrorPayload } from "@/app/types/open-meteo-errors.types";

export function isOpenMeteoErrorPayload(
  x: unknown
): x is OpenMeteoErrorPayload {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return o.error === true && typeof o.reason === "string";
}

export type DomainErrorCode =
  | "OPEN_METEO_BAD_REQUEST"
  | "OPEN_METEO_MISSING_VARIABLE"
  | "INPUT_VALIDATION"
  | "SHEETS_FORBIDDEN"
  | "RATE_LIMITED"
  | "CONFIG"
  | "UNKNOWN";

export type DomainError = {
  code: DomainErrorCode;
  message: string;
  httpStatus: 400 | 403 | 429 | 500;
  details?: Record<string, unknown>;
};

export function domainError(e: DomainError): DomainError {
  return e;
}

export function isDomainError(err: unknown): err is DomainError {
  if (typeof err !== "object" || err === null) return false;
  const o = err as Record<string, unknown>;
  return (
    typeof o.code === "string" &&
    typeof o.message === "string" &&
    typeof o.httpStatus === "number"
  );
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Unknown error";
}

export function extractOpenMeteoPayload(
  err: unknown
): OpenMeteoErrorPayload | null {
  if (isOpenMeteoErrorPayload(err)) return err;

  if (typeof err === "object" && err !== null) {
    const o = err as Record<string, unknown>;
    if (isOpenMeteoErrorPayload(o.cause))
      return o.cause as OpenMeteoErrorPayload;
    if (isOpenMeteoErrorPayload(o.data)) return o.data as OpenMeteoErrorPayload;
    if (isOpenMeteoErrorPayload(o.body)) return o.body as OpenMeteoErrorPayload;
  }
  return null;
}

export function normalizeError(err: unknown): DomainError {
  if (isDomainError(err)) return err;

  const om = extractOpenMeteoPayload(err);
  if (om) {
    return domainError({
      code: "OPEN_METEO_BAD_REQUEST",
      message: om.reason,
      httpStatus: 400,
      details: { source: "open-meteo", reason: om.reason },
    });
  }

  const msg = getErrorMessage(err);

  if (
    /OPEN_METEO_MISSING_VARIABLE/i.test(msg) ||
    /Missing daily field/i.test(msg)
  ) {
    return domainError({
      code: "OPEN_METEO_MISSING_VARIABLE",
      message: msg,
      httpStatus: 400,
    });
  }

  if (/OPEN_METEO_BAD_REQUEST/i.test(msg)) {
    return domainError({
      code: "OPEN_METEO_BAD_REQUEST",
      message: msg,
      httpStatus: 400,
    });
  }

  if (/PERMISSION_DENIED/i.test(msg) || /\b403\b/.test(msg)) {
    return domainError({
      code: "SHEETS_FORBIDDEN",
      message:
        "Google Sheets permission denied. Ensure the Sheet is shared with the service account email as Editor, and the Google Sheets API is enabled.",
      httpStatus: 403,
      details: { raw: msg },
    });
  }

  if (
    /Too Many Requests/i.test(msg) ||
    /\b429\b/.test(msg) ||
    /rate limit/i.test(msg)
  ) {
    return domainError({
      code: "RATE_LIMITED",
      message: "Rate limit exceeded. Please retry after some time.",
      httpStatus: 429,
      details: { raw: msg },
    });
  }

  if (/Missing GOOGLE_/i.test(msg) || /Missing .*SHEET_ID/i.test(msg)) {
    return domainError({
      code: "CONFIG",
      message: msg,
      httpStatus: 500,
    });
  }

  return domainError({
    code: "UNKNOWN",
    message: msg,
    httpStatus: 500,
  });
}
