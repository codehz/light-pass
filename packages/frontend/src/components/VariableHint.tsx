import { useState } from "react";
import { tw } from "bun-tailwindcss" with { type: "macro" };
import classnames from "classnames";
import { HeightTransition } from "./HeightTransition";
import { AutoTransition } from "./AutoTransition";

export interface Variable {
  name: string;
  description: string;
}

export function VariableHint({ variables }: { variables: Variable[] }) {
  const [expanded, setExpanded] = useState(false);

  if (variables.length === 0) {
    return null;
  }

  return (
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
                  <code className={tw("shrink-0 font-mono")}>
                    {variable.name}
                  </code>
                  <span className={tw("flex-1")}>- {variable.description}</span>
                </div>
              ))}
            </div>
          )}
        </AutoTransition>
      </HeightTransition>
    </div>
  );
}
