import { Suspense } from "react";

import { ContentLoading } from "@/components/shell/content-loading";
import { RouteContentGate } from "@/components/shell/route-content-gate";
import { InvoicesWorkspace } from "@/features/invoices/invoices-workspace";

export default function InvoicesPage() {
  return (
    <RouteContentGate>
      <Suspense fallback={<ContentLoading />}>
        <InvoicesWorkspace />
      </Suspense>
    </RouteContentGate>
  );
}
