import { tw } from "bun-tailwindcss" with { type: "macro" };
import { ReactNode } from "react";

export function SafeAreaPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className={tw(
        "bg-bg safearea h-screen grid-rows-[auto_minmax(0,1fr)]",
        "overflow-y-auto overflow-x-hidden overscroll-none",
      )}
    >
      <div
        className={tw(
          "inset-header bg-accent-text text-button-text sticky inset-x-0 top-0 rounded-b-3xl shadow-md",
        )}
      >
        <div className={tw("grid place-items-center py-2 text-lg font-bold")}>
          {title}
        </div>
      </div>
      <div className={tw("p-4")}>{children}</div>
    </div>
  );
}
