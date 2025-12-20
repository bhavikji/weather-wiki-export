// UI-related shared types used by client components

export type DomainErrorResponse = {
  success: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
};

export type SuccessResponse = {
  success: true;
  latitude: number;
  longitude: number;
  startYear: number;
  endYear: number;
};

export type ExportResponse = SuccessResponse | DomainErrorResponse;

export type FormState = {
  latitude: string;
  longitude: string;
  sheetId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
};

export type SheetSelectProps = {
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  className?: string;
};

export type ResultBannerProps = {
  result: ExportResponse | null;
  loading: boolean;
  reorderLoading: boolean;
  selectedSheetLabel: string | null;
};

export type ExportFormState = FormState;
