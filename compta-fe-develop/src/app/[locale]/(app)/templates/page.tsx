import { Suspense } from "react";

import { ContentLoading } from "@/components/shell/content-loading";
import { RouteContentGate } from "@/components/shell/route-content-gate";
import { TemplatesWorkspace } from "@/features/templates/templates-workspace";

export default function TemplatesPage() {
  return (
    <RouteContentGate>
      <Suspense fallback={<ContentLoading />}>
        <TemplatesWorkspace />
      </Suspense>
    </RouteContentGate>
  );
}
