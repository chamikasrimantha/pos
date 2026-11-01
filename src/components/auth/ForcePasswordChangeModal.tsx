// src/components/auth/ForcePasswordChangeModal.tsx
"use client";

import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { updateUserProfile } from "@/lib/firestore-service";
import { Lock, ShieldAlert, CheckCircle2 } from "lucide-react";

export function ForcePasswordChangeModal() {
  const { currentUser, setCurrentUser, showToast } = useApp();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!currentUser?.mustChangePassword) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 10) {
      setError("Choose a longer password (at least 10 characters).");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await updateUserProfile(
        currentUser.uid,
        {
          mustChangePassword: false,
          password: newPassword,
        },
        currentUser.uid
      );

      setCurrentUser(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem("pos_session_user", JSON.stringify(updated));
      }
      showToast("Password updated successfully! Welcome to Apex POS.", "success");
    } catch (err: any) {
      setError(err?.message || "Failed to update password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: "16px",
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "var(--surface)",
          borderRadius: "16px",
          border: "1px solid var(--line)",
          padding: "28px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "var(--primary-soft)",
              color: "var(--primary-ink)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "12px",
            }}
          >
            <Lock size={24} />
          </div>
          <h3 style={{ fontSize: "19px", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
            Change Your Password
          </h3>
          <p style={{ fontSize: "13px", color: "var(--ink-2)", marginTop: "6px" }}>
            This account was issued with a temporary password. You must set a personal password before continuing.
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "var(--danger-soft)",
              border: "1px solid #fca5a5",
              borderRadius: "8px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--danger)",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            <ShieldAlert size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "var(--ink)", marginBottom: "6px" }}>
              New Password (min 10 characters) *
            </label>
            <input
              type="password"
              required
              className="input-field"
              placeholder="Enter new secure password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ width: "100%", height: "46px", fontSize: "15px" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "var(--ink)", marginBottom: "6px" }}>
              Confirm New Password *
            </label>
            <input
              type="password"
              required
              className="input-field"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ width: "100%", height: "46px", fontSize: "15px" }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            style={{ height: "48px", marginTop: "8px", fontSize: "15px", fontWeight: "600" }}
          >
            <CheckCircle2 size={16} />
            <span>{isSubmitting ? "Updating..." : "Save Password & Continue"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
