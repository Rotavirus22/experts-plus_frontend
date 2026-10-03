import type { OccupancyDto } from "@xperts/shared";
import { cn } from "@/lib/utils";

// Client-only (motion) pieces live in ./motion and are re-exported so callers import from one place.
export { EASE, FadeIn, OccupancyBar } from "./motion";

/** Page title row: title, optional subtitle, actions on the right. */
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.02em]">{title}</h1>
          {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase", className)}>{children}</h2>;
}

export function percentInUse(o: OccupancyDto): number {
  return o.beds ? ((o.occupied + o.held) / o.beds) * 100 : 0;
}

/** KPI card: coloured dot + label, big number, caption. */
export function KpiCard({
  label,
  value,
  caption,
  dot,
  className,
}: {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  dot?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5 rounded-[14px] border bg-card p-4 shadow-sm sm:p-5", className)}>
      <span className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
        {dot && <span className={cn("size-2 rounded-full", dot)} />}
        {label}
      </span>
      <span className="text-[26px] leading-none font-extrabold sm:text-[32px] tracking-[-0.02em] tabular-nums">{value}</span>
      {caption && <span className="text-xs text-muted-foreground">{caption}</span>}
    </div>
  );
}

/** Empty state with a helpful next action. */
export function EmptyState({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
      {icon && <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</div>}
      <p className="text-base font-bold">{title}</p>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
      {action}
    </div>
  );
}

/** Small pill used for exit types, admin states, counts. */
export function Pill({
  tone = "muted",
  className,
  children,
}: {
  tone?: "muted" | "primary" | "warning" | "success" | "danger" | "info" | "accent";
  className?: string;
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    muted: "border-border bg-muted text-muted-foreground",
    primary: "border-transparent bg-primary text-primary-foreground",
    warning: "border-warning-border bg-warning-bg text-warning-fg",
    success: "border-status-vacant-border bg-status-vacant-bg text-status-vacant-fg",
    danger: "border-[color-mix(in_oklab,var(--destructive)_35%,var(--border))] bg-[color-mix(in_oklab,var(--destructive)_10%,var(--card))] text-destructive",
    info: "border-status-occupied-border bg-status-occupied-bg text-status-occupied-fg",
    accent: "border-transparent bg-accent text-accent-foreground",
  };
  return (
    <span className={cn("inline-flex h-5.5 items-center gap-1 rounded-full border px-2.5 text-[11.5px] font-bold whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}
