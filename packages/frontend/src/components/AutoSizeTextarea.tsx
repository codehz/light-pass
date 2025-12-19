import { makeClass } from "bun-tailwindcss" with { type: "macro" };
import classNames from "classnames";
import { ComponentPropsWithRef, memo, useEffect, useState } from "react";

const supports = globalThis.window?.CSS?.supports ?? (() => false);

const nativeSupportFormSizing =
  supports("form-sizing: normal") || supports("field-sizing: content");

export const AutoSizeTextArea = memo(function AutoSizeTextArea({
  className,
  style,
  value,
  defaultValue,
  "container:className": containerClassName,
  ref,
  ...props
}: ComponentPropsWithRef<"textarea"> & {
  "container:className"?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(!nativeSupportFormSizing);
  }, []);
  return (
    <div
      className={classNames(
        makeClass("auto-size-text-area", "grid *:col-start-1 *:row-start-1"),
        containerClassName,
      )}
    >
      {loaded && (
        <span
          inert
          className={classNames(
            makeClass(
              "auto-size-text-area-fake-text",
              "pointer-events-none invisible! whitespace-pre-wrap",
            ),
            className,
          )}
        >
          {value ?? defaultValue}
          {typeof value === "string" && value.endsWith("\n") && <br />}
        </span>
      )}
      <textarea
        {...props}
        ref={ref}
        className={className}
        value={value}
        defaultValue={defaultValue}
      />
    </div>
  );
});
