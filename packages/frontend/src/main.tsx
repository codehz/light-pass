import "./utils/polyfills";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  backButton,
  init,
  initData,
  miniApp,
  on,
  swipeBehavior,
  themeParams,
  User,
  viewport,
} from "@telegram-apps/sdk-react";
import { tw } from "bun-tailwindcss" with { type: "macro" };
import { ReactNode, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import { SafeAreaInset } from "telegram-mini-app";
import { SafeAreaPage } from "./components/SafeAreaPage";
import { StackNavigator } from "./components/StackNavigator";
import { ToastHost } from "./components/ToastHost";
import { Status } from "./pages/Status";
import { WaitHost } from "./components/WaitHost";

if (document.fonts) {
  await document.fonts.load("16px MiSans-VF");
}

const loader = document.getElementById("loader");
if (loader) {
  loader.animate({ opacity: [1, 0] }, { duration: 1000 }).finished.then(() => {
    loader.remove();
  });
}

const root = createRoot(document.body);
const queryClient = new QueryClient();

root.render(
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <App />
    </ErrorBoundary>
  </QueryClientProvider>,
);

function ErrorFallback(props: FallbackProps) {
  useEffect(() => console.error(props.error), []);
  return <ErrorDialog>出现错误：{`${props.error}`}</ErrorDialog>;
}

function App() {
  const [user] = useState(() => {
    init();
    miniApp.mountSync();
    const darkMode = miniApp.isSupported()
      ? miniApp.isDark()
      : window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    try {
      themeParams.mountSync();
      themeParams.bindCssVars();
    } catch {}
    if (swipeBehavior.isSupported()) {
      swipeBehavior.mount();
      swipeBehavior.disableVertical.ifAvailable();
    }
    viewport.mount().then(async () => {
      try {
        await viewport.requestFullscreen();
        try {
          const color = themeParams.accentTextColor();
          if (color) miniApp.setHeaderColor(color);
        } catch (e) {
          alert(e);
        }
        function update() {
          apply("tg-safe-area-inset", viewport.safeAreaInsets());
          apply("tg-content-safe-area-inset", viewport.contentSafeAreaInsets());
          function apply(prefix: string, insets: SafeAreaInset) {
            const keys = ["top", "left", "right", "bottom"] as const;
            for (const key of keys) {
              document.documentElement.style.setProperty(
                `--${prefix}-${key}`,
                `${insets[key]}px`,
              );
            }
          }
        }
        on("viewport_changed", update);
        update();
      } catch {
        viewport.expand();
      }
    });
    backButton.mount();
    initData.restore();
    return initData.user();
  });
  if (!user) return <ErrorDialog>该页面仅限Telegram Mini App访问</ErrorDialog>;
  return (
    <WaitHost>
      <ToastHost />
      <StackNavigator>
        <UserPage user={user} />
      </StackNavigator>
    </WaitHost>
  );
}

function UserPage({ user }: { user: User }) {
  const name = user.first_name + (user.last_name ? ` ${user.last_name}` : "");
  return (
    <SafeAreaPage title="Light Pass">
      <div className={tw("text-2xl font-bold")}>
        你好，<span className={tw("text-accent-text")}>{name}</span>
      </div>
      <Suspense>
        <Status />
      </Suspense>
    </SafeAreaPage>
  );
}

function ErrorDialog({ children }: { children: ReactNode }) {
  return (
    <SafeAreaPage title="错误">
      <div
        className={tw(
          "bg-danger-500 m-2 max-h-full w-fit place-self-center overflow-y-auto whitespace-pre-wrap rounded-2xl px-3 py-2 text-white",
        )}
      >
        {children}
      </div>
    </SafeAreaPage>
  );
}
