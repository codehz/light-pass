import { tw } from "bun-tailwindcss" with { type: "macro" };
import { nanoid } from "nanoid";
import { createContext, ReactNode, useCallback, useState } from "react";
import { Spinner } from "./Spinner";

export const WaitContext = createContext<() => { [Symbol.dispose](): void }>(
  () => ({
    [Symbol.dispose](): void {},
  }),
);

export function WaitHost({ children }: { children: ReactNode }) {
  const [state, setState] = useState<string[]>([]);
  const wait = useCallback(() => {
    const id = nanoid();
    setState((state) => [id, ...state]);
    return {
      [Symbol.dispose]() {
        setState((state) => state.filter((x) => x !== id));
      },
    };
  }, []);
  return (
    <WaitContext value={wait}>
      {children}
      <div
        className={tw(
          "inert:opacity-0 inert:pointer-events-none",
          "absolute inset-0 z-50 flex items-center justify-center",
          "bg-black/50 backdrop-blur-3xl backdrop-saturate-150",
          "transition-opacity duration-300 ease-in-out",
        )}
        inert={state.length === 0}
      >
        <Spinner size={12} />
      </div>
    </WaitContext>
  );
}
