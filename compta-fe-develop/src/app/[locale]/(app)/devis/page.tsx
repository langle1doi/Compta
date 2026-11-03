import { Suspense } from "react";

import { ContentLoading } from "@/components/shell/content-loading";
import { RouteContentGate } from "@/components/shell/route-content-gate";
import { QuotesWorkspace } from "@/features/quotes/quotes-workspace";

export default function QuotesPage() {
  return (
    <RouteContentGate>
      <Suspense fallback={<ContentLoading />}>
        <QuotesWorkspace />
      </Suspense>
    </RouteContentGate>
  );
}
