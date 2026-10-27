// src/lib/scan-parser.ts

/**
 * Parses and sanitizes a raw barcode scan or manual input string.
 * Strips non-printable ASCII control characters (0-31 except allowed whitespace),
 * trims leading/trailing whitespace, and ensures it satisfies minimum length.
 */
export function parseScanInput(rawText: string, minLength: number = 6): string | null {
  if (!rawText || typeof rawText !== "string") return null;

  // Remove non-printable control characters (ASCII 0x00 to 0x1F and 0x7F to 0x9F)
  const cleaned = rawText
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
    .trim();

  if (cleaned.length < minLength) {
    return null;
  }

  return cleaned;
}

/**
 * Checks if a sequence of keypress timestamps resembles a hardware barcode scanner.
 * Hardware scanners usually emit characters with intervals between 2ms and 35ms.
 */
export function isScannerBurst(intervals: number[], maxAverageIntervalMs: number = 50): boolean {
  if (intervals.length === 0) return false;
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  return avg <= maxAverageIntervalMs;
}
