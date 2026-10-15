/**
 * Merged admin facade.
 * Access / RBAC: ./shipany-access
 * Users / redemptions / tasks UI patterns: mkfast admin (documented in MERGE_NOTES)
 */

export type AdminRole = "owner" | "admin" | "support" | "viewer";

export type AdminPermission =
  | "users.read"
  | "users.write"
  | "credits.adjust"
  | "payments.read"
  | "settings.write"
  | "content.write";

export const defaultRolePermissions: Record<AdminRole, AdminPermission[]> = {
  owner: [
    "users.read",
    "users.write",
    "credits.adjust",
    "payments.read",
    "settings.write",
    "content.write",
  ],
  admin: [
    "users.read",
    "users.write",
    "credits.adjust",
    "payments.read",
    "settings.write",
    "content.write",
  ],
  support: ["users.read", "payments.read", "credits.adjust"],
  viewer: ["users.read", "payments.read"],
};

export function can(role: AdminRole, permission: AdminPermission): boolean {
  return defaultRolePermissions[role]?.includes(permission) ?? false;
}

export const adminNav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/credits", label: "Credits" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/redemptions", label: "Redemptions" },
  { href: "/admin/settings", label: "Settings" },
] as const;
