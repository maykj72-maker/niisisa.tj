"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { API_BASE } from "./api-config";
import { useTr } from "./i18n";

const links = [
  { href: "/", ru: "Реестр сертификатов", tg: "Феҳристи сертификатҳо" },
  { href: "/services", ru: "Услуги", tg: "Хизматрасониҳо" },
  { href: "/documents", ru: "Документы", tg: "Ҳуҷҷатҳо" },
  { href: "/news", ru: "Новости", tg: "Ахбор" },
  { href: "/activities", ru: "Наша деятельность", tg: "Фаъолият" },
  { href: "/architecture", ru: "Институт", tg: "Пажӯҳишгоҳ" },
  { href: "/goods", ru: "Товары", tg: "Молҳо" },
  { href: "/projects", ru: "Проекты", tg: "Лоиҳаҳо" },
  { href: "/contact", ru: "Обратная связь", tg: "Алоқа" },
];

export default function SiteFooter() {
  const tr = useTr();
  const [contacts, setContacts] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE}/site-settings`);
        if (response.ok) setContacts((await response.json()) as Record<string, string>);
      } catch {
        /* контакты необязательны */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const contactLines = [contacts.address, contacts.phone, contacts.email, contacts.working_hours].filter(Boolean);

  return (
    <footer className="unified-site-footer">
      <div className="unified-site-footer__inner">
        <p className="unified-site-footer__identity">
          <strong>{tr("НИИ «Строительство и архитектура»", "Пажӯҳишгоҳи илмӣ-тадқиқотии «Сохтмон ва меъморӣ»")}</strong>
          <span>{tr("Республика Таджикистан", "Ҷумҳурии Тоҷикистон")}</span>
          {contactLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
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
