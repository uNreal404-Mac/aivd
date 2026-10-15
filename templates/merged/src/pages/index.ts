/**
 * Page stubs for the fused template (marketing + app shells).
 * Wire these to TanStack Router / Next app router when promoting.
 */

export const marketingPages = [
  { path: "/", title: "Home", seo: true },
  { path: "/pricing", title: "Pricing", seo: true },
  { path: "/blog", title: "Blog", seo: true },
  { path: "/docs", title: "Docs", seo: true },
] as const;

export const authPages = [
  { path: "/sign-in", title: "Sign in" },
  { path: "/sign-up", title: "Sign up" },
  { path: "/forgot-password", title: "Forgot password" },
  { path: "/reset-password", title: "Reset password" },
] as const;

export const appPages = [
  { path: "/settings", title: "Settings" },
  { path: "/settings/credits", title: "Credits" },
  { path: "/settings/billing", title: "Billing" },
  { path: "/settings/payments", title: "Payments" },
] as const;

export const adminPages = [
  { path: "/admin", title: "Admin" },
  { path: "/admin/users", title: "Users" },
  { path: "/admin/credits", title: "Credits" },
  { path: "/admin/payments", title: "Payments" },
] as const;
