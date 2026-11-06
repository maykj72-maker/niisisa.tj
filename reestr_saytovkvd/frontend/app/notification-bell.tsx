"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { API_BASE } from "./api-config";

const AUTH_KEY = "gov_registry_auth";

type NotificationItem = { id: string; message: string; read: boolean; created_at: string };

function hasAuth() {
  try {
    return Boolean(window.localStorage.getItem(AUTH_KEY));
  } catch {
    return false;
  }
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function NotificationBell() {
  const [signedIn, setSignedIn] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!hasAuth()) {
      setSignedIn(false);
      setItems([]);
      setUnread(0);
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/notifications`, { credentials: "include" });
      if (!response.ok) {
        setSignedIn(false);
        return;
      }
      const data = (await response.json()) as { unread: number; items: NotificationItem[] };
      setSignedIn(true);
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      /* network error: keep the previous state */
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(load, 0);
    const timer = window.setInterval(load, 20000);
    const onStorage = () => void load();
    window.addEventListener("storage", onStorage);
    window.addEventListener("gov-registry-auth", onStorage);
    window.addEventListener("focus", onStorage);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("gov-registry-auth", onStorage);
      window.removeEventListener("focus", onStorage);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!signedIn) return null;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      try {
        await fetch(`${API_BASE}/notifications/read`, { method: "POST", credentials: "include" });
        setUnread(0);
      } catch {
        /* ignore */
      }
    }
  };

  const Icon = unread > 0 ? BellRing : Bell;

  return (
    <div className="notification-bell" ref={rootRef}>
      <button
        type="button"
        className="notification-bell__button"
        aria-label={unread > 0 ? `Уведомления: ${unread} новых` : "Уведомления"}
        aria-expanded={open}
        onClick={toggle}
      >
        <Icon size={18} aria-hidden="true" />
        {unread > 0 && <span className="notification-bell__badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="notification-bell__panel" role="dialog" aria-label="Уведомления">
          <div className="notification-bell__title">Уведомления</div>
          {items.length === 0 ? (
            <div className="notification-bell__empty">Пока нет уведомлений</div>
          ) : (
            <ul className="notification-bell__list">
              {items.map((item) => (
                <li key={item.id} className={item.read ? "" : "is-unread"}>
                  <span>{item.message}</span>
                  <time>{formatTime(item.created_at)}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
