import { makeClass } from "bun-tailwindcss" with { type: "macro" };
import { memo } from "react";

export const Spinner = memo(function Spinner({ size = 8 }: { size?: number }) {
  return (
    <div
      className={makeClass(
        "Spinner",
        "text-hint block size-8 animate-spin rounded-full border-4 border-solid border-current border-e-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]",
      )}
      style={{ height: size * 4, width: size * 4 }}
    >
      <span
        className={makeClass(
          "Spinner-text",
          "absolute! -m-px! h-px! w-px! overflow-hidden! whitespace-nowrap! border-0! p-0! [clip:rect(0,0,0,0)]!",
        )}
      >
        Loading...
      </span>
    </div>
  );
});