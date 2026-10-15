import type { ReactNode } from "react";

export type IconName =
  | "arrow-down"
  | "arrow-left"
  | "arrow-right"
  | "arrow-up-right"
  | "check"
  | "close"
  | "copy"
  | "grip"
  | "plus"
  | "sparkle"
  | "chevron-up"
  | "chevron-down";

const iconShapes: Record<IconName, ReactNode> = {
  "arrow-down": <path d="M12 5v14m-7-7 7 7 7-7" />,
  "arrow-left": <path d="M19 12H5m7 7-7-7 7-7" />,
  "arrow-right": <path d="M5 12h14m-7-7 7 7-7 7" />,
  "arrow-up-right": <path d="M7 17 17 7M8 7h9v9" />,
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="1" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
  grip: (
    <g fill="currentColor" stroke="none">
      <circle cx="8" cy="5" r="1.5" />
      <circle cx="16" cy="5" r="1.5" />
      <circle cx="8" cy="12" r="1.5" />
      <circle cx="16" cy="12" r="1.5" />
      <circle cx="8" cy="19" r="1.5" />
      <circle cx="16" cy="19" r="1.5" />
    </g>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  sparkle: <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 12 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />,
  "chevron-up": <path d="m6 15 6-6 6 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
};

export function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      height="1em"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="1em"
    >
      {iconShapes[name]}
    </svg>
  );
}
