// src/app/page.tsx
"use client";

import React from "react";
import dynamic from "next/dynamic";
import { AppProvider } from "@/context/AppContext";

// Dynamically import MainAppShell with ssr: false so that browser-specific state (localStorage,
// browser timers, and client-only hooks) do not cause SSR hydration mismatch warnings.
const MainAppShell = dynamic(
  () => import("@/components/MainAppShell").then((mod) => mod.MainAppShell),
  {
    ssr: false,
    loading: () => (
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
          Loading RightWay &amp; Mega Shoes POS…
        </div>
      </div>
    ),
  }
);

export default function Home() {
  return (
    <AppProvider>
      <MainAppShell />
    </AppProvider>
  );
}
