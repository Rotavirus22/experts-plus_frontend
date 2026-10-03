import { Suspense } from "react";
import { XpertsLogo } from "@/components/shell/logo";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[680px_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-14 text-sidebar-foreground lg:flex">
        <XpertsLogo className="w-[252px]" />
        <div className="relative z-10 flex flex-col gap-4">
          <p className="flex items-center gap-3 text-[13px] font-bold tracking-[0.12em] text-brand uppercase">
            <span className="h-[3px] w-7 rounded-full bg-brand" /> Xperts Camps
          </p>
          <h1 className="max-w-md text-[40px] leading-[1.1] font-extrabold tracking-[-0.02em] text-white">
            Workers, camps and beds across the UAE, in one place.
          </h1>
          <p className="text-[15px]">The internal accommodation system for Xperts Recruitment staff.</p>
        </div>
        <p className="relative z-10 text-xs opacity-70">© {new Date().getFullYear()} Xperts Recruitment Services · Dubai, UAE</p>
        {/* Decorative rings */}
        <span aria-hidden className="absolute -right-40 -bottom-40 size-[520px] rounded-full border border-white/10" />
        <span aria-hidden className="absolute -right-24 -bottom-24 size-[380px] rounded-full border border-white/10" />
      </aside>
      <main className="flex items-center justify-center bg-background px-6 py-12">
        <div className="flex w-full max-w-[400px] flex-col gap-7">
          <XpertsLogo className="w-[200px] lg:hidden" />
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[28px] font-extrabold tracking-[-0.02em]">Sign in</h2>
            <p className="text-sm text-muted-foreground">Staff accounts only. Ask an administrator if you need access.</p>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
