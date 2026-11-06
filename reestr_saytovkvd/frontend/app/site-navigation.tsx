"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, BookOpenText, Building2, ClipboardList, Landmark, Newspaper } from "lucide-react";
import type { ReactNode } from "react";
import CompanyIdentity from "./company-identity";
import NotificationBell from "./notification-bell";
import ThemeToggle from "./theme-toggle";

const links = [
  { href: "/", label: "Феҳристи сертификатҳо", icon: ClipboardList },
  { href: "/services", label: "Хизматрасониҳо", icon: Building2 },
  { href: "/documents", label: "Ҳуҷҷатҳо", icon: BookOpenText },
  { href: "/news", label: "Ахбор", icon: Newspaper },
  { href: "/architecture", label: "Пажӯҳишгоҳ", icon: Landmark },
];

export default function SiteNavigation({ rightContent }: { rightContent?: ReactNode }) {
  const pathname = usePathname();

  return (
    <header className={`unified-site-header${rightContent ? " unified-site-header--with-actions" : ""}`}>
      <div className="unified-site-header__inner">
        <Link className="unified-site-header__brand" href="/" aria-label="Ба феҳристи сертификатҳо">
          <CompanyIdentity className="unified-site-header__identity" />
        </Link>
        <nav className="unified-site-nav" aria-label="Навигация по сайту">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              className="unified-site-nav__link"
              href={href}
              aria-current={pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)) ? "page" : undefined}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{label}</span>
              {href === "/architecture" && <ArrowUpRight className="unified-site-nav__external" size={13} aria-hidden="true" />}
            </Link>
          ))}
        </nav>
        <div className="unified-site-header__actions">
          <NotificationBell />
          <ThemeToggle />
          {rightContent}
        </div>
      </div>
    </header>
  );
}
