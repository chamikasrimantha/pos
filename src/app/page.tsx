// src/app/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { AppProvider, useApp } from "@/context/AppContext";
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

function MainAppShell() {
  const {
    isAuthenticated,
    selectedOutletSlug,
    setSelectedOutletSlug,
    activeView,
  } = useApp();

  // Defer rendering until after the first client-side effect so that
  // localStorage-restored state (isAuthenticated, selectedOutletSlug) is
  // available before we decide which UI to show. This prevents the
  // server-rendered HTML (which never has localStorage) from diverging
  // from the first client render and causing a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100vw", height: "100dvh" }}>
        <div style={{ color: "var(--ink-2)", fontSize: "14px" }}>Loading…</div>
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
        outletSlug={selectedOutletSlug as any}
        onBack={() => setSelectedOutletSlug(null)}
      />
    );
  }

  return (
    <div style={{ display: "flex", width: "100vw", height: "100dvh", overflow: "hidden" }}>
      {/* Primary Left Navigation (Desktop) */}
      <Sidebar />

      {/* Main Operational Stage */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden", minWidth: 0 }}>
        {/* Top Header with Branch & Shift status */}
        <Header />

        {/* Dynamic Operational Content View */}
        <main className="app-main-content" style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          {activeView === "pos" && <PosView />}
          {activeView === "shifts" && <ShiftManager />}
          {activeView === "returns" && <ReturnsDesk />}
          {activeView === "repairs" && <RepairDesk />}
          {activeView === "transfers" && <TransfersView />}
          {activeView === "inventory" && <InventoryView />}
          {activeView === "products" && <ProductsMasterView />}
          {activeView === "purchases" && <PurchasesView />}
          {activeView === "suppliers" && <SuppliersView />}
          {activeView === "reports" && <ReportsView />}
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

export default function Home() {
  return (
    <AppProvider>
      <React.Suspense fallback={<div style={{ padding: "32px", textAlign: "center", color: "var(--ink-2)" }}>Loading RightWay & Mega Shoes POS…</div>}>
        <MainAppShell />
      </React.Suspense>
    </AppProvider>
  );
}
