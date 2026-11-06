"use client";

import Image from "next/image";
import { useSyncExternalStore, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowDownward, ArrowUpward, CloudUploadOutlined, DeleteOutlined, EditOutlined, LinkOutlined, SaveOutlined } from "@mui/icons-material";
import { isAllowedMediaUrl, uploadMediaFile } from "../media-upload";
import { API_BASE } from "../api-config";

type ContentItem = string | Record<string, unknown>;
type StoredAdminAuth = { user?: { role?: string } } | null;

let authSnapshot: StoredAdminAuth | undefined;
const authListeners = new Set<() => void>();
const sectionLabels: Record<string, string> = {
  leaders: "Роҳбарони пажӯҳишгоҳ",
  focusAreas: "Самтҳои фаъолият",
  services: "Хизматрасониҳо",
  contacts: "Маълумоти тамос",
  contactInfo: "Суроға ва муассис",
  siteCopy: "Матн ва маълумоти асосии саҳифа",
  historyPhotos: "Аксҳои таърих",
  projectPhotos: "Аксҳои лоиҳаҳо",
  engineeringPhotos: "Аксҳои муоинаи техникӣ",
  laboratoryPhotos: "Аксҳои озмоишгоҳ",
  standardsPhotos: "Аксҳои меъёрҳо",
  trainingPhotos: "Аксҳои омӯзиш",
  digitalPhotos: "Аксҳои рақамикунонӣ",
  printingPhotos: "Аксҳои маркази табъу нашр",
  newsPhotos: "Аксҳои ҳамкорӣ",
  inspectionReasons: "Сабабҳои муоина",
  inspectionInstruments: "Таҷҳизоти муоина",
  inspectionSteps: "Марҳилаҳои муоина",
  inspectionReport: "Маълумоти хулосаи техникӣ",
  laboratoryMaterials: "Маводи озмоишшаванда",
  trainingCourses: "Курсҳои омӯзишӣ",
  printingServices: "Хизматрасониҳои табъу нашр",
  digitalBenefits: "Имкониятҳои системаи рақамӣ",
};
const russianSectionLabels: Record<string, string> = {
  leaders: "Руководители института",
  focusAreas: "Направления деятельности",
  services: "Услуги",
  contacts: "Контактная информация",
  contactInfo: "Адрес и учредитель",
  siteCopy: "Тексты и основные сведения",
  historyPhotos: "Фотографии истории",
  projectPhotos: "Фотографии проектов",
  engineeringPhotos: "Фотографии технического обследования",
  laboratoryPhotos: "Фотографии лаборатории",
  standardsPhotos: "Фотографии нормативных документов",
  trainingPhotos: "Фотографии обучения",
  digitalPhotos: "Фотографии цифровой системы",
  printingPhotos: "Фотографии издательского центра",
  newsPhotos: "Фотографии сотрудничества",
  inspectionReasons: "Причины обследования",
  inspectionInstruments: "Оборудование для обследования",
  inspectionSteps: "Этапы обследования",
  inspectionReport: "Содержание технического заключения",
  laboratoryMaterials: "Испытуемые материалы",
  trainingCourses: "Учебные курсы",
  printingServices: "Полиграфические услуги",
  digitalBenefits: "Возможности цифровой системы",
};

const photoSections = new Set([
  "historyPhotos",
  "projectPhotos",
  "engineeringPhotos",
  "laboratoryPhotos",
  "standardsPhotos",
  "trainingPhotos",
  "digitalPhotos",
  "printingPhotos",
  "newsPhotos",
]);

