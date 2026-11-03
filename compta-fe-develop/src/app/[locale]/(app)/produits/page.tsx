import { Suspense } from "react";

import { ContentLoading } from "@/components/shell/content-loading";
import { RouteContentGate } from "@/components/shell/route-content-gate";
import { ProductsWorkspace } from "@/features/products";

export default function ProductsPage() {
  return (
    <RouteContentGate>
      <Suspense fallback={<ContentLoading />}>
        <ProductsWorkspace />
      </Suspense>
    </RouteContentGate>
  );
}
