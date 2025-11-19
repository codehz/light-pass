import { tw } from "bun-tailwindcss" with { type: "macro" };
import { ReactNode } from "react";

export function FormLabel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <label>
      <span className={tw("mb-1 block text-sm font-medium text-gray-700")}>
        {title}
      </span>
      {children}
    </label>
  );
}
