import { tw } from "bun-tailwindcss" with { type: "macro" };
import { ReactNode } from "react";

export function Fieldset({
  title,
  children,
  disabled,
}: {
  title: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <fieldset
      className={tw(
        "border-subtitle-text rounded-lg border p-4 shadow-md",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
      disabled={disabled}
    >
      <legend className={tw("text-subtitle-text px-2 text-sm font-medium")}>
        {title}
      </legend>
      <div className={tw("grid gap-4")}>{children}</div>
    </fieldset>
  );
}
