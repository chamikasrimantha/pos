// src/components/admin/AdminView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import {
  getAuditLogs,
  createUserProfile,
  updateUserProfile,
  toggleUserActive,
  updateSystemSettings,
} from "@/lib/firestore-service";
import { formatDate } from "@/lib/receipt-generator";
import { formatColomboDateTime } from "@/lib/date-utils";
import { UserProfile, SystemSettings, UserRole } from "@/types";
import {
  Store,
  Users,
  ScrollText,
  Sliders,
  Plus,
  ShieldAlert,
  CheckCircle2,
  X,
  KeyRound,
  UserCheck,
  UserX,
  Save,
  Lock,
  Pencil,
  Shield,
} from "lucide-react";

export function AdminView() {
  const { shops, users, currentUser, settings, showToast, refreshData, dataVersion } = useApp();

  const [activeTab, setActiveTab] = useState<"BRANCHES" | "USERS" | "SETTINGS" | "AUDIT">("BRANCHES");

  // User Management State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("CASHIER");
  const [newShopId, setNewShopId] = useState<string>("rightway");
  const [newTemporaryPassword, setNewTemporaryPassword] = useState("ApexPass2026!");
  const [newMustChangePassword, setNewMustChangePassword] = useState(true);
  const [superAdminConfirmed, setSuperAdminConfirmed] = useState(false);
  const [newDiscountCap, setNewDiscountCap] = useState("0");
  const [newRefundCap, setNewRefundCap] = useState("3000");
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // Edit User State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("CASHIER");
  const [editShopId, setEditShopId] = useState("rightway");
  const [editSuperAdminConfirmed, setEditSuperAdminConfirmed] = useState(false);
  const [isSavingEditUser, setIsSavingEditUser] = useState(false);

  // Settings State
  const [formSettings, setFormSettings] = useState<SystemSettings>({ ...settings });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Audit State
  const [auditFilterUser, setAuditFilterUser] = useState("");
  const [auditFilterAction, setAuditFilterAction] = useState("");

  const auditLogs = useMemo(() => getAuditLogs(), [dataVersion]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (auditFilterUser && !log.userEmailCache.toLowerCase().includes(auditFilterUser.toLowerCase())) {
        return false;
      }
      if (auditFilterAction && log.action !== auditFilterAction) {
        return false;
      }
      return true;
    });
  }, [auditLogs, auditFilterUser, auditFilterAction]);

  // Handle Create User via Server Route /api/admin/users
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!newEmail.trim() || !newDisplayName.trim()) {
      showToast("Please provide user full name and email.", "error");
      return;
    }
    if (newTemporaryPassword.length < 10) {
      showToast("Temporary password must be at least 10 characters.", "error");
      return;
    }
    if (newRole === "SUPER_ADMIN" && !superAdminConfirmed) {
      showToast("Please confirm granting Super Admin privileges.", "error");
      return;
    }

    const discCap = parseFloat(newDiscountCap) || 0;
    const refCap = parseFloat(newRefundCap) || 0;

    setIsSubmittingUser(true);
    try {
      const allowedShops = newRole === "SUPER_ADMIN" ? ["rightway", "mega"] : [newShopId];
      let created;
      try {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: newEmail.trim().toLowerCase(),
            displayName: newDisplayName.trim(),
            role: newRole,
            branchId: newShopId,
            temporaryPassword: newTemporaryPassword,
            mustChangePassword: newMustChangePassword,
            createdBy: currentUser.uid,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to create user on server");
        }
        created = data.user;
      } catch {
        // Fallback to internal storage service
        created = await createUserProfile({
          email: newEmail.trim().toLowerCase(),
          displayName: newDisplayName.trim(),
          role: newRole,
          allowedShopIds: allowedShops,
          discountCap: discCap,
          cashRefundCap: refCap,
          createdBy: currentUser.uid,
          password: newTemporaryPassword,
          mustChangePassword: newMustChangePassword,
        });
      }

      showToast(`Created user account for ${created.displayName}!`, "success");
      setIsAddUserModalOpen(false);
      setNewEmail("");
      setNewDisplayName("");
      setNewRole("CASHIER");
      setNewTemporaryPassword("ApexPass2026!");
      setNewMustChangePassword(true);
      setSuperAdminConfirmed(false);
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to create user", "error");
    } finally {
      setIsSubmittingUser(false);
    }
  };

  // Open Edit User Modal
  const openEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setEditDisplayName(user.displayName);
    setEditRole(user.role);
    setEditShopId(user.allowedShopIds[0] || "rightway");
    setEditSuperAdminConfirmed(user.role === "SUPER_ADMIN");
  };

  // Handle Save Edit User
  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !editingUser) return;

    if (editingUser.uid === currentUser.uid && editRole !== "SUPER_ADMIN") {
      showToast("You cannot demote your own administrator account.", "error");
      return;
    }

    if (editRole === "SUPER_ADMIN" && !editSuperAdminConfirmed) {
      showToast("Please confirm granting Super Admin privileges.", "error");
      return;
    }

    setIsSavingEditUser(true);
    try {
      const allowedShops = editRole === "SUPER_ADMIN" ? ["rightway", "mega"] : [editShopId];
      try {
        const res = await fetch("/api/admin/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: editingUser.uid,
            updates: {
              displayName: editDisplayName.trim(),
              role: editRole,
              allowedShopIds: allowedShops,
            },
            updatedBy: currentUser.uid,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Server update failed");
      } catch {
        await updateUserProfile(
          editingUser.uid,
          {
            displayName: editDisplayName.trim(),
            role: editRole,
            allowedShopIds: allowedShops,
          },
          currentUser.uid
        );
      }

      showToast(`Updated profile for ${editDisplayName.trim()}!`, "success");
      setEditingUser(null);
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to update user", "error");
    } finally {
      setIsSavingEditUser(false);
    }
  };

  // Handle Toggle User Active
  const handleToggleActive = async (targetUser: UserProfile) => {
    if (!currentUser) return;
    if (targetUser.uid === currentUser.uid) {
      showToast("You cannot disable your own administrator account.", "error");
      return;
    }
    try {
      try {
        const res = await fetch("/api/admin/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: targetUser.uid,
            updates: { active: !targetUser.active },
            updatedBy: currentUser.uid,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Server update failed");
      } catch {
        await toggleUserActive(targetUser.uid, !targetUser.active, currentUser.uid);
      }
      showToast(`User ${targetUser.displayName} marked as ${!targetUser.active ? "active" : "disabled"}.`, "success");
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to update user status", "error");
    }
  };

  // Handle Reset Password Flag
  const handleResetPassword = async (targetUser: UserProfile) => {
    if (!currentUser) return;
    const tempPass = "ApexPass2026!";
    try {
      try {
        const res = await fetch("/api/admin/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: targetUser.uid,
            updates: {
              mustChangePassword: true,
              password: tempPass,
            },
            updatedBy: currentUser.uid,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to reset password");
      } catch {
        await updateUserProfile(targetUser.uid, { mustChangePassword: true, password: tempPass }, currentUser.uid);
      }
      showToast(`Password reset for ${targetUser.displayName}. Temporary password: ${tempPass} (Forced change at next sign-in).`, "success");
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to reset user password", "error");
    }
  };

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingSettings(true);
    try {
      await updateSystemSettings(formSettings, currentUser.uid);
      showToast("System settings successfully saved and applied!", "success");
      refreshData();
    } catch (err: any) {
      showToast(err.message || "Failed to save settings", "error");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Enforce Section 5.2 & Section 6: Super Admin only
  if (currentUser?.role !== "SUPER_ADMIN") {
    return (
      <div style={{ padding: "48px 24px", display: "flex", justifyContent: "center" }}>
        <div
          style={{
            maxWidth: "500px",
            width: "100%",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
            padding: "32px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "var(--danger-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <ShieldAlert size={28} color="var(--danger)" />
          </div>
          <h3 style={{ fontSize: "18px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
            Access Restricted
          </h3>
          <p style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "8px", lineHeight: "1.5" }}>
            System configuration, user management, policy rules, and security audit logs are restricted exclusively to Super Admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="page-responsive-container"
      style={{
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        minHeight: "100%",
        paddingBottom: "90px",
      }}
    >
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: "600", color: "var(--ink)" }}>
            System Administration & Settings
          </h2>
          <div style={{ fontSize: "14px", color: "var(--ink-2)", marginTop: "2px" }}>
            Branch settings, staff user permissions, business policy thresholds, and audit trails.
          </div>
        </div>
      </div>


      {/* Tabs */}
      <div className="seg-control" style={{ width: "fit-content", maxWidth: "100%", overflowX: "auto", scrollbarWidth: "none", flexShrink: 0 }}>
        <button
          className={activeTab === "BRANCHES" ? "active" : ""}
          onClick={() => setActiveTab("BRANCHES")}
        >
          <Store size={15} /> Branches ({shops.length})
        </button>
        <button
          className={activeTab === "USERS" ? "active" : ""}
          onClick={() => setActiveTab("USERS")}
        >
          <Users size={15} /> Staff Users ({users.length})
        </button>
        <button
          className={activeTab === "SETTINGS" ? "active" : ""}
          onClick={() => setActiveTab("SETTINGS")}
        >
          <Sliders size={15} /> Policy & Settings
        </button>
        <button
          className={activeTab === "AUDIT" ? "active" : ""}
          onClick={() => setActiveTab("AUDIT")}
        >
          <ScrollText size={15} /> Audit Log ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: BRANCHES */}
      {activeTab === "BRANCHES" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "16px" }}>
          {shops.map((s) => (
            <div
              key={s.id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-tile)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span className="badge badge-neutral">{s.code}</span>
                  <h3 style={{ fontSize: "18px", fontWeight: "600", color: "var(--ink)", marginTop: "6px", margin: 0 }}>
                    {s.name}
                  </h3>
                </div>
                <span className="badge badge-success">Active Branch</span>
              </div>

              <div style={{ fontSize: "13px", color: "var(--ink-2)", display: "flex", flexDirection: "column", gap: "4px" }}>
                <div><span style={{ color: "var(--ink-3)" }}>Address:</span> {s.address}</div>
                <div><span style={{ color: "var(--ink-3)" }}>Phone:</span> {s.phone}</div>
                <div><span style={{ color: "var(--ink-3)" }}>Tax Number:</span> {s.taxNumber || "None"}</div>
                <div><span style={{ color: "var(--ink-3)" }}>Invoice Prefix:</span> <strong style={{ color: "var(--ink)" }}>{s.invoicePrefix}</strong></div>
              </div>

              <div
                style={{
                  background: "var(--canvas)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-control)",
                  padding: "12px",
                  fontSize: "12px",
                  color: "var(--ink-2)",
                  whiteSpace: "pre-line",
                  fontFamily: "monospace",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-3)", marginBottom: "4px", textTransform: "uppercase" }}>
                  Receipt Print Header
                </div>
                {s.receiptHeader}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: USERS & PERMISSIONS */}
      {activeTab === "USERS" && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
                Authorized Staff Accounts & Scopes
              </h3>
              <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                Role-based access control, outlet assignments, and discount caps.
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => setIsAddUserModalOpen(true)}>
              <Plus size={16} /> Add Staff User
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="pos-table">
              <thead>
                <tr>
                  <th>Display Name</th>
                  <th>Email / Username</th>
                  <th>Role</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Last Sign-in</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const roleLabel =
                    u.role === "SUPER_ADMIN"
                      ? "Super Admin"
                      : u.role === "SHOP_MANAGER"
                      ? "Shop Manager"
                      : "Cashier";

                  const isSelf = u.uid === currentUser?.uid;
                  const activeAdminsCount = users.filter((x) => x.role === "SUPER_ADMIN" && x.active).length;
                  const cannotDisableOrDemote = isSelf || (u.role === "SUPER_ADMIN" && activeAdminsCount <= 1 && u.active);

                  const branchLabel =
                    u.role === "SUPER_ADMIN"
                      ? "All Branches (Central)"
                      : u.allowedShopIds.includes("rightway")
                      ? "RightWay Shoes"
                      : u.allowedShopIds.includes("mega")
                      ? "Mega Shoes"
                      : u.allowedShopIds.join(", ");

                  return (
                    <tr key={u.uid}>
                      <td style={{ fontWeight: "600" }}>{u.displayName}</td>
                      <td style={{ color: "var(--ink-2)" }}>{u.email}</td>
                      <td>
                        <span
                          className={`badge ${
                            u.role === "SUPER_ADMIN"
                              ? "badge-primary"
                              : u.role === "SHOP_MANAGER"
                              ? "badge-warning"
                              : "badge-neutral"
                          }`}
                        >
                          {roleLabel}
                        </span>
                      </td>
                      <td style={{ fontSize: "13px", fontWeight: "500", color: "var(--ink)" }}>
                        {branchLabel}
                      </td>
                      <td>
                        <span className={`badge ${u.active ? "badge-success" : "badge-danger"}`}>
                          {u.active ? "Active" : "Disabled"}
                        </span>
                        {u.mustChangePassword && (
                          <span className="badge badge-warning" style={{ marginLeft: "4px" }}>
                            Must Change Pass
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--ink-2)" }}>
                        {u.lastSignInAt ? formatColomboDateTime(u.lastSignInAt) : "Never"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Edit user details and role"
                            onClick={() => openEditUser(u)}
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Issue temporary password & force change on next sign-in"
                            onClick={() => handleResetPassword(u)}
                          >
                            <KeyRound size={13} /> Reset Pass
                          </button>
                          {!isSelf && (
                            <button
                              className={`btn btn-sm ${u.active ? "btn-danger" : "btn-primary"}`}
                              onClick={() => handleToggleActive(u)}
                              disabled={cannotDisableOrDemote}
                              title={
                                cannotDisableOrDemote
                                  ? "Cannot disable the last active Super Admin"
                                  : u.active
                                  ? "Disable staff account"
                                  : "Enable staff account"
                              }
                            >
                              {u.active ? <UserX size={13} /> : <UserCheck size={13} />}
                              {u.active ? "Disable" : "Enable"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SYSTEM SETTINGS */}
      {activeTab === "SETTINGS" && (
        <form onSubmit={handleSaveSettings} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-tile)",
              padding: "24px",
            }}
          >
            <h3 style={{ fontSize: "17px", fontWeight: "600", color: "var(--ink)", margin: "0 0 16px 0" }}>
              Returns & Refunds Policy
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Customer Return Window (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  required
                  className="input-field"
                  value={formSettings.returnWindowDays}
                  onChange={(e) => setFormSettings({ ...formSettings, returnWindowDays: parseInt(e.target.value) || 14 })}
                />
                <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>
                  Returns older than this window require supervisor approval.
                </div>
              </div>

              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Return Approval Threshold (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  required
                  className="input-field"
                  value={formSettings.returnApprovalThreshold}
                  onChange={(e) => setFormSettings({ ...formSettings, returnApprovalThreshold: parseFloat(e.target.value) || 0 })}
                />
                <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>
                  Returns exceeding this value trigger manager sign-off.
                </div>
              </div>

              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Cashier Cash Refund Limit (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  required
                  className="input-field"
                  value={formSettings.cashierRefundCap}
                  onChange={(e) => setFormSettings({ ...formSettings, cashierRefundCap: parseFloat(e.target.value) || 0 })}
                />
                <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>
                  Maximum physical cash cashier can refund without manager override.
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-tile)",
              padding: "24px",
            }}
          >
            <h3 style={{ fontSize: "17px", fontWeight: "600", color: "var(--ink)", margin: "0 0 16px 0" }}>
              Discount Limits & Cash Drawer Controls
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Cashier Max Discount (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  className="input-field"
                  value={formSettings.cashierDiscountCap}
                  onChange={(e) => setFormSettings({ ...formSettings, cashierDiscountCap: parseFloat(e.target.value) || 0 })}
                />
                <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>
                  Default is 0% (no cashier discounts allowed).
                </div>
              </div>

              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Shop Manager Max Discount (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  className="input-field"
                  value={formSettings.managerDiscountCap}
                  onChange={(e) => setFormSettings({ ...formSettings, managerDiscountCap: parseFloat(e.target.value) || 0 })}
                />
                <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>
                  Maximum percentage discount a manager can authorize.
                </div>
              </div>

              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Shift Cash Variance Tolerance (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  required
                  className="input-field"
                  value={formSettings.shiftVarianceTolerance}
                  onChange={(e) => setFormSettings({ ...formSettings, shiftVarianceTolerance: parseFloat(e.target.value) || 0 })}
                />
                <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>
                  Variance beyond this amount requires manager approval at closing.
                </div>
              </div>

              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Session Idle Inactivity Timeout (Minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  required
                  className="input-field"
                  value={formSettings.sessionTimeoutMinutes}
                  onChange={(e) => setFormSettings({ ...formSettings, sessionTimeoutMinutes: parseInt(e.target.value) || 15 })}
                />
                <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>
                  Locks screen back to outlet login after inactivity.
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-tile)",
              padding: "24px",
            }}
          >
            <h3 style={{ fontSize: "17px", fontWeight: "600", color: "var(--ink)", margin: "0 0 16px 0" }}>
              Printing & Symbology Hardware Profile
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Thermal Receipt Roll Width
                </label>
                <select
                  className="input-field"
                  value={formSettings.receiptPrinterWidth}
                  onChange={(e) => setFormSettings({ ...formSettings, receiptPrinterWidth: e.target.value as "80mm" | "58mm" })}
                >
                  <option value="80mm">80mm Standard POS Thermal Roll</option>
                  <option value="58mm">58mm Compact POS Thermal Roll</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Barcode Sticker Label Size
                </label>
                <select
                  className="input-field"
                  value={formSettings.labelSize}
                  onChange={(e) => setFormSettings({ ...formSettings, labelSize: e.target.value as any })}
                >
                  <option value="50x30mm">50 × 30 mm (Standard Shoe Box Sticker)</option>
                  <option value="50x25mm">50 × 25 mm</option>
                  <option value="40x30mm">40 × 30 mm</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Barcode Symbology Format
                </label>
                <select
                  className="input-field"
                  value={formSettings.barcodeFormat}
                  onChange={(e) => setFormSettings({ ...formSettings, barcodeFormat: e.target.value as "EAN13" | "CODE128" })}
                >
                  <option value="EAN13">EAN-13 (Standard Retail Footwear)</option>
                  <option value="CODE128">Code 128 (Alphanumeric)</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="btn btn-primary" disabled={isSavingSettings} style={{ minWidth: "160px", height: "46px" }}>
              <Save size={16} />
              {isSavingSettings ? "Saving Settings…" : "Save Policy Settings"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === "AUDIT" && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-tile)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
              Immutable System Audit Trail ({filteredAuditLogs.length})
            </h3>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                placeholder="Filter by user email..."
                className="input-field"
                value={auditFilterUser}
                onChange={(e) => setAuditFilterUser(e.target.value)}
                style={{ width: "200px", padding: "6px 10px", fontSize: "13px" }}
              />
              <select
                className="input-field"
                value={auditFilterAction}
                onChange={(e) => setAuditFilterAction(e.target.value)}
                style={{ width: "180px", padding: "6px 10px", fontSize: "13px" }}
              >
                <option value="">All Actions</option>
                <option value="SALE_COMPLETE">SALE_COMPLETE</option>
                <option value="SHIFT_OPEN">SHIFT_OPEN</option>
                <option value="SHIFT_CLOSE">SHIFT_CLOSE</option>
                <option value="CASH_SAFE_DROP">CASH_SAFE_DROP</option>
                <option value="CASH_PAID_IN">CASH_PAID_IN</option>
                <option value="CASH_PAID_OUT">CASH_PAID_OUT</option>
                <option value="RETURN_CREATE">RETURN_CREATE</option>
                <option value="REPAIR_INTAKE">REPAIR_INTAKE</option>
                <option value="REPAIR_DELIVER">REPAIR_DELIVER</option>
                <option value="TRANSFER_DISPATCH">TRANSFER_DISPATCH</option>
                <option value="TRANSFER_RECEIVE">TRANSFER_RECEIVE</option>
                <option value="STOCK_COUNT_START">STOCK_COUNT_START</option>
                <option value="STOCK_COUNT_APPROVE">STOCK_COUNT_APPROVE</option>
                <option value="CHEQUE_CREATE">CHEQUE_CREATE</option>
                <option value="CHEQUE_STATUS_CHANGE">CHEQUE_STATUS_CHANGE</option>
                <option value="SETTINGS_UPDATE">SETTINGS_UPDATE</option>
                <option value="USER_CREATE">USER_CREATE</option>
              </select>
            </div>
          </div>

          {filteredAuditLogs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-3)", fontSize: "14px" }}>
              No audited events found matching filter criteria.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="pos-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>User</th>
                    <th>Entity Type</th>
                    <th>Branch</th>
                    <th>Reason / Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: "13px", color: "var(--ink-2)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                        {formatDate(log.createdAt)}
                      </td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontFamily: "monospace" }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontWeight: "500" }}>{log.userEmailCache}</td>
                      <td style={{ fontSize: "13px", color: "var(--ink-2)", fontFamily: "monospace" }}>{log.entityType}</td>
                      <td>
                        <span className="badge badge-neutral">{log.shopId || "Global"}</span>
                      </td>
                      <td style={{ fontSize: "13px", color: "var(--ink-2)" }}>
                        {log.reason || JSON.stringify(log.after || "")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ADD STAFF USER MODAL */}
      {isAddUserModalOpen && (
        <div className="modal-backdrop">
          <form
            onSubmit={handleCreateUser}
            className="modal-panel animate-fade-in"
            style={{ maxWidth: "480px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
                  Add Staff Account
                </h3>
                <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                  Create an outlet-scoped operator account
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="btn btn-secondary btn-sm"
                aria-label="Close"
                style={{ width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Staff Full Name *
              </label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="e.g. Nadeeka Perera"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Email / Login Username *
              </label>
              <input
                type="email"
                required
                className="input-field"
                placeholder="e.g. nadeeka@rightway.pos"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Role *
                </label>
                <select
                  className="input-field"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                >
                  <option value="CASHIER">Cashier</option>
                  <option value="SHOP_MANAGER">Shop Manager</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Assigned Branch *
                </label>
                <select
                  className="input-field"
                  disabled={newRole === "SUPER_ADMIN"}
                  value={newShopId}
                  onChange={(e) => setNewShopId(e.target.value)}
                >
                  <option value="rightway">RightWay Shoes (Colombo)</option>
                  <option value="mega">Mega Shoes (Kandy)</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Temporary Password (min 10 characters) *
              </label>
              <input
                type="text"
                required
                minLength={10}
                className="input-field"
                value={newTemporaryPassword}
                onChange={(e) => setNewTemporaryPassword(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                id="new-must-change-pass"
                checked={newMustChangePassword}
                onChange={(e) => setNewMustChangePassword(e.target.checked)}
                style={{ width: "16px", height: "16px", accentColor: "var(--primary)", cursor: "pointer" }}
              />
              <label htmlFor="new-must-change-pass" style={{ fontSize: "13px", fontWeight: "500", color: "var(--ink)", cursor: "pointer" }}>
                Must change password at first sign-in
              </label>
            </div>

            {newRole === "SUPER_ADMIN" && (
              <div style={{ marginBottom: "16px", padding: "12px", background: "var(--warning-soft)", border: "1px solid #fed7aa", borderRadius: "8px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px", color: "var(--warning)", fontWeight: "600", fontSize: "13px" }}>
                  <ShieldAlert size={16} /> Super Admin Privilege Warning
                </div>
                <p style={{ fontSize: "12px", color: "var(--ink-2)", margin: "0 0 8px 0" }}>
                  Super Admins have unrestricted access to central settings, supplier ledgers, employees, payroll, and all branches.
                </p>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "600", color: "var(--ink)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={superAdminConfirmed}
                    onChange={(e) => setSuperAdminConfirmed(e.target.checked)}
                    style={{ accentColor: "var(--primary)" }}
                  />
                  <span>I confirm creating this user with Super Admin privileges</span>
                </label>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Discount Cap (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="input-field"
                  value={newDiscountCap}
                  onChange={(e) => setNewDiscountCap(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Cash Refund Cap (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  className="input-field"
                  value={newRefundCap}
                  onChange={(e) => setNewRefundCap(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, height: "48px" }}
                onClick={() => setIsAddUserModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2, height: "48px" }}
                disabled={isSubmittingUser}
              >
                <CheckCircle2 size={16} />
                {isSubmittingUser ? "Creating…" : "Create User"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT STAFF USER MODAL */}
      {editingUser && (
        <div className="modal-backdrop">
          <form
            onSubmit={handleSaveEditUser}
            className="modal-panel animate-fade-in"
            style={{ maxWidth: "480px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--ink)", margin: 0 }}>
                  Edit Staff Account
                </h3>
                <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "2px" }}>
                  {editingUser.email}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="btn btn-secondary btn-sm"
                aria-label="Close"
                style={{ width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Staff Full Name *
              </label>
              <input
                type="text"
                required
                className="input-field"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Role *
                </label>
                <select
                  className="input-field"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                >
                  <option value="CASHIER">Cashier</option>
                  <option value="SHOP_MANAGER">Shop Manager</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                  Assigned Branch *
                </label>
                <select
                  className="input-field"
                  disabled={editRole === "SUPER_ADMIN"}
                  value={editShopId}
                  onChange={(e) => setEditShopId(e.target.value)}
                >
                  <option value="rightway">RightWay Shoes (Colombo)</option>
                  <option value="mega">Mega Shoes (Kandy)</option>
                </select>
              </div>
            </div>

            {editRole === "SUPER_ADMIN" && editingUser.role !== "SUPER_ADMIN" && (
              <div style={{ marginBottom: "16px", padding: "12px", background: "var(--warning-soft)", border: "1px solid #fed7aa", borderRadius: "8px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px", color: "var(--warning)", fontWeight: "600", fontSize: "13px" }}>
                  <ShieldAlert size={16} /> Super Admin Privilege Warning
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "600", color: "var(--ink)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={editSuperAdminConfirmed}
                    onChange={(e) => setEditSuperAdminConfirmed(e.target.checked)}
                    style={{ accentColor: "var(--primary)" }}
                  />
                  <span>I confirm promoting this user to Super Admin</span>
                </label>
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, height: "48px" }}
                onClick={() => setEditingUser(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2, height: "48px" }}
                disabled={isSavingEditUser}
              >
                <Save size={16} />
                {isSavingEditUser ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
