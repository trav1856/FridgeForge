"use client";

import type { MouseEvent, ReactNode } from "react";
import {
  SPLASH_AUTH_EVENT,
  type SplashAuthEventDetail,
  type SplashAuthMode,
} from "@/lib/splash-auth";

/**
 * In-page link to the splash auth card. Without JS it is a plain #auth anchor;
 * once hydrated it asks the card to switch tab, scroll into view and focus.
 */
export function SplashAuthLink({
  mode,
  className,
  children,
}: {
  mode?: SplashAuthMode;
  className?: string;
  children: ReactNode;
}) {
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    window.dispatchEvent(
      new CustomEvent<SplashAuthEventDetail>(SPLASH_AUTH_EVENT, {
        detail: { mode },
      })
    );
  }

  return (
    <a href="#auth" onClick={onClick} className={className}>
      {children}
    </a>
  );
}