const fieldLabels: Record<string, string> = {
  name: "Ному насаб",
  role: "Вазифа",
  years: "Солҳои роҳбарӣ",
  note: "Маълумоти иловагӣ",
  photo: "Сурати роҳбар",
  src: "Суроғаи акс",
  alt: "Тавсифи дастрасӣ",
  caption: "Сарлавҳаи акс",
  description: "Тавсиф",
  type: "Навъи медиа (image ё video)",
  document: "Ҳуҷҷат",
  orientation: "Самти акс",
  number: "Рақам",
  title: "Сарлавҳа",
  icon: "Нишонаи хизматрасонӣ",
  href: "Истинод",
  action: "Матни тугма",
  kind: "Навъи тамос (Phone, Mail ё Landmark)",
  label: "Матни тамос",
  address: "Суроға",
  founder: "Муассис",
  mapUrl: "Истиноди харита",
  heroKicker: "Сарлавҳаи хурди баннер",
  heroTitle: "Сарлавҳаи баннер",
  heroEmphasis: "Калимаи таъкидшуда дар сарлавҳа",
  heroLead: "Матни баннер",
  heroFoundation: "Ишора ба қарори муассис",
  heroFooter: "Шиори поёни баннер",
  aboutKicker: "Сарлавҳаи хурди бахши «Дар бораи мо»",
  aboutTitle: "Сарлавҳаи бахши «Дар бораи мо»",
  aboutParagraph1: "Матни якуми бахши «Дар бораи мо»",
  aboutParagraph2: "Матни дуюми бахши «Дар бораи мо»",
  leadersKicker: "Сарлавҳаи хурди роҳбарон",
  leadersTitle: "Сарлавҳаи давраҳои роҳбарӣ",
  historyKicker: "Сарлавҳаи хурди таърих",
  historyTitle: "Сарлавҳаи таърих",
  areasKicker: "Сарлавҳаи хурди самтҳо",
  areasTitle: "Сарлавҳаи самтҳои фаъолият",
  projectsKicker: "Сарлавҳаи хурди лоиҳаҳо",
  projectsTitle: "Сарлавҳаи лоиҳаҳо",
  projectsDescription: "Тавсифи галереяи лоиҳаҳо",
  servicesKicker: "Сарлавҳаи хурди хизматрасониҳо",
  servicesTitle: "Сарлавҳаи хизматрасониҳо",
  servicesDescription: "Тавсифи хизматрасониҳо",
  inspectionTitle: "Сарлавҳаи муоинаи техникӣ",
  inspectionIntro: "Тавсифи муоинаи техникӣ",
  laboratoryTitle: "Сарлавҳаи озмоишгоҳ",
  laboratoryIntro: "Тавсифи озмоишгоҳ",
  laboratoryOutro: "Маълумоти иловагӣ дар бораи озмоишгоҳ",
  standardsTitle: "Сарлавҳаи корҳои илмӣ ва меъёрҳо",
  standardsParagraph1: "Тавсифи корҳои илмӣ",
  standardsParagraph2: "Тавсифи ҳуҷҷатҳои меъёрӣ",
  trainingTitle: "Сарлавҳаи маркази таълимӣ",
  trainingIntro: "Тавсифи маркази таълимӣ",
  trainingOutro: "Маълумоти иловагӣ дар бораи омӯзиш",
  digitalTitle: "Сарлавҳаи бахши рақамикунонӣ",
  digitalIntro: "Тавсифи системаи рақамӣ",
  printingTitle: "Сарлавҳаи маркази табъу нашр",
  printingIntro: "Тавсифи хизматрасониҳои табъу нашр",
  newsTitle: "Сарлавҳаи ахбор",
  newsDescription: "Тавсифи бахши ахбор",
  newsGalleryTitle: "Сарлавҳаи нигористони аксҳо",
  contactTitle: "Сарлавҳаи маълумоти тамос",
  founderPrefix: "Матни пеш аз номи муассис",
  countryName: "Номи кишвар",
  governmentLink: "Истиноди Кумита",
  governmentUrl: "Суроғаи сомонаи Кумита",
  navAbout: "Меню: дар бораи мо",
  navHistory: "Меню: таърих",
  navAreas: "Меню: самтҳо",
  navServices: "Меню: хизматрасониҳо",
  navNews: "Меню: ахбор",
  navContact: "Меню: тамос",
  registryLink: "Истиноди феҳрист",
  brandAriaLabel: "Тавсифи дастрасии феҳристи сертификатҳо",
  navAriaLabel: "Тавсифи менюи асосӣ",
  heroRegistryButton: "Тугмаи санҷиши сертификат",
  heroAboutButton: "Тугмаи маълумот дар бораи мо",
  heroArtLabel: "Матни тасвири шаҳр",
  heroScrollLabel: "Тавсифи дастрасии тугмаи поён",
  areasCount: "Рақамгузории самтҳо",
  inspectionKicker: "Сарлавҳаи хурди муоинаи техникӣ",
  inspectionReasonsTitle: "Сарлавҳаи сабабҳои муоина",
  inspectionStepsTitle: "Сарлавҳаи марҳилаҳои кор",
  inspectionInstrumentsTitle: "Сарлавҳаи таҷҳизоти муоина",
  inspectionReportTitle: "Сарлавҳаи хулосаи техникӣ",
  laboratoryKicker: "Сарлавҳаи хурди озмоишгоҳ",
  laboratoryMaterialsTitle: "Сарлавҳаи маводи озмоишшаванда",
  standardsKicker: "Сарлавҳаи хурди илм ва меъёрҳо",
  trainingKicker: "Сарлавҳаи хурди маркази таълимӣ",
  trainingCoursesTitle: "Сарлавҳаи курсҳои омӯзишӣ",
  digitalKicker: "Сарлавҳаи хурди рақамикунонӣ",
  printingKicker: "Сарлавҳаи хурди маркази табъу нашр",
  newsKicker: "Сарлавҳаи хурди хабарҳо",
  allNewsLink: "Истиноди ҳамаи хабарҳо",
  newsGalleryKicker: "Сарлавҳаи хурди нигористони аксҳо",
  contactKicker: "Сарлавҳаи хурди маълумоти тамос",
  mapLink: "Матни истиноди харита",
  footerCopyright: "Матни ҳуқуқи муаллиф",
  footerRegistryLink: "Истиноди поёни саҳифа",
};
const russianFieldLabels: Record<string, string> = {
  name: "ФИО",
  role: "Должность",
  years: "Период руководства",
  note: "Дополнительная информация",
  photo: "Фотография руководителя",
  src: "Адрес изображения",
  alt: "Описание изображения",
  caption: "Подпись к изображению",
  description: "Описание",
  type: "Тип медиа (image или video)",
  document: "Документ",
  orientation: "Ориентация",
  number: "Номер",
  title: "Заголовок",
  icon: "Значок услуги",
  href: "Ссылка",
  action: "Текст кнопки",
  kind: "Тип контакта (Phone, Mail или Landmark)",
  label: "Контакт",
  address: "Адрес",
  founder: "Учредитель",
  mapUrl: "Ссылка на карту",
  heroKicker: "Надзаголовок баннера",
  heroTitle: "Заголовок баннера",
  heroEmphasis: "Выделенное слово",
  heroLead: "Текст баннера",
  heroFoundation: "Сведения о решении учредителя",
  heroFooter: "Подпись внизу баннера",
  aboutTitle: "Заголовок раздела «Об институте»",
  aboutParagraph1: "Первый абзац раздела «Об институте»",
  aboutParagraph2: "Второй абзац раздела «Об институте»",
  inspectionTitle: "Заголовок технического обследования",
  inspectionIntro: "Описание технического обследования",
  laboratoryTitle: "Заголовок лаборатории",
  laboratoryIntro: "Описание лаборатории",
  laboratoryOutro: "Дополнительная информация о лаборатории",
  standardsTitle: "Заголовок исследований и норм",
  standardsParagraph1: "Описание научной работы",
  standardsParagraph2: "Описание нормативных документов",
  trainingTitle: "Заголовок учебного центра",
  trainingIntro: "Описание учебного центра",
  trainingOutro: "Дополнительная информация об обучении",
  digitalTitle: "Заголовок цифрового раздела",
  digitalIntro: "Описание цифровой системы",
  printingTitle: "Заголовок издательского центра",
  printingIntro: "Описание полиграфических услуг",
  newsTitle: "Заголовок новостей",
  newsDescription: "Описание раздела новостей",
  newsGalleryTitle: "Заголовок фотогалереи",
  contactTitle: "Заголовок контактной информации",
  footerCopyright: "Текст об авторских правах",
  mapLink: "Текст ссылки на карту",
  aboutKicker: "Надзаголовок раздела «Об институте»",
  leadersKicker: "Надзаголовок раздела руководителей",
  leadersTitle: "Заголовок периодов руководства",
  historyKicker: "Надзаголовок раздела истории",
  historyTitle: "Заголовок истории",
  areasKicker: "Надзаголовок направлений",
  areasTitle: "Заголовок направлений деятельности",
  projectsKicker: "Надзаголовок проектов",
  projectsTitle: "Заголовок проектов",
  projectsDescription: "Описание фотогалереи проектов",
  servicesKicker: "Надзаголовок услуг",
  servicesTitle: "Заголовок услуг",
  servicesDescription: "Описание услуг",
  inspectionKicker: "Надзаголовок технического обследования",
  inspectionReasonsTitle: "Заголовок причин обследования",
  inspectionStepsTitle: "Заголовок этапов работ",
  inspectionInstrumentsTitle: "Заголовок оборудования",
  inspectionReportTitle: "Заголовок технического заключения",
  laboratoryKicker: "Надзаголовок лаборатории",
  laboratoryMaterialsTitle: "Заголовок испытуемых материалов",
  standardsKicker: "Надзаголовок науки и нормирования",
  trainingKicker: "Надзаголовок учебного центра",
  trainingCoursesTitle: "Заголовок учебных курсов",
  digitalKicker: "Надзаголовок цифрового раздела",
  printingKicker: "Надзаголовок издательского центра",
  newsKicker: "Надзаголовок новостей",
  allNewsLink: "Ссылка на все новости",
  newsGalleryKicker: "Надзаголовок фотогалереи",
  contactKicker: "Надзаголовок контактов",
  founderPrefix: "Подпись перед названием учредителя",
  countryName: "Название страны",
  governmentLink: "Название ссылки на Комитет",
  governmentUrl: "Адрес сайта Комитета",
  navAbout: "Меню: об институте",
  navHistory: "Меню: история",
  navAreas: "Меню: направления",
  navServices: "Меню: услуги",
  navNews: "Меню: новости",
  navContact: "Меню: контакты",
  registryLink: "Ссылка на реестр",
  brandAriaLabel: "Описание ссылки на реестр сертификатов",
  navAriaLabel: "Описание главного меню",
  heroRegistryButton: "Кнопка проверки сертификата",
  heroAboutButton: "Кнопка информации об институте",
  heroArtLabel: "Подпись к изображению города",
  heroScrollLabel: "Описание кнопки перехода вниз",
  areasCount: "Нумерация направлений",
  footerRegistryLink: "Ссылка внизу страницы",
};

