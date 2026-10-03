/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

/**
 * The Xperts logo cropped to its artwork (content box x 8–196, y 73–130 of the 200×200 file),
 * on a white tile so it reads on the navy sidebar and in dark mode.
 */
export function XpertsLogo({ className }: { className?: string }) {
  return (
    <div className={cn("relative aspect-[216/64] w-[216px] overflow-hidden rounded-[10px] bg-white", className)}>
      <img
        src="/xperts-logo.jpg"
        alt="Xperts Recruitment Services"
        className="absolute left-0 w-[99.07%] max-w-none"
        style={{ top: "-118.75%" }}
        draggable={false}
      />
    </div>
  );
}
