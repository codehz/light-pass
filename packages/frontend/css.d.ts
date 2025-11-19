import "react";

interface MyCustomProperties {
  "--reveal-x"?: string;
  "--reveal-y"?: string;
}

declare module "react" {
  interface CSSProperties extends MyCustomProperties {}
}
