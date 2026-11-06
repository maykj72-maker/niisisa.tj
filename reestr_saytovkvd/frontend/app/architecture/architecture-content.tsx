"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE } from "../api-config";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  FlaskConical,
  GraduationCap,
  Landmark,
  Languages,
  Mail,
  MapPinned,
  Monitor,
  Phone,
  Printer,
  Ruler,
  ShieldCheck,
} from "lucide-react";
import NewsFeed from "./news-feed";
import PhotoGallery from "./photo-gallery";
import { setSiteLanguage, useSiteLanguage } from "./site-language";
import { motion } from "framer-motion";
import SiteNavigation from "../site-navigation";
import {
  digitalPhotos,
  engineeringPhotos,
  focusAreas,
  historyPhotos,
  inspectionInstruments,
  inspectionReasons,
  inspectionReport,
  inspectionSteps,
  laboratoryMaterials,
  laboratoryPhotos,
  leaders,
  newsPhotos,
  printingPhotos,
  printingServices,
  projectPhotos,
  standardsPhotos,
  trainingCourses,
  trainingPhotos,
  type OrganizationPhoto,
} from "./organization-data";
import { russianContent, russianSiteCopy } from "./russian-content";
import "./architecture.css";
import "./modern-theme.css";

const services = [
  {
    icon: "MapPinned",
    title: "Шаҳрсозӣ ва банақшагирӣ",
    description:
      "Нақшаҳои генералии шаҳрҳо ва маҳалҳои аҳолинишин, банақшагирии ҳудудҳо ва инфрасохтори иҷтимоиву нақлиётӣ.",
    href: "#projects",
    action: "Дидани лоиҳаҳо",
  },
  {
    icon: "Ruler",
    title: "Лоиҳакашии бино ва иншоот",
    description:
      "Лоиҳаҳои истиқоматӣ, ҷамъиятӣ, мактабҳо, муассисаҳои тиббӣ, иншооти варзишӣ ва дигар объектҳо.",
    href: "#projects",
    action: "Дидани лоиҳаҳо",
  },
  {
    icon: "ShieldCheck",
    title: "Муоинаи техникӣ ва ҷустуҷӯҳои муҳандисӣ",
    description:
      "Муайян кардани ҳолати бино, нуқсонҳо ва эътимоднокии конструксияҳо; таҳияи хулоса ва тавсияҳои истифодаи бехатар.",
    href: "#inspection",
    action: "Маълумоти муфассал",
  },
  {
    icon: "FlaskConical",
    title: "Озмоишгоҳи санҷишӣ",
    description:
      "Озмоиши масолеҳ ва маснуоти сохтмонӣ. Аккредитатсия тибқи ГОСТ ИСО/МЭК 17025-2019; рақами феҳрист TJ 762.37100.02.055-2023.",
    href: "#laboratory",
    action: "Намудҳои санҷиш",
  },
  {
    icon: "BookOpenCheck",
    title: "Илм ва ҳуҷҷатҳои меъёрӣ",
    description:
      "Корҳои илмӣ-тадқиқотӣ ва таҳияи зиёда аз 199 меъёру қоидаҳои сохтмонӣ ва шаҳрсозӣ.",
    href: "#standards",
    action: "Дар бораи ҳуҷҷатҳои соҳавӣ",
  },
  {
    icon: "GraduationCap",
    title: "Маркази таълимӣ ва аттестатсия",
    description:
      "Курсҳои такмили ихтисос аз соли 2014; омӯзиш аз рӯи барномаҳои ETABS ва LIRA.",
    href: "#training",
    action: "Самтҳои омӯзиш",
  },
  {
    icon: "Monitor",
    title: "Технологияҳои рақамӣ ва машварат",
    description:
      "Системаи электронии «Иттилооти шаҳрсозӣ» — китобхонаи ҳуҷҷатҳои техникӣ ва ҳуқуқии соҳа.",
    href: "#digital",
    action: "Маълумот дар бораи система",
  },
  {
    icon: "Printer",
    title: "Маркази «Табъу нашр»",
    description:
      "Чопи васеъ, китобу брошюра, маводи иттилоотӣ, нусхабардорӣ, сканеркунӣ ва дигар хизматрасониҳои полиграфӣ.",
    href: "#printing",
    action: "Хизматрасониҳои чопӣ",
  },
];