function getAdminAuth(): StoredAdminAuth {
  if (typeof window === "undefined") return null;
  if (authSnapshot !== undefined) return authSnapshot;
  try {
    const stored = JSON.parse(window.localStorage.getItem("gov_registry_auth") || "null") as {
      token?: string;
      user?: { role?: string };
    } | null;
    authSnapshot = stored?.user ? { user: stored.user } : null;
    if (stored?.token && authSnapshot) {
      window.localStorage.setItem("gov_registry_auth", JSON.stringify(authSnapshot));
    }
  } catch {
    authSnapshot = null;
  }
  return authSnapshot;
}

function subscribeToAdminAuth(listener: () => void) {
  authListeners.add(listener);
  const handleChange = () => {
    authSnapshot = undefined;
    authListeners.forEach((current) => current());
  };
  window.addEventListener("storage", handleChange);
  window.addEventListener("gov-registry-auth", handleChange);
  return () => {
    authListeners.delete(listener);
    window.removeEventListener("storage", handleChange);
    window.removeEventListener("gov-registry-auth", handleChange);
  };
}

function createItem(section: string, index: number): ContentItem {
  if (photoSections.has(section)) {
    return { src: "", type: "image", alt: "", caption: "", description: "", document: false, orientation: "wide" };
  }
  if (section === "leaders") {
    return {
      name: "",
      role: "Директор",
      years: "",
      note: "",
      photo: { src: "", type: "image", alt: "", caption: "", description: "", orientation: "portrait" },
    };
  }
  if (section === "focusAreas") {
    return { number: String(index + 1).padStart(2, "0"), title: "", description: "" };
  }
  if (section === "services") {
    return { icon: "Landmark", title: "", description: "", href: "#", action: "" };
  }
  if (section === "contacts") return { kind: "Phone", label: "", href: "tel:" };
  if (section === "contactInfo") return { address: "", founder: "", mapUrl: "" };
  if (section === "siteCopy") return { heroTitle: "", heroLead: "", aboutTitle: "", aboutParagraph1: "" };
  return "";
}

