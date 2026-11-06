"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Eye, FileText, Globe2, ImagePlus, Link2, LoaderCircle, Plus, Send, Trash2, X } from "lucide-react";
import { useSiteLanguage } from "./site-language";
import { isAllowedMediaUrl, uploadMediaFile } from "../media-upload";
import { API_BASE } from "../api-config";

type NewsMedia = {
  src: string;
  type: "image" | "video";
  caption: string;
  caption_ru: string;
  alt: string;
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

type StoredAuth = {
  token?: string;
  user?: { role?: string };
};

type NewsFormState = {
  id: string | null;
  title: string;
  category: string;
  content: string;
  titleRu: string;
  categoryRu: string;
  contentRu: string;
  media: NewsMedia[];
};

const apiBase = API_BASE;
const emptyForm: NewsFormState = { id: null, title: "", category: "Ахбор", content: "", titleRu: "", categoryRu: "Новости", contentRu: "", media: [] };

function getNewsMedia(item: NewsItem): NewsMedia[] {
  if (item.media?.length) return item.media;
  return (item.images || []).map((src) => ({ src, type: "image", caption: "", caption_ru: "", alt: "" }));
}

function formatDate(value: string, language: "tg" | "ru") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "tg-TJ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function readAuth(): StoredAuth | null {
  try {
    const raw = window.localStorage.getItem("gov_registry_auth");
    if (!raw) return null;
    const stored = JSON.parse(raw) as { token?: string; user?: StoredAuth["user"] };
    const auth = stored.user ? { user: stored.user } : null;
    if (stored.token && auth) window.localStorage.setItem("gov_registry_auth", JSON.stringify(auth));
    return auth;
  } catch {
    return null;
  }
}

