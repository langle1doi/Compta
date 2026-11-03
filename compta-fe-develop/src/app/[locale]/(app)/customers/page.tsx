import { RouteContentGate } from "@/components/shell/route-content-gate";
import { CustomersWorkspace } from "@/features/customers";

export default function CustomersPage() {
  return (
    <RouteContentGate>
      <CustomersWorkspace />
    </RouteContentGate>
  );
}