function updateAtPath(
  item: Record<string, unknown>,
  path: string[],
  value: string | boolean,
): Record<string, unknown> {
  const [key, ...remaining] = path;
  if (!key) return item;
  if (remaining.length === 0) return { ...item, [key]: value };
  const nested = item[key];
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) return item;
  return {
    ...item,
    [key]: updateAtPath(nested as Record<string, unknown>, remaining, value),
  };
}

function addMediaFields(item: ContentItem): ContentItem {
  if (typeof item === "string") return item;
  const normalized: Record<string, unknown> = { ...item };
  for (const [key, value] of Object.entries(normalized)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      normalized[key] = addMediaFields(value as Record<string, unknown>);
    }
  }
  if (typeof normalized.src === "string") {
    normalized.type = normalized.type === "video" ? "video" : "image";
    normalized.description = typeof normalized.description === "string" ? normalized.description : "";
  }
  return normalized;
}

function MediaSourceEditor({
  value,
  mediaType,
  language,
  onChange,
  onUploadChange,
}: {
  value: string;
  mediaType: unknown;
  language: "tg" | "ru";
  onChange: (source: string, type?: "image" | "video") => void;
  onUploadChange: (pending: boolean) => void;
}) {
  const isRussian = language === "ru";
  const [mode, setMode] = useState<"web" | "device">(
    value.startsWith("http://") || value.startsWith("https://") || !value ? "web" : "device",
  );
  const isVideo = mediaType === "video";

  return (
    <Box className="portal-media-source">
      <Box className="portal-media-source__switch" role="group" aria-label={isRussian ? "Источник медиа" : "Манбаи медиа"}>
        <Button
          size="small"
          variant={mode === "web" ? "contained" : "outlined"}
          startIcon={<LinkOutlined />}
          onClick={() => setMode("web")}
        >
          {isRussian ? "Ссылка из интернета" : "Истинод аз интернет"}
        </Button>
        <Button
          size="small"
          variant={mode === "device" ? "contained" : "outlined"}
          startIcon={<CloudUploadOutlined />}
          onClick={() => setMode("device")}
        >
          {isRussian ? "Файл с устройства" : "Файл аз дастгоҳ"}
        </Button>
      </Box>
      {mode === "web" ? (
        <TextField
          label={isRussian ? "Адрес фото или видео" : "Суроғаи акс ё видео"}
          placeholder="https://example.com/media.jpg"
          type="url"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          fullWidth
          size="small"
          helperText={isRussian ? "Укажите прямую ссылку, начинающуюся с http:// или https://" : "Истиноди мустақимро бо http:// ё https:// ворид кунед"}
        />
      ) : (
        <Button className="portal-media-source__upload" component="label" variant="outlined" startIcon={<CloudUploadOutlined />}>
          {isRussian ? `Выбрать ${isVideo ? "видео" : "фото или видео"} с устройства` : `Интихоби ${isVideo ? "видео" : "акс ё видео"} аз дастгоҳ`}
          <input
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              onUploadChange(true);
              try {
                const uploaded = await uploadMediaFile(file);
                onChange(uploaded.src, uploaded.type);
              } catch (uploadError) {
                window.alert(uploadError instanceof Error ? uploadError.message : isRussian ? "Не удалось загрузить файл." : "Файлро бор кардан нашуд.");
              } finally {
                onUploadChange(false);
                event.target.value = "";
              }
            }}
          />
        </Button>
      )}
      {value && (
        <Box className="portal-media-source__preview">
          {isVideo
            ? <video src={value} controls playsInline preload="metadata" />
            : <Image src={value} alt="" width={360} height={180} unoptimized />}
          <Typography variant="caption" title={value}>{value}</Typography>
        </Box>
      )}
    </Box>
  );
}

