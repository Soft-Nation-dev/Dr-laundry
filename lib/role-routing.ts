import type { AppRole } from "@/types/profile";

export function getLandingRoute(role: AppRole): string {
  if (role === "driver") return "/driver/home";
  if (role === "admin") return "/admin";
  if (role === "superadmin") return "/admin";
  return "/home";
}

export function canUseDriverMode(role: AppRole): boolean {
  return role === "driver" || role === "admin" || role === "superadmin";
}

export function canViewAdminOrders(role: AppRole): boolean {
  return role === "admin" || role === "superadmin";
}

export function canManageRoles(role: AppRole): boolean {
  return role === "superadmin";
}
