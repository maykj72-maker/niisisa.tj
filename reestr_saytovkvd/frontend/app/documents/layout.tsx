import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Документы и нормативы | Реестр сертификатов",
  description: "Нормативные документы, приказы, методические материалы и бланки для скачивания.",
};

export default function DocumentsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
