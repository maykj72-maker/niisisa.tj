import type { Metadata } from "next";
import NewsPageContent from "./news-page-content";

export const metadata: Metadata = {
  title: "Ахбор | Пажӯҳишгоҳи илмӣ-тадқиқотӣ",
  description: "Хабарҳо ва эълонҳои Пажӯҳишгоҳи илмию тадқиқотии сохтмон ва меъморӣ.",
};

export default function NewsPage() {
  return <NewsPageContent />;
}
