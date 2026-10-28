// src/components/modals/PrintModal.tsx
"use client";

import React, { useRef } from "react";
import { useApp } from "@/context/AppContext";
import { Printer, X } from "lucide-react";

export function PrintModal() {
  const { printModal, closePrintModal } = useApp();
  const printRef = useRef<HTMLDivElement>(null);

  if (!printModal.isOpen) return null;

  const isThermalLabel =
    printModal.htmlContent.includes("thermal-barcode-label") ||
    printModal.title.toLowerCase().includes("barcode label");

  const isA4Sheet = printModal.htmlContent.includes("a4-label-sheet");

  const isA4 =
    !isThermalLabel &&
    (isA4Sheet ||
      printModal.htmlContent.includes("210mm") ||
      printModal.htmlContent.includes("AUDIT REPORT") ||
      printModal.htmlContent.includes("STATUS AUDIT") ||
      printModal.title.toLowerCase().includes("a4"));

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open(
      "",
      "_blank",
      isA4 ? "width=900,height=960" : isThermalLabel ? "width=420,height=520" : "width=480,height=640"
    );
    if (printWindow) {
      let pageCss = "@page { margin: 8mm; size: A4 portrait; }";
      if (isThermalLabel) {
        pageCss = `
          @page { size: 50mm 30mm; margin: 0; }
          html, body { margin: 0; padding: 0; width: 50mm; height: 30mm; background: #fff; }
          .thermal-barcode-label-container { gap: 0 !important; }
          .thermal-barcode-label-item { width: 50mm !important; height: 30mm !important; margin: 0 !important; page-break-after: always !important; break-after: page !important; }
        `;
      } else if (isA4Sheet) {
        pageCss = `
          @page { size: A4 portrait; margin: 6mm; }
          html, body { margin: 0; padding: 0; background: #fff; }
          .a4-label-sheet-page { page-break-after: always !important; break-after: page !important; }
        `;
      } else if (!isA4) {
        // Standard 80mm Counter Thermal Roll
        pageCss = `
          @page { size: 80mm auto; margin: 0; }
          html, body { margin: 0; padding: 0; background: #fff; }
        `;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${printModal.title}</title>
            <style>
              * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              ${pageCss}
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fff; }
            </style>
          </head>
          <body>
            ${printModal.htmlContent}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.onafterprint = function() { window.close(); };
                }, 100);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="modal-backdrop">
      <div
        className="modal-panel animate-fade-in"
        style={{
          maxWidth: isA4 ? "960px" : "540px",
          width: "100%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Printer size={18} style={{ color: "var(--primary)" }} />
            <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
              {printModal.title}
            </h3>
          </div>
          <button
            onClick={closePrintModal}
            className="btn btn-secondary btn-sm"
            aria-label="Close"
            style={{ width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Thermal Preview Paper Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px",
            background: "var(--surface-sunken)",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            ref={printRef}
            style={{
              background: "#ffffff",
              color: "#111111",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
              border: "1px solid var(--line)",
              borderRadius: "4px",
              padding: isA4 ? "24px" : "16px",
              minWidth: isA4 ? "600px" : "320px",
              maxWidth: isA4 ? "100%" : "380px",
              width: isA4 ? "100%" : "auto",
            }}
            dangerouslySetInnerHTML={{ __html: printModal.htmlContent }}
          />
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--line)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            background: "var(--surface)",
          }}
        >
          <button className="btn btn-secondary" onClick={closePrintModal}>
            Dismiss
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={16} />
            Print document
          </button>
        </div>
      </div>
    </div>
  );
}
