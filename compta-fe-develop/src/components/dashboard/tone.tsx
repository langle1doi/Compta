import type { ComponentType, CSSProperties, SVGProps } from "react";

import type { Tone } from "@/mocks/dashboard/types";

type TileIcon = ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number }>;

const toneClass: Record<Tone, string> = {
  blue: "bg-[#e7efff] text-[#044ce2]",
  green: "bg-[#e8f7f0] text-[#238567]",
  orange: "bg-[#fff4e6] text-[#b96d24]",
  red: "bg-[#fff0ed] text-[#c9564f]",
  purple: "bg-[#f2edff] text-[#7b61c8]",
  slate: "bg-[#eef2f7] text-[#66758d]",
};

const badgeSize = {
  md: "min-h-7 rounded-[7px] px-2.5 text-xs",
  sm: "h-5 rounded-[5px] px-2 text-[10px]",
  xs: "h-[18px] rounded-[4px] px-1.5 text-[9px]",
};

const tileSize = {
  md: "h-10 w-10 rounded-[11px] [&>svg]:h-[18px] [&>svg]:w-[18px]",
  sm: "h-7 w-7 rounded-[7px] [&>svg]:h-3.5 [&>svg]:w-3.5",
  xs: "h-[22px] w-[22px] rounded-[6px] [&>svg]:h-3 [&>svg]:w-3",
};

export function StatusBadge({
  tone,
  children,
  className = "",
  size = "md",
  style,
}: {
  tone: Tone;
  children: string;
  className?: string;
  size?: keyof typeof badgeSize;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`inline-flex max-w-full min-w-0 items-center overflow-hidden font-medium ${badgeSize[size]} ${toneClass[tone]} ${className}`}
      style={style}
      title={children}
    >
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

export function IconTile({
  tone,
  icon: Icon,
  className = "",
  size = "md",
  strokeWidth = 1.75,
}: {
  tone: Tone;
  icon: TileIcon;
  className?: string;
  size?: keyof typeof tileSize;
  strokeWidth?: number;
}) {
  return (
    <span className={`grid shrink-0 place-items-center ${tileSize[size]} ${toneClass[tone]} ${className}`}>
      <Icon aria-hidden="true" strokeWidth={strokeWidth} />
    </span>
  );
}