function hasInvalidMediaSource(items: ContentItem[]): boolean {
  const inspect = (value: ContentItem | Record<string, unknown>): boolean => {
    if (typeof value === "string") return false;
    return Object.entries(value).some(([key, child]) => {
      if (key === "src" && typeof child === "string" && child.trim() && !isAllowedMediaUrl(child)) return true;
      if (child && typeof child === "object") {
        if (Array.isArray(child)) return child.some((entry) => entry && typeof entry === "object" && inspect(entry as Record<string, unknown>));
        return inspect(child as Record<string, unknown>);
      }
      return false;
    });
  };
  return items.some((item) => inspect(item));
}

function renderFields(
  value: Record<string, unknown>,
  update: (path: string[], next: string | boolean) => void,
  language: "tg" | "ru",
  onUploadChange: (pending: boolean) => void,
  path: string[] = [],
): ReactNode {
  return Object.entries(value).map(([key, fieldValue]) => {
    const fieldPath = [...path, key];
    const fieldKey = fieldPath.join(".");
    if (typeof fieldValue === "boolean") {
      return (
        <FormControlLabel
          key={fieldKey}
          control={<Checkbox checked={fieldValue} onChange={(event) => update(fieldPath, event.target.checked)} />}
          label={(language === "ru" ? russianFieldLabels[key] : undefined) || key}
        />
      );
    }
    if (typeof fieldValue === "string" || typeof fieldValue === "number") {
      const isLong = ["description", "caption", "note", "alt", "content"].includes(key) ||
        (typeof fieldValue === "string" && fieldValue.length > 100);
      if (key === "type") {
        return (
          <TextField
            select
            key={fieldKey}
            label={(language === "ru" ? russianFieldLabels[key] : undefined) || fieldLabels[key]}
            value={fieldValue}
            onChange={(event) => update(fieldPath, event.target.value)}
            fullWidth
            size="small"
          >
            <MenuItem value="image">{language === "ru" ? "Изображение" : "Акс"}</MenuItem>
            <MenuItem value="video">{language === "ru" ? "Видео со звуком" : "Видео бо садо"}</MenuItem>
          </TextField>
        );
      }
      if (key === "src") {
        return (
          <Box key={fieldKey} sx={{ gridColumn: "1 / -1" }}>
            <MediaSourceEditor
              value={String(fieldValue)}
              mediaType={value.type}
              language={language}
              onChange={(source, type) => {
                update(fieldPath, source);
                if (type) update([...fieldPath.slice(0, -1), "type"], type);
              }}
              onUploadChange={onUploadChange}
            />
          </Box>
        );
      }
      return (
        <Box key={fieldKey} sx={{ gridColumn: isLong ? "1 / -1" : undefined }}>
          <TextField
            label={(language === "ru" ? russianFieldLabels[key] : undefined) || fieldLabels[key] || key}
            value={fieldValue}
            onChange={(event) => update(fieldPath, event.target.value)}
            multiline={isLong}
            minRows={isLong ? 2 : undefined}
            fullWidth
            size="small"
          />
        </Box>
      );
    }
    if (fieldValue && typeof fieldValue === "object" && !Array.isArray(fieldValue)) {
      return (
        <Box key={fieldKey} sx={{ gridColumn: "1 / -1", p: 1.5, border: "1px solid #e3ebf2", borderRadius: 2 }}>
          <Typography variant="caption" sx={{ display: "block", mb: 1, fontWeight: 800, textTransform: "capitalize" }}>
            {fieldLabels[key] || key}
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
            {renderFields(fieldValue as Record<string, unknown>, update, language, onUploadChange, fieldPath)}
          </Box>
        </Box>
      );
    }
    return null;
  });
}

