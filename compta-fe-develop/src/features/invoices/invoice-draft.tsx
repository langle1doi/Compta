"use client";

import { useEffect } from "react";

import { ContentLoading } from "@/components/shell/content-loading";
import { useRouter } from "@/i18n/navigation";

export function InvoiceDraft({ id }: { id: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/factures?invoice=${id}`);
  }, [id, router]);

  return <ContentLoading />;
}
