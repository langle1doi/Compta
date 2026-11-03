import { Menu } from "lucide-react";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { format, parseISO } from "date-fns";

import {
  AssistantProvider,
  FloatingAssistant,
} from "@/components/assistant";
import { BrandLogo } from "@/components/brand-logo";
import {
  CommandSearchIconTrigger,
  CommandSearchTrigger,
} from "@/components/command/command-palette";
import { HeaderNotifications } from "@/components/shell/header-notifications";
import { HeaderCalendar } from "@/components/shell/header-calendar";
import { todayIso } from "@/lib/iso-date";
import {
  Sidebar,
  SidebarBody,
  SidebarChrome,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/shell/sidebar";
import {
  parseDesktopOpenCookie,
  SIDEBAR_DESKTOP_OPEN_KEY,
} from "@/components/shell/sidebar/sidebar-preference";
import { ShellTitle } from "@/components/shell/shell-title";
import { UserAccountMenu } from "@/components/shell/user-account-menu";

/** Persistent COMPTE chrome — sidebar stays mounted across route changes. */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  const calendarDate = todayIso();
  const today = t("header.today", { date: format(parseISO(calendarDate), "dd/MM/yyyy") });
  const cookieStore = await cookies();
  const defaultDesktopOpen = parseDesktopOpenCookie(
    cookieStore.get(SIDEBAR_DESKTOP_OPEN_KEY)?.value,
  );

  return (
    <SidebarProvider defaultDesktopOpen={defaultDesktopOpen}>
      <AssistantProvider>
        <div className="flex h-dvh w-full overflow-hidden bg-[#f3f4f6] text-[#063586]">
          <Sidebar>
            <SidebarBody
              aria-label={t("header.navigation")}
              closeLabel={t("header.closeMenu")}
            >
              <SidebarChrome
                navigationLabel={t("header.navigation")}
                searchLabel={t("header.search")}
              />
            </SidebarBody>
          </Sidebar>

          <div className="workspace-pane flex min-h-0 min-w-0 flex-1 flex-col">
            <img alt="" aria-hidden="true" className="workspace-pane__art" src="/workspace-bg.png" />
            <header className="dashboard-enter enter-0 relative z-30 flex min-h-[64px] shrink-0 items-center gap-2 border-b border-[#d1d5db]/70 bg-[rgb(243_244_246/0.8)] px-3 backdrop-blur-xl sm:min-h-[76px] sm:gap-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)_minmax(0,1fr)] lg:px-8">
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4 lg:flex-none lg:gap-3">
                <SidebarTrigger
                  className="action-motion soft-button grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-[#506078] lg:hidden"
                  label={t("header.openMenu")}
                >
                  <Menu aria-hidden="true" className="h-5 w-5" />
                </SidebarTrigger>
                <BrandLogo className="hidden h-8 w-auto shrink-0 md:block lg:hidden" />

                <div className="min-w-0 flex-1 lg:flex-none">
                  <p className="hidden text-xs font-medium text-[#7d8aa0] sm:block">{today}</p>
                  <h1 className="truncate text-[21px] font-semibold tracking-[-0.025em] text-[#063586] sm:text-[26px] lg:text-[28px] xl:text-[30px]">
                    <ShellTitle />
                  </h1>
                </div>
              </div>

              <div className="hidden min-w-0 justify-self-center lg:flex lg:w-full lg:max-w-[420px]">
                <CommandSearchTrigger label={t("header.search")} />
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 lg:ml-0 lg:justify-self-end">
                <CommandSearchIconTrigger
                  className="hidden min-[480px]:grid lg:hidden"
                  label={t("header.search")}
                />

                <HeaderCalendar initialDate={calendarDate} />

                <HeaderNotifications label={t("header.notifications")} />

                <UserAccountMenu />
              </div>
            </header>

            <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {children}
            </div>
          </div>

          <FloatingAssistant />
        </div>
      </AssistantProvider>
    </SidebarProvider>
  );
}
