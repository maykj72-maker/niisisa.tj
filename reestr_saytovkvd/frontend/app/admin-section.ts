export type AdminSection = "overview" | "applications" | "news" | "site-content";

const adminSections: AdminSection[] = ["overview", "applications", "news", "site-content"];

export function getAdminSectionSnapshot(): AdminSection {
  if (typeof window === "undefined") return "overview";
  const requested = new URLSearchParams(window.location.search).get("adminSection");
  return adminSections.includes(requested as AdminSection) ? requested as AdminSection : "overview";
}

export function subscribeToAdminSection(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener("admin-section-change", listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener("admin-section-change", listener);
  };
}

export function notifyAdminSectionChange() {
  window.dispatchEvent(new Event("admin-section-change"));
}
