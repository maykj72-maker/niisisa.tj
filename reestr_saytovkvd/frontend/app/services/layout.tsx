import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Услуги и заявки | Институт строительства и архитектуры",
  description: "Каталог услуг института и защищённая подача заявок на обслуживание.",
};

export default function ServicesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
