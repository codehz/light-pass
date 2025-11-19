import { useSyncExternalStore } from "react";

function subscribeViewport(cb: () => void) {
  const controller = new AbortController();
  let pending = false;
  function handler() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      cb();
    });
  }
  window.visualViewport!.addEventListener("resize", handler, {
    signal: controller.signal,
  });
  window.visualViewport!.addEventListener("scroll", handler, {
    signal: controller.signal,
  });
  return () => controller.abort();
}

function getVisualViewportBottom() {
  const viewport = window.visualViewport!;
  return window.innerHeight - (viewport.offsetTop + viewport.height);
}
function getVisualViewportHeight() {
  const viewport = window.visualViewport!;
  return viewport.height;
}

function getHeightServerSnapshot() {
  return Number.MAX_SAFE_INTEGER;
}

function getBottomServerSnapshot() {
  return 0;
}

export function useVisualViewportBottom() {
  return useSyncExternalStore(
    subscribeViewport,
    getVisualViewportBottom,
    getBottomServerSnapshot,
  );
}
export function useVisualViewportHeight() {
  return useSyncExternalStore(
    subscribeViewport,
    getVisualViewportHeight,
    getHeightServerSnapshot,
  );
}
