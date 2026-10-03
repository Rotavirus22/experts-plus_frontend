import type { Permission } from "@xperts/shared";

export interface NavItem {
  href: string;
  label: string;
  icon: "dashboard" | "workers" | "camps" | "reports" | "fields" | "org" | "users" | "roles" | "audit";
  permission?: Permission;
  group: "main" | "admin";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard", group: "main" },
  { href: "/workers", label: "Workers", icon: "workers", permission: "workers.view", group: "main" },
  { href: "/camps", label: "Camps", icon: "camps", permission: "camps.view", group: "main" },
  { href: "/reports", label: "Reports", icon: "reports", permission: "reports.view", group: "main" },
  { href: "/admin/fields", label: "Custom fields", icon: "fields", permission: "fields.manage", group: "admin" },
  { href: "/admin/organisation", label: "Sponsors & clients", icon: "org", permission: "org.manage", group: "admin" },
  { href: "/admin/users", label: "Users", icon: "users", permission: "users.manage", group: "admin" },
  { href: "/admin/roles", label: "Roles & permissions", icon: "roles", permission: "roles.manage", group: "admin" },
  { href: "/admin/audit", label: "Audit log", icon: "audit", permission: "audit.view", group: "admin" },
];
