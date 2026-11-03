"use client";

import type { ReactNode } from "react";

import { SettingsNavigation } from "./settings-navigation";

export function SettingsShell({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="dashboard-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="dashboard-page flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
        {title ? (
          <header className="dashboard-enter enter-0 shrink-0 min-w-0">
            <h2 className="truncate text-[22px] font-semibold tracking-[-0.025em] text-[#063586] sm:text-[24px]">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 max-w-[68ch] text-sm leading-6 text-[#66758d]">{description}</p>
            ) : null}
          </header>
        ) : null}

        <div className="grid min-h-0 min-w-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)]">
          {/* Nav column is outside the content scroller so it never jumps under the topbar. */}
          <aside className="app-scroll hidden min-h-0 min-w-0 self-stretch overflow-x-hidden overflow-y-auto lg:block">
            <SettingsNavigation />
          </aside>

          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            <div className="shrink-0 lg:hidden">
              <SettingsNavigation />
            </div>
            <div className="settings-shell__content app-scroll mt-3 flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto lg:mt-0">
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
