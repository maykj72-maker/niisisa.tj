"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTr } from "./i18n";

const links = [
  { href: "/", ru: "Реестр сертификатов", tg: "Феҳристи сертификатҳо" },
  { href: "/services", ru: "Услуги", tg: "Хизматрасониҳо" },
  { href: "/documents", ru: "Документы", tg: "Ҳуҷҷатҳо" },
  { href: "/news", ru: "Новости", tg: "Ахбор" },
  { href: "/activities", ru: "Наша деятельность", tg: "Фаъолият" },
  { href: "/architecture", ru: "Институт", tg: "Пажӯҳишгоҳ" },
];

export default function SiteFooter() {
  const tr = useTr();
  return (
    <footer className="unified-site-footer">
      <div className="unified-site-footer__inner">
        <p className="unified-site-footer__identity">
          <strong>{tr("НИИ «Строительство и архитектура»", "Пажӯҳишгоҳи илмӣ-тадқиқотии «Сохтмон ва меъморӣ»")}</strong>
          <span>{tr("Республика Таджикистан", "Ҷумҳурии Тоҷикистон")}</span>
        </p>
        <nav className="unified-site-footer__links" aria-label={tr("Навигация в подвале", "Навигатсия дар поёни сомона")}>
          {links.map(({ href, ru, tg }) => (
            <Link href={href} key={href}>
              {tr(ru, tg)}
              {href === "/architecture" && <ArrowRight size={14} aria-hidden="true" />}
            </Link>
          ))}
        </nav>
        <span className="unified-site-footer__copyright">{tr("Официальная информация института · Республика Таджикистан", "Маълумоти расмии пажӯҳишгоҳ · Ҷумҳурии Тоҷикистон")}</span>
      </div>
    </footer>
  );
}
