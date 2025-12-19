import { Slot } from "@radix-ui/react-slot";
import {
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type ElementType,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
} from "react";

/**
 * Props shared by all `HeightTransition` variants.
 *
 * @template T - Optional `ElementType` used for rendering the inner container (defaults to `Slot`).
 * @property {T} [as] - Element type to render the inner content as (forwarded to the inner container). If omitted, the Radix `Slot` is used.
 * @property {ReactNode} children - The content whose height changes are observed and animated.
 * @property {number} [initialHeight] - Optional initial height (in pixels) applied to the outer container while the first measurement occurs.
 * @property {React.ForwardedRef<HTMLDivElement>} [ref] - Optional ref forwarded to the outer `div` container
 * @property {string} [className] - Optional className for the outer `div`.
 * @property {number} [duration=250] - Animation duration in milliseconds used when a height change is detected.
 * @property {number} [delay=0] - Animation delay in milliseconds applied before starting the height animation.
 * @property {string} [easing='cubic-bezier(0.445, 0.05, 0.55, 0.95)'] - CSS easing function used for the height transition.
 * @property {boolean} [disconnected=false] - If true, height transition events from inner `HeightTransition` components will not propagate to this component.
 */
type HeightTransitionBaseProps<T extends ElementType | undefined> = {
  as?: T;
  children: ReactNode;
  initialHeight?: number;
  ref?: ForwardedRef<ComponentRef<"div">>;
  className?: string;
  duration?: number;
  delay?: number;
  easing?: string;
  disconnected?: boolean;
};

/**
 * Full props for the exported `HeightTransition` component.
 *
 * When `as` is provided as a specific `ElementType`, the props of that element
 * are also allowed on the resulting component (except those that collide with
 * the base props).
 */
type HeightTransitionProps<T extends ElementType | undefined> =
  T extends ElementType
    ? HeightTransitionBaseProps<T> &
        Omit<
          ComponentPropsWithoutRef<T>,
          keyof HeightTransitionBaseProps<T>
        > & {
          children?: ReactNode;
        }
    : HeightTransitionBaseProps<T> & {
        children: ReactElement;
      };

/**
 * HeightTransition animates its parent element's height when the content
 * (the inner container) changes size. It observes the inner container using
 * `ResizeObserver` and animates the parent's height using the Web Animations
 * API to provide a smoother transition between size changes.
 *
 * Notes:
 * - The component renders an outer `div` (the element that will be animated) and
 *   an inner content element (defaulting to `Slot`). Provide `as` to render
 *   the inner container as a different element type (e.g. `section`, `div`, `ul`).
 * - `initialHeight` can be used to avoid a layout jump on mount while the
 *   initial measurement happens.
 * - `duration`, `delay` and `easing` correspond to the Web Animations API
 *   options applied for height transitions. Easing should be a valid CSS easing
 *   string, e.g. `ease-in-out` or `cubic-bezier(...)`.
 *
 * @template T - Optional `ElementType` for the inner container.
 * @param props - Component props.
 *
 * @example
 * <HeightTransition className="overflow-hidden" duration={200}>
 *   <div>Content with dynamic height</div>
 * </HeightTransition>
 */
export function HeightTransition<T extends ElementType | undefined>({
  as,
  initialHeight,
  children,
  ref,
  className,
  duration = 250,
  delay = 0,
  easing = "cubic-bezier(0.445, 0.05, 0.55, 0.95)",
  disconnected,
  ...rest
}: HeightTransitionProps<T>) {
  const Component = as ?? Slot;
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const parent = container.current!.parentElement as HTMLDivElement;
    const initial = parent.offsetHeight;
    let animation = parent.animate(
      { height: [`${initial}px`, `${initial}px`] },
      { duration: 0, fill: "forwards" },
    );
    let innerAnimation = false;
    parent.addEventListener("heightTransitionStart", (e) => {
      if (disconnected) e.stopPropagation();
      if (e.target === parent) return;
      innerAnimation = true;
      if (animation.playState === "finished") animation.cancel();
    });
    parent.addEventListener("heightTransitionEnd", (e) => {
      if (disconnected) e.stopPropagation();
      if (e.target === parent) return;
      innerAnimation = false;
      animateHeight();
    });
    function animateHeight() {
      const current = parent.offsetHeight;
      const target =
        container.current!.offsetHeight + current - parent.clientHeight;
      animation.cancel();
      if (current === target) {
        animation = parent.animate(
          { height: [`${current}px`, `${current}px`] },
          { duration: 0, fill: "forwards" },
        );
        return;
      }
      parent.dispatchEvent(
        new CustomEvent("heightTransitionStart", { bubbles: true }),
      );
      animation = parent.animate(
        { height: [`${current}px`, `${target}px`] },
        {
          fill: "both",
          ...(current !== target && {
            duration,
            delay,
            easing,
          }),
        },
      );
      animation.addEventListener("finish", () => {
        parent.dispatchEvent(
          new CustomEvent("heightTransitionEnd", { bubbles: true }),
        );
      });
    }
    const observer = new ResizeObserver(() => {
      if (innerAnimation) return;
      animateHeight();
    });
    observer.observe(container.current!, { box: "content-box" });
    return () => {
      observer.disconnect();
    };
  }, [delay, duration, easing, disconnected]);
  return (
    <div className={className} ref={ref} style={{ height: initialHeight }}>
      <Component {...rest} ref={container}>
        {children}
      </Component>
    </div>
  );
}
