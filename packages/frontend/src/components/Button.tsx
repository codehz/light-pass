import { RemixiconComponentType } from "@remixicon/react";
import { tw } from "bun-tailwindcss" with { type: "macro" };
import classNames from "classnames";
import { ComponentRef, MouseEvent, ReactNode } from "react";

export function Button({
  children,
  className,
  Icon,
  onClick,
  variant,
  color = "accent",
  type = "button",
  disabled,
}: {
  children: ReactNode;
  className?: string;
  Icon?: RemixiconComponentType;
  onClick?: (e: MouseEvent<ComponentRef<"button">>) => void;
  variant: "solid" | "plain";
  color?: "accent" | "destructive";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        tw("flex items-center justify-center rounded-full"),
        tw("px-[0.5em] py-[0.2em]"),
        tw("disabled:pointer-events-none disabled:opacity-50"),
        variant === "plain" && [
          tw("drop-shadow-sm"),
          color === "accent" && tw("text-accent-text"),
          color === "destructive" && tw("text-destructive-text"),
        ],
        variant === "solid" && [
          tw("text-button-text shadow-sm"),
          color === "accent" && tw("bg-accent-text"),
          color === "destructive" && tw("bg-destructive-text"),
        ],
        className,
      )}
      type={type}
      disabled={disabled}
    >
      {Icon && <Icon size="1.5em" className={tw("mr-[0.2em]")} />}
      {children}
    </button>
  );
}
