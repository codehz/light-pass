import { Spinner } from "./Spinner";
import { tw } from "bun-tailwindcss" with { type: "macro" };
import {
  Component,
  createContext,
  Suspense,
  useContext,
  useEffect,
  useState,
  type AnimationEvent,
  type ReactNode,
} from "react";
import { useEventCallback } from "usehooks-ts";

const FallbackContext = createContext(false);

export class AnimatedSuspense extends Component<
  {
    children: ReactNode;
    fallback: ReactNode;
    isPending?: boolean;
  },
  { fallback: boolean }
> {
  state = { fallback: true };
  fallback = true;
  render() {
    return (
      <>
        <Suspense>
          {this.props.children}
          <DummySuccess instance={this} />
        </Suspense>
        <DelayMount instance={this} isPending={this.props.isPending}>
          {this.props.fallback}
        </DelayMount>
      </>
    );
  }
}

export namespace AnimatedSuspense {
  export function useFallbackState() {
    return useContext(FallbackContext);
  }

  export function DefaultLoading({ solid, zIndex }: { solid?: boolean | ReactNode; zIndex?: number }) {
    const [showSpinner, setShowSpinner] = useState(false);
    const fallback = useFallbackState();
    useEffect(() => {
      if (fallback) {
        const handle = requestAnimationFrame(() => setShowSpinner(true));
        return () => cancelAnimationFrame(handle);
      }
    }, [fallback]);
    const handleAnimationEnd = useEventCallback((event: AnimationEvent) => {
      if (event.animationName === "disappear") setShowSpinner(false);
    });
    if (!showSpinner) return null;
    return (
      <div
        inert={!fallback}
        className={tw("animate-appear inert:animate-disappear absolute inset-0 grid place-items-center")}
        onAnimationEnd={handleAnimationEnd}
        style={{ zIndex }}
      >
        {solid && typeof solid === "boolean" ? <div className={tw("bg-bg absolute inset-0")} /> : solid}
        <Spinner size={12} />
      </div>
    );
  }
}

class DelayMount extends Component<{
  instance: AnimatedSuspense;
  children: ReactNode;
  isPending?: boolean;
}> {
  render(): ReactNode {
    return (
      <FallbackContext.Provider value={this.props.instance.fallback || this.props.isPending || false}>
        {this.props.children}
      </FallbackContext.Provider>
    );
  }
}

class DummySuccess extends Component<{ instance: AnimatedSuspense }> {
  constructor(props: { instance: AnimatedSuspense }) {
    super(props);
    this.props.instance.fallback = false;
    this.props.instance.setState({ fallback: false });
  }
  render(): ReactNode {
    return null;
  }
}