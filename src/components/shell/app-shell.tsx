"use client";

import type { AccessProfile } from "@xperts/shared";
import { LogOut, Menu, Monitor, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { AppSidebar, type NavCounts } from "./app-sidebar";
import { BreadcrumbProvider, Breadcrumbs } from "./breadcrumbs";
import { CommandPalette } from "./command-palette";
import { SessionKeepAlive } from "./session-keep-alive";
import { useAppRouter } from "@/lib/use-app-router";

type Me = { name: string; roleName: string | null; access: AccessProfile };

const COLLAPSE_KEY = "xc.sidebar.collapsed";

/** Remembered per browser; read-only fallbacks keep the server render and private windows working. */
function useCollapsed(): [boolean, (v: boolean) => void] {
  const subscribe = (cb: () => void) => {
    window.addEventListener("storage", cb);
    return () => window.removeEventListener("storage", cb);
  };
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(COLLAPSE_KEY) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const set = (v: boolean) => {
    try {
      localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
      window.dispatchEvent(new StorageEvent("storage"));
    } catch {
      /* storage unavailable: keep default */
    }
  };
  return [value, set];
}

export function AppShell({ me, counts, children }: { me: Me; counts: NavCounts; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <BreadcrumbProvider>
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 overflow-y-auto transition-[width] duration-200 md:block",
            collapsed ? "w-[76px]" : "w-[248px]",
          )}
        >
          <AppSidebar access={me.access} counts={counts} collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)} />
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[280px] border-0 p-0 sm:max-w-[280px]" showCloseButton={false}>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <AppSidebar access={me.access} counts={counts} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:px-6">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu />
            </Button>
            <div className="min-w-0 flex-1">
              <Breadcrumbs />
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden h-9.5 w-[340px] max-w-[30vw] items-center gap-2 rounded-lg border bg-background px-3 text-[13px] text-muted-foreground transition hover:border-input lg:flex"
            >
              <Search className="size-4" />
              <span className="flex-1 text-left">Search workers, camps…</span>
              <kbd className="rounded-[5px] border bg-card px-1.5 py-0.5 font-mono text-[11px]">⌘K</kbd>
            </button>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSearchOpen(true)} aria-label="Search">
              <Search />
            </Button>
            <ThemeMenu />
            <UserBlock me={me} />
          </header>
          <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-6 pb-12 md:px-8">{children}</main>
        </div>
      </div>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} access={me.access} />
      <SessionKeepAlive />
    </BreadcrumbProvider>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function UserBlock({ me }: { me: Me }) {
  const router = useAppRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <Link href="/account" title="My account" className="flex items-center gap-2.5 rounded-lg p-1 pr-2 transition hover:bg-muted">
        <span className="flex size-[34px] items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{initials(me.name)}</span>
        <span className="hidden flex-col leading-tight sm:flex">
          <span className="text-[13px] font-semibold">{me.name}</span>
          <span className="text-xs text-muted-foreground">{me.roleName ?? "No role"}</span>
        </span>
      </Link>
      <Button
        variant="outline"
        size="sm"
        className="h-9"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await authClient.signOut();
            router.replace("/login");
            router.refresh();
          })
        }
      >
        <LogOut data-icon="inline-start" />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </div>
  );
}

function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Theme" />}>
        <Sun className="dark:hidden" />
        <Moon className="hidden dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={(v) => setTheme(String(v))}>
          <DropdownMenuRadioItem value="light">
            <Sun /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
