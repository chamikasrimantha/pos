// src/components/MainAppShell.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { Toaster } from "@/components/layout/Toaster";
import { PrintModal } from "@/components/modals/PrintModal";
import { OutletPicker } from "@/components/auth/OutletPicker";
import { SignInView } from "@/components/auth/SignInView";

// Operational View Components
import { PosView } from "@/components/pos/PosView";
import { ShiftManager } from "@/components/shifts/ShiftManager";
import { ReturnsDesk } from "@/components/returns/ReturnsDesk";
import { RepairDesk } from "@/components/repairs/RepairDesk";
import { TransfersView } from "@/components/transfers/TransfersView";
import { InventoryView } from "@/components/inventory/InventoryView";
import { ProductsMasterView } from "@/components/products/ProductsMasterView";
import { PurchasesView } from "@/components/purchases/PurchasesView";
import { SuppliersView } from "@/components/suppliers/SuppliersView";
import { ReportsView } from "@/components/reports/ReportsView";
import { AdminView } from "@/components/admin/AdminView";
import { InvoicesView } from "@/components/invoices/InvoicesView";
import { DayEndStatusView } from "@/components/admin/DayEndStatusView";

export function MainAppShell() {
  const {
    isAuthenticated,
    selectedOutletSlug,
    setSelectedOutletSlug,
    activeView,
  } = useApp();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100vw",
          height: "100vh",
          background: "var(--canvas)",
        }}
      >
        <div style={{ color: "var(--ink-2)", fontSize: "14px", fontWeight: "600" }}>
          Loading Apex POS…
        </div>
      </div>
    );
  }

  // If not signed in, show outlet picker / sign in flow (Section 4)
  if (!isAuthenticated) {
    if (!selectedOutletSlug) {
      return (
        <OutletPicker
          onSelectOutlet={(slug) => setSelectedOutletSlug(slug)}
          onSelectAdmin={() => setSelectedOutletSlug("admin")}
        />
      );
    }
    return (
      <SignInView
        outletSlug={selectedOutletSlug as "rightway" | "mega" | "admin"}
        onBack={() => setSelectedOutletSlug(null)}
      />
    );
  }

  // Authenticated Application Shell (Section 5)
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "var(--canvas)",
      }}
    >
      {/* Global Top App Bar */}
      <Header />

      {/* Main Two-Column Layout */}
      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Desktop Left Navigation Sidebar */}
        <Sidebar />

        {/* Dynamic Operational Screen (Viewport) */}
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {activeView === "pos" && <PosView />}
          {activeView === "invoices" && <InvoicesView />}
          {activeView === "shifts" && <ShiftManager />}
          {activeView === "returns" && <ReturnsDesk />}
          {activeView === "repairs" && <RepairDesk />}
          {activeView === "transfers" && <TransfersView />}
          {activeView === "inventory" && <InventoryView />}
          {activeView === "products" && <ProductsMasterView />}
          {activeView === "purchases" && <PurchasesView />}
          {activeView === "suppliers" && <SuppliersView />}
          {activeView === "reports" && <ReportsView />}
          {activeView === "dayEndStatus" && <DayEndStatusView />}
          {activeView === "admin" && <AdminView />}
        </main>
      </div>

      {/* Mobile Bottom Navigation (Phones & Small Tablets) */}
      <MobileNav />

      {/* Global Interactive Modals & Alerts */}
      <PrintModal />
      <Toaster />
    </div>
  );
}
