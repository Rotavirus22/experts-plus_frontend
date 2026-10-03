"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

type Crumb = { label: string; href?: string };

const SECTION_LABELS: Record<string, string> = {
  "": "Dashboard",
  workers: "Workers",
  camps: "Camps",
  reports: "Reports",
  "admin/fields": "Custom fields",
  "admin/organisation": "Sponsors & clients",
  "admin/users": "Users",
  "admin/roles": "Roles & permissions",
  "admin/audit": "Audit log",
};

const Ctx = createContext<{ extra: Crumb[]; setExtra: (c: Crumb[]) => void } | null>(null);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [extra, setExtra] = useState<Crumb[]>([]);
  return <Ctx.Provider value={{ extra, setExtra }}>{children}</Ctx.Provider>;
}

/** Pages with a dynamic title (a camp, a worker) add their own crumb, e.g. "Camps › Al Quoz Camp". */
export function SetBreadcrumb({ items }: { items: Crumb[] }) {
  const ctx = useContext(Ctx);
  const key = JSON.stringify(items);
  useEffect(() => {
    ctx?.setExtra(JSON.parse(key) as Crumb[]);
    return () => ctx?.setExtra([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const ctx = useContext(Ctx);
  const parts = pathname.split("/").filter(Boolean);
  const sectionKey = parts[0] === "admin" ? parts.slice(0, 2).join("/") : (parts[0] ?? "");
  const section = SECTION_LABELS[sectionKey];
  const extra = ctx?.extra ?? [];
  const base: Crumb[] = section ? [{ label: section, href: extra.length ? `/${sectionKey}` : undefined }] : [];
  const crumbs: Crumb[] = [...(parts[0] === "admin" ? [{ label: "Administration" }] : []), ...base, ...extra];

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-2">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
            {c.href && !last ? (
              <Link href={c.href} className="truncate text-muted-foreground hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span className={last ? "truncate font-semibold text-foreground" : "truncate text-muted-foreground"}>{c.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
