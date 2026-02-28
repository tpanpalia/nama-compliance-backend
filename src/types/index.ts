// GPS enforcement
export const GPS_MAX_DISTANCE_METERS = parseInt(process.env.GPS_MAX_DISTANCE_METERS || '100', 10);
export const GPS_MAX_ACCURACY_METERS = parseInt(process.env.GPS_MAX_ACCURACY_METERS || '50', 10);

// Evidence limits
export const MAX_PHOTOS_PER_WORKORDER = parseInt(process.env.MAX_PHOTOS_PER_WORKORDER || '20', 10);
export const MAX_VIDEOS_PER_WORKORDER = parseInt(process.env.MAX_VIDEOS_PER_WORKORDER || '5', 10);
export const MAX_PHOTO_SIZE_BYTES = parseInt(process.env.MAX_FILE_SIZE_PHOTO_MB || '10', 10) * 1024 * 1024;
export const MAX_VIDEO_SIZE_BYTES = parseInt(process.env.MAX_FILE_SIZE_VIDEO_MB || '50', 10) * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 120;

// Scoring — 3-state rating point values
export const RATING_POINTS = {
  COMPLIANT: 100,
  PARTIAL: 67,
  NON_COMPLIANT: 33,
} as const;

// Compliance bands
export const COMPLIANCE_BANDS = {
  EXCELLENT: { min: 90, max: 100, label: 'Excellent' },
  GOOD: { min: 70, max: 89, label: 'Good' },
  FAIR: { min: 50, max: 69, label: 'Fair' },
  POOR: { min: 0, max: 49, label: 'Poor' },
} as const;

// Work order reference format: INS-YYYY-NNNNN
export const generateWorkOrderReference = (sequence: number): string => {
  const year = new Date().getFullYear();
  const seq = String(sequence).padStart(5, '0');
  return `INS-${year}-${seq}`;
};

// Contractor ID format: C-XXXXX
export const generateContractorId = (sequence: number): string => {
  const seq = String(sequence).padStart(5, '0');
  return `C-${seq}`;
};

export function generateRequestId(date: Date, sequence: number): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const seq = String(sequence).padStart(3, '0');
  return `REQ-${year}${month}${day}-${seq}`;
}
