// src/hooks/useBarcodeScanner.ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { parseScanInput, isScannerBurst } from "@/lib/scan-parser";
import { isScannerMuted, setScannerMuted } from "@/lib/audio-feedback";

interface BarcodeScannerOptions {
  enabled?: boolean;
  minLength?: number;
  maxIntervalMs?: number;
  targetInputId?: string;
}

export function useBarcodeScanner(
  onScan: (code: string) => void,
  options: BarcodeScannerOptions = {}
) {
  const {
    enabled = true,
    minLength = 6,
    maxIntervalMs = 60,
    targetInputId = "pos-barcode-input",
  } = options;

  const [muted, setMuted] = useState<boolean>(false);
  const bufferRef = useRef<string>("");
  const timestampsRef = useRef<number[]>([]);
  const lastKeyTimeRef = useRef<number>(0);

  // Sync mute state from localStorage
  useEffect(() => {
    setMuted(isScannerMuted());
  }, []);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setScannerMuted(next);
    setMuted(next);
  }, [muted]);

  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const triggerScan = useCallback(
    (raw: string) => {
      const parsed = parseScanInput(raw, minLength);
      if (parsed) {
        console.log(`[scanner] code=${parsed}, result=SUCCESS`);
        onScanRef.current(parsed);
      } else {
        console.log(`[scanner] code=${raw}, result=IGNORED_TOO_SHORT`);
      }
    },
    [minLength]
  );

  useEffect(() => {
    if (!enabled) return;

    // Attach simulation helper to window for automated testing and dev verification
    (window as any).__simulateScan = (code: string) => {
      console.log(`[scanner-simulation] injected code=${code}`);
      triggerScan(code);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if an active modal or dialog is present
      const modalActive = document.querySelector('[role="dialog"], .modal-open, [data-modal="true"]');
      if (modalActive) {
        return;
      }

      const activeEl = document.activeElement;
      const isTargetInput = targetInputId && activeEl?.id === targetInputId;

      // If typing in another input (like customer name or search), don't hijack unless it's the target barcode input
      const isOtherInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable);

      const now = Date.now();
      const delta = lastKeyTimeRef.current > 0 ? now - lastKeyTimeRef.current : 0;

      // Handle Enter / Tab terminators
      if (e.key === "Enter" || e.key === "Tab") {
        if (isTargetInput) {
          // If Enter was pressed while inside the target input, grab its text value or buffer
          const inputEl = activeEl as HTMLInputElement;
          const val = inputEl.value.trim() || bufferRef.current;
          if (val) {
            e.preventDefault();
            inputEl.value = "";
            bufferRef.current = "";
            timestampsRef.current = [];
            lastKeyTimeRef.current = 0;
            triggerScan(val);
            return;
          }
        } else if (!isOtherInput && bufferRef.current.length >= minLength) {
          // Scanner burst captured globally outside inputs
          e.preventDefault();
          const scanBuffer = bufferRef.current;
          bufferRef.current = "";
          timestampsRef.current = [];
          lastKeyTimeRef.current = 0;
          triggerScan(scanBuffer);
          return;
        }

        // Reset buffer on unconsumed Enter
        bufferRef.current = "";
        timestampsRef.current = [];
        lastKeyTimeRef.current = 0;
        return;
      }

      // Ignore modifier combinations (Ctrl, Alt, Meta)
      if (e.ctrlKey || e.altKey || e.metaKey || e.key.length > 1) {
        return;
      }

      // If user is typing in another input and speed is human (>45ms), let normal typing happen
      if (isOtherInput && !isTargetInput) {
        // Reset scanner buffer so human typing doesn't leak into scanner
        bufferRef.current = "";
        timestampsRef.current = [];
        lastKeyTimeRef.current = 0;
        return;
      }

      // If interval between keys is too long, reset buffer for a new scan sequence
      if (delta > maxIntervalMs) {
        bufferRef.current = "";
        timestampsRef.current = [];
      }

      if (delta > 0) {
        timestampsRef.current.push(delta);
      }
      lastKeyTimeRef.current = now;
      bufferRef.current += e.key;
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      delete (window as any).__simulateScan;
    };
  }, [enabled, minLength, maxIntervalMs, targetInputId, triggerScan]);

  return {
    isMuted: muted,
    toggleMute,
    simulateScan: triggerScan,
  };
}
