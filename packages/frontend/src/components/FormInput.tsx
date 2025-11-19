import { FormFieldProxy } from "@codehz/form";
import { tw } from "bun-tailwindcss" with { type: "macro" };
import { ComponentPropsWithRef, useState } from "react";
import { useValueChangeEffect } from "../hooks/useValueChangeEffect";

export function FormInput({
  proxy,
  ...rest
}: { proxy: FormFieldProxy<string> } & Omit<
  ComponentPropsWithRef<"input">,
  "value" | "onChange"
>) {
  const value = proxy.use();
  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => {
        proxy.value = e.target.value;
      }}
      className={INPUT}
    />
  );
}

export namespace FormInput {
  export function number({
    proxy,
    defaultValue,
    ...rest
  }: { proxy: FormFieldProxy<number> } & Omit<
    ComponentPropsWithRef<"input">,
    "value" | "onChange"
  >) {
    const value = proxy.use();
    const [text, setText] = useState(
      () =>
        (Number.isFinite(value)
          ? value
          : Number.isFinite(defaultValue)
            ? defaultValue
            : "") + "",
    );
    useValueChangeEffect(value, (value: any) => {
      const parsed = parseFloat(text.toString());
      if (parsed !== value)
        setText(
          (Number.isFinite(value)
            ? value
            : Number.isFinite(defaultValue)
              ? defaultValue
              : "") + "",
        );
    });
    return (
      <input
        {...rest}
        inputMode="numeric"
        className={INPUT}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const trimed = e.target.value.trim();
          if (trimed.length) {
            const parsed = parseFloat(trimed);
            if (Number.isFinite(parsed)) proxy.value = parsed;
          }
        }}
      />
    );
  }
}

const INPUT = tw(
  "border-subtitle-text focus:border-accent-text focus:ring-accent-text w-full rounded-md border px-3 py-2 shadow-sm transition duration-150 ease-in-out focus:outline-none focus:ring-2",
);
