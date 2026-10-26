// src/components/auth/SignInView.tsx
"use client";

import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Lock, Mail, Eye, EyeOff, ArrowLeft, AlertCircle, Store, Shield } from "lucide-react";

export function SignInView({
  outletSlug,
  onBack,
}: {
  outletSlug: "rightway" | "mega" | "admin";
  onBack: () => void;
}) {
  const { shops, login } = useApp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const activeOutlet =
    outletSlug === "admin"
      ? null
      : shops.find((s) => s.slug === outletSlug) || shops[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await login(email, password, outletSlug);
      if (!res.success) {
        setErrorMessage(res.error || "Email or password is incorrect.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred during sign in.");
    } finally {
      setIsLoading(false);
    }
  };

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
          maxWidth: "440px",
          background: "var(--surface)",
          borderRadius: "16px",
          border: "1px solid var(--line)",
          padding: "32px 28px",
          boxShadow: "var(--shadow-float)",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Back Link */}
        <button
          onClick={onBack}
          style={{
            alignSelf: "flex-start",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--ink-2)",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            padding: "4px 0",
          }}
        >
          <ArrowLeft size={16} />
          <span>Change outlet</span>
        </button>

        {/* Header Header */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: outletSlug === "admin" ? "#1e293b" : "var(--primary)",
              color: "#fff",
              marginBottom: "12px",
            }}
          >
            {outletSlug === "admin" ? <Shield size={24} /> : <Store size={24} />}
          </div>

          <h2 style={{ fontSize: "22px", fontWeight: "700", color: "var(--ink)" }}>
            {outletSlug === "admin"
              ? "Administrator Sign In"
              : activeOutlet?.name || "Retail Counter"}
          </h2>

          <p style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "4px" }}>
            {outletSlug === "admin"
              ? "Centralized oversight, suppliers & system settings"
              : `${activeOutlet?.address} (${activeOutlet?.code})`}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              background: "var(--danger-soft)",
              border: "1px solid #fca5a5",
              borderRadius: "8px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              color: "var(--danger)",
              fontSize: "13px",
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "var(--ink)", marginBottom: "6px" }}>
              Email address
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="email"
                required
                className="input-field"
                placeholder="name@shoes.pos"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", paddingLeft: "36px", height: "46px", fontSize: "15px" }}
              />
              <Mail
                size={16}
                color="var(--ink-3)"
                style={{ position: "absolute", left: "12px", top: "15px" }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)" }}>
                Password
              </label>
            </div>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                required
                className="input-field"
                placeholder="Enter password (min 10 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", paddingLeft: "36px", paddingRight: "40px", height: "46px", fontSize: "15px" }}
              />
              <Lock
                size={16}
                color="var(--ink-3)"
                style={{ position: "absolute", left: "12px", top: "15px" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "13px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--ink-3)",
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
            style={{ width: "100%", height: "48px", fontSize: "16px", fontWeight: "600", marginTop: "8px" }}
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

      </div>
    </div>
  );
}
