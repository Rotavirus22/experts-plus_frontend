import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Loading placeholders shaped like the pages they stand in for (pulse disabled for reduced motion). */
export function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted motion-reduce:animate-none", className)} />;
}

function Header({ actions = 1 }: { actions?: number }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        <Bone className="h-8 w-56" />
        <Bone className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: actions }, (_, i) => (
          <Bone key={i} className="h-9.5 w-32" />
        ))}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      {children}
    </div>
  );
}

/** Header, optional filter bar, table. */
export function TablePageSkeleton({ filters = false, rows = 8 }: { filters?: boolean; rows?: number }) {
  return (
    <Shell>
      <Header actions={2} />
      {filters && (
        <div className="flex flex-wrap gap-2 rounded-2xl border bg-card p-4 shadow-sm">
          <Bone className="h-9.5 w-64" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Bone key={i} className="h-9.5 w-28" />
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="border-b bg-muted/60 px-4 py-3">
          <Bone className="h-4 w-1/2" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <Bone className="h-4 w-20" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Bone className="h-4 w-48" />
              <Bone className="h-3 w-24" />
            </div>
            <Bone className="hidden h-4 w-32 md:block" />
            <Bone className="hidden h-6 w-20 rounded-full md:block" />
            <Bone className="h-7.5 w-20" />
          </div>
        ))}
      </div>
    </Shell>
  );
}

/** Header, side card + main cards. */
export function DetailPageSkeleton() {
  return (
    <Shell>
      <Header actions={3} />
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-5">
          {[0, 1].map((i) => (
            <div key={i} className="grid gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:grid-cols-3">
              {Array.from({ length: 6 }, (_, j) => (
                <div key={j} className="flex flex-col gap-1.5">
                  <Bone className="h-3 w-20" />
                  <Bone className="h-4 w-32" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm">
          <Bone className="h-4 w-28" />
          <Bone className="h-16 w-full" />
          <Bone className="h-16 w-full" />
        </div>
      </div>
    </Shell>
  );
}

/** Header, KPI strip, grid of cards (camps, rooms). */
export function GridPageSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <Shell>
      <Header actions={1} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
            <Bone className="h-5 w-32" />
            <Bone className="h-3 w-48" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }, (_, j) => (
                <Bone key={j} className="h-14" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/** Header + form sections. */
export function FormPageSkeleton() {
  return (
    <Shell>
      <Header actions={0} />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
          <Bone className="h-5 w-40" />
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }, (_, j) => (
              <div key={j} className="flex flex-col gap-1.5">
                <Bone className="h-3 w-24" />
                <Bone className="h-9.5 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </Shell>
  );
}

/** Inline spinner + text for small regions (lists inside dialogs, drawers). */
export function LoadingText({ children = "Loading…", className }: { children?: React.ReactNode; className?: string }) {
  return (
    <p role="status" className={cn("flex items-center justify-center gap-2 text-sm text-muted-foreground", className)}>
      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
      {children}
    </p>
  );
}
