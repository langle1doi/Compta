import { Suspense } from "react";

import { ContentLoading } from "@/components/shell/content-loading";
import { RouteContentGate } from "@/components/shell/route-content-gate";
import { AutomationWorkspace } from "@/features/automation/automation-workspace";

export default function AutomationPage() {
  return (
    <RouteContentGate>
      <Suspense fallback={<ContentLoading />}>
        <AutomationWorkspace />
      </Suspense>
    </RouteContentGate>
  );
}
