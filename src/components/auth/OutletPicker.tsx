// src/components/auth/OutletPicker.tsx
"use client";

import React from "react";
import { useApp } from "@/context/AppContext";
import { Store, Shield, ArrowRight, MapPin, Phone } from "lucide-react";

export function OutletPicker({
  onSelectOutlet,
  onSelectAdmin,
}: {
  onSelectOutlet: (slug: "rightway" | "mega") => void;
  onSelectAdmin: () => void;
}) {
  const { shops } = useApp();

  const rightway = shops.find((s) => s.slug === "rightway") || shops[0];
  const mega = shops.find((s) => s.slug === "mega") || shops[1];

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--canvas)",
        padding: "24px 16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "680px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
        }}
      >
        {/* Header Branding */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "var(--primary)",
              color: "#fff",
              marginBottom: "12px",
            }}
          >
            <Store size={26} />
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", color: "var(--ink)", letterSpacing: "-0.5px" }}>
            Welcome to Apex POS
          </h1>
          <p style={{ fontSize: "15px", color: "var(--ink-2)", marginTop: "4px" }}>
            Choose your retail outlet counter to sign in
          </p>
        </div>

        {/* Outlet Cards Grid */}
        <div
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {/* RightWay Shoes Card */}
          <div
            onClick={() => onSelectOutlet("rightway")}
            role="button"
            tabIndex={0}
            style={{
              background: "var(--surface)",
              borderRadius: "16px",
              border: "1px solid var(--line)",
              padding: "24px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: "160px",
              transition: "transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease",
              boxShadow: "0 2px 8px rgba(16, 24, 40, 0.04)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--primary)";
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "var(--shadow-float)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--line)";
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(16, 24, 40, 0.04)";
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    background: "var(--primary-soft)",
                    color: "var(--primary-ink)",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    letterSpacing: "0.5px",
                  }}
                >
                  BRANCH {rightway?.code || "RW"}
                </span>
                <span style={{ color: "var(--primary)" }}>
                  <ArrowRight size={18} />
                </span>
              </div>
              <h2 style={{ fontSize: "20px", fontWeight: "700", color: "var(--ink)", marginBottom: "8px" }}>
                {rightway?.name || "RightWay Shoes"}
              </h2>
              <div style={{ fontSize: "13px", color: "var(--ink-2)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <MapPin size={14} style={{ flexShrink: 0 }} />
                <span>{rightway?.address || "No. 45 Main Street, Colombo 11"}</span>
              </div>
              <div style={{ fontSize: "13px", color: "var(--ink-3)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Phone size={14} style={{ flexShrink: 0 }} />
                <span>{rightway?.phone || "+94 11 234 5678"}</span>
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "16px", height: "46px", fontSize: "15px", fontWeight: "600" }}
            >
              Sign in to RightWay Shoes
            </button>
          </div>

          {/* Mega Shoes Card */}
          <div
            onClick={() => onSelectOutlet("mega")}
            role="button"
            tabIndex={0}
            style={{
              background: "var(--surface)",
              borderRadius: "16px",
              border: "1px solid var(--line)",
              padding: "24px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: "160px",
              transition: "transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease",
              boxShadow: "0 2px 8px rgba(16, 24, 40, 0.04)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--primary)";
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "var(--shadow-float)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--line)";
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(16, 24, 40, 0.04)";
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    background: "var(--primary-soft)",
                    color: "var(--primary-ink)",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    letterSpacing: "0.5px",
                  }}
                >
                  BRANCH {mega?.code || "MG"}
                </span>
                <span style={{ color: "var(--primary)" }}>
                  <ArrowRight size={18} />
                </span>
              </div>
              <h2 style={{ fontSize: "20px", fontWeight: "700", color: "var(--ink)", marginBottom: "8px" }}>
                {mega?.name || "Mega Shoes"}
              </h2>
              <div style={{ fontSize: "13px", color: "var(--ink-2)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <MapPin size={14} style={{ flexShrink: 0 }} />
                <span>{mega?.address || "Level 2, Kandy City Centre, Kandy"}</span>
              </div>
              <div style={{ fontSize: "13px", color: "var(--ink-3)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Phone size={14} style={{ flexShrink: 0 }} />
                <span>{mega?.phone || "+94 81 223 9876"}</span>
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "16px", height: "46px", fontSize: "15px", fontWeight: "600" }}
            >
              Sign in to Mega Shoes
            </button>
          </div>
        </div>

        {/* Quieter Admin Link (Section 4.3 #4.1) */}
        <div style={{ textAlign: "center", marginTop: "8px" }}>
          <button
            onClick={onSelectAdmin}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-2)",
              fontSize: "14px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "8px",
              transition: "color 140ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-2)")}
          >
            <Shield size={16} />
            <span>Owner or administrator? Sign in here</span>
          </button>
        </div>
      </div>
    </div>
  );
}
