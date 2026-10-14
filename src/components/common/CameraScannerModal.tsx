// src/components/common/CameraScannerModal.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import { Camera, X, AlertCircle, RefreshCw } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
}

export function CameraScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "Scan Shoe Barcode",
}: CameraScannerModalProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);
  const qrCodeInstanceRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg(null);
    setIsInitializing(true);
    let isMounted = true;
    const scannerId = "camera-barcode-scanner-view";

    const initScanner = async () => {
      try {
        // Small delay to ensure DOM element is mounted
        await new Promise((r) => setTimeout(r, 200));
        if (!isMounted) return;

        const html5QrCode = new Html5Qrcode(scannerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
          verbose: false,
        });
        qrCodeInstanceRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 12,
            qrbox: { width: 280, height: 160 },
          },
          (decodedText) => {
            if (isMounted) {
              onScan(decodedText.trim());
              onClose();
            }
          },
          () => {
            // Frame scan callback without match
          }
        );

        if (isMounted) {
          setIsInitializing(false);
        }
      } catch (err: any) {
        console.warn("Camera start failed:", err);
        if (isMounted) {
          setErrorMsg(
            err?.message ||
            "Could not access camera. Please check camera permissions or use manual entry below."
          );
          setIsInitializing(false);
        }
      }
    };

    initScanner();

    return () => {
      isMounted = false;
      if (qrCodeInstanceRef.current) {
        qrCodeInstanceRef.current
          .stop()
          .then(() => qrCodeInstanceRef.current?.clear())
          .catch((e) => console.log("Camera cleanup:", e));
      }
    };
  }, [isOpen, onScan, onClose]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      onClose();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(16, 24, 40, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          width: "100%",
          maxWidth: "420px",
          borderRadius: "16px",
          boxShadow: "var(--shadow-float)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", fontSize: "16px" }}>
            <Camera size={18} color="var(--primary)" />
            <span>{title}</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "var(--ink-2)",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Camera Viewfinder */}
        <div style={{ position: "relative", minHeight: "240px", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            id="camera-barcode-scanner-view"
            style={{ width: "100%", minHeight: "240px" }}
          />

          {isInitializing && !errorMsg && (
            <div
              style={{
                position: "absolute",
                color: "#ffffff",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
              }}
            >
              <RefreshCw className="animate-spin" size={24} />
              <span>Starting camera viewfinder...</span>
            </div>
          )}

          {errorMsg && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.85)",
                color: "#f87171",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                fontSize: "13px",
              }}
            >
              <AlertCircle size={32} style={{ marginBottom: "8px" }} />
              <div>{errorMsg}</div>
            </div>
          )}
        </div>

        {/* Manual Fallback Entry */}
        <form
          onSubmit={handleManualSubmit}
          style={{
            padding: "14px 16px",
            background: "var(--surface-sunken)",
            borderTop: "1px solid var(--line)",
            display: "flex",
            gap: "8px",
          }}
        >
          <input
            type="text"
            className="input-field"
            placeholder="Type barcode or SKU..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            style={{ flex: 1, fontSize: "14px", height: "42px" }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ height: "42px", padding: "0 16px" }}
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
