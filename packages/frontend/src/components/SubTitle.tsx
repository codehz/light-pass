import { tw } from "bun-tailwindcss" with { type: "macro" };
import classNames from "classnames";
import { ReactNode } from "react";

export function SubTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={classNames(
        tw("text-subtitle-text flex items-center border-b-2 text-xl"),
        className,
      )}
    >
      {children}
    </div>
  );
}
