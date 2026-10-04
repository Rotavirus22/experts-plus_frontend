import { cn } from "@/lib/utils";

export const APP_NAME = "Camps Management";

/**
 * App mark: a camp roof over a row of beds (one highlighted), on a blue tile. Pure SVG so it stays sharp at any
 * size and works on the navy sidebar, light and dark backgrounds.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" role="img" aria-label={APP_NAME} className={cn("size-9 shrink-0", className)}>
      {/* Solid fills only: an SVG gradient id would clash when the mark appears twice on a page. */}
      <rect width="40" height="40" rx="10" fill="#2563EB" />
      <path d="M10 0h20a10 10 0 0 1 10 10v6C26 22 12 16 0 24V10A10 10 0 0 1 10 0Z" fill="#fff" fillOpacity="0.1" />
      {/* Roof */}
      <path d="M8.5 19.5 20 10l11.5 9.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* Beds */}
      <rect x="9" y="23" width="6" height="8" rx="1.6" fill="#fff" fillOpacity="0.92" />
      <rect x="17" y="23" width="6" height="8" rx="1.6" fill="#F5A524" />
      <rect x="25" y="23" width="6" height="8" rx="1.6" fill="#fff" fillOpacity="0.92" />
    </svg>
  );
}

/** Mark + "Camps Management" wordmark. `tone="light"` for dark backgrounds (sidebar, login panel). */
export function AppLogo({ className, tone = "default", size = "md" }: { className?: string; tone?: "default" | "light"; size?: "md" | "lg" }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={size === "lg" ? "size-12" : "size-9"} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-extrabold tracking-[-0.02em]", size === "lg" ? "text-[26px]" : "text-[17px]", tone === "light" ? "text-white" : "text-foreground")}>Camps</span>
        <span
          className={cn(
            "mt-1 font-semibold tracking-[0.18em] uppercase",
            size === "lg" ? "text-[11.5px]" : "text-[9.5px]",
            tone === "light" ? "text-brand" : "text-muted-foreground",
          )}
        >
          Management
        </span>
      </span>
    </span>
  );
}
