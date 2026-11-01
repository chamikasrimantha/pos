// src/components/MainAppShell.tsx
"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { Toaster } from "@/components/layout/Toaster";
import { PrintModal } from "@/components/modals/PrintModal";
import { OutletPicker } from "@/components/auth/OutletPicker";
import { SignInView } from "@/components/auth/SignInView";
import { ForcePasswordChangeModal } from "@/components/auth/ForcePasswordChangeModal";

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
import { CustomersView } from "@/components/customers/CustomersView";
import { EmployeesView } from "@/components/employees/EmployeesView";
import { DayEndStatusView } from "@/components/admin/DayEndStatusView";

export function MainAppShell() {
  const {
    isAuthenticated,
    selectedOutletSlug,
    setSelectedOutletSlug,
    activeView,
    currentUser,
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
          id="pos-main-scroll-viewport"
          className="app-main-viewport"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflowY: activeView === "pos" ? "hidden" : "auto",
            overflowX: "hidden",
            position: "relative",
            WebkitOverflowScrolling: "touch",
            minHeight: 0,
            width: "100%",
          }}
        >
          {activeView === "pos" && (
            currentUser?.role === "SUPER_ADMIN" ? (
              <div
                style={{
                  padding: "48px 24px",
                  maxWidth: "560px",
                  margin: "60px auto",
                  textAlign: "center",
                  background: "var(--surface)",
                  borderRadius: "16px",
                  border: "1px solid var(--line)",
                  boxShadow: "var(--shadow-tile)",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: "var(--warning-soft)",
                    color: "var(--warning)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "16px",
                  }}
                >
                  <ShieldCheck size={24} />
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--ink)", marginBottom: "8px" }}>
                  POS Billing Counter Restricted
                </h3>
                <p style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: "1.5", margin: 0 }}>
                  The administrator account cannot make sales or access the POS counter. Sign in as a Cashier to operate the counter.
                </p>
              </div>
            ) : (
              <PosView />
            )
          )}
          {activeView === "invoices" && <InvoicesView />}
          {activeView === "customers" && <CustomersView />}
          {activeView === "shifts" && <ShiftManager />}
          {activeView === "returns" && <ReturnsDesk />}
          {activeView === "repairs" && <RepairDesk />}
          {activeView === "transfers" && <TransfersView />}
          {activeView === "inventory" && <InventoryView />}
          {activeView === "products" && <ProductsMasterView />}
          {activeView === "purchases" && <PurchasesView />}
          {activeView === "suppliers" && <SuppliersView />}
          {activeView === "employees" && <EmployeesView />}
          {activeView === "reports" && <ReportsView />}
          {activeView === "dayEndStatus" && <DayEndStatusView />}
          {activeView === "admin" && <AdminView />}
        </main>
      </div>

      {/* Mobile Bottom Navigation (Phones & Small Tablets) */}
      <MobileNav />

      {/* Global Interactive Modals & Alerts */}
      <PrintModal />
      <ForcePasswordChangeModal />
      <Toaster />
    </div>
  );
}
