import { useEffect, useState } from "react";

export function useValueChangeEffect<T>(
  value: T,
  effect: (value: T, old: T) => (() => void) | void,
  equals: (a: T, b: T) => boolean = (a, b) => a === b
) {
  const [current, update] = useState(value);
  useEffect(() => {
    if (!equals(value, current)) {
      update(value);
      return effect(value, current);
    }
  }, [value]);
}
