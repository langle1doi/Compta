import { Suspense } from "react";

import { ContentLoading } from "@/components/shell/content-loading";
import { RouteContentGate } from "@/components/shell/route-content-gate";
import { PaymentsWorkspace } from "@/features/payments/payments-workspace";

export default function PaymentsPage() {
  return (
    <RouteContentGate>
      <Suspense fallback={<ContentLoading />}>
        <PaymentsWorkspace />
      </Suspense>
    </RouteContentGate>
  );
}
