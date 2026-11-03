import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  strokeWidth?: number;
};

function KpiGlyph({ children, strokeWidth = 2, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      {...props}
    >
      {children}
    </svg>
  );
}

export function KpiDollarIcon(props: IconProps) {
  return (
    <KpiGlyph {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.15v9.7" />
      <path d="M9.2 9c.4-1.2 1.45-1.85 2.85-1.85 1.65 0 2.8.8 2.8 2.05 0 1.1-.75 1.75-2.7 2.2l-.9.2c-1.9.45-2.65 1.2-2.65 2.4 0 1.4 1.25 2.25 3 2.25 1.55 0 2.7-.7 3.1-1.95" />
    </KpiGlyph>
  );
}

export function KpiCardIcon(props: IconProps) {
  return (
    <KpiGlyph {...props}>
      <rect height="14" rx="3.2" width="18" x="3" y="5" />
      <path d="M3 9.4h18" />
      <path d="M6.4 14.35h5.4" />
      <rect height="2.2" rx="0.7" width="3.1" x="14.5" y="13.25" />
    </KpiGlyph>
  );
}

export function KpiClockIcon(props: IconProps) {
  return (
    <KpiGlyph {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 8.1v4.15l3.15 2.05" />
    </KpiGlyph>
  );
}

export function KpiFileCheckIcon(props: IconProps) {
  return (
    <KpiGlyph {...props}>
      <path d="M13.55 4.75H8.2c-1.15 0-2.1.95-2.1 2.1v10.3c0 1.15.95 2.1 2.1 2.1h4.05" />
      <path d="M13.55 4.75 17.9 9.1v2.2" />
      <path d="M13.55 4.75V9.1h4.35" />
      <path d="M8.55 11.15h4.2" />
      <path d="M8.55 13.55h3.35" />
      <path d="M8.55 15.95h2.35" />
      <circle cx="16.35" cy="16.2" r="3.35" />
      <path d="m14.95 16.25 1 1 2.15-2.3" />
    </KpiGlyph>
  );
}
