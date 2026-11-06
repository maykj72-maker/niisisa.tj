import { Suspense } from "react";
import NewsDetail from "./news-detail";

async function NewsDetailPageContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NewsDetail id={id} />;
}

export default function NewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<main className="portal-news-detail__state">Хабар бор шуда истодааст...</main>}>
      <NewsDetailPageContent params={params} />
    </Suspense>
  );
}
