import { Suspense } from "react";

import { ContentLoading } from "@/components/shell/content-loading";
import { RouteContentGate } from "@/components/shell/route-content-gate";
import { IntegrationsWorkspace } from "@/features/integrations/integrations-workspace";

export default function IntegrationsPage() {
  return (
    <RouteContentGate>
      <Suspense fallback={<ContentLoading />}>
        <IntegrationsWorkspace />
      </Suspense>
    </RouteContentGate>
  );
}
