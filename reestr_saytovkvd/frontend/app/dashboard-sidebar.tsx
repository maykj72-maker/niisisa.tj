"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  BadgeCheck,
  BookOpenText,
  FileText,
  FolderKanban,
  Images,
  LayoutDashboard,
  Newspaper,
  Settings2,
  UsersRound,
} from "lucide-react";
import { useSyncExternalStore } from "react";
import { getAdminSectionSnapshot, notifyAdminSectionChange, subscribeToAdminSection, type AdminSection } from "./admin-section";

type DashboardRole = "admin" | "applicant";

function getHashSnapshot() {
  return typeof window === "undefined" ? "" : window.location.hash;
}

function subscribeToHash(listener: () => void) {
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  return () => {
    window.removeEventListener("hashchange", listener);
    window.removeEventListener("popstate", listener);
  };
}

const linksByRole = {
  admin: [
    { href: "/?adminSection=overview", label: "Панель асосӣ", icon: LayoutDashboard },
    { href: "/?adminSection=applications", label: "Заявки и реестр", icon: BadgeCheck },
    { href: "/?adminSection=news", label: "Новости", icon: Newspaper },
    { href: "/documents", label: "Документы", icon: FileText },
    { href: "/services", label: "Услуги", icon: FolderKanban },
    { href: "/architecture", label: "Команда", icon: UsersRound },
    { href: "/architecture#history-gallery", label: "Галерея", icon: Images },
    { href: "/?adminSection=site-content", label: "Идоракунии сомона", icon: Settings2 },
  ],
  applicant: [
    { href: "#dashboard-top", label: "Моя панель", icon: LayoutDashboard },
    { href: "#certificate-list", label: "Мои заявки", icon: BadgeCheck },
    { href: "#application-form", label: "Новая заявка", icon: FileText },
    { href: "/services", label: "Услуги", icon: FolderKanban },
    { href: "/documents", label: "Документы", icon: BookOpenText },
    { href: "/news", label: "Новости", icon: Newspaper },
  ],
} satisfies Record<DashboardRole, { href: string; label: string; icon: typeof LayoutDashboard }[]>;

export default function DashboardSidebar({ role }: { role: DashboardRole }) {
  const pathname = usePathname();
  const links = linksByRole[role];
  const adminSection = useSyncExternalStore(
    subscribeToAdminSection,
    getAdminSectionSnapshot,
    () => "overview" as AdminSection,
  );
  const hash = useSyncExternalStore(subscribeToHash, getHashSnapshot, () => "");

  return (
    <aside className="registry-dashboard-sidebar" aria-label="Навигация личного кабинета">
      <Link className="registry-dashboard-sidebar__brand" href="/" aria-label="К феҳристи сертификатҳо">
        <Image src="/company-logo.jpg" alt="" width={66} height={66} priority />
      </Link>
      <nav className="registry-dashboard-sidebar__nav">
        {links.map(({ href, label, icon: Icon }) => {
          const section = href.startsWith("/?adminSection=")
            ? href.split("=").at(-1) as AdminSection
            : null;
          const [targetPath, targetAnchor] = href.split("#");
          const isActive = section
            ? pathname === "/" && adminSection === section
            : href.startsWith("#")
              ? pathname === "/" && (hash === href || (!hash && href === "#dashboard-top"))
              : pathname === targetPath
                && (!targetAnchor || hash === `#${targetAnchor}`);

          return (
            section ? (
              <a
                aria-current={isActive ? "page" : undefined}
                className={`registry-dashboard-sidebar__link${isActive ? " is-active" : ""}`}
                href={href}
                key={href}
                onClick={() => notifyAdminSectionChange()}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </a>
            ) : (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`registry-dashboard-sidebar__link${isActive ? " is-active" : ""}`}
                href={href}
                key={href}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            )
          );
        })}
      </nav>
      <Link className="registry-dashboard-sidebar__public-link" href="/architecture">
        <ArrowUpRight size={16} aria-hidden="true" />
        <span>Публичный сайт</span>
      </Link>
    </aside>
  );
}
