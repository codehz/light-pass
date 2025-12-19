import { tw } from "bun-tailwindcss" with { type: "macro" };

export interface Variable {
  name: string;
  description: string;
}

export function VariableHint({ variables }: { variables: Variable[] }) {
  if (variables.length === 0) {
    return null;
  }

  return (
    <p className={tw("mt-2 text-xs text-gray-500")}>
      可用变量：
      <br />
      {variables.map((variable, index) => (
        <span key={variable.name}>
          <code>{variable.name}</code> - {variable.description}
          {index < variables.length - 1 && <br />}
        </span>
      ))}
    </p>
  );
}
