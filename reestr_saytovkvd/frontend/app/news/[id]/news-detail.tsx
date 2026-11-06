"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import "../../architecture/architecture.css";
import { setSiteLanguage, useSiteLanguage } from "../../architecture/site-language";
import "../../architecture/modern-theme.css";
import { API_BASE } from "../../api-config";
import SiteNavigation from "../../site-navigation";
import SiteFooter from "../../site-footer";

type NewsMedia = {
  src: string;
  type: "image" | "video";
  caption?: string;
  caption_ru?: string;
  alt?: string;
};

type NewsItem = {
  id: string;
  title: string;
  category: string;
  content: string;
  title_ru?: string | null;
  category_ru?: string | null;
  content_ru?: string | null;
  images?: string[];
  media?: NewsMedia[];
  published_at: string;
  view_count: number;
};

const apiBase = API_BASE;

function formatDate(value: string, language: "tg" | "ru") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "tg-TJ", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function getReaderId() {
  const key = "institute-news-reader";
  try {
    const saved = window.localStorage.getItem(key);
    if (saved) return saved;
    const created = window.crypto.randomUUID();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return window.crypto.randomUUID();
  }
}

export default function NewsDetail({ id }: { id: string }) {
  const [news, setNews] = useState<NewsItem | null>(null);
  const [error, setError] = useState("");
  const [viewError, setViewError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const language = useSiteLanguage();

  useEffect(() => {
    let active = true;

    const loadNews = async () => {
      try {
        const response = await fetch(`${apiBase}/news/${encodeURIComponent(id)}`);
        if (!response.ok) {
          const message = await response.text();
          let detail = message;
          try {
            const parsed = JSON.parse(message) as { detail?: string };
            detail = parsed.detail || message;
          } catch {
            // Keep the original API response when it is not JSON.
          }
          throw new Error(detail || "Хабарро кушодан нашуд.");
        }

        const data = (await response.json()) as NewsItem;
        if (active) setNews(data);

        try {
          const viewResponse = await fetch(`${apiBase}/news/${encodeURIComponent(id)}/views`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ visitor_id: getReaderId() }),
          });
          if (!viewResponse.ok) {
            const message = await viewResponse.text();
            throw new Error(message || `Хонандаҳоро ҳисоб кардан нашуд (${viewResponse.status}).`);
          }
          const viewData = (await viewResponse.json()) as { view_count: number };
          if (active) setNews((current) => current ? { ...current, view_count: viewData.view_count } : current);
        } catch (viewUpdateError) {
          if (active) {
            setViewError(viewUpdateError instanceof Error ? viewUpdateError.message : "Ҳисоби хонандагон нав карда нашуд.");
          }
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Хабарро кушодан нашуд.");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadNews();
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <main className="architecture-site" lang={language}>
      <div className="portal-ribbon">
        <div className="portal-container portal-ribbon__inner">
          <span>{language === "ru" ? "Республика Таджикистан" : "Ҷумҳурии Тоҷикистон"}</span>
          <div className="portal-ribbon__actions">
            <Link href="/news">{language === "ru" ? "Назад к новостям" : "Бозгашт ба ахбор"}</Link>
            <div className="portal-language-switch" aria-label={language === "ru" ? "Язык сайта" : "Забони сомона"}>
              <button type="button" aria-pressed={language === "tg"} onClick={() => setSiteLanguage("tg")}>TJ</button>
              <button type="button" aria-pressed={language === "ru"} onClick={() => setSiteLanguage("ru")}>RU</button>
            </div>
          </div>
        </div>
      </div>

      <SiteNavigation />

      <section className="portal-container portal-news-detail">
        <Link className="portal-news-detail__back" href="/news">
          <ArrowLeft size={16} /> {language === "ru" ? "Все новости" : "Ба ҳамаи хабарҳо"}
        </Link>

        {isLoading ? (
          <p className="portal-news-detail__state"><LoaderCircle className="portal-news-spin" size={20} /> {language === "ru" ? "Загрузка новости..." : "Хабар бор шуда истодааст..."}</p>
        ) : error ? (
          <div className="portal-news-detail__state portal-news-detail__state--error" role="alert">
            <h1>{language === "ru" ? "Новость не найдена" : "Хабар ёфт нашуд"}</h1>
            <p>{error}</p>
          </div>
        ) : news ? (
          <article>
            <div className="portal-news-card__meta">
              <span>{language === "ru" ? news.category_ru || news.category : news.category}</span>
              <time dateTime={news.published_at}>{formatDate(news.published_at, language)}</time>
            </div>
            <h1 className="portal-news-detail__title">{language === "ru" ? news.title_ru || news.title : news.title}</h1>
            {(news.media?.length
              ? news.media
              : (news.images || []).map((src): NewsMedia => ({ src, type: "image" }))).map((media, index) => (
              <figure className="portal-news-detail__media" key={`${news.id}-${index}`}>
                {media.type === "video" ? (
                  <video className="portal-news-detail__video" src={media.src} controls playsInline preload="metadata" />
                ) : (
                  <Image
                    className="portal-news-detail__image"
                    src={media.src}
                    alt={media.alt || `${language === "ru" ? news.title_ru || news.title : news.title} — ${index + 1}`}
                    width={1200}
                    height={800}
                    unoptimized
                  />
                )}
                {(language === "ru" ? media.caption_ru || media.caption : media.caption) && (
                  <figcaption>{language === "ru" ? media.caption_ru || media.caption : media.caption}</figcaption>
                )}
              </figure>
            ))}
            <div className="portal-news-detail__content">{language === "ru" ? news.content_ru || news.content : news.content}</div>
            <p className="portal-news-detail__readers">
              <span>{language === "ru" ? "Читателей" : "Хонандагон"}:</span> {news.view_count ?? 0}
              {viewError && <small role="status">{language === "ru" ? "Счётчик временно недоступен." : "Ҳисобкунаки хонандагон муваққатан дастнорас аст."}</small>}
            </p>
            <p className="portal-news-detail__id">ID: {news.id}</p>
          </article>
        ) : null}
      </section>
      <SiteFooter />
    </main>
  );
}