const defaultSiteContent = {
  leaders,
  focusAreas,
  services,
  historyPhotos,
  projectPhotos,
  engineeringPhotos,
  laboratoryPhotos,
  standardsPhotos,
  trainingPhotos,
  digitalPhotos,
  printingPhotos,
  newsPhotos,
  inspectionReasons,
  inspectionInstruments,
  inspectionSteps,
  inspectionReport,
  laboratoryMaterials,
  trainingCourses,
  printingServices,
  digitalBenefits: [
    "Дастрасии зуд ба ҳуҷҷатҳои зарурӣ дар шакли рақамӣ.",
    "Фарогирии ГОСТ, меъёрҳои сохтмонӣ ва шаҳрсозӣ, дастурҳои методӣ, фармоишҳо ва мактубҳои соҳавӣ, аз ҷумла МҚС ҶТ, МҚШ ҶТ, МҚ ҶТ ва ҲРС ҶТ.",
    "Имкони истифодаи ҳамзамони ҳуҷҷатҳо ва нигоҳдории онҳо дар китобхонаи электронӣ.",
    "Шӯъба ҳамчунин ҳуҷҷатҳои меъёриро дастрас карда, ба фармоишгарон машварат медиҳад.",
  ],
  contacts: [
    { kind: "Phone", label: "+992 37 227-77-60", href: "tel:+992372277760" },
    { kind: "Phone", label: "+992 37 227-77-61", href: "tel:+992372277761" },
    { kind: "Phone", label: "+992 37 227-10-62", href: "tel:+992372271062" },
    { kind: "Mail", label: "niisa.tj@mail.ru", href: "mailto:niisa.tj@mail.ru" },
    { kind: "Mail", label: "nissnip@mail.ru", href: "mailto:nissnip@mail.ru" },
    { kind: "Landmark", label: "Кумитаи меъморӣ ва сохтмон", href: "https://egov.tj/site/arhitekture-tjk?lang=tg" },
  ],
  contactInfo: [{
    address: "734025, шаҳри Душанбе, кӯчаи Ҳусейнзода, 36-А (назди боғи Куруши Кабир).",
    founder: "Кумитаи меъморӣ ва сохтмони назди Ҳукумати Ҷумҳурии Тоҷикистон.",
    mapUrl: "https://maps.google.com/?q=Huseynzoda+36A+Dushanbe",
  }],
  siteCopy: [{
    countryName: "Ҷумҳурии Тоҷикистон",
    governmentLink: "Сомонаи Кумитаи меъморӣ ва сохтмон",
    governmentUrl: "https://egov.tj/site/arhitekture-tjk?lang=tg",
    navAbout: "Дар бораи мо",
    navHistory: "Таърихи мо",
    navAreas: "Самтҳои фаъолият",
    navServices: "Хизматрасониҳо",
    navNews: "Ахбор",
    navContact: "Тамос",
    registryLink: "Феҳристи сертификатҳо",
    brandAriaLabel: "Ба феҳристи сертификатҳо",
    navAriaLabel: "Навигатсияи асосӣ",
    heroKicker: "2006 — 2026 · 20 соли фаъолият",
    heroTitle: "Илм ва лоиҳакашӣ барои сохтмони",
    heroEmphasis: "бехатар",
    heroLead: "Пажӯҳишгоҳи илмию тадқиқотии сохтмон ва меъморӣ 4 июли соли 2006 таъсис ёфта, дар соҳаи меъморӣ, сохтмон, таҳқиқоти илмӣ ва лоиҳакашӣ фаъолият мекунад.",
    heroFoundation: "Корхона тибқи қарори Ҳукумати Ҷумҳурии Тоҷикистон №311 таъсис ёфтааст",
    heroFooter: "20 соли тадқиқот, тарҳрезӣ ва рушд",
    heroRegistryButton: "Санҷидани сертификат",
    heroAboutButton: "Дар бораи пажӯҳишгоҳ",
    heroArtLabel: "ДУШАНБЕ · ТОҶИКИСТОН",
    heroScrollLabel: "Ба маълумот дар бораи пажӯҳишгоҳ",
    aboutKicker: "Дар бораи пажӯҳишгоҳ",
    aboutTitle: "20 сол дар роҳи рушд ва созандагӣ",
    aboutParagraph1: "Корхонаи воҳиди давлатии «Пажӯҳишгоҳи илмию тадқиқотии «Сохтмон ва меъморӣ»» тибқи қарори Ҳукумати Ҷумҳурии Тоҷикистон аз 4 июли соли 2006, №311 таъсис ёфтааст. Муассиси корхона Кумитаи меъморӣ ва сохтмони назди Ҳукумати Ҷумҳурии Тоҷикистон мебошад.",
    aboutParagraph2: "Вазифаи асосии пажӯҳишгоҳ таъмин намудани ҷомеа бо таҳқиқоти босифати илмӣ ва коркардҳои лоиҳавӣ, иштирок дар барномаҳои давлатӣ ва пешбурди корҳои илмӣ дар соҳаи сохтмон мебошад.",
    leadersKicker: "Роҳбарони пажӯҳишгоҳ",
    leadersTitle: "Давраҳои роҳбарӣ",
    historyKicker: "Таърих ва сохтор",
    historyTitle: "Кормандон ва ташкили пажӯҳишгоҳ",
    areasKicker: "Самтҳои фаъолият",
    areasTitle: "Илм ва таҷриба дар хизмати сохтмон",
    areasCount: "01 — 08",
    projectsKicker: "Портфели лоиҳаҳо",
    projectsTitle: "Лоиҳаҳои меъморӣ ва сохтмонӣ",
    projectsDescription: "Намунаҳои лоиҳаҳои дар нашрияи ҷашнии пажӯҳишгоҳ овардашуда: шаҳрсозӣ, манзил, муассисаҳои таълимӣ ва тиббӣ, иншооти варзишӣ ва сайёҳӣ.",
    servicesKicker: "Самтҳо ва хизматрасониҳо",
    servicesTitle: "Имкониятҳои пажӯҳишгоҳ",
    servicesDescription: "Аз хизматрасонии мувофиқ истифода баред ё ба маълумоти расмии соҳа гузаред.",
    inspectionTitle: "Ҷустуҷӯҳои муҳандисӣ ва бехатарии бино",
    inspectionIntro: "Мутахассисон ҳолати ҷорӣ, дараҷаи фарсудашавӣ ва хусусиятҳои асосии конструксияҳоро муайян мекунанд. Натиҷа барои қарор дар бораи таъмир, таҷдид ё пурзӯркунӣ истифода мешавад.",
    inspectionKicker: "Муоинаи техникӣ",
    inspectionReasonsTitle: "Муоина кай зарур мешавад?",
    inspectionStepsTitle: "Марҳилаҳои кор",
    inspectionInstrumentsTitle: "Таҷҳизоти муоина",
    inspectionReportTitle: "Хулосаи техникӣ",
    laboratoryTitle: "«Мавод, масолеҳ ва маснуоти сохтмонӣ»",
    laboratoryIntro: "Озмоишгоҳ аккредитатсия шуда, ба стандарти ГОСТ ИСО/МЭК 17025-2019 мутобиқат мекунад. Ба феҳристи давлатии низоми миллии сертификатсия 29 августи соли 2023 бо рақами TJ 762.37100.02.055-2023 ворид шудааст.",
    laboratoryOutro: "Санҷишҳо дар озмоишгоҳ ё дар маҳалли сохтмон гузаронида мешаванд; натиҷаҳо тибқи стандартҳо омода шуда, корҳои фаврӣ низ қабул карда мешаванд. Самтҳои иловагӣ: назорати зангзанӣ ва мустаҳкамии масолеҳи филизӣ ва композитӣ, таҳлили гармигузаронӣ ва самаранокии энергия.",
    laboratoryKicker: "Озмоишгоҳи санҷишӣ",
    laboratoryMaterialsTitle: "Маводи санҷишшаванда",
    standardsTitle: "Таҳқиқот ва ҳуҷҷатҳои меъёрии сохтмон",
    standardsParagraph1: "Пажӯҳишгоҳ самтҳои афзалиятноки тадқиқотро муайян карда, ҳамоҳангсозии корҳои илмиро анҷом медиҳад. Дар давоми фаъолият зиёда аз 199 меъёру қоидаҳои сохтмонӣ ва шаҳрсозӣ барои соҳаи ҷумҳурӣ таҳия шудаанд. Механизмҳои иқтисодии бозори сохтмон ва роҳҳои такмили меъёргузорӣ низ омӯхта мешаванд.",
    standardsParagraph2: "Ҳуҷҷатҳо тибқи Кодекси шаҳрсозии Ҷумҳурии Тоҷикистон ва қонунҳои «Дар бораи стандартизатсия», «Дар бораи санадҳои меъёрии ҳуқуқӣ» ва «Дар бораи забони давлатии Ҷумҳурии Тоҷикистон» таҳия мегарданд. Барои такмили онҳо дар пажӯҳишгоҳ семинару ҷаласаҳо баргузор мешаванд.",
    standardsKicker: "Илм ва танзими техникӣ",
    trainingTitle: "Курсҳои такмили ихтисос аз соли 2014",
    trainingIntro: "Марказ барои омӯзиши мутахассисони соҳаи меъморӣ ва сохтмон иҷозатномаи силсилаи Т–ИФ №0004189 дорад, ки 14 декабри соли 2023 дода шудааст. Шакли таълим рӯзона буда, дар гурӯҳҳо 12–15 нафар қабул мешаванд. Пас аз анҷоми бомуваффақияти курс ҳуҷҷати тасдиқкунандаи такмили ихтисос дода мешавад.",
    trainingOutro: "Курсҳои амалии ҳисобу таҳлили конструксияҳо бо барномаҳои ETABS ва LIRA низ гузаронида мешаванд; мутахассисон ва тренерони хориҷӣ ҷалб мегарданд.",
    trainingKicker: "Маркази таълимӣ ва аттестатсия",
    trainingCoursesTitle: "Самтҳои омӯзиш",
    digitalTitle: "Системаи «Иттилооти шаҳрсозӣ»",
    digitalIntro: "Системаи электронӣ китобхонаи муттаҳидаи иттилооти илмӣ, техникӣ ва ҳуқуқии соҳа мебошад. Он барои ташкилотҳои лоиҳакашӣ, сохтмонӣ, таъмирӣ ва васлӣ, инчунин мақомоти назоратӣ ва иҷозатдиҳӣ пешбинӣ шудааст.",
    digitalKicker: "Рақамикунонӣ ва машварат",
    printingTitle: "Хизматрасониҳои полиграфӣ",
    printingIntro: "Марказ омода ва чоп кардани адабиёти илмӣ, таълимӣ ва методӣ, ҳуҷҷатҳои техникӣ ва маводи таблиғотиро барои ташкилоту муассисаҳо анҷом медиҳад.",
    printingKicker: "Маркази «Табъу нашр»",
    newsTitle: "Ахбори пажӯҳишгоҳ",
    newsDescription: "Дар соли 2026 аз таъсиси пажӯҳишгоҳ 20 сол пур мешавад. Дар нашрияи ҷашнӣ таърихи корхона, роҳбарон, лоиҳаҳо ва дастовардҳои кормандон инъикос ёфтаанд. Ахбори нав ва маводи иловагӣ дар ин бахш мунтазам нашр мешаванд.",
    newsKicker: "Ахбор ва эълонҳо",
    allNewsLink: "Ҳамаи ахбор ва иловаи маълумот",
    newsGalleryKicker: "Нигористони аксҳо",
    newsGalleryTitle: "Вохӯриҳо ва ҳамкориҳои соҳавӣ",
    contactKicker: "Тамос ва маълумот",
    contactTitle: "Суроға ва маълумоти тамос",
    founderPrefix: "Муассис:",
    mapLink: "Дидани суроға",
    footerCopyright: "© Пажӯҳишгоҳи илмию тадқиқотии сохтмон ва меъморӣ",
    footerRegistryLink: "Ба феҳристи сертификатҳо",
  }],
};

