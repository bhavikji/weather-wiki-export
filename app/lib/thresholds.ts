// app/lib/thresholds.ts
export const THRESHOLDS = {
  RAIN_MM: 2.5, // rainy day threshold (mm)
  SNOW_CM: 0.254, // snow day threshold (cm)
  PRECIP_MM: 0.1, // wet day threshold (mm) (optional if you track “wet days”)
} as const;
