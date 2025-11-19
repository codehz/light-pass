import { FormFieldProxy } from "@codehz/form";
import { tw } from "bun-tailwindcss" with { type: "macro" };
import { ComponentPropsWithRef } from "react";
import { AutoSizeTextArea } from "./AutoSizeTextarea";

export function FormTextarea({
  proxy,
  ...rest
}: { proxy: FormFieldProxy<string> } & Omit<
  ComponentPropsWithRef<"textarea">,
  "value" | "onChange"
>) {
  const value = proxy.use();
  return (
    <AutoSizeTextArea
      {...rest}
      value={value}
      onChange={(e) => {
        proxy.value = e.target.value;
      }}
      className={tw(
        "border-subtitle-text focus:border-accent-text focus:ring-accent-text w-full rounded-md border px-3 py-2 shadow-sm transition duration-150 ease-in-out focus:outline-none focus:ring-2",
      )}
    />
  );
}
