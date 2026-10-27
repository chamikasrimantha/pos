// src/context/AppContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { Shop, UserProfile, CashierShift, SystemSettings } from "@/types";
import { DEFAULT_SETTINGS } from "@/lib/seed-data";
import {
  getShops,
  getUsers,
  getActiveShift,
  getSystemSettings,
  seedDatabaseIfEmpty,
} from "@/lib/firestore-service";
import {
  PermissionKey,
  hasPermission as checkPermission,
  canAccessOutlet as checkOutletAccess,
  isModuleVisible as checkModuleVisible,
} from "@/lib/permissions";

interface ToastNotification {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface PrintModalData {
  isOpen: boolean;
  title: string;
  htmlContent: string;
}

interface AppContextType {
  shops: Shop[];
  activeShop: Shop;
  setActiveShopId: (id: string) => void;
  users: UserProfile[];
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;
  isAuthenticated: boolean;
  selectedOutletSlug: string | null;
  setSelectedOutletSlug: (slug: string | null) => void;
  login: (email: string, password: string, outletSlug?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  activeShift: CashierShift | null;
  refreshActiveShift: () => void;
  settings: SystemSettings;
  toasts: ToastNotification[];
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  removeToast: (id: string) => void;
  printModal: PrintModalData;
  openPrintModal: (title: string, htmlContent: string) => void;
  closePrintModal: () => void;
  activeView: string;
  setActiveView: (view: string) => void;
  refreshData: () => void;
  dataVersion: number;
  hasPermission: (permission: PermissionKey) => boolean;
  isModuleVisible: (moduleId: string) => boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [activeShop, setActiveShop] = useState<Shop | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [selectedOutletSlug, setSelectedOutletSlugState] = useState<string | null>(null);
  const [activeShift, setActiveShift] = useState<CashierShift | null>(null);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [dataVersion, setDataVersion] = useState<number>(1);
  const [activeView, setActiveView] = useState<string>("pos");

  const [printModal, setPrintModal] = useState<PrintModalData>({
    isOpen: false,
    title: "",
    htmlContent: "",
  });

  const lastActivityRef = useRef<number>(0);

  const refreshData = useCallback(() => {
    setDataVersion((v) => v + 1);
  }, []);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = `t_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const openPrintModal = useCallback((arg1: string, arg2: string) => {
    let title = arg1;
    let htmlContent = arg2;
    if (arg1 && arg1.trim().startsWith("<") && (!arg2 || !arg2.trim().startsWith("<"))) {
      title = arg2 || "Print Document";
      htmlContent = arg1;
    }
    setPrintModal({
      isOpen: true,
      title,
      htmlContent,
    });
  }, []);

  const closePrintModal = useCallback(() => {
    setPrintModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const setSelectedOutletSlug = (slug: string | null) => {
    setSelectedOutletSlugState(slug);
    if (typeof window !== "undefined") {
      if (slug) {
        localStorage.setItem("pos_last_outlet", slug);
      } else {
        localStorage.removeItem("pos_last_outlet");
      }
    }
  };

  // Initialize data
  useEffect(() => {
    lastActivityRef.current = Date.now();
    seedDatabaseIfEmpty();
    const loadedShops = getShops();
    const loadedUsers = getUsers();
    const loadedSettings = getSystemSettings();
    setShops(loadedShops);
    setUsers(loadedUsers);
    setSettings(loadedSettings);

    // Retrieve saved last outlet convenience value
    if (typeof window !== "undefined") {
      const savedOutlet = localStorage.getItem("pos_last_outlet");
      if (savedOutlet) {
        setSelectedOutletSlugState(savedOutlet);
      }

      // Restore session if user was signed in
      const sessionUserRaw = localStorage.getItem("pos_session_user");
      if (sessionUserRaw) {
        try {
          const sessionUser: UserProfile = JSON.parse(sessionUserRaw);
          const found = loadedUsers.find((u) => u.uid === sessionUser.uid && u.active);
          if (found) {
            setCurrentUser(found);
            setIsAuthenticated(true);
            const userOutlet = loadedShops.find((s) => s.id === found.allowedShopIds[0]) || loadedShops[0];
            setActiveShop(userOutlet);
          }
        } catch (e) {
          console.warn("Session restore failed:", e);
        }
      }
    }

    if (loadedShops.length > 0 && !activeShop) {
      setActiveShop(loadedShops[0]);
    }
  }, []);

  // Track active shift for current user & active shop
  const refreshActiveShift = useCallback(() => {
    if (!activeShop || !currentUser) {
      setActiveShift(null);
      return;
    }
    const shift = getActiveShift(activeShop.id, currentUser.uid);
    setActiveShift(shift);
  }, [activeShop, currentUser]);

  useEffect(() => {
    refreshActiveShift();
  }, [refreshActiveShift, dataVersion]);

  // Handle Login Authentication with Outlet Scoping (Section 4)
  const login = async (
    email: string,
    password: string,
    outletSlug?: string
  ): Promise<{ success: boolean; error?: string }> => {
    // 1. Password minimum length check
    if (!password || password.length < 10) {
      return { success: false, error: "Choose a longer password (at least 10 characters)." };
    }

    const currentUsers = getUsers();
    const foundUser = currentUsers.find(
      (u) => u.email.toLowerCase().trim() === email.toLowerCase().trim()
    );

    if (!foundUser || !foundUser.active) {
      return { success: false, error: "Email or password is incorrect." };
    }

    // 2. Outlet Scoping Check (Section 4.3 #4.5)
    // If logging into a specific outlet (not /login/admin), check user has permission for that outlet
    if (outletSlug && outletSlug !== "admin") {
      const targetShop = shops.find((s) => s.slug === outletSlug || s.id === outletSlug);
      if (!targetShop) {
        return { success: false, error: "Invalid outlet selected." };
      }

      if (foundUser.role !== "SUPER_ADMIN" && !foundUser.allowedShopIds.includes(targetShop.id)) {
        return {
          success: false,
          error: `This account is not set up for ${targetShop.name}.`,
        };
      }

      setActiveShop(targetShop);
    } else {
      // Admin login: user MUST be SUPER_ADMIN
      if (outletSlug === "admin" && foundUser.role !== "SUPER_ADMIN") {
        return {
          success: false,
          error: "Administrator privileges required to access this console.",
        };
      }
      if (foundUser.allowedShopIds.length > 0) {
        const primaryShop = shops.find((s) => s.id === foundUser.allowedShopIds[0]) || shops[0];
        setActiveShop(primaryShop);
      }
    }

    setCurrentUser(foundUser);
    setIsAuthenticated(true);
    lastActivityRef.current = Date.now();

    if (typeof window !== "undefined") {
      localStorage.setItem("pos_session_user", JSON.stringify(foundUser));
    }

    showToast(`Welcome back, ${foundUser.displayName}!`, "success");
    return { success: true };
  };

  const logout = useCallback(() => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    setActiveShift(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("pos_session_user");
    }
    showToast("Signed out successfully.", "info");
  }, [showToast]);

  // Inactivity timeout lock (Section 4.3 #4.12)
  useEffect(() => {
    if (!isAuthenticated) return;

    const timeoutMinutes = settings.sessionTimeoutMinutes || 15;
    const timeoutMs = timeoutMinutes * 60 * 1000;

    const interval = setInterval(() => {
      const idleTime = Date.now() - lastActivityRef.current;
      if (idleTime >= timeoutMs) {
        logout();
        showToast("Session locked due to inactivity.", "info");
      }
    }, 15000);

    const onUserActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener("pointerdown", onUserActivity);
    window.addEventListener("keydown", onUserActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener("pointerdown", onUserActivity);
      window.removeEventListener("keydown", onUserActivity);
    };
  }, [isAuthenticated, settings.sessionTimeoutMinutes, logout, showToast]);

  const setActiveShopId = (id: string) => {
    // Only Super Admin can freely switch shops
    if (currentUser?.role !== "SUPER_ADMIN") {
      showToast("Branch is locked to your assigned outlet.", "error");
      return;
    }
    const found = shops.find((s) => s.id === id);
    if (found) {
      setActiveShop(found);
    }
  };

  const hasPermission = useCallback(
    (permission: PermissionKey) => {
      if (!currentUser) return false;
      return checkPermission(currentUser.role, permission, currentUser);
    },
    [currentUser]
  );

  const isModuleVisible = useCallback(
    (moduleId: string) => {
      if (!currentUser) return false;
      return checkModuleVisible(currentUser.role, moduleId);
    },
    [currentUser]
  );

  return (
    <AppContext.Provider
      value={{
        shops,
        activeShop: activeShop || shops[0],
        setActiveShopId,
        users,
        currentUser,
        setCurrentUser,
        isAuthenticated,
        selectedOutletSlug,
        setSelectedOutletSlug,
        login,
        logout,
        activeShift,
        refreshActiveShift,
        settings,
        toasts,
        showToast,
        removeToast,
        printModal,
        openPrintModal,
        closePrintModal,
        activeView,
        setActiveView,
        refreshData,
        dataVersion,
        hasPermission,
        isModuleVisible,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return ctx;
}