export default function NewsFeed({ limit, language }: { limit?: number; language?: "tg" | "ru" }) {
  const siteLanguage = useSiteLanguage();
  const activeLanguage = language ?? siteLanguage;
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaSource, setMediaSource] = useState<"device" | "web">("device");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaUrlType, setMediaUrlType] = useState<"image" | "video">("image");
  const [expandedNews, setExpandedNews] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<NewsFormState>(emptyForm);

  const loadNews = useCallback(async () => {
    const response = await fetch(`${apiBase}/news`, { credentials: "include" });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Ахбор бор нашуд (${response.status}).`);
    }

    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("Маълумоти ахбор шакли нодуруст дорад.");
    setNews(data as NewsItem[]);
  }, []);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        await loadNews();
      } catch (requestError) {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : "Ахборро бор кардан нашуд.");
        }
      } finally {
        if (active) {
          setIsAdmin(readAuth()?.user?.role === "admin");
          setIsLoading(false);
        }
      }
    };

    void initialize();
    return () => {
      active = false;
    };
  }, [loadNews]);

  const handleMediaChange = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    try {
      const selectedFiles = Array.from(files);
      if (form.media.length + selectedFiles.length > 5) {
        throw new Error("Як хабар метавонад то 5 акс ё видео дошта бошад.");
      }
      if (readAuth()?.user?.role !== "admin") throw new Error("Барои бор кардани медиа ҳамчун администратор ворид шавед.");

      setUploadingMedia(true);
      setError("");
      const uploadedMedia: NewsMedia[] = [];
      for (const file of selectedFiles) {
        const uploaded = await uploadMediaFile(file);
        uploadedMedia.push({ ...uploaded, caption: "", caption_ru: "", alt: "" });
      }
      setForm((current) => ({ ...current, media: [...current.media, ...uploadedMedia] }));
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "Расмро бор кардан нашуд.");
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleAddMediaUrl = () => {
    const source = mediaUrl.trim();
    if (form.media.length >= 5) {
      setError(activeLanguage === "ru" ? "В одной новости можно добавить не более 5 файлов." : "Ба як хабар то 5 акс ё видео илова кардан мумкин аст.");
      return;
    }
    if (!isAllowedMediaUrl(source) || source.startsWith("/")) {
      setError(activeLanguage === "ru"
        ? "Введите полный адрес медиа, начинающийся с http:// или https://."
        : "Суроғаи пурраи медиа бо http:// ё https:// ворид кунед.");
      return;
    }
    setError("");
    setForm((current) => ({
      ...current,
      media: [...current.media, { src: source, type: mediaUrlType, caption: "", caption_ru: "", alt: "" }],
    }));
    setMediaUrl("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readAuth()?.user?.role !== "admin") {
      setError("Сессияи администратор ёфт нашуд. Ба реестр ворид шавед ва саҳифаро нав кунед.");
      return;
    }

    setError("");
    setNotice("");
    setIsSubmitting(true);

    try {
      const isEditing = Boolean(form.id);
      const response = await fetch(`${apiBase}/news${form.id ? `/${encodeURIComponent(form.id)}` : ""}`, {
        method: isEditing ? "PUT" : "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          content: form.content,
          title_ru: form.titleRu.trim() || null,
          category_ru: form.categoryRu.trim() || null,
          content_ru: form.contentRu.trim() || null,
          images: form.media.filter((item) => item.type === "image").map((item) => item.src),
          media: form.media,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        let detail = message;
        try {
          const parsed = JSON.parse(message) as { detail?: string };
          detail = parsed.detail || message;
        } catch {
          // Keep the original API response when it is not JSON.
        }
        throw new Error(detail || `${isEditing ? "Тағйири хабар" : "Нашри хабар"} муваффақ нашуд (${response.status}).`);
      }

      await loadNews();
      setForm(emptyForm);
      setNotice(isEditing ? "Маълумот нав карда шуд." : "Маълумот нашр шуд ва дар сомона намоён аст.");
      setShowForm(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Хабарро нашр кардан нашуд.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (item: NewsItem) => {
    setForm({
      id: item.id,
      title: item.title,
      category: item.category,
      content: item.content,
      titleRu: item.title_ru ?? "",
      categoryRu: item.category_ru ?? "",
      contentRu: item.content_ru ?? "",
      media: getNewsMedia(item),
    });
    setError("");
    setNotice("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (item: NewsItem) => {
    if (!window.confirm(`Нест кардани хабари «${item.title}»? Ин амалро бекор кардан мумкин нест.`)) return;
    if (readAuth()?.user?.role !== "admin") {
      setError("Сессияи администратор ёфт нашуд. Ба реестр ворид шавед ва саҳифаро нав кунед.");
      return;
    }

    setError("");
    setNotice("");
    try {
      const response = await fetch(`${apiBase}/news/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const message = await response.text();
        let detail = message;
        try {
          const parsed = JSON.parse(message) as { detail?: string };
          detail = parsed.detail || message;
        } catch {
          // Keep the original API response when it is not JSON.
        }
        throw new Error(detail || `Нест кардани хабар муваффақ нашуд (${response.status}).`);
      }

      await loadNews();
      if (form.id === item.id) {
        setForm(emptyForm);
        setShowForm(false);
      }
      setNotice("Хабар нест карда шуд.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Хабарро нест кардан нашуд.");
    }
  };

  return (
    <div className="portal-news-feed">
      <div className="portal-news-feed__heading">
        <div>
          <span className="portal-news-feed__count">
            {news.length.toString().padStart(2, "0")} {activeLanguage === "ru"
              ? news.length === 1 ? "новость" : "новостей"
              : "хабар"}
          </span>
          <h3>{activeLanguage === "ru" ? "Последние новости" : "Хабарҳои тоза"}</h3>
        </div>
        {isAdmin && (
          <button
            className="portal-news-feed__add"
            type="button"
            onClick={() => setShowForm((value) => !value)}
            aria-expanded={showForm}
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? activeLanguage === "ru" ? "Закрыть" : "Пӯшидан" : activeLanguage === "ru" ? "Добавить новость" : "Иловаи маълумот"}
          </button>
        )}
      </div>

      {error && <p className="portal-news-message portal-news-message--error" role="alert">{error}</p>}
      {notice && <p className="portal-news-message portal-news-message--success" role="status">{notice}</p>}

      {showForm && isAdmin && (
        <form className="portal-news-form" onSubmit={handleSubmit}>
          <div className="portal-news-form__title">
            <span className="portal-news-form__title-icon"><FileText size={18} /></span>
            <div>
              <h4>{form.id ? activeLanguage === "ru" ? "Редактирование новости" : "Таҳрири маълумот" : activeLanguage === "ru" ? "Новая новость" : "Иловаи маълумот ё хабари нав"}</h4>
              <p>{activeLanguage === "ru" ? "Заполните публикацию и выберите источник медиа." : "Маълумоти хабарро пур карда, манбаи акс ё видеоро интихоб кунед."}</p>
            </div>
          </div>
          <p className="portal-news-form__hint">
            {activeLanguage === "ru"
              ? "Добавьте тексты на таджикском и русском языках. После публикации новость будет доступна на сайте."
                : "Унвон ва матни хабарро ба тоҷикӣ ва русӣ ворид кунед. Акс ё видео бо тавсифи зери он илова кунед; видеои MP4/WebM метавонад садо дошта бошад."}
          </p>
          <label>
            {activeLanguage === "ru" ? "Заголовок (тоҷикӣ)" : "Унвон (тоҷикӣ)"}
            <input required minLength={3} maxLength={200} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label>
            {activeLanguage === "ru" ? "Категория (тоҷикӣ)" : "Категория (тоҷикӣ)"}
            <input maxLength={80} value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
          </label>
          <label>
            {activeLanguage === "ru" ? "Текст новости (тоҷикӣ)" : "Матни хабар (тоҷикӣ)"}
            <textarea required minLength={10} rows={4} value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} />
          </label>
          <label>
            Заголовок (русский)
            <input maxLength={200} value={form.titleRu} onChange={(event) => setForm((current) => ({ ...current, titleRu: event.target.value }))} />
          </label>
          <label>
            Категория (русский)
            <input maxLength={80} value={form.categoryRu} onChange={(event) => setForm((current) => ({ ...current, categoryRu: event.target.value }))} />
          </label>
          <label>
            Текст новости (русский)
            <textarea rows={4} value={form.contentRu} onChange={(event) => setForm((current) => ({ ...current, contentRu: event.target.value }))} />
          </label>
          <section className="portal-news-media-source">
            <div className="portal-news-media-source__heading">
              <div>
                <strong>{activeLanguage === "ru" ? "Фото и видео" : "Акс ва видео"}</strong>
                <span>{activeLanguage === "ru" ? `${form.media.length}/5 файлов` : `${form.media.length}/5 файл`}</span>
              </div>
              <p>{activeLanguage === "ru" ? "Добавьте медиа по ссылке или загрузите с устройства." : "Медиаро бо истинод ё аз дастгоҳи худ илова кунед."}</p>
            </div>
            <div className="portal-news-media-source__tabs" role="group" aria-label={activeLanguage === "ru" ? "Источник медиа" : "Манбаи медиа"}>
              <button type="button" className={mediaSource === "device" ? "is-active" : ""} onClick={() => setMediaSource("device")}>
                <ImagePlus size={16} /> {activeLanguage === "ru" ? "С устройства" : "Аз дастгоҳ"}
              </button>
              <button type="button" className={mediaSource === "web" ? "is-active" : ""} onClick={() => setMediaSource("web")}>
                <Globe2 size={16} /> {activeLanguage === "ru" ? "Из интернета" : "Аз интернет"}
              </button>
            </div>
            {mediaSource === "device" ? (
              <label className="portal-news-form__upload">
                <ImagePlus size={18} />
                <span>
                  <strong>{activeLanguage === "ru" ? "Выбрать файлы на устройстве" : "Интихоби файл аз дастгоҳ"}</strong>
                  <small>{activeLanguage === "ru" ? "Фото до 5 МБ · видео MP4/WebM до 100 МБ" : "Акс то 5 МБ · видео MP4/WebM то 100 МБ"}</small>
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                  multiple
                  disabled={uploadingMedia || form.media.length >= 5}
                  onChange={(event) => {
                    void handleMediaChange(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            ) : (
              <div className="portal-news-media-source__url">
                <div className="portal-news-media-source__url-fields">
                  <label>
                    <span>{activeLanguage === "ru" ? "Тип медиа" : "Навъи медиа"}</span>
                    <select value={mediaUrlType} onChange={(event) => setMediaUrlType(event.target.value as "image" | "video")}>
                      <option value="image">{activeLanguage === "ru" ? "Фото" : "Акс"}</option>
                      <option value="video">{activeLanguage === "ru" ? "Видео со звуком" : "Видео бо садо"}</option>
                    </select>
                  </label>
                  <label className="portal-news-media-source__url-address">
                    <span>{activeLanguage === "ru" ? "Прямая ссылка" : "Суроғаи мустақим"}</span>
                    <input
                      type="url"
                      placeholder="https://example.com/photo.jpg"
                      value={mediaUrl}
                      disabled={form.media.length >= 5}
                      onChange={(event) => setMediaUrl(event.target.value)}
                    />
                  </label>
                  <button type="button" onClick={handleAddMediaUrl} disabled={form.media.length >= 5}>
                    <Link2 size={16} /> {activeLanguage === "ru" ? "Добавить ссылку" : "Иловаи истинод"}
                  </button>
                </div>
                <small>{activeLanguage === "ru" ? "Ссылка должна быть прямой и начинаться с http:// или https://." : "Истинод бояд мустақим буда, бо http:// ё https:// оғоз шавад."}</small>
              </div>
            )}
          </section>
          {uploadingMedia && <span className="portal-news-form__image-count">{activeLanguage === "ru" ? "Загрузка файла..." : "Файл бор шуда истодааст..."}</span>}
          {form.media.map((media, index) => (
            <div className="portal-news-form__media-item" key={`${media.src}-${index}`}>
              {media.type === "video" ? (
                <video src={media.src} controls playsInline preload="metadata" />
              ) : (
                <Image src={media.src} alt={media.alt || ""} width={220} height={130} unoptimized />
              )}
              <input
                aria-label={activeLanguage === "ru" ? "Подпись к фото или видео" : "Сарлавҳаи акс ё видео"}
                placeholder={activeLanguage === "ru" ? "Подпись к медиа (таджикский)" : "Маълумот дар зери акс/видео (тоҷикӣ)"}
                value={media.caption}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  media: current.media.map((item, mediaIndex) => mediaIndex === index ? { ...item, caption: event.target.value } : item),
                }))}
              />
              <input
                aria-label={activeLanguage === "ru" ? "Подпись к фото или видео на русском" : "Сарлавҳаи русии акс ё видео"}
                placeholder="Описание медиа (русский)"
                value={media.caption_ru}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  media: current.media.map((item, mediaIndex) => mediaIndex === index ? { ...item, caption_ru: event.target.value } : item),
                }))}
              />
              <button
                className="portal-news-form__remove-media"
                type="button"
                aria-label={activeLanguage === "ru" ? "Удалить медиа" : "Нест кардани медиа"}
                onClick={() => setForm((current) => ({ ...current, media: current.media.filter((_, mediaIndex) => mediaIndex !== index) }))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button className="portal-news-form__submit" type="submit" disabled={isSubmitting || uploadingMedia}>
            {isSubmitting || uploadingMedia ? <LoaderCircle className="portal-news-spin" size={17} /> : <Send size={16} />}
            {isSubmitting || uploadingMedia ? activeLanguage === "ru" ? "Сохранение..." : "Сабт шуда истодааст..." : form.id ? activeLanguage === "ru" ? "Сохранить изменения" : "Сабт кардани тағйирот" : activeLanguage === "ru" ? "Опубликовать" : "Нашри маълумот"}
          </button>
          {form.id && (
            <button className="portal-news-form__cancel" type="button" onClick={() => { setForm(emptyForm); setShowForm(false); }}>
                {activeLanguage === "ru" ? "Отмена" : "Бекор кардан"}
            </button>
          )}
        </form>
      )}

      {isLoading ? (
        <div className="portal-news-feed__empty"><LoaderCircle className="portal-news-spin" size={19} /> {activeLanguage === "ru" ? "Загрузка новостей..." : "Ахбор бор шуда истодааст..."}</div>
      ) : news.length === 0 && !error ? (
        <div className="portal-news-feed__empty"><FileText size={22} /> {activeLanguage === "ru" ? "Новостей пока нет." : "Ҳоло хабар нашр нашудааст."}</div>
      ) : (
        <div
          className="portal-news-list"
          tabIndex={0}
          aria-label={activeLanguage === "ru" ? "Список последних новостей" : "Рӯйхати хабарҳои тоза"}
        >
          {news.slice(0, limit).map((item) => {
            const media = getNewsMedia(item);
            const firstMedia = media[0];
            const isExpanded = expandedNews.has(item.id);
            const content = activeLanguage === "ru" ? item.content_ru || item.content : item.content;
            return (
            <article className="portal-news-card" key={item.id}>
              {firstMedia && (
                <figure className="portal-news-card__media">
                  {firstMedia.type === "video" ? (
                    <video src={firstMedia.src} controls playsInline preload="metadata" aria-label={item.title} />
                  ) : (
                    <Image
                      className="portal-news-card__image"
                      src={firstMedia.src}
                      alt={firstMedia.alt || item.title}
                      width={560}
                      height={280}
                      unoptimized
                    />
                  )}
                  {(activeLanguage === "ru" ? firstMedia.caption_ru || firstMedia.caption : firstMedia.caption) && (
                    <figcaption>{activeLanguage === "ru" ? firstMedia.caption_ru || firstMedia.caption : firstMedia.caption}</figcaption>
                  )}
                </figure>
              )}
              <div className="portal-news-card__meta">
                <span>{activeLanguage === "ru" ? item.category_ru || item.category : item.category}</span>
                <time dateTime={item.published_at}>{formatDate(item.published_at, activeLanguage)}</time>
              </div>
              <h4>
                <Link className="portal-news-card__title-link" href={`/news/${encodeURIComponent(item.id)}`}>
                  {activeLanguage === "ru" ? item.title_ru || item.title : item.title}
                </Link>
              </h4>
              <p className={content.length > 240 && !isExpanded ? "portal-news-card__excerpt" : undefined}>
                {content}
              </p>
              {content.length > 240 && (
                <button
                  className="portal-news-card__read-more"
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedNews((current) => {
                    const next = new Set(current);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  })}
                >
                  {isExpanded ? activeLanguage === "ru" ? "Свернуть" : "Пӯшидан" : activeLanguage === "ru" ? "Подробнее" : "Муфассал"}
                </button>
              )}
              <p className="portal-news-card__readers"><Eye size={14} /> {activeLanguage === "ru" ? "Читателей" : "Хонандагон"}: {item.view_count ?? 0}</p>
              {isAdmin && (
                <div className="portal-news-card__admin-actions">
                  <button type="button" onClick={() => handleEdit(item)}>{activeLanguage === "ru" ? "Изменить" : "Таҳрир"}</button>
                  <button type="button" onClick={() => void handleDelete(item)}>{activeLanguage === "ru" ? "Удалить" : "Нест кардан"}</button>
                </div>
              )}
              {media.length > 1 && (
                <span className="portal-news-card__more">+{media.length - 1} {activeLanguage === "ru" ? "медиафайлов" : "маводи дигар"}</span>
              )}
            </article>
          );
          })}
        </div>
      )}

      {limit && news.length > limit && (
        <Link className="portal-news-feed__source" href="/news">
          {activeLanguage === "ru" ? "Все новости" : "Ҳамаи хабарҳо"} <ArrowUpRight size={15} />
        </Link>
      )}

      <a
        className="portal-news-feed__source"
        href={`https://egov.tj/site/arhitekture-tjk?lang=${activeLanguage}`}
        target="_blank"
        rel="noreferrer"
      >
        {activeLanguage === "ru" ? "Официальная информация Комитета по архитектуре и строительству" : "Маълумоти расмии Кумитаи меъморӣ ва сохтмон"} <ArrowUpRight size={15} />
      </a>
    </div>
  );
}