const serviceIcons: Record<string, typeof MapPinned> = {
  MapPinned,
  Ruler,
  ShieldCheck,
  FlaskConical,
  BookOpenCheck,
  GraduationCap,
  Monitor,
  Printer,
  Landmark,
};

const defaultRussianContent = Object.fromEntries(
  Object.entries(defaultSiteContent).map(([section, items]) => [
    `${section}Ru`,
    russianContent[section] ?? items,
  ]),
);

const contactIcons: Record<string, typeof Mail> = { Phone, Mail, Landmark };

export default function ArchitecturePage() {
  const [siteContent, setSiteContent] = useState<Record<string, unknown[]>>({
    ...defaultSiteContent,
    ...defaultRussianContent,
  });
  const language = useSiteLanguage();

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/site-content`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Не удалось загрузить содержимое сайта (${response.status})`);
        return response.json() as Promise<Record<string, unknown>>;
      })
      .then((saved) => {
        if (!active) return;
        const collections: Record<string, unknown[]> = {};
        for (const [section, items] of Object.entries(saved)) {
          if (Array.isArray(items)) collections[section] = items;
        }
        setSiteContent((current) => ({ ...current, ...collections }));
      })
      .catch((error: unknown) => {
        console.error(error);
      });
    return () => {
      active = false;
    };
  }, []);

  const contentList = <T,>(section: keyof typeof defaultSiteContent) =>
    (siteContent[language === "ru" ? `${section}Ru` : section] ??
      (language === "ru" ? defaultRussianContent[`${section}Ru`] : defaultSiteContent[section])) as T;

  const siteCopy = (contentList<typeof defaultSiteContent.siteCopy>("siteCopy")[0] ||
    (language === "ru" ? russianSiteCopy : defaultSiteContent.siteCopy[0])) as typeof defaultSiteContent.siteCopy[0];
  const copy = (key: keyof typeof defaultSiteContent.siteCopy[0]) => siteCopy[key];
  const contactInfo = contentList<typeof defaultSiteContent.contactInfo>("contactInfo")[0] ||
    (language === "ru" ? russianContent.contactInfo[0] : defaultSiteContent.contactInfo[0]) as typeof defaultSiteContent.contactInfo[0];
  const contactLinks = contentList<typeof defaultSiteContent.contacts>("contacts");

  return (
    <main className="architecture-site" lang={language}>
      <div className="portal-ribbon">
        <div className="portal-container portal-ribbon__inner">
          <span>{copy("countryName")}</span>
          <div className="portal-ribbon__actions">
            <a href={copy("governmentUrl")} target="_blank" rel="noreferrer">
              {copy("governmentLink")} <ArrowUpRight size={14} />
            </a>
            <div className="portal-language-switch" aria-label={language === "ru" ? "Язык сайта" : "Забони сомона"}>
              <Languages size={14} aria-hidden="true" />
              <button
                type="button"
                aria-pressed={language === "tg"}
                onClick={() => {
                  setSiteLanguage("tg");
                }}
              >
                TJ
              </button>
              <button
                type="button"
                aria-pressed={language === "ru"}
                onClick={() => {
                  setSiteLanguage("ru");
                }}
              >
                RU
              </button>
            </div>
          </div>
        </div>
      </div>

      <SiteNavigation />
      <nav className="portal-section-nav" aria-label={copy("navAriaLabel")}>
        <div className="portal-container portal-section-nav__inner">
          <Link href="/architecture#about">{copy("navAbout")}</Link>
          <Link href="/architecture#areas">{copy("navAreas")}</Link>
          <Link href="/architecture#services">{copy("navServices")}</Link>
          <Link href="/news">{copy("navNews")}</Link>
          <Link href="/architecture#contacts">{copy("navContact")}</Link>
        </div>
      </nav>

      <section className="portal-hero" aria-labelledby="hero-title">
        <div className="portal-hero__grid" aria-hidden="true" />
        <div className="portal-container portal-hero__content">
          <motion.div
            className="portal-hero__copy"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55 }}
          >
            <p className="portal-eyebrow">
              <span /> {copy("heroKicker")}
            </p>
            <h1 id="hero-title">
              {copy("heroTitle")} <em>{copy("heroEmphasis")}</em>
            </h1>
            <p className="portal-hero__lead">{copy("heroLead")}</p>
            <div className="portal-hero__actions">
              <Link className="portal-button portal-button--light" href="/">
                {copy("heroRegistryButton")} <ArrowRight size={17} />
              </Link>
              <a className="portal-text-link" href="#about">
                {copy("heroAboutButton")} <ArrowRight size={16} />
              </a>
            </div>
            <div className="portal-hero__note">
              <ShieldCheck size={18} />
              <span>{copy("heroFoundation")}</span>
            </div>
          </motion.div>

          <motion.div
            className="portal-hero__art"
            aria-hidden="true"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12 }}
          >
            <div className="portal-hero__sun" />
            <div className="portal-hero__mountains portal-hero__mountains--back" />
            <div className="portal-hero__mountains portal-hero__mountains--front" />
            <div className="portal-building portal-building--left">
              <span /><span /><span /><span /><span /><span />
            </div>
            <div className="portal-building portal-building--center">
              <div className="portal-building__roof" />
              <span /><span /><span /><span /><span /><span /><span /><span />
            </div>
            <div className="portal-building portal-building--right">
              <span /><span /><span /><span /><span /><span />
            </div>
            <div className="portal-hero__ground" />
            <span className="portal-art-label">{copy("heroArtLabel")}</span>
          </motion.div>
        </div>
        <div className="portal-container portal-hero__bottom">
          <span>{copy("heroFooter")}</span>
          <a href="#about" aria-label={copy("heroScrollLabel")}>
            <ArrowRight size={17} />
          </a>
        </div>
      </section>

      <section className="portal-quick-links" aria-label={language === "ru" ? "Основные направления" : "Самтҳои асосӣ"}>
        <div className="portal-container portal-quick-links__inner">
          {[
            { href: "#areas", icon: Ruler, title: language === "ru" ? "Архитектура и строительство" : "Меъморӣ ва сохтмон" },
            { href: "#laboratory", icon: FlaskConical, title: language === "ru" ? "Испытания и лаборатория" : "Озмоиш ва озмоишгоҳ" },
            { href: "#standards", icon: BookOpenCheck, title: language === "ru" ? "Научные исследования" : "Таҳқиқоти илмӣ" },
            { href: "#digital", icon: Monitor, title: language === "ru" ? "Цифровые технологии" : "Технологияҳои рақамӣ" },
          ].map(({ href, icon: Icon, title }) => (
            <Link className="portal-quick-link" href={href} key={href}>
              <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
              <span>{title}</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section className="portal-intro portal-section" id="about">
        <div className="portal-container portal-intro__layout">
          <div>
            <p className="portal-kicker">{copy("aboutKicker")}</p>
            <h2>{copy("aboutTitle")}</h2>
          </div>
          <div className="portal-intro__body">
            <p>{copy("aboutParagraph1")}</p>
            <p>{copy("aboutParagraph2")}</p>
          </div>
        </div>
        <div className="portal-container portal-institute-facts" aria-label={language === "ru" ? "Факты об институте" : "Маълумот дар бораи пажӯҳишгоҳ"}>
          {[
            { value: "20", label: language === "ru" ? "лет научной работы" : "соли фаъолияти илмӣ" },
            { value: "199+", label: language === "ru" ? "строительных нормативных документов" : "ҳуҷҷати меъёрии сохтмонӣ" },
            { value: "2014", label: language === "ru" ? "год начала курсов повышения квалификации" : "оғози курсҳои такмили ихтисос" },
          ].map((fact) => (
            <div className="portal-institute-fact" key={fact.value}>
              <strong>{fact.value}</strong>
              <span>{fact.label}</span>
            </div>
          ))}
        </div>
        <div className="portal-container portal-history">
          <div className="portal-history__heading">
            <p className="portal-kicker">{copy("leadersKicker")}</p>
            <h3>{copy("leadersTitle")}</h3>
          </div>
          <div className="portal-leadership-grid">
            {contentList<typeof leaders>("leaders").map((leader) => (
              <article className="portal-leader-card" key={leader.name}>
                <PhotoGallery
                  className="portal-leader-photo-grid"
                  photos={[leader.photo]}
                />
                <div className="portal-leader-card__copy">
                  <span>{leader.years}</span>
                  <h4>{leader.name}</h4>
                  <p>{leader.note}</p>
                  <small>{leader.role}</small>
                </div>
              </article>
            ))}
          </div>
          <div className="portal-history__gallery" id="history-gallery">
            <div>
              <p className="portal-kicker">{copy("historyKicker")}</p>
              <h3>{copy("historyTitle")}</h3>
            </div>
            <PhotoGallery autoCarousel photos={contentList<OrganizationPhoto[]>("historyPhotos")} />
          </div>
        </div>
      </section>

      <section className="portal-section portal-areas" id="areas">
        <div className="portal-container">
          <div className="portal-section-heading">
            <div>
              <p className="portal-kicker">{copy("areasKicker")}</p>
              <h2>{copy("areasTitle")}</h2>
            </div>
            <span className="portal-section-heading__mark">{copy("areasCount")}</span>
          </div>
          <div className="portal-area-grid">
            {contentList<typeof focusAreas>("focusAreas").map((area) => (
              <article className="portal-area-card" key={area.number}>
                <span className="portal-area-card__number">{area.number}</span>
                <h3>{area.title}</h3>
                <p>{area.description}</p>
                <span className="portal-area-card__rule" />
              </article>
            ))}
          </div>
          <div className="portal-gallery-section" id="projects">
            <div className="portal-gallery-section__heading">
              <p className="portal-kicker">{copy("projectsKicker")}</p>
              <h3>{copy("projectsTitle")}</h3>
              <p>{copy("projectsDescription")}</p>
            </div>
            <PhotoGallery autoCarousel photos={contentList<OrganizationPhoto[]>("projectPhotos")} />
          </div>
        </div>
      </section>

      <section className="portal-services portal-section" id="services">
        <div className="portal-container">
          <div className="portal-section-heading">
            <div>
              <p className="portal-kicker">{copy("servicesKicker")}</p>
              <h2>{copy("servicesTitle")}</h2>
            </div>
            <p className="portal-section-heading__description">{copy("servicesDescription")}</p>
          </div>
          <div className="portal-service-grid">
            {contentList<typeof services>("services").map((service) => {
              const Icon = serviceIcons[service.icon] || Landmark;
              const external = service.href.startsWith("https://");

              return (
                <article className="portal-service-card" key={service.title}>
                  <span className="portal-service-card__icon">
                    <Icon size={22} strokeWidth={1.7} />
                  </span>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  {external ? (
                    <a href={service.href} target="_blank" rel="noreferrer">
                      {service.action} <ArrowUpRight size={15} />
                    </a>
                  ) : (
                    <Link href={service.href}>
                      {service.action} <ArrowRight size={15} />
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
          <div className="portal-capability-list">
            <article className="portal-capability-card" id="inspection">
              <div className="portal-capability-card__copy">
                <p className="portal-kicker">{copy("inspectionKicker")}</p>
                <h3>{copy("inspectionTitle")}</h3>
                <p>{copy("inspectionIntro")}</p>
                <h4>{copy("inspectionReasonsTitle")}</h4>
                <ul className="portal-detail-list">
                  {contentList<typeof inspectionReasons>("inspectionReasons").map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
                <h4>{copy("inspectionStepsTitle")}</h4>
                <ol className="portal-detail-list">
                  {contentList<typeof inspectionSteps>("inspectionSteps").map((step) => <li key={step}>{step}</li>)}
                </ol>
                <h4>{copy("inspectionInstrumentsTitle")}</h4>
                <ul className="portal-detail-list">
                  {contentList<typeof inspectionInstruments>("inspectionInstruments").map((instrument) => <li key={instrument}>{instrument}</li>)}
                </ul>
                <h4>{copy("inspectionReportTitle")}</h4>
                <ul className="portal-detail-list">
                  {contentList<typeof inspectionReport>("inspectionReport").map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <PhotoGallery photos={contentList<OrganizationPhoto[]>("engineeringPhotos")} />
            </article>

            <article className="portal-capability-card" id="laboratory">
              <div className="portal-capability-card__copy">
                <p className="portal-kicker">{copy("laboratoryKicker")}</p>
                <h3>{copy("laboratoryTitle")}</h3>
                <p>{copy("laboratoryIntro")}</p>
                <h4>{copy("laboratoryMaterialsTitle")}</h4>
                <ul className="portal-detail-list">
                  {contentList<typeof laboratoryMaterials>("laboratoryMaterials").map((material) => <li key={material}>{material}</li>)}
                </ul>
                <p>{copy("laboratoryOutro")}</p>
              </div>
              <PhotoGallery photos={contentList<OrganizationPhoto[]>("laboratoryPhotos")} />
            </article>

            <article className="portal-capability-card" id="standards">
              <div className="portal-capability-card__copy">
                <p className="portal-kicker">{copy("standardsKicker")}</p>
                <h3>{copy("standardsTitle")}</h3>
                <p>{copy("standardsParagraph1")}</p>
                <p>{copy("standardsParagraph2")}</p>
              </div>
              <PhotoGallery autoCarousel photos={contentList<OrganizationPhoto[]>("standardsPhotos")} />
            </article>

            <article className="portal-capability-card" id="training">
              <div className="portal-capability-card__copy">
                <p className="portal-kicker">{copy("trainingKicker")}</p>
                <h3>{copy("trainingTitle")}</h3>
                <p>{copy("trainingIntro")}</p>
                <h4>{copy("trainingCoursesTitle")}</h4>
                <ul className="portal-detail-list">
                  {contentList<typeof trainingCourses>("trainingCourses").map((course) => <li key={course}>{course}</li>)}
                </ul>
                <p>{copy("trainingOutro")}</p>
              </div>
              <PhotoGallery photos={contentList<OrganizationPhoto[]>("trainingPhotos")} />
            </article>

            <article className="portal-capability-card" id="digital">
              <div className="portal-capability-card__copy">
                <p className="portal-kicker">{copy("digitalKicker")}</p>
                <h3>{copy("digitalTitle")}</h3>
                <p>{copy("digitalIntro")}</p>
                <ul className="portal-detail-list">
                  {contentList<typeof defaultSiteContent.digitalBenefits>("digitalBenefits").map((benefit) => <li key={benefit}>{benefit}</li>)}
                </ul>
              </div>
              <PhotoGallery photos={contentList<OrganizationPhoto[]>("digitalPhotos")} />
            </article>

            <article className="portal-capability-card" id="printing">
              <div className="portal-capability-card__copy">
                <p className="portal-kicker">{copy("printingKicker")}</p>
                <h3>{copy("printingTitle")}</h3>
                <p>{copy("printingIntro")}</p>
                <ul className="portal-detail-list">
                  {contentList<typeof printingServices>("printingServices").map((service) => <li key={service}>{service}</li>)}
                </ul>
              </div>
              <PhotoGallery photos={contentList<OrganizationPhoto[]>("printingPhotos")} />
            </article>
          </div>
        </div>
      </section>

      <section className="portal-news portal-section" id="news">
        <div className="portal-container portal-news__inner">
          <div>
            <p className="portal-kicker">{copy("newsKicker")}</p>
            <h2>{copy("newsTitle")}</h2>
            <p className="portal-news__copy">{copy("newsDescription")}</p>
            <Link className="portal-inline-link" href="/news">
              {copy("allNewsLink")} <ArrowRight size={15} />
            </Link>
          </div>
          <NewsFeed language={language} />
        </div>
        <div className="portal-container portal-news__gallery">
          <div className="portal-gallery-section__heading">
            <p className="portal-kicker">{copy("newsGalleryKicker")}</p>
            <h3>{copy("newsGalleryTitle")}</h3>
          </div>
          <PhotoGallery autoCarousel photos={contentList<OrganizationPhoto[]>("newsPhotos")} />
        </div>
      </section>

      <section className="portal-contact portal-section" id="contacts">
        <div className="portal-container portal-contact__layout">
          <div>
            <p className="portal-kicker portal-kicker--light">{copy("contactKicker")}</p>
            <h2>{copy("contactTitle")}</h2>
            <p>{contactInfo.address} {copy("founderPrefix")} {contactInfo.founder}</p>
          </div>
          <a
            className="portal-button portal-button--outline"
            href={contactInfo.mapUrl}
            target="_blank"
            rel="noreferrer"
          >
            <MapPinned size={17} /> {copy("mapLink")} <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="portal-container portal-contact__links">
          {contactLinks.map((contact) => {
            const Icon = contactIcons[contact.kind] || Landmark;
            const external = contact.href.startsWith("https://");
            return (
              <a key={`${contact.href}-${contact.label}`} href={contact.href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
                <Icon size={17} /> {contact.label}
              </a>
            );
          })}
        </div>
      </section>

      <footer className="portal-footer">
        <div className="portal-container portal-footer__inner">
          <span>{copy("footerCopyright")}</span>
          <Link href="/">{copy("footerRegistryLink")} <ArrowRight size={15} /></Link>
        </div>
      </footer>
    </main>
  );
}
