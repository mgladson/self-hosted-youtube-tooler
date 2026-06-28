"use client";

import { useEffect, useRef } from "react";

type EventType = "page_view" | "scroll_depth" | "click" | "element_visibility" | "page_exit" | "web_vital";

type Event = {
  type: EventType;
  sessionId: string;
  path: string;
  timestamp: number;
  data: Record<string, unknown>;
};

const SESSION_KEY = "bf_analytics_session";
const FLUSH_INTERVAL_MS = 5_000;
const MAX_BATCH = 25;
const ENDPOINT = "/api/analytics/events";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // RFC4122 v4 fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = uuid();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return uuid();
  }
}

function describeElement(el: HTMLElement): { tag: string; text: string; href: string; element_id: string } {
  const tag = el.tagName.toLowerCase();
  const text = (el.innerText || el.textContent || "").trim().slice(0, 80);
  const href = (el as HTMLAnchorElement).href ?? "";
  const element_id = el.id || el.getAttribute("data-track-id") || "";
  return { tag, text, href, element_id };
}

export function AnalyticsTracker() {
  const queueRef = useRef<Event[]>([]);
  const sessionIdRef = useRef<string>("");
  const pageEnterRef = useRef<number>(0);
  const maxScrollRef = useRef<number>(0);
  const scrollMilestonesRef = useRef<Set<number>>(new Set());
  const lastPathRef = useRef<string>("");

  useEffect(() => {
    sessionIdRef.current = getSessionId();

    const enqueue = (type: EventType, data: Record<string, unknown> = {}) => {
      queueRef.current.push({
        type,
        sessionId: sessionIdRef.current,
        path: window.location.pathname,
        timestamp: Date.now(),
        data,
      });
      if (queueRef.current.length >= MAX_BATCH) void flush();
    };

    const flush = async (useBeacon = false) => {
      if (queueRef.current.length === 0) return;
      const batch = queueRef.current.splice(0, MAX_BATCH);
      const body = JSON.stringify({ events: batch });
      try {
        if (useBeacon && "sendBeacon" in navigator) {
          const blob = new Blob([body], { type: "application/json" });
          navigator.sendBeacon(ENDPOINT, blob);
          return;
        }
        await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          credentials: "same-origin",
          keepalive: true,
        });
      } catch {
        // Drop on error: analytics is best-effort
      }
    };

    const recordPageView = () => {
      const path = window.location.pathname;
      if (path === lastPathRef.current) return;
      // Emit exit for previous page
      if (lastPathRef.current) {
        emitPageExit();
      }
      lastPathRef.current = path;
      pageEnterRef.current = Date.now();
      maxScrollRef.current = 0;
      scrollMilestonesRef.current = new Set();
      enqueue("page_view", {
        referrer: document.referrer || null,
        screen_w: window.innerWidth,
        screen_h: window.innerHeight,
      });
    };

    const emitPageExit = () => {
      if (!lastPathRef.current) return;
      const time_on_page_ms = Date.now() - pageEnterRef.current;
      // Force-emit using last known path
      queueRef.current.push({
        type: "page_exit",
        sessionId: sessionIdRef.current,
        path: lastPathRef.current,
        timestamp: Date.now(),
        data: {
          time_on_page_ms,
          max_scroll_depth_pct: maxScrollRef.current,
        },
      });
    };

    const onScroll = () => {
      const doc = document.documentElement;
      const totalScrollable = doc.scrollHeight - window.innerHeight;
      if (totalScrollable <= 0) return;
      const pct = Math.min(100, Math.round((window.scrollY / totalScrollable) * 100));
      if (pct > maxScrollRef.current) maxScrollRef.current = pct;
      for (const milestone of [25, 50, 75, 100]) {
        if (pct >= milestone && !scrollMilestonesRef.current.has(milestone)) {
          scrollMilestonesRef.current.add(milestone);
          enqueue("scroll_depth", { depth_pct: milestone });
        }
      }
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const el = target.closest("a, button, [data-track]");
      if (!el || !(el instanceof HTMLElement)) return;
      enqueue("click", describeElement(el));
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        emitPageExit();
        void flush(true);
      }
    };

    const onPageHide = () => {
      emitPageExit();
      void flush(true);
    };

    const onPopState = () => {
      // Detect SPA route changes (next/navigation)
      queueMicrotask(recordPageView);
    };

    // Patch history.pushState/replaceState to detect client-side nav
    const wrap = (method: "pushState" | "replaceState") => {
      const original = history[method].bind(history);
      return function (this: History, ...args: Parameters<History["pushState"]>) {
        const result = original(...args);
        queueMicrotask(recordPageView);
        return result;
      };
    };
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    history.pushState = wrap("pushState") as typeof history.pushState;
    history.replaceState = wrap("replaceState") as typeof history.replaceState;

    recordPageView();

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("popstate", onPopState);

    const flushTimer = window.setInterval(() => void flush(), FLUSH_INTERVAL_MS);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("popstate", onPopState);
      window.clearInterval(flushTimer);
      history.pushState = originalPush;
      history.replaceState = originalReplace;
      emitPageExit();
      void flush(true);
    };
  }, []);

  return null;
}