export default function SiteContentManager({
  content,
  language,
  onSaved,
}: {
  content: Record<string, unknown[]>;
  language: "tg" | "ru";
  onSaved: (section: string, items: ContentItem[]) => void;
}) {
  const auth = useSyncExternalStore(subscribeToAdminAuth, getAdminAuth, () => null);
  const isAdmin = auth?.user?.role === "admin";
  const [section, setSection] = useState("services");
  const [draftsBySection, setDraftsBySection] = useState<Record<string, ContentItem[]>>({});
  const [showManager, setShowManager] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const sections = Object.entries(sectionLabels);
  const sectionKey = language === "ru" ? `${section}Ru` : section;
  const sourceItems = ((content[sectionKey] || []) as ContentItem[]).map(addMediaFields);
  const drafts = draftsBySection[sectionKey] ?? sourceItems;
  const setDrafts = (update: (current: ContentItem[]) => ContentItem[]) => {
    setDraftsBySection((current) => ({
      ...current,
      [sectionKey]: update(current[sectionKey] ?? sourceItems),
    }));
  };

  if (!isAdmin) return null;

  const updateItem = (index: number, path: string[], value: string | boolean) => {
    setDrafts((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index || typeof item === "string") return item;
      return updateAtPath(item, path, value);
    }));
  };

  const saveSection = async () => {
    if (hasInvalidMediaSource(drafts)) {
      setError(language === "ru"
        ? "Укажите действительную ссылку http(s) или выберите файл с устройства."
        : "Суроғаи дурусти http(s)-ро ворид кунед ё файлро аз дастгоҳ интихоб намоед.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_BASE}/site-content/${sectionKey}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items: drafts }),
      });
      if (!response.ok) {
        const body = await response.text();
        let detail = body;
        try {
          detail = (JSON.parse(body) as { detail?: string }).detail || body;
        } catch {
          // Keep the API response when it is not JSON.
        }
        throw new Error(detail || `Содержимое не сохранено (${response.status})`);
      }
      onSaved(sectionKey, drafts);
      setDraftsBySection((current) => ({ ...current, [sectionKey]: drafts }));
      setNotice(language === "ru" ? "Изменения сохранены и опубликованы на сайте." : "Тағйирот сабт шуд ва дар сомона нашр гардид.");
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : language === "ru" ? "Не удалось сохранить содержимое." : "Содержимое не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper className="portal-content-manager">
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, gap: 2 }}>
        <Box>
          <Typography variant="overline">{language === "ru" ? "ПАНЕЛЬ АДМИНИСТРАТОРА" : "ПАНЕЛЬ АДМИНИСТРАТОР"}</Typography>
          <Typography variant="h6">{language === "ru" ? "Управление содержимым сайта" : "Идоракунии ҳамаи маълумоти сомона"}</Typography>
          <Typography variant="body2">{language === "ru" ? "Редактируйте тексты, руководителей, направления, услуги, галереи и контакты." : "Роҳбарон, самтҳо, хизматрасониҳо, галереяҳо ва маълумоти бахшҳоро таҳрир кунед."}</Typography>
        </Box>
        <Button variant="contained" onClick={() => setShowManager((value) => !value)}>
          {showManager ? language === "ru" ? "Закрыть" : "Пӯшидан" : language === "ru" ? "Управление содержимым" : "Идоракунии муҳтаво"}
        </Button>
      </Stack>

      {showManager && (
        <Box className="portal-content-manager__body">
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
          <TextField
            select
            label={language === "ru" ? "Раздел сайта" : "Бахши сомона"}
            value={section}
            onChange={(event) => setSection(event.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          >
            {sections.map(([key, label]) => (
              <MenuItem key={key} value={key}>
                {language === "ru" ? russianSectionLabels[key] : label} ({(content[language === "ru" ? `${key}Ru` : key] || []).length})
              </MenuItem>
            ))}
          </TextField>

          {section === "services" && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
              {language === "ru"
                ? "Управляйте карточками услуг института: названием, описанием, значком и ссылкой. Сохранённые изменения сразу отображаются в разделе «Услуги» на сайте."
                : "Карточкаҳои хизматрасонии пажӯҳишгоҳро идора кунед: ном, тавсиф, нишона ва истинодро тағйир диҳед. Баъди сабт хизматрасониҳо дар бахши «Хизматрасониҳо»-и сомона намоён мешаванд."}
            </Alert>
          )}

          <Stack spacing={1.5}>
            {drafts.map((item, index) => (
              <Paper className="portal-content-manager__item" key={`${section}-${index}`}>
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{language === "ru" ? `Элемент ${index + 1}` : `Элемент ${index + 1}`}</Typography>
                  <Stack direction="row" spacing={0.5}>
                    <Button
                      aria-label="Ба боло кӯчондан"
                      size="small"
                      disabled={index === 0}
                      onClick={() => setDrafts((current) => current.map((value, itemIndex) => itemIndex === index - 1 ? current[index] : itemIndex === index ? current[index - 1] : value))}
                    >
                      <ArrowUpward fontSize="small" />
                    </Button>
                    <Button
                      aria-label="Ба поён кӯчондан"
                      size="small"
                      disabled={index === drafts.length - 1}
                      onClick={() => setDrafts((current) => current.map((value, itemIndex) => itemIndex === index + 1 ? current[index] : itemIndex === index ? current[index + 1] : value))}
                    >
                      <ArrowDownward fontSize="small" />
                    </Button>
                    <Button
                      color="error"
                      size="small"
                      startIcon={<DeleteOutlined />}
                      disabled={(section === "siteCopy" || section === "contactInfo") && drafts.length === 1}
                      onClick={() => setDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      {language === "ru" ? "Удалить" : "Нест кардан"}
                    </Button>
                  </Stack>
                </Stack>
                {typeof item === "string" ? (
                  <TextField
                    value={item}
                    onChange={(event) => setDrafts((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))}
                    multiline
                    minRows={2}
                    fullWidth
                    size="small"
                    label={language === "ru" ? "Текст" : "Матн"}
                  />
                ) : (
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
                    {renderFields(
                      item,
                      (path, value) => updateItem(index, path, value),
                      language,
                      (pending) => setPendingUploads((count) => Math.max(0, count + (pending ? 1 : -1))),
                    )}
                  </Box>
                )}
              </Paper>
            ))}
            {drafts.length === 0 && (
              <Alert severity="info">{language === "ru" ? "В этом разделе пока нет данных." : "Дар ин бахш ҳоло маълумот нест."}</Alert>
            )}
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ justifyContent: "space-between", mt: 2 }}>
            {!["siteCopy", "contactInfo"].includes(section) && (
              <Button
                variant="outlined"
                startIcon={<EditOutlined />}
                onClick={() => setDrafts((current) => [...current, createItem(section, current.length)])}
              >
                {language === "ru" ? "Добавить элемент" : "Илова кардани элемент"}
              </Button>
            )}
            <Button variant="contained" startIcon={<SaveOutlined />} onClick={() => void saveSection()} disabled={saving || pendingUploads > 0}>
              {pendingUploads > 0
                ? language === "ru" ? "Загрузка файла..." : "Файл бор шуда истодааст..."
                : saving ? language === "ru" ? "Сохранение..." : "Сабт шуда истодааст..." : language === "ru" ? "Сохранить и опубликовать" : "Сабт ва нашр"}
            </Button>
          </Stack>
        </Box>
      )}
    </Paper>
  );
}
