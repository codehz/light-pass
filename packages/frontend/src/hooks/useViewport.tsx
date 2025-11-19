import { off, on, viewport,  } from "@telegram-apps/sdk-react";
import { useSyncExternalStore } from "react";

function subscribeViewportHeightChange(fn: () => void) {
  on("viewport_changed", fn);
  return () => {
    off("viewport_changed", fn);
  };
}

function getViewportHeight() {
  return viewport.height();
}

function getViewportBottom() {
  return window.innerHeight - viewport.height();
}

function getViewportStableHeight() {
  return viewport.stableHeight();
}

function getViewportStableBottom() {
  return window.innerHeight - viewport.stableHeight();
}

function getHeightServerSnapshot() {
  return Number.MAX_SAFE_INTEGER;
}

function getBottomServerSnapshot() {
  return 0;
}

export function useViewportHeight() {
  return useSyncExternalStore(
    subscribeViewportHeightChange,
    getViewportHeight,
    getHeightServerSnapshot,
  );
}

export function useViewportBottom() {
  return useSyncExternalStore(
    subscribeViewportHeightChange,
    getViewportBottom,
    getBottomServerSnapshot,
  );
}

export function useViewportStableHeight() {
  return useSyncExternalStore(
    subscribeViewportHeightChange,
    getViewportStableHeight,
    getHeightServerSnapshot,
  );
}

export function useViewportStableBottom() {
  return useSyncExternalStore(
    subscribeViewportHeightChange,
    getViewportStableBottom,
    getBottomServerSnapshot,
  );
}
