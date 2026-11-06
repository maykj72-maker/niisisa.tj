"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, BookOpenText, Building2, ClipboardList, Landmark, Newspaper, Package } from "lucide-react";
import type { ReactNode } from "react";
import CompanyIdentity from "./company-identity";
import NotificationBell from "./notification-bell";
import ThemeToggle from "./theme-toggle";
import LanguageToggle from "./language-toggle";
import { useTr } from "./i18n";

const links = [
  { href: "/", ru: "Реестр сертификатов", tg: "Феҳристи сертификатҳо", icon: ClipboardList },
  { href: "/services", ru: "Услуги", tg: "Хизматрасониҳо", icon: Building2 },
  { href: "/documents", ru: "Документы", tg: "Ҳуҷҷатҳо", icon: BookOpenText },
  { href: "/goods", ru: "Товары", tg: "Молҳо", icon: Package },
  { href: "/news", ru: "Новости", tg: "Ахбор", icon: Newspaper },
  { href: "/activities", ru: "Наша деятельность", tg: "Фаъолият", icon: Building2 },
  { href: "/architecture", ru: "Институт", tg: "Пажӯҳишгоҳ", icon: Landmark },
];

export default function SiteNavigation({ rightContent }: { rightContent?: ReactNode }) {
  const pathname = usePathname();
  const tr = useTr();

  return (
    <header className={`unified-site-header${rightContent ? " unified-site-header--with-actions" : ""}`}>
      <div className="unified-site-header__inner">
        <Link className="unified-site-header__brand" href="/" aria-label={tr("К реестру сертификатов", "Ба феҳристи сертификатҳо")}>
          <CompanyIdentity className="unified-site-header__identity" />
        </Link>
        <nav className="unified-site-nav" aria-label={tr("Навигация по сайту", "Навигатсия дар сомона")}>
          {links.map(({ href, ru, tg, icon: Icon }) => (
            <Link
              key={href}
              className="unified-site-nav__link"
              href={href}
              aria-current={pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)) ? "page" : undefined}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{tr(ru, tg)}</span>
              {href === "/architecture" && <ArrowUpRight className="unified-site-nav__external" size={13} aria-hidden="true" />}
            </Link>
          ))}
        </nav>
        <div className="unified-site-header__actions">
          <NotificationBell />
          <LanguageToggle />
          <ThemeToggle />
          {rightContent}
        </div>
      </div>
    </header>
  );
}
