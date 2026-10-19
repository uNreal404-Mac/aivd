"use client";

import { useEffect } from "react";

import {
  ATTRIBUTION_COOKIE,
  pickAttribution,
} from "@/lib/attribution";

const COOKIE_MAX_AGE_SECONDS = 7776000;

function hasAttributionCookie(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const prefix = `${ATTRIBUTION_COOKIE}=`;
  return document.cookie
    .split(";")
    .some((part) => part.trim().startsWith(prefix));
}

export function AttributionCapture() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (hasAttributionCookie()) {
      return;
    }

    const params = pickAttribution(
      new URLSearchParams(window.location.search),
    );
    if (!params) {
      return;
    }

    const payload = {
      ...params,
      landing_path: window.location.pathname,
      first_seen: new Date().toISOString(),
    };

    const value = encodeURIComponent(JSON.stringify(payload));
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${ATTRIBUTION_COOKIE}=${value}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  }, []);

  return null;
}
