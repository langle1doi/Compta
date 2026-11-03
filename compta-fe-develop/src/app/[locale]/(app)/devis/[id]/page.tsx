import { QuoteEditor } from "@/features/quotes/quote-editor";

export default async function QuoteEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <QuoteEditor id={id} />;
}
