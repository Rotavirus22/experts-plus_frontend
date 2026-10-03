"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Light / dark / system theme via the `.dark` class (tokens in globals.css). */
export function ThemeProvider(props: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props} />;
}
