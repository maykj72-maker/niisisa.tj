import type { Metadata } from "next";
import ArchitectureContent from "./architecture-content";

export const metadata: Metadata = {
  title: "Меъморӣ ва сохтмон | Пажӯҳишгоҳи илмӣ-тадқиқотӣ",
  description:
    "Таърих, фаъолияти илмӣ, лоиҳаҳо, озмоишгоҳ ва хизматрасониҳои Корхонаи воҳиди давлатии «Пажӯҳишгоҳи илмию тадқиқотии «Сохтмон ва меъморӣ»».",
};

export default function ArchitecturePage() {
  return <ArchitectureContent />;
}
