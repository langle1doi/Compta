import { CustomerDetailView } from "@/features/customers/components/customer-detail-view";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerDetailView customerId={id} />;
}
