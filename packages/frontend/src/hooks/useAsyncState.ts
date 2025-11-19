import { useCallback, useState } from "react";

export function useAsyncState() {
  const [running, setRunning] = useState(false);
  return [
    running,
    useCallback(() => {
      setRunning((old) => {
        if (old) throw new Error("Already running");
        return true;
      });
      return {
        [Symbol.dispose]() {
          setRunning(false);
        },
      };
    }, []),
  ] as const;
}
