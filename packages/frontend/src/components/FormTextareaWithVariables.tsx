import { FormFieldProxy } from "@codehz/form";
import { tw } from "bun-tailwindcss" with { type: "macro" };
import classnames from "classnames";
import { ComponentPropsWithRef, useRef, useState } from "react";
import { AutoSizeTextArea } from "./AutoSizeTextarea";
import { HeightTransition } from "./HeightTransition";
import { AutoTransition } from "./AutoTransition";

export interface Variable {
  name: string;
  description: string;
}

export function FormTextareaWithVariables({
  proxy,
  variables,
  ...rest
}: {
  proxy: FormFieldProxy<string>;
  variables: Variable[];
} & Omit<ComponentPropsWithRef<"textarea">, "value" | "onChange">) {
  const value = proxy.use();
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (variableName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;

    // 如果有选中的文本，替换它；否则在光标位置插入
    const newValue =
      value.slice(0, start) + `{{${variableName}}}` + value.slice(end);
    proxy.value = newValue;

    // 重新聚焦并移动光标到插入的变量后面
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + variableName.length + 4; // 4 = {{ 和 }}
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  return (
    <div>
      <AutoSizeTextArea
        ref={textareaRef}
        {...rest}
        value={value}
        onChange={(e) => {
          proxy.value = e.target.value;
        }}
        className={tw(
          "w-full rounded-md border border-subtitle-text px-3 py-2 shadow-sm transition duration-150 ease-in-out focus:border-accent-text focus:ring-2 focus:ring-accent-text focus:outline-none",
        )}
      />

      {variables.length > 0 && (
        <div className={tw("text-gray-500 mt-2 text-xs")}>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={tw(
              "flex items-center gap-1 font-medium",
              "hover:text-gray-600 transition-colors duration-200",
              "cursor-pointer select-none",
            )}
            aria-expanded={expanded}
          >
            <span
              className={classnames(tw("transition-transform duration-300"), {
                [tw("rotate-90")]: expanded,
              })}
            >
              ▶
            </span>
            可用变量
          </button>
          <HeightTransition>
            <AutoTransition as="div">
              {expanded && (
                <div className={tw("space-y-1 pt-2")}>
                  {variables.map((variable) => (
                    <div
                      key={variable.name}
                      className={tw("flex items-start gap-2")}
                    >
                      <button
                        type="button"
                        onClick={() => insertVariable(variable.name)}
                        className={tw(
                          "shrink-0 cursor-pointer text-left font-mono text-accent-text transition-opacity duration-200 hover:opacity-80",
                        )}
                      >
                        {variable.name}
                      </button>
                      <span className={tw("flex-1")}>
                        - {variable.description}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </AutoTransition>
          </HeightTransition>
        </div>
      )}
    </div>
  );
}
