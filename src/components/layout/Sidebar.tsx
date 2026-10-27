// src/components/layout/Sidebar.tsx
"use client";

import React from "react";
import { useApp } from "@/context/AppContext";
import {
  ShoppingBag,
  Coins,
  RotateCcw,
  Wrench,
  ArrowLeftRight,
  Boxes,
  Tag,
  Truck,
  Building2,
  BarChart3,
  ShieldCheck,
  Footprints,
  LogOut,
  Receipt,
  CalendarCheck,
} from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

export function Sidebar() {
  const { activeView, setActiveView, currentUser, isModuleVisible, logout } = useApp();

  const allNavItems: NavItem[] = [
    { id: "pos",          label: "POS Counter",          icon: ShoppingBag },
    { id: "shifts",       label: "Cash Drawer & Shifts",  icon: Coins },
    { id: "invoices",     label: "Invoices & Receipts",   icon: Receipt },
    { id: "returns",      label: "Returns & Exchanges",   icon: RotateCcw },
    { id: "repairs",      label: "Shoe Repair Desk",      icon: Wrench },
    { id: "transfers",    label: "Branch Transfers",      icon: ArrowLeftRight },
    { id: "inventory",    label: "Stock & Inventory",     icon: Boxes },
    { id: "products",     label: "Product Catalog",       icon: Tag },
    { id: "purchases",    label: "Purchasing Inward",     icon: Truck },
    { id: "suppliers",    label: "Suppliers & Cheques",   icon: Building2 },
    { id: "reports",      label: "Reports & Analytics",   icon: BarChart3 },
    { id: "dayEndStatus", label: "Day-end Status",        icon: CalendarCheck },
    { id: "admin",        label: "Admin & Settings",      icon: ShieldCheck },
  ];

  // Filter navigation items by role access (Section 5.2)
  const visibleNavItems = allNavItems.filter((item) => isModuleVisible(item.id));

  return (
    <aside
      className="app-desktop-sidebar"
      style={{
        width: "230px",
        height: "100dvh",
        background: "var(--surface)",
        borderRight: "1px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        zIndex: 20,
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: "18px 20px 16px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Footprints size={20} color="#ffffff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "15px",
              fontWeight: "700",
              color: "var(--ink)",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            RightWay & Mega
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>Footwear POS</div>
        </div>
      </div>

      {/* Nav Items List */}
      <nav
        style={{
          flex: 1,
          padding: "12px 10px",
          display: "flex",
          flexDirection: "column",
          gap: "3px",
          overflowY: "auto",
        }}
      >
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "10px 12px",
                borderRadius: "var(--radius-control)",
                background: isActive ? "var(--primary-soft)" : "transparent",
                color: isActive ? "var(--primary-ink)" : "var(--ink)",
                border: isActive
                  ? "1px solid var(--primary-soft-line)"
                  : "1px solid transparent",
                cursor: "pointer",
                textAlign: "left",
                fontSize: "14px",
                fontWeight: isActive ? "600" : "500",
                transition: "all var(--motion-hover)",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "var(--surface-sunken)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <Icon
                size={18}
                color={isActive ? "var(--primary)" : "var(--ink-2)"}
                style={{ flexShrink: 0 }}
              />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* User Footer & Sign Out */}
      <div
        style={{
          padding: "14px 16px",
          borderTop: "1px solid var(--line)",
          background: "var(--surface-sunken)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "var(--ink)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {currentUser?.displayName || "Staff Member"}
          </div>
          <div style={{ fontSize: "11px", color: "var(--ink-3)", textTransform: "capitalize" }}>
            {currentUser?.role?.replace("_", " ").toLowerCase()}
          </div>
        </div>

        <button
          onClick={logout}
          title="Sign Out"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--ink-2)",
            padding: "6px",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-2)")}
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}