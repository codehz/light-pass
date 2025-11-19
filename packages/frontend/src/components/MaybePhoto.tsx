import { tw } from "bun-tailwindcss" with { type: "macro" };
import classNames from "classnames";

export function MaybePhoto({
  className,
  photo,
}: {
  className: string;
  photo?: string;
}) {
  return photo ? (
    <img src={`/file/${photo}`} className={className} />
  ) : (
    <div
      className={classNames(tw("bg-secondary-bg inline-block"), className)}
    />
  );
}
