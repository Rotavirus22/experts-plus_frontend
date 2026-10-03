"use client";

import { hasPermission, type AccessProfile } from "@xperts/shared";
import {
  Building2,
  Briefcase,
  FileBarChart,
  History,
  LayoutDashboard,
  ListPlus,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { XpertsLogo } from "./logo";

const ICONS: Record<NavItem["icon"], LucideIcon> = {
  dashboard: LayoutDashboard,
  workers: Users,
  camps: Building2,
  reports: FileBarChart,
  fields: ListPlus,
  org: Briefcase,
  users: UserCog,
  roles: ShieldCheck,
  audit: History,
};

export type NavCounts = { workers: number | null; camps: number | null };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Navy sidebar: logo, product name, navigation grouped Main / Administration, filtered by permission. */
export function AppSidebar({
  access,
  counts,
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
}: {
  access: AccessProfile;
  counts: NavCounts;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const visible = NAV_ITEMS.filter((item) => !item.permission || hasPermission(access, item.permission));
  const groups = [
    { key: "main", title: "Main", items: visible.filter((i) => i.group === "main") },
    { key: "admin", title: "Administration", items: visible.filter((i) => i.group === "admin") },
  ].filter((g) => g.items.length > 0);
  const countFor = (href: string) => (href === "/workers" ? counts.workers : href === "/camps" ? counts.camps : null);

  return (
    <div className="flex h-full flex-col gap-6 bg-sidebar px-4 py-4 text-sidebar-foreground">
      <div className="flex flex-col gap-2.5">
        {!collapsed && <XpertsLogo />}
        <div className={cn("flex items-center gap-2 px-1", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="text-[15px] font-bold text-sidebar-accent-foreground">Xperts Camps</span>
              <span className="text-[11px] opacity-80">Accommodation · UAE</span>
            </div>
          )}
          {onToggleCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-sidebar-border text-sidebar-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </button>
          )}
        </div>
      </div>

      <nav className="flex flex-col gap-5">
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-0.5">
            {!collapsed && <p className="px-2.5 pb-1.5 text-[11px] font-bold tracking-[0.08em] uppercase opacity-60">{group.title}</p>}
            {group.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(pathname, item.href);
              const count = countFor(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-10 items-center gap-3 rounded-[10px] pr-2.5 pl-3.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
                    collapsed && "justify-center px-0",
                    active ? "font-semibold text-sidebar-accent-foreground" : "font-medium hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-[10px] bg-sidebar-accent"
                      transition={reduce ? { duration: 0 } : { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
                    >
                      <span className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-full bg-sidebar-primary" />
                    </motion.span>
                  )}
                  <Icon className="relative size-[18px] shrink-0" strokeWidth={1.75} />
                  {!collapsed && <span className="relative flex-1 truncate">{item.label}</span>}
                  {!collapsed && count !== null && (
                    <span className="relative text-xs font-semibold tabular-nums opacity-75">{count.toLocaleString()}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}
