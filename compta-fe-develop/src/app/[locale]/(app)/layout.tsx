import { CommandProvider } from "@/components/command/command-palette";
import { AppShell } from "@/components/shell/app-shell";
import { RouteGate } from "@/features/settings/route-gate";
import { SessionProvider } from "@/features/settings/session-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CommandProvider>
        <AppShell>
          <RouteGate>{children}</RouteGate>
        </AppShell>
      </CommandProvider>
    </SessionProvider>
  );
}
