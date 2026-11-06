"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Languages } from "lucide-react";
import NewsFeed from "../architecture/news-feed";
import SiteNavigation from "../site-navigation";
import SiteFooter from "../site-footer";
import { setSiteLanguage, useSiteLanguage } from "../architecture/site-language";
import "../architecture/architecture.css";
import "../architecture/modern-theme.css";

export default function NewsPageContent() {
  const language = useSiteLanguage();
  const isRussian = language === "ru";

  const changeLanguage = (next: "tg" | "ru") => {
    setSiteLanguage(next);
  };

  return (
    <main className="architecture-site" lang={language}>
      <div className="portal-ribbon">
        <div className="portal-container portal-ribbon__inner">
          <span>{isRussian ? "Республика Таджикистан" : "Ҷумҳурии Тоҷикистон"}</span>
          <div className="portal-ribbon__actions">
            <a href={`https://egov.tj/site/arhitekture-tjk?lang=${language}`} target="_blank" rel="noreferrer">
              {isRussian ? "Комитет по архитектуре и строительству" : "Сомонаи Кумитаи меъморӣ ва сохтмон"} <ArrowUpRight size={14} />
            </a>
            <div className="portal-language-switch" aria-label={isRussian ? "Язык сайта" : "Забони сомона"}>
              <Languages size={14} aria-hidden="true" />
              <button type="button" aria-pressed={!isRussian} onClick={() => changeLanguage("tg")}>TJ</button>
              <button type="button" aria-pressed={isRussian} onClick={() => changeLanguage("ru")}>RU</button>
            </div>
          </div>
        </div>
      </div>

      <SiteNavigation />

      <section className="portal-feature-news portal-section">
        <div className="portal-container">
          <div className="portal-section-heading">
            <div>
              <p className="portal-kicker">{isRussian ? "Юбилейный год · 2006–2026" : "Соли ҷашнӣ · 2006–2026"}</p>
              <h2>{isRussian ? "20 лет развития и созидания" : "20 сол дар роҳи рушд ва созандагӣ"}</h2>
            </div>
          </div>
          <article className="portal-feature-news__story">
            <div className="portal-feature-news__poster">
              <Image
                src="/anniversary-20-years.jpg"
                alt={isRussian ? "Плакат к 20-летию института, Душанбе, 2026" : "Постери 20-солагии пажӯҳишгоҳ, Душанбе, 2026"}
                width={755}
                height={1078}
                sizes="(max-width: 720px) 100vw, (max-width: 1020px) 42vw, 360px"
                priority
              />
            </div>
            <div className="portal-feature-news__details">
              <p className="portal-feature-news__label">{isRussian ? "4 июля 2006 · Постановление № 311" : "4 июли 2006 · Қарори №311"}</p>
              <h3>{isRussian ? "Институт отмечает 20-летие со дня основания" : "Пажӯҳишгоҳ 20-солагии таъсисёбиро таҷлил мекунад"}</h3>
              <p>
                {isRussian
                  ? "Государственное унитарное предприятие «Научно-исследовательский институт «Строительство и архитектура»» создано постановлением Правительства Республики Таджикистан. Юбилейное издание 2026 года представляет историю института, руководителей, проекты, лаборатории и центры."
                  : "Корхонаи воҳиди давлатии «Пажӯҳишгоҳи илмию тадқиқотии «Сохтмон ва меъморӣ»» бо қарори Ҳукумати Ҷумҳурии Тоҷикистон таъсис ёфтааст. Нашрияи ҷашнии соли 2026 таърихи пажӯҳишгоҳ, роҳбарон, лоиҳаҳо ва фаъолияти озмоишгоҳу марказҳои онро муаррифӣ мекунад."}
              </p>
              <div className="portal-feature-news__facts">
                <span>{isRussian ? "Разработано более 199 строительных нормативных документов" : "Зиёда аз 199 ҳуҷҷати меъёрии сохтмонӣ таҳия шудааст"}</span>
                <span>{isRussian ? "Курсы повышения квалификации проводятся с 2014 года" : "Курсҳои такмили ихтисос аз соли 2014 амал мекунанд"}</span>
              </div>
              <div className="portal-feature-news__actions">
                <Link className="portal-button portal-button--dark" href="/architecture#about">
                  {isRussian ? "История и направления" : "Шиносоӣ бо таърих ва бахшҳо"} <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="portal-news portal-section">
        <div className="portal-container portal-news-page__inner">
          <div className="portal-news-page__heading">
            <p className="portal-kicker">{isRussian ? "Новости и объявления" : "Ахбор ва эълонҳо"}</p>
            <h1>{isRussian ? "Новости института" : "Ахбори пажӯҳишгоҳ"}</h1>
            <p className="portal-news__copy">
              {isRussian
                ? "Выберите новость, чтобы открыть полный текст. Руководители и администраторы могут добавлять сюда новые материалы и фотографии."
                : "Хабарро интихоб кунед, то матни пурраи он кушода шавад. Роҳбарон ва администраторҳо метавонанд аз ҳамин бахш маълумот ва аксҳои навро ба сомона илова кунанд."}
            </p>
          </div>
          <NewsFeed language={language} />
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
