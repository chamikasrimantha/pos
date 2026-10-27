import { describe, it, expect } from "vitest";
import { parseScanInput, isScannerBurst } from "../scan-parser";

describe("parseScanInput", () => {
  it("trims and sanitizes valid barcodes", () => {
    expect(parseScanInput("  8901234567890  ")).toBe("8901234567890");
    expect(parseScanInput("RW-SH-001\r\n")).toBe("RW-SH-001");
  });

  it("strips non-printable ASCII characters", () => {
    const withControlChars = "\x028901234567890\x03";
    expect(parseScanInput(withControlChars)).toBe("8901234567890");
  });

  it("rejects codes below minimum length", () => {
    expect(parseScanInput("123", 6)).toBeNull();
    expect(parseScanInput("   ", 6)).toBeNull();
    expect(parseScanInput("", 6)).toBeNull();
  });

  it("detects scanner burst vs slow human typing", () => {
    // Hardware scanner burst: ~10ms between keys
    const scannerIntervals = [12, 14, 8, 15, 11, 9, 13];
    expect(isScannerBurst(scannerIntervals, 40)).toBe(true);

    // Human typing: > 100ms between keys
    const humanIntervals = [180, 220, 150, 310, 190];
    expect(isScannerBurst(humanIntervals, 40)).toBe(false);
  });
});
