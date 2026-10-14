// src/components/layout/Header.tsx
"use client";

import React from "react";
import { useApp } from "@/context/AppContext";
import { formatCurrency } from "@/lib/receipt-generator";
import { RotateCw, ChevronDown, User, CheckCircle2, Lock, LogOut } from "lucide-react";

export function Header() {
  const {
    shops,
    activeShop,
    setActiveShopId,
    currentUser,
    activeShift,
    setActiveView,
    refreshData,
    showToast,
    logout,
  } = useApp();

  const shiftSince = activeShift
    ? new Date(activeShift.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  const isAdmin = currentUser?.role === "SUPER_ADMIN";

  return (
    <header
      style={{
        height: "56px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        gap: "12px",
        zIndex: 15,
        flexShrink: 0,
      }}
    >
      {/* ── Left: Branch name & Scope ────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
        {isAdmin ? (
          /* Super Admin gets a branch selector */
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <select
              value={activeShop.id}
              onChange={(e) => {
                setActiveShopId(e.target.value);
                showToast(
                  `Switched workspace to ${shops.find((s) => s.id === e.target.value)?.name}`,
                  "info"
                );
              }}
              style={{
                background: "var(--surface-sunken)",
                border: "1px solid var(--line)",
                padding: "4px 8px",
                borderRadius: "6px",
                color: "var(--ink)",
                fontSize: "14px",
                fontWeight: "700",
                cursor: "pointer",
                outline: "none",
                fontFamily: "inherit",
              }}
            >
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id} style={{ background: "#fff", color: "var(--ink)" }}>
                  {shop.name} ({shop.code})
                </option>
              ))}
            </select>
            <ChevronDown size={14} color="var(--ink-3)" />
          </div>
        ) : (
          /* All other roles (Manager, Cashier) — plain text, locked */
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--ink)", lineHeight: 1.2 }}>
              {activeShop.name}
            </div>
            <div style={{ fontSize: "11px", color: "var(--ink-3)" }}>
              Outlet {activeShop.code} &bull; Locked
            </div>
          </div>
        )}
      </div>

      {/* ── Center: Cashier Shift Status Pill ────────────────── */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {activeShift ? (
          <button
            onClick={() => setActiveView("shifts")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              background: "var(--success-soft)",
              border: "1px solid #bbf7d0",
              borderRadius: "999px",
              cursor: "pointer",
              fontSize: "12px",
              color: "var(--success)",
              fontWeight: "600",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "var(--success)",
                display: "inline-block",
              }}
            />
            <span style={{ display: "none" }} className="shift-label-full">
              Shift #{activeShift.shiftNumber.slice(-4)} &bull; Since {shiftSince}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: "700" }}>
              {formatCurrency(
                activeShift.openingFloat +
                  activeShift.cashSales +
                  (activeShift.repairCashIn || 0) +
                  (activeShift.cashPaidIn || 0) -
                  (activeShift.cashRefunds || 0) -
                  (activeShift.cashPayouts || 0)
              )}
            </span>
          </button>
        ) : (
          <button
            onClick={() => setActiveView("shifts")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              background: "var(--warning-soft)",
              border: "1px solid #fed7aa",
              borderRadius: "999px",
              cursor: "pointer",
              fontSize: "12px",
              color: "var(--warning)",
              fontWeight: "600",
            }}
          >
            <Lock size={12} />
            <span>Open Shift</span>
          </button>
        )}
      </div>

      {/* ── Right: User Profile & Actions ─────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {/* User Pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: "var(--ink)",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "var(--surface-sunken)",
              border: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink-2)",
            }}
          >
            <User size={15} />
          </div>
          <div style={{ display: "none" }} className="header-user-text">
            <span style={{ fontWeight: "600" }}>{currentUser?.displayName?.split(" ")[0]}</span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: "700",
                textTransform: "uppercase",
                background: "var(--primary-soft)",
                color: "var(--primary-ink)",
                padding: "2px 5px",
                borderRadius: "4px",
                marginLeft: "4px",
              }}
            >
              {currentUser?.role === "SUPER_ADMIN"
                ? "Admin"
                : currentUser?.role === "SHOP_MANAGER"
                ? "Manager"
                : "Cashier"}
            </span>
          </div>
        </div>

        {/* Sync Button */}
        <button
          onClick={() => {
            refreshData();
            showToast("System records re-synchronized", "info");
          }}
          title="Refresh Data"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--ink-3)",
            padding: "6px",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <RotateCw size={15} />
        </button>

        {/* Sign out */}
        <button
          onClick={logout}
          title="Sign out"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--ink-2)",
            padding: "6px",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-2)")}
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}