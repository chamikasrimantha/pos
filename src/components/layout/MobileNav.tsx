// src/components/layout/MobileNav.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { getReviewInboxCounts } from "@/lib/firestore-service";
import {
  ShoppingBag,
  RotateCcw,
  Wrench,
  Boxes,
  ArrowLeftRight,
  BarChart3,
  Building2,
  MoreHorizontal,
  LogOut,
  X,
  Truck,
  Tag,
  ShieldCheck,
  Receipt,
  CalendarCheck,
  Users2,
  Briefcase,
  Inbox,
} from "lucide-react";

export function MobileNav() {
  const { currentUser, activeView, setActiveView, logout, dataVersion } = useApp();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const reviewCounts = useMemo(() => {
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") return 0;
    try {
      return getReviewInboxCounts(currentUser).total;
    } catch {
      return 0;
    }
  }, [currentUser, dataVersion]);

  if (!currentUser) return null;

  const role = currentUser.role;

  // Primary bottom navigation items by role per Section 2.2
  const getPrimaryItems = () => {
    if (role === "CASHIER") {
      return [
        { id: "pos", label: "Sell", icon: ShoppingBag },
        { id: "invoices", label: "Invoices", icon: Receipt },
        { id: "returns", label: "Returns", icon: RotateCcw },
        { id: "repairs", label: "Repairs", icon: Wrench },
      ];
    }
    if (role === "SHOP_MANAGER") {
      return [
        { id: "pos", label: "Sell", icon: ShoppingBag },
        { id: "inventory", label: "Stock", icon: Boxes },
        { id: "transfers", label: "Transfers", icon: ArrowLeftRight },
        { id: "invoices", label: "Invoices", icon: Receipt },
      ];
    }
    // SUPER_ADMIN (No POS, No Shifts)
    return [
      { id: "reports", label: "Overview", icon: BarChart3 },
      { id: "inventory", label: "Stock", icon: Boxes },
      { id: "suppliers", label: "Suppliers", icon: Building2 },
      { id: "admin", label: "Admin", icon: ShieldCheck },
    ];
  };

  const primaryItems = getPrimaryItems();

  // Secondary items in the "More" drawer sheet
  const getSecondaryItems = () => {
    if (role === "CASHIER") {
      return [
        { id: "customers", label: "Customers & Credit", icon: Users2 },
        { id: "transfers", label: "Branch Transfers", icon: ArrowLeftRight },
        { id: "inventory", label: "Stock Check", icon: Boxes },
        { id: "products", label: "Product Catalog & Labels", icon: Tag },
        { id: "purchases", label: "Purchasing Inward", icon: Truck },
      ];
    }
    if (role === "SHOP_MANAGER") {
      return [
        { id: "customers", label: "Customers & Credit", icon: Users2 },
        { id: "returns", label: "Returns & Exchanges", icon: RotateCcw },
        { id: "repairs", label: "Repair Desk", icon: Wrench },
        { id: "products", label: "Product Catalog", icon: Tag },
        { id: "purchases", label: "Purchasing Inward", icon: Truck },
      ];
    }
    // SUPER_ADMIN
    return [
      { id: "invoices", label: "All Invoices", icon: Receipt },
      { id: "customers", label: "Customers & Credit", icon: Users2 },
      { id: "reviewInbox", label: "Review Inbox", icon: Inbox },
      { id: "employees", label: "Employees & Payroll", icon: Briefcase },
      { id: "dayEndStatus", label: "Day-end Status", icon: CalendarCheck },
      { id: "returns", label: "Returns & Exchanges", icon: RotateCcw },
      { id: "repairs", label: "Repair Desk", icon: Wrench },
      { id: "transfers", label: "Branch Transfers", icon: ArrowLeftRight },
      { id: "products", label: "Product Catalog", icon: Tag },
      { id: "purchases", label: "Purchasing & Inward", icon: Truck },
    ];
  };

  const secondaryItems = getSecondaryItems();

  const handleSelectView = (viewId: string) => {
    setActiveView(viewId);
    setIsMoreOpen(false);
  };

  return (
    <>
      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="mobile-nav-bar"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "64px",
          background: "var(--surface)",
          borderTop: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          zIndex: 90,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          boxShadow: "0 -2px 10px rgba(16, 24, 40, 0.05)",
        }}
      >
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelectView(item.id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                cursor: "pointer",
                height: "100%",
                minHeight: "44px",
                color: isActive ? "var(--primary)" : "var(--ink-2)",
                gap: "2px",
                fontSize: "11px",
                fontWeight: isActive ? "700" : "500",
              }}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* More Button */}
        <button
          onClick={() => setIsMoreOpen(true)}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            height: "100%",
            minHeight: "44px",
            color: isMoreOpen ? "var(--primary)" : "var(--ink-2)",
            gap: "2px",
            fontSize: "11px",
            fontWeight: isMoreOpen ? "700" : "500",
          }}
        >
          <MoreHorizontal size={20} />
          <span>More</span>
          {reviewCounts > 0 && (
            <span
              style={{
                position: "absolute",
                top: "6px",
                right: "16px",
                background: "var(--danger)",
                color: "#fff",
                fontSize: "10px",
                fontWeight: "800",
                padding: "1px 5px",
                borderRadius: "9999px",
              }}
            >
              {reviewCounts}
            </span>
          )}
        </button>
      </nav>

      {/* "More" Bottom Sheet Modal */}
      {isMoreOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(16, 24, 40, 0.6)",
            zIndex: 999,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
          onClick={() => setIsMoreOpen(false)}
        >
          <div
            style={{
              background: "var(--surface)",
              borderTopLeftRadius: "20px",
              borderTopRightRadius: "20px",
              padding: "20px 16px max(24px, env(safe-area-inset-bottom, 24px))",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              maxHeight: "80dvh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "10px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ fontWeight: "700", fontSize: "16px", color: "var(--ink)" }}>
                {currentUser.displayName}
              </div>
              <button
                onClick={() => setIsMoreOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-2)" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* List of other modules */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {secondaryItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectView(item.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "none",
                      background: isActive ? "var(--primary-soft)" : "transparent",
                      color: isActive ? "var(--primary-ink)" : "var(--ink)",
                      cursor: "pointer",
                      fontSize: "15px",
                      fontWeight: isActive ? "600" : "400",
                      textAlign: "left",
                      minHeight: "44px",
                    }}
                  >
                    <Icon size={18} color={isActive ? "var(--primary)" : "var(--ink-2)"} />
                    <span>{item.label}</span>
                    {item.id === "reviewInbox" && reviewCounts > 0 && (
                      <span
                        style={{
                          marginLeft: "auto",
                          background: "var(--danger)",
                          color: "#ffffff",
                          fontSize: "11px",
                          fontWeight: "800",
                          padding: "1px 6px",
                          borderRadius: "9999px",
                        }}
                      >
                        {reviewCounts}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Sign Out Option */}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "10px", marginTop: "4px" }}>
              <button
                onClick={() => {
                  setIsMoreOpen(false);
                  logout();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "none",
                  background: "var(--danger-soft)",
                  color: "var(--danger)",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: "600",
                  minHeight: "44px",
                }}
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
