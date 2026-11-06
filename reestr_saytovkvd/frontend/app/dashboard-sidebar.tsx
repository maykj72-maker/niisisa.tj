"use client";

import { useTr } from "./i18n";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  BadgeCheck,
  BookOpenText,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  Boxes,
  Package,
  Layers,
  Star,
  Info,
  Mail,
  ScrollText,
  Tag,
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
    { href: "/?adminSection=overview", label: "Панель управления", icon: LayoutDashboard },
    { href: "/?adminSection=applications", label: "Заявки и реестр", icon: BadgeCheck },
    { href: "/?adminSection=news", label: "Новости", icon: Newspaper },
    { href: "/documents", label: "Документы", icon: FileText },
    { href: "/services", label: "Услуги", icon: FolderKanban },
    { href: "/activities", label: "Наша деятельность", icon: UsersRound },
    { href: "/?adminSection=site-content", label: "Управление сайтом", icon: Settings2 },
    { href: "/admin/slides", label: "Слайды", icon: ImageIcon },
    { href: "/admin/home-blocks", label: "Блоки главной", icon: Layers },
    { href: "/admin/advantages", label: "Преимущества", icon: Star },
    { href: "/admin/products", label: "Наши продукты", icon: Package },
    { href: "/admin/goods", label: "Товары", icon: Boxes },
    { href: "/admin/goods-categories", label: "Категории товаров", icon: Tag },
    { href: "/admin/projects", label: "Проекты", icon: FolderKanban },
    { href: "/admin/project-categories", label: "Категории проектов", icon: Tag },
    { href: "/admin/pages", label: "Страницы", icon: FileText },
    { href: "/admin/about", label: "О предприятии", icon: Info },
    { href: "/admin/messages", label: "Сообщения", icon: Mail },
    { href: "/admin/logs", label: "Логи", icon: ScrollText },
    { href: "/admin/settings", label: "Настройки", icon: Settings2 },
  ],
  applicant: [
    { href: "#dashboard-top", label: "Моя панель", icon: LayoutDashboard },
    { href: "#certificate-list", label: "Мои заявки", icon: BadgeCheck },
    { href: "#application-form", label: "Новая заявка", icon: FileText },
    { href: "#document-requests", label: "Мои документы", icon: BookOpenText },
    { href: "/services", label: "Услуги", icon: FolderKanban },
    { href: "/documents", label: "Документы", icon: BookOpenText },
    { href: "/goods", label: "Товары", icon: Boxes },
    { href: "/news", label: "Новости", icon: Newspaper },
  ],
} satisfies Record<DashboardRole, { href: string; label: string; icon: typeof LayoutDashboard }[]>;

const labelTg: Record<string, string> = {
  "Заявки и реестр": "Дархостҳо ва феҳрист",
  "Новости": "Ахбор",
  "Документы": "Ҳуҷҷатҳо",
  "Услуги": "Хизматрасониҳо",
  "Наша деятельность": "Фаъолият",
  "Панель управления": "Панели асосӣ",
  "Управление сайтом": "Идоракунии сомона",
  "Моя панель": "Панели ман",
  "Мои заявки": "Дархостҳои ман",
  "Новая заявка": "Дархости нав",
  "Мои документы": "Ҳуҷҷатҳои ман",
  "Слайды": "Слайдҳо",
  "Блоки главной": "Блокҳои саҳифаи асосӣ",
  "Преимущества": "Бартариҳо",
  "Наши продукты": "Маҳсулоти мо",
  "Товары": "Молҳо",
  "Категории товаров": "Категорияҳои молҳо",
  "Проекты": "Лоиҳаҳо",
  "Категории проектов": "Категорияҳои лоиҳаҳо",
  "Страницы": "Саҳифаҳо",
  "О предприятии": "Дар бораи корхона",
  "Сообщения": "Паёмҳо",
  "Логи": "Журнал",
  "Настройки": "Танзимот",
};

export default function DashboardSidebar({ role }: { role: DashboardRole }) {
  const pathname = usePathname();
  const links = linksByRole[role];
  const tr = useTr();
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
                <span>{tr(label, labelTg[label] ?? label)}</span>
              </a>
            ) : (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`registry-dashboard-sidebar__link${isActive ? " is-active" : ""}`}
                href={href}
                key={href}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{tr(label, labelTg[label] ?? label)}</span>
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
