// src/components/modals/PrintModal.tsx
"use client";

import React, { useRef } from "react";
import { useApp } from "@/context/AppContext";
import { Printer, X } from "lucide-react";

export function PrintModal() {
  const { printModal, closePrintModal } = useApp();
  const printRef = useRef<HTMLDivElement>(null);

  if (!printModal.isOpen) return null;

  const isA4 =
    printModal.htmlContent.includes("210mm") ||
    printModal.htmlContent.includes("AUDIT REPORT") ||
    printModal.htmlContent.includes("STATUS AUDIT");

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open(
      "",
      "_blank",
      isA4 ? "width=900,height=960" : "width=480,height=640"
    );
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${printModal.title}</title>
            <style>
              @page { margin: 8mm; size: ${isA4 ? "A4 portrait" : "auto"}; }
              body { margin: 0; padding: 0; font-family: Arial, sans-serif; background: #fff; }
            </style>
          </head>
          <body>
            ${printModal.htmlContent}
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() { window.close(); };
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
