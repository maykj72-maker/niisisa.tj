import Link from "next/link";
import { ArrowRight } from "lucide-react";

const links = [
  { href: "/", label: "Феҳристи сертификатҳо" },
  { href: "/services", label: "Хизматрасониҳо" },
  { href: "/documents", label: "Ҳуҷҷатҳо" },
  { href: "/news", label: "Ахбор" },
  { href: "/architecture", label: "Пажӯҳишгоҳ" },
];

export default function SiteFooter() {
  return (
    <footer className="unified-site-footer">
      <div className="unified-site-footer__inner">
        <p className="unified-site-footer__identity">
          <strong>Пажӯҳишгоҳи илмӣ-тадқиқотии «Сохтмон ва меъморӣ»</strong>
          <span>Ҷумҳурии Тоҷикистон</span>
        </p>
        <nav className="unified-site-footer__links" aria-label="Навигация в подвале">
          {links.map(({ href, label }) => (
            <Link href={href} key={href}>
              {label}
              {href === "/architecture" && <ArrowRight size={14} aria-hidden="true" />}
            </Link>
          ))}
        </nav>
        <span className="unified-site-footer__copyright">Маълумоти расмии пажӯҳишгоҳ · Ҷумҳурии Тоҷикистон</span>
      </div>
    </footer>
  );
}
