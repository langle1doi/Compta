import { InvoiceDraft } from "@/features/invoices/invoice-draft";

export default async function InvoiceDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InvoiceDraft id={id} />;
}
