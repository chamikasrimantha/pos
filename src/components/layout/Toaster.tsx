// src/components/layout/Toaster.tsx
"use client";

import React from "react";
import { useApp } from "@/context/AppContext";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export function Toaster() {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "72px",
        right: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        zIndex: 9999,
      }}
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === "success";
        const isError   = toast.type === "error";

        const iconColor = isSuccess
          ? "var(--success)"
          : isError
          ? "var(--danger)"
          : "var(--primary)";

        const toastClass = isSuccess
          ? "toast toast-success"
          : isError
          ? "toast toast-error"
          : "toast toast-info";

        return (
          <div key={toast.id} className={`${toastClass} animate-fade-in`}>
            {isSuccess && <CheckCircle2 size={18} style={{ color: iconColor, flexShrink: 0 }} />}
            {isError   && <AlertCircle  size={18} style={{ color: iconColor, flexShrink: 0 }} />}
            {!isSuccess && !isError && (
              <Info size={18} style={{ color: iconColor, flexShrink: 0 }} />
            )}
            <span style={{ fontSize: "14px", fontWeight: "500", color: "var(--ink)", flex: 1 }}>
              {toast.message}
            </span>
            <button
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--ink-3)",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
                borderRadius: "4px",
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}