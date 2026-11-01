// src/app/api/admin/users/route.ts
import { NextResponse } from "next/server";
import { createUserProfile, updateUserProfile, toggleUserActive, getUsers } from "@/lib/firestore-service";
import { ERROR_MESSAGES } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, displayName, role, branchId, temporaryPassword, mustChangePassword = true, createdBy } = body;

    // Caller verification: must be an active Super Admin
    const allUsers = getUsers(true);
    const caller = allUsers.find((u) => u.uid === createdBy);
    if (!caller || !caller.active || caller.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized: Super Admin credentials required." }, { status: 403 });
    }

    if (!displayName?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "Full name and email are required." }, { status: 400 });
    }

    if (!temporaryPassword || temporaryPassword.length < 10) {
      return NextResponse.json({ error: "Temporary password must be at least 10 characters." }, { status: 400 });
    }

    if (role !== "SUPER_ADMIN" && role !== "SHOP_MANAGER" && role !== "CASHIER") {
      return NextResponse.json({ error: "Invalid role specified." }, { status: 400 });
    }

    let allowedShopIds: string[] = [];
    if (role === "SUPER_ADMIN") {
      allowedShopIds = ["rightway", "mega"];
    } else {
      if (!branchId || (branchId !== "rightway" && branchId !== "mega")) {
        return NextResponse.json({ error: "Cashier and Manager accounts must be assigned to exactly one branch." }, { status: 400 });
      }
      allowedShopIds = [branchId];
    }

    const newUser = await createUserProfile({
      email: email.trim().toLowerCase(),
      displayName: displayName.trim(),
      role,
      allowedShopIds,
      createdBy: caller.uid,
      password: temporaryPassword,
      mustChangePassword,
    });

    return NextResponse.json({ success: true, user: newUser });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create user account" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { uid, updates, updatedBy } = body;

    const allUsers = getUsers(true);
    const caller = allUsers.find((u) => u.uid === updatedBy);
    if (!caller || !caller.active || caller.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized: Super Admin credentials required." }, { status: 403 });
    }

    const targetUser = allUsers.find((u) => u.uid === uid);
    if (!targetUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Safety Guard: Cannot disable or demote yourself
    if (targetUser.uid === caller.uid) {
      if (updates.active === false) {
        return NextResponse.json({ error: "You cannot disable your own administrator account." }, { status: 400 });
      }
      if (updates.role && updates.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "You cannot demote your own administrator account." }, { status: 400 });
      }
    }

    // Safety Guard: Cannot disable or demote the last active Super Admin
    if (targetUser.role === "SUPER_ADMIN" && (updates.active === false || (updates.role && updates.role !== "SUPER_ADMIN"))) {
      const activeAdmins = allUsers.filter((u) => u.role === "SUPER_ADMIN" && u.active);
      if (activeAdmins.length <= 1) {
        return NextResponse.json({ error: ERROR_MESSAGES.LAST_ADMIN }, { status: 400 });
      }
    }

    let updatedUser;
    if (typeof updates.active === "boolean") {
      updatedUser = await toggleUserActive(uid, updates.active, caller.uid);
    } else {
      updatedUser = await updateUserProfile(uid, updates, caller.uid);
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update user account" }, { status: 400 });
  }
}
