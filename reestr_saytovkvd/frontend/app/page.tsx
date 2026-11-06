"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE } from "./api-config";
import SiteNavigation from "./site-navigation";
import SiteFooter from "./site-footer";
import DashboardSidebar from "./dashboard-sidebar";
import AdminSiteContent from "./admin-site-content";
import {
  getAdminSectionSnapshot,
  notifyAdminSectionChange,
  subscribeToAdminSection,
  type AdminSection,
} from "./admin-section";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import type { AlertColor } from "@mui/material";
import {
  Badge,
  Business,
  CheckCircle,
  CancelOutlined,
  DeleteOutlined,
  Download,
  EditOutlined,
  ExitToApp,
  Lock,
  PictureAsPdf,
  QrCode,
  Search,
  ShieldOutlined,
  Visibility,
} from "@mui/icons-material";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Clock3,
  Database,
  Eye,
  EyeOff,
  FileText,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";

type Role = "admin" | "applicant";
type Status = "pending" | "published" | "revoked" | "rejected";

type User = {
  id: string;
  code: string;
  role: Role;
  name: string;
};

type Certificate = {
  id: string;
  fullName: string;
  birthDate: string;
  workplace: string;
  position: string;
  specialty: string;
  trainingType: string;
  trainingCenter: string;
  courseName: string;
  startDate: string;
  endDate: string;
  hours: string;
  result: string;
  regNumber: string;
  certificateDate: string;
  validityPeriod: string;
  status: Status;
  approved: boolean;
  publicationDate?: string;
  qrUrl: string;
  comments: string;
};

type AuditEntry = {
  id: string;
  message: string;
  created_at: string;
};

type NewsItem = {
  id: string;
  title: string;
  category: string;
  content: string;
  images?: string[];
  published_at: string;
  created_by?: string;
  created_at?: string;
};

type DashboardData = {
  total: number;
  active: number;
  revoked: number;
  applicants: number;
  years: Record<string, number>;
  products: Record<string, number>;
};

type CertificatePageResponse = {
  items: Record<string, unknown>[];
  total: number;
  counts: Record<Status, number>;
};

const CERTIFICATES_PER_PAGE = 25;

type FormState = {
  registrationNumber: string;
  fullName: string;
  birthDate: string;
  workplace: string;
  position: string;
  specialty: string;
  trainingType: string;
  trainingCenter: string;
  courseName: string;
  startDate: string;
  endDate: string;
  hours: string;
  result: string;
  certificateDate: string;
  validityPeriod: string;
  comments: string;
};

const AUTH_KEY = "gov_registry_auth";

type StoredAuth = { user: User };

function getVerificationUrl(record: Certificate) {
  const base = API_BASE.replace(/\/+$/, "");
  const apiBase = base.startsWith("/") && typeof window !== "undefined" ? `${window.location.origin}${base}` : base;
  const id = encodeURIComponent(record.id);
  const number = encodeURIComponent(record.regNumber);
  return `${apiBase}/certificates/verify/${id}?number=${number}`;
}

let authSnapshot: StoredAuth | null | undefined;
const authListeners = new Set<() => void>();

function getAuthSnapshot(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  if (authSnapshot !== undefined) return authSnapshot;

  const raw = window.localStorage.getItem(AUTH_KEY);
  if (!raw) {
    authSnapshot = null;
    return authSnapshot;
  }

  try {
    const parsed = JSON.parse(raw) as { token?: string; user?: User };
    if (parsed.user?.id && (parsed.user.role === "admin" || parsed.user.role === "applicant")) {
      authSnapshot = { user: parsed.user };
      if (parsed.token) window.localStorage.setItem(AUTH_KEY, JSON.stringify(authSnapshot));
    } else {
      window.localStorage.removeItem(AUTH_KEY);
      authSnapshot = null;
    }
  } catch {
    window.localStorage.removeItem(AUTH_KEY);
    authSnapshot = null;
  }
  return authSnapshot;
}

function subscribeToAuth(listener: () => void) {
  authListeners.add(listener);
  const handleStorage = () => {
    authSnapshot = undefined;
    listener();
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    authListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function storeAuth(value: StoredAuth | null) {
  if (value) window.localStorage.setItem(AUTH_KEY, JSON.stringify(value));
  else window.localStorage.removeItem(AUTH_KEY);
  authSnapshot = value;
  window.dispatchEvent(new Event("gov-registry-auth"));
  authListeners.forEach((listener) => listener());
}

const initialForm: FormState = {
  registrationNumber: "",
  fullName: "",
  birthDate: "",
  workplace: "",
  position: "",
  specialty: "",
  trainingType: "Первоначальное обучение",
  trainingCenter: "",
  courseName: "",
  startDate: "",
  endDate: "",
  hours: "",
  result: "Сдал успешно",
  certificateDate: "",
  validityPeriod: "",
  comments: "",
};

const roleLabels: Record<Role, string> = {
  admin: "Администратор",
  applicant: "Заявитель",
};

const statusLabels: Record<Status, string> = {
  pending: "На утверждении",
  published: "Опубликован",
  revoked: "Аннулирован",
  rejected: "Отклонена",
};

const companyHighlights = [
  { title: "О нас", text: "Пажӯҳишгоҳи илмию тадқиқотии сохтмон ва меъморӣ — научно-исследовательский центр по строительству, архитектуре, проектированию и технической экспертизе." },
  { title: "Лаборатория", text: "В составе центра действует лаборатория испытаний материалов, контроль качества и технической диагностики объектов." },
  { title: "Реестры", text: "Проводится электронный учёт аттестации, сертификатов, квалификации специалистов и проверок качества." },
  { title: "Поддержка", text: "Для заявителей и организаций предусмотрены консультации, регистрация и проверка документов в едином порядке." },
];

function normalizeCertificate(item: Record<string, unknown>): Certificate {
  const getString = (...values: unknown[]) => {
    const value = values.find((candidate) => typeof candidate === "string" || typeof candidate === "number");
    return value == null ? "" : String(value);
  };
  const status = item.status;

  return {
    id: getString(item.id),
    fullName: getString(item.full_name, item.fullName),
    birthDate: getString(item.birth_date, item.birthDate),
    workplace: getString(item.workplace),
    position: getString(item.position),
    specialty: getString(item.specialty),
    trainingType: getString(item.training_type, item.trainingType),
    trainingCenter: getString(item.training_center, item.trainingCenter),
    courseName: getString(item.course_name, item.courseName),
    startDate: getString(item.start_date, item.startDate),
    endDate: getString(item.end_date, item.endDate),
    hours: getString(item.hours),
    result: getString(item.result),
    regNumber: getString(item.registration_number, item.regNumber),
    certificateDate: getString(item.certificate_date, item.certificateDate),
    validityPeriod: getString(item.validity_period, item.validityPeriod),
    status: status === "published" || status === "revoked" || status === "rejected" ? status : "pending",
    approved: item.approved === true || item.approved === 1,
    publicationDate: getString(item.publication_date, item.publicationDate) || undefined,
    qrUrl: "",
    comments: getString(item.comments),
  };
}

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

async function createQrDataUrl(record: Certificate) {
  const QRCode = await import("qrcode");
  return QRCode.toDataURL(getVerificationUrl(record), {
    margin: 1,
    width: 220,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (let word of words) {
    while (word) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth) {
        line = candidate;
        word = "";
      } else if (line) {
        lines.push(line);
        line = "";
      } else {
        const characters = Array.from(word);
        let chunk = "";
        let count = 0;
        while (count < characters.length && context.measureText(chunk + characters[count]).width <= maxWidth) {
          chunk += characters[count];
          count += 1;
        }
        if (count === 0) count = 1;
        lines.push(characters.slice(0, count).join(""));
        word = characters.slice(count).join("");
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const lines = wrapCanvasText(context, text, maxWidth);
  lines.forEach((value, index) => context.fillText(value, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

async function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось загрузить изображение для PDF"));
    image.src = source;
  });
}

async function createCertificatePdfPage(record: Certificate) {
  const qrDataUrl = record.qrUrl || (await createQrDataUrl(record));
  const qrImage = await loadImage(qrDataUrl);
  const logo = await loadImage("/company-logo.jpg");
  const pages: HTMLCanvasElement[] = [];
  const createPage = (continuation: boolean) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 2263;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Не удалось подготовить страницу PDF");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#f3f6f9";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const headerHeight = continuation ? 250 : 400;
    const gradient = context.createLinearGradient(0, 0, canvas.width, headerHeight);
    gradient.addColorStop(0, "#082b43");
    gradient.addColorStop(0.58, "#0b5d83");
    gradient.addColorStop(1, "#168a8a");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, headerHeight);
    context.fillStyle = "#d6b66f";
    context.fillRect(90, headerHeight - 4, 190, 5);

    if (continuation) {
      context.fillStyle = "#b9e4dc";
      context.font = "bold 22px Arial, sans-serif";
      context.fillText("ЭЛЕКТРОННЫЙ РЕЕСТР СЕРТИФИКАТОВ", 90, 75);
      context.fillStyle = "#ffffff";
      context.font = "bold 40px Arial, sans-serif";
      context.fillText("Продолжение сведений", 90, 145);
      context.font = "24px Arial, sans-serif";
      context.fillText(`Регистрационный номер: ${record.regNumber}`, 90, 205);
      pages.push(canvas);
      return { canvas, context, y: 300 };
    }

    context.save();
    context.beginPath();
    context.arc(190, 150, 94, 0, Math.PI * 2);
    context.clip();
    context.drawImage(logo, 96, 56, 188, 188);
    context.restore();
    context.strokeStyle = "rgba(255,255,255,0.65)";
    context.lineWidth = 4;
    context.beginPath();
    context.arc(190, 150, 94, 0, Math.PI * 2);
    context.stroke();

    context.fillStyle = "#ffffff";
    context.font = "bold 24px Arial, sans-serif";
    context.fillText("ЭЛЕКТРОННЫЙ РЕЕСТР СЕРТИФИКАТОВ", 330, 87);
    context.font = "bold 42px Arial, sans-serif";
    context.fillText("СВЕДЕНИЯ О СЕРТИФИКАТЕ", 330, 150);
    context.font = "bold 34px Arial, sans-serif";
    context.fillText(`Рег. номер: ${record.regNumber}`, 330, 222);
    context.font = "27px Arial, sans-serif";
    context.fillText(`Статус: ${statusLabels[record.status]}`, 330, 278);

    context.fillStyle = "#ffffff";
    context.fillRect(90, 330, 1420, 235);
    context.fillStyle = "#0b5d83";
    context.fillRect(90, 330, 10, 235);
    context.fillStyle = "#65788a";
    context.font = "bold 22px Arial, sans-serif";
    context.fillText("СПЕЦИАЛИСТ", 130, 382);
    context.fillStyle = "#17344a";
    context.font = "bold 48px Arial, sans-serif";
    drawWrappedText(context, record.fullName || "—", 130, 452, 1070, 58);
    context.fillStyle = "#65788a";
    context.font = "23px Arial, sans-serif";
    context.fillText(record.specialty || "Сведения о квалификации", 130, 525);
    context.drawImage(qrImage, 1285, 345, 190, 190);

    pages.push(canvas);
    return { canvas, context, y: 620 };
  };
  let page = createPage(false);

  const fields: Array<[string, string]> = [
    ["ФИО", record.fullName],
    ["Дата рождения", formatDate(record.birthDate)],
    ["Место работы", record.workplace],
    ["Должность", record.position],
    ["Специальность", record.specialty],
    ["Тип обучения", record.trainingType],
    ["Учебный центр", record.trainingCenter],
    ["Название курса", record.courseName],
    ["Дата начала обучения", formatDate(record.startDate)],
    ["Дата окончания обучения", formatDate(record.endDate)],
    ["Количество часов", record.hours],
    ["Результат", record.result],
    ["Дата выдачи сертификата", formatDate(record.certificateDate)],
    ["Срок действия", record.validityPeriod],
    ["Дата публикации", formatDate(record.publicationDate)],
    ["Комментарии", record.comments],
  ];

  for (const [label, rawValue] of fields) {
    const value = rawValue || "—";
    page.context.font = "30px Arial, sans-serif";
    const lines = wrapCanvasText(page.context, value, 1320);
    const cardHeight = Math.max(106, 57 + lines.length * 38);
    if (page.y + cardHeight > page.canvas.height - 150) page = createPage(true);

    page.context.fillStyle = "#ffffff";
    page.context.fillRect(90, page.y, 1420, cardHeight - 10);
    page.context.fillStyle = "#0b5d83";
    page.context.fillRect(90, page.y, 7, cardHeight - 10);
    page.context.fillStyle = "#718293";
    page.context.font = "bold 21px Arial, sans-serif";
    page.context.fillText(label.toLocaleUpperCase("ru-RU"), 125, page.y + 32);
    page.context.fillStyle = "#17344a";
    page.context.font = "30px Arial, sans-serif";
    lines.forEach((text, index) => page.context.fillText(text, 125, page.y + 70 + index * 38));
    page.y += cardHeight;
  }

  return pages.map((canvas, index) => {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Не удалось подготовить страницу PDF");
    context.fillStyle = "#dce5eb";
    context.fillRect(90, canvas.height - 110, 1420, 2);
    context.fillStyle = "#718293";
    context.font = "20px Arial, sans-serif";
    context.fillText(`Проверка сертификата: ${record.regNumber}`, 90, canvas.height - 65);
    context.textAlign = "right";
    context.fillText(`Страница ${index + 1} из ${pages.length}`, 1510, canvas.height - 65);
    context.textAlign = "left";
    return canvas.toDataURL("image/jpeg", 0.96);
  });
}

async function downloadCertificatePdf(records: Certificate[], filename: string) {
  if (records.length === 0) throw new Error("Нет записей для экспорта");
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let pageCount = 0;
  for (const record of records) {
    const recordPages = await createCertificatePdfPage(record);
    for (const page of recordPages) {
      if (pageCount > 0) doc.addPage();
      doc.addImage(page, "JPEG", 0, 0, 210, 297);
      pageCount += 1;
    }
  }
  doc.save(filename);
}

async function downloadRegistryPdf(records: Certificate[], filename: string) {
  if (records.length === 0) throw new Error("Нет записей для экспорта");

  const { jsPDF } = await import("jspdf");
  const logo = await loadImage("/company-logo.jpg");
  const pageWidth = 1600;
  const pageHeight = 2263;
  const margin = 90;
  const tableWidth = pageWidth - margin * 2;
  const columnWidths = [70, 235, 320, 420, 160, 215];
  const columns = ["№", "Регистрационный №", "ФИО / место работы", "Курс", "Дата выдачи", "Статус"];
  const pages: string[] = [];
  type PdfPage = { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; y: number };
  let page: PdfPage | null = null;

  const finalizePage = (currentPage: PdfPage) => {
    currentPage.context.fillStyle = "#dce5eb";
    currentPage.context.fillRect(margin, 2140, tableWidth, 2);
    currentPage.context.fillStyle = "#718293";
    currentPage.context.font = "20px Arial, sans-serif";
    currentPage.context.fillText("Электронный реестр сертификатов", margin, 2185);
    currentPage.context.textAlign = "right";
    currentPage.context.fillText(`Страница ${pages.length + 1}`, pageWidth - margin, 2185);
    currentPage.context.textAlign = "left";
    pages.push(currentPage.canvas.toDataURL("image/jpeg", 0.94));
  };

  const createPage = (firstPage: boolean) => {
    if (page) finalizePage(page);
    const canvas = document.createElement("canvas");
    canvas.width = pageWidth;
    canvas.height = pageHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Не удалось подготовить страницу PDF");

    context.fillStyle = "#f3f6f9";
    context.fillRect(0, 0, pageWidth, pageHeight);

    if (firstPage) {
      const gradient = context.createLinearGradient(0, 0, pageWidth, 350);
      gradient.addColorStop(0, "#082b43");
      gradient.addColorStop(0.58, "#0b5d83");
      gradient.addColorStop(1, "#168a8a");
      context.fillStyle = gradient;
      context.fillRect(0, 0, pageWidth, 350);
      context.fillStyle = "#d6b66f";
      context.fillRect(margin, 322, 190, 5);
      context.fillStyle = "#b9e4dc";
      context.font = "bold 23px Arial, sans-serif";
      context.fillText("ЭЛЕКТРОННЫЙ РЕЕСТР · ОТЧЁТ", margin, 78);
      context.fillStyle = "#ffffff";
      context.font = "bold 66px Arial, sans-serif";
      context.fillText("Реестр сертификатов", margin, 174);
      context.fillStyle = "rgba(255,255,255,0.82)";
      context.font = "28px Arial, sans-serif";
      context.fillText("Сведения о квалификации и прохождении обучения", margin, 235);
      context.font = "22px Arial, sans-serif";
      context.fillText(`Сформировано: ${new Date().toLocaleString("ru-RU")}`, margin, 285);

      context.save();
      context.beginPath();
      context.arc(1410, 175, 102, 0, Math.PI * 2);
      context.clip();
      context.drawImage(logo, 1308, 73, 204, 204);
      context.restore();
      context.strokeStyle = "rgba(255,255,255,0.65)";
      context.lineWidth = 4;
      context.beginPath();
      context.arc(1410, 175, 102, 0, Math.PI * 2);
      context.stroke();

      const metrics = [
        { label: "ЗАПИСЕЙ В ОТЧЁТЕ", value: String(records.length), color: "#0c5d85" },
        { label: "ОПУБЛИКОВАНО", value: String(records.filter((item) => item.status === "published").length), color: "#168364" },
        { label: "НА ПРОВЕРКЕ / АННУЛИРОВАНО", value: String(records.filter((item) => item.status !== "published").length), color: "#b7791f" },
      ];
      const gap = 24;
      const cardWidth = (tableWidth - gap * 2) / 3;
      metrics.forEach((metric, index) => {
        const x = margin + index * (cardWidth + gap);
        context.fillStyle = "#ffffff";
        context.fillRect(x, 390, cardWidth, 145);
        context.fillStyle = metric.color;
        context.fillRect(x, 390, 8, 145);
        context.fillStyle = "#65788a";
        context.font = "bold 18px Arial, sans-serif";
        context.fillText(metric.label, x + 28, 430);
        context.fillStyle = metric.color;
        context.font = "bold 48px Arial, sans-serif";
        context.fillText(metric.value, x + 28, 495);
      });

      context.fillStyle = "#17344a";
      context.font = "bold 30px Arial, sans-serif";
      context.fillText("Список сертификатов", margin, 590);
      context.fillStyle = "#708295";
      context.font = "21px Arial, sans-serif";
      context.fillText("Данные приведены в соответствии с выбранными фильтрами реестра", margin, 625);
      page = { canvas, context, y: 680 };
    } else {
      context.fillStyle = "#0b4563";
      context.fillRect(0, 0, pageWidth, 200);
      context.fillStyle = "#b9e4dc";
      context.font = "bold 20px Arial, sans-serif";
      context.fillText("ЭЛЕКТРОННЫЙ РЕЕСТР СЕРТИФИКАТОВ", margin, 72);
      context.fillStyle = "#ffffff";
      context.font = "bold 38px Arial, sans-serif";
      context.fillText("Продолжение списка", margin, 130);
      context.save();
      context.beginPath();
      context.arc(1410, 100, 68, 0, Math.PI * 2);
      context.clip();
      context.drawImage(logo, 1342, 32, 136, 136);
      context.restore();
      page = { canvas, context, y: 250 };
    }

    const newPage = page;
    const headerY = newPage.y;
    context.fillStyle = "#e3ebf0";
    context.fillRect(margin, headerY, tableWidth, 72);
    context.font = "bold 20px Arial, sans-serif";
    context.fillStyle = "#36546a";
    let x = margin;
    columns.forEach((label, index) => {
      const lines = wrapCanvasText(context, label, columnWidths[index] - 22);
      lines.forEach((line, lineIndex) => context.fillText(line, x + 12, headerY + 28 + lineIndex * 25));
      x += columnWidths[index];
    });
    newPage.y = headerY + 72;
    return newPage;
  };

  page = createPage(true);

  const truncateLines = (value: string, width: number, maxLines = 4) => {
    if (!page) throw new Error("Не удалось подготовить страницу PDF");
    const lines = wrapCanvasText(page.context, value, width);
    if (lines.length <= maxLines) return lines;
    return [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1].slice(0, -1)}…`];
  };

  records.forEach((record, index) => {
    const registrationLines = truncateLines(record.regNumber || "—", columnWidths[1] - 24, 3);
    const nameLines = truncateLines(record.fullName || "—", columnWidths[2] - 24, 3);
    const workplaceLines = record.workplace
      ? truncateLines(record.workplace, columnWidths[2] - 24, 2)
      : [];
    const courseLines = truncateLines(record.courseName || "—", columnWidths[3] - 24, 4);
    const dateLines = truncateLines(formatDate(record.certificateDate), columnWidths[4] - 24, 2);
    const statusLines = truncateLines(statusLabels[record.status], columnWidths[5] - 24, 2);
    const lineCount = Math.max(
      registrationLines.length,
      nameLines.length + workplaceLines.length,
      courseLines.length,
      dateLines.length,
      statusLines.length,
    );
    const rowHeight = Math.max(100, lineCount * 32 + 28);
    if (!page) throw new Error("Не удалось подготовить страницу PDF");
    if (page.y + rowHeight > pageHeight - 130) page = createPage(false);
    if (!page) throw new Error("Не удалось подготовить страницу PDF");

    const rowPage = page;
    const rowY = rowPage.y;
    rowPage.context.fillStyle = index % 2 === 0 ? "#ffffff" : "#f8fafc";
    rowPage.context.fillRect(margin, rowY, tableWidth, rowHeight);
    rowPage.context.strokeStyle = "#e3eaf0";
    rowPage.context.lineWidth = 2;
    rowPage.context.beginPath();
    rowPage.context.moveTo(margin, rowY + rowHeight);
    rowPage.context.lineTo(margin + tableWidth, rowY + rowHeight);
    rowPage.context.stroke();

    let x = margin;
    const textY = rowY + 20;
    rowPage.context.fillStyle = "#8494a2";
    rowPage.context.font = "bold 22px Arial, sans-serif";
    rowPage.context.fillText(String(index + 1), x + 12, textY);
    x += columnWidths[0];

    rowPage.context.fillStyle = "#0b5d83";
    rowPage.context.font = "bold 22px Arial, sans-serif";
    registrationLines.forEach((line, lineIndex) => rowPage.context.fillText(line, x + 12, textY + lineIndex * 32));
    x += columnWidths[1];

    rowPage.context.fillStyle = "#17344a";
    rowPage.context.font = "bold 23px Arial, sans-serif";
    nameLines.forEach((line, lineIndex) => rowPage.context.fillText(line, x + 12, textY + lineIndex * 31));
    rowPage.context.fillStyle = "#738596";
    rowPage.context.font = "19px Arial, sans-serif";
    workplaceLines.forEach((line, lineIndex) => {
      rowPage.context.fillText(line, x + 12, textY + (nameLines.length + lineIndex) * 29);
    });
    x += columnWidths[2];

    rowPage.context.fillStyle = "#40596c";
    rowPage.context.font = "21px Arial, sans-serif";
    courseLines.forEach((line, lineIndex) => rowPage.context.fillText(line, x + 12, textY + lineIndex * 32));
    x += columnWidths[3];

    rowPage.context.fillStyle = "#52677b";
    rowPage.context.font = "20px Arial, sans-serif";
    dateLines.forEach((line, lineIndex) => rowPage.context.fillText(line, x + 12, textY + lineIndex * 30));
    x += columnWidths[4];

    const statusColor = record.status === "published" ? "#168364" : record.status === "revoked" || record.status === "rejected" ? "#bd3e4c" : "#b7791f";
    const pillWidth = columnWidths[5] - 24;
    const pillHeight = Math.max(38, statusLines.length * 25 + 14);
    const pillY = rowY + (rowHeight - pillHeight) / 2;
    rowPage.context.fillStyle = record.status === "published" ? "#e1f3eb" : record.status === "revoked" || record.status === "rejected" ? "#fbe8e8" : "#fff3d8";
    rowPage.context.fillRect(x + 10, pillY, pillWidth, pillHeight);
    rowPage.context.fillStyle = statusColor;
    rowPage.context.font = "bold 18px Arial, sans-serif";
    statusLines.forEach((line, lineIndex) => rowPage.context.fillText(line, x + 20, pillY + 25 + lineIndex * 23));
    rowPage.y += rowHeight;
  });

  if (!page) throw new Error("Не удалось подготовить страницу PDF");
  finalizePage(page);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  pages.forEach((image, index) => {
    if (index > 0) doc.addPage();
    doc.addImage(image, "JPEG", 0, 0, 210, 297);
  });
  doc.save(filename);
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = { ...(options?.headers || {}) } as Record<string, string>;
  const response = await fetch(url, { ...options, credentials: "include", headers });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Ошибка запроса");
  }
  return response.json() as Promise<T>;
}

function certificatePageUrl(search: string, status: Status | "all", offset: number, limit: number) {
  const params = new URLSearchParams({
    search,
    offset: String(offset),
    limit: String(limit),
  });
  if (status !== "all") params.set("status", status);
  return `${API_BASE}/certificates?${params.toString()}`;
}

async function fetchAllFilteredCertificates(search: string, status: Status | "all") {
  const records: Certificate[] = [];
  let offset = 0;
  let total = 0;

  do {
    const page = await fetchJson<CertificatePageResponse>(
      certificatePageUrl(search, status, offset, 200),
    );
    if (page.items.length === 0) break;
    records.push(...page.items.map(normalizeCertificate));
    total = page.total;
    offset += page.items.length;
  } while (offset < total);

  return records;
}

export default function Home() {
  const router = useRouter();
  const auth = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, () => null);
  const adminSection = useSyncExternalStore(
    subscribeToAdminSection,
    getAdminSectionSnapshot,
    () => "overview" as AdminSection,
  );
  const user = auth?.user ?? null;
  const authUserId = auth?.user.id;
  const authUserRole = auth?.user.role;
  const authUserName = auth?.user.name;
  const isApplicant = user?.role === "applicant";
  const [loginCode, setLoginCode] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerCode, setRegisterCode] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [certificateTotal, setCertificateTotal] = useState(0);
  const [certificateCounts, setCertificateCounts] = useState<Record<Status, number>>({
    pending: 0,
    published: 0,
    revoked: 0,
    rejected: 0,
  });
  const [certificatePage, setCertificatePage] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingCertificateId, setEditingCertificateId] = useState<string | null>(null);
  const certificateFormRef = useRef<HTMLDivElement>(null);
  const [newsForm, setNewsForm] = useState({ title: "", category: "Новости", content: "" });
  const [newsImages, setNewsImages] = useState<string[]>([]);
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const newsFormRef = useRef<HTMLDivElement>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [notice, setNotice] = useState("");
  const [noticeSeverity, setNoticeSeverity] = useState<AlertColor>("success");
  const showNotice = (message: string, severity: AlertColor = "success") => {
    setNoticeSeverity(severity);
    setNotice(message);
  };

  useEffect(() => {
    if (!authUserId) return;
    let active = true;
    fetchJson<{ user: User }>(`${API_BASE}/me`)
      .then((data) => {
        if (
          active
          && (data.user.id !== authUserId || data.user.role !== authUserRole || data.user.name !== authUserName)
        ) {
          storeAuth({ user: data.user });
        }
      })
      .catch(() => {
        if (active) storeAuth(null);
      });
    return () => {
      active = false;
    };
  }, [authUserId, authUserName, authUserRole]);

  const requestData = async (includeAudit = false) => {
    const [dashboardData, auditData, newsData] = await Promise.all([
      includeAudit
        ? fetchJson<DashboardData>(`${API_BASE}/dashboard`)
        : Promise.resolve(null),
      includeAudit ? fetchJson<AuditEntry[]>(`${API_BASE}/audit`) : Promise.resolve([]),
      fetchJson<NewsItem[]>(`${API_BASE}/news`),
    ]);
    return {
      dashboardData,
      audit: includeAudit ? auditData : [],
      news: newsData,
    };
  };

  const requestCertificatePage = useCallback((
    page: number,
    query: string,
    filter: Status | "all",
    signal?: AbortSignal,
  ) => fetchJson<CertificatePageResponse>(
      certificatePageUrl(query, filter, page * CERTIFICATES_PER_PAGE, CERTIFICATES_PER_PAGE),
      signal ? { signal } : undefined,
    ), []);

  const applyData = useCallback((data: Awaited<ReturnType<typeof requestData>>) => {
    setDashboard(data.dashboardData);
    setAudit(data.audit);
    setNews(data.news);
  }, []);

  const applyCertificatePage = useCallback((data: CertificatePageResponse, page: number) => {
    setCertificates(data.items.map(normalizeCertificate));
    setCertificateTotal(data.total);
    setCertificateCounts(data.counts);
    const lastPage = Math.max(0, Math.ceil(data.total / CERTIFICATES_PER_PAGE) - 1);
    if (page > lastPage) setCertificatePage(lastPage);
  }, []);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const includeAdminData = getAuthSnapshot()?.user?.role === "admin";
      const [data, certificateData] = await Promise.all([
        requestData(includeAdminData),
        requestCertificatePage(certificatePage, debouncedSearch, statusFilter),
      ]);
      applyData(data);
      applyCertificatePage(certificateData, certificatePage);
    } catch (error) {
      console.error(error);
      showNotice((error as Error).message || "Не удалось загрузить данные", "error");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    let active = true;

    requestData(user?.role === "admin")
      .then((data) => {
        if (active) applyData(data);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error(error);
        showNotice(error instanceof Error ? error.message : "Не удалось загрузить данные", "error");
      })
      .finally(() => {
        if (active) setLoadingData(false);
      });

    return () => {
      active = false;
    };
  }, [auth?.user.id, user?.role, applyData]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    requestCertificatePage(certificatePage, debouncedSearch, statusFilter, controller.signal)
      .then((data) => applyCertificatePage(data, certificatePage))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setNotice(error instanceof Error ? error.message : "Не удалось загрузить сертификаты");
        setNoticeSeverity("error");
      });
    return () => controller.abort();
  }, [auth?.user.id, certificatePage, debouncedSearch, statusFilter, requestCertificatePage, applyCertificatePage]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoadingLogin(true);
    setLoginError("");

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: loginCode, password: loginPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Неверный код или пароль");
      }
      const auth = { user: data.user as User };
      storeAuth(auth);
      showNotice(`Добро пожаловать, ${data.user.name}`);
    } catch (error) {
      setLoginError((error as Error).message || "Ошибка входа");
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    setLoadingRegister(true);
    setRegisterError("");

    try {
      const response = await fetch(`${API_BASE}/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: registerName, code: registerCode, password: registerPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Ошибка регистрации");
      }
      setLoginCode(registerCode.trim());
      setLoginPassword(registerPassword);
      showNotice("Регистрация успешна. Войдите в личный кабинет, используя свой код и пароль.");
      setRegisterName("");
      setRegisterCode("");
      setRegisterPassword("");
      setRegisterError("");
      setAuthMode("login");
    } catch (error) {
      setRegisterError((error as Error).message || "Ошибка регистрации");
    } finally {
      setLoadingRegister(false);
    }
  };

  const handleLogout = async () => {
    if (!user) {
      storeAuth(null);
      setLoginCode("");
      setLoginPassword("");
      return;
    }
    try {
      await fetchJson(`${API_BASE}/logout`, { method: "POST" });
    } catch (error) {
      console.error("Could not invalidate the server session", error);
      showNotice("Аз ин браузер баромадед, аммо қатъи сессияи сервер муваффақ нашуд.", "warning");
    } finally {
      storeAuth(null);
      setLoginCode("");
      setLoginPassword("");
    }
  };

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось загрузить изображение"));
    reader.readAsDataURL(file);
  });

  const handleNewsImagesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      setNewsImages([]);
      return;
    }

    try {
      const dataUrls = await Promise.all(files.slice(0, 5).map((file) => readFileAsDataUrl(file)));
      setNewsImages(dataUrls);
    } catch (error) {
      showNotice((error as Error).message || "Ошибка загрузки изображений", "error");
    }
  };

  const handleSaveNews = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || user.role !== "admin") return;

    try {
      const editingId = editingNewsId;
      await fetchJson(editingId ? `${API_BASE}/news/${editingId}` : `${API_BASE}/news`, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newsForm.title,
          category: newsForm.category,
          content: newsForm.content,
          images: newsImages,
        }),
      });
      setEditingNewsId(null);
      setNewsForm({ title: "", category: "Новости", content: "" });
      setNewsImages([]);
      showNotice(editingId ? "Новость обновлена" : "Новость опубликована");
      await loadData();
    } catch (error) {
      showNotice((error as Error).message || "Не удалось сохранить новость", "error");
    }
  };

  const handleEditNews = (item: NewsItem) => {
    setNewsForm({ title: item.title, category: item.category, content: item.content });
    setNewsImages(item.images || []);
    setEditingNewsId(item.id);
    newsFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleCancelNewsEdit = () => {
    setEditingNewsId(null);
    setNewsForm({ title: "", category: "Новости", content: "" });
    setNewsImages([]);
  };

  const handleDeleteNews = async (item: NewsItem) => {
    if (user?.role !== "admin") return;
    if (!window.confirm(`Удалить новость «${item.title}»? Это действие нельзя отменить.`)) return;

    try {
      await fetchJson(`${API_BASE}/news/${item.id}`, { method: "DELETE" });
      if (editingNewsId === item.id) handleCancelNewsEdit();
      showNotice("Новость удалена");
      await loadData();
    } catch (error) {
      showNotice((error as Error).message || "Не удалось удалить новость", "error");
    }
  };

  const handleCreateCertificate = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (user.role !== "admin" && user.role !== "applicant") {
      showNotice("У вас нет прав на создание записи", "error");
      return;
    }

    try {
      const editingId = editingCertificateId;
      await fetchJson(
        editingId ? `${API_BASE}/certificates/${editingId}` : `${API_BASE}/certificates`,
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: form.fullName,
            registration_number:
              !editingId && user.role === "admin" ? form.registrationNumber.trim() || null : null,
            birth_date: form.birthDate,
            workplace: form.workplace,
            position: form.position,
            specialty: form.specialty,
            training_type: form.trainingType,
            training_center: form.trainingCenter,
            course_name: form.courseName,
            start_date: form.startDate,
            end_date: form.endDate,
            hours: form.hours,
            result: form.result,
            certificate_date: form.certificateDate,
            validity_period: form.validityPeriod,
            comments: form.comments,
          }),
        },
      );
      setForm(initialForm);
      setEditingCertificateId(null);
      showNotice(
        editingId
          ? "Изменения сертификата сохранены"
          : isApplicant
            ? "Заявка отправлена администратору на проверку"
            : "Сертификат успешно сохранён",
      );
      await loadData();
    } catch (error) {
      showNotice((error as Error).message || "Не удалось сохранить сертификат", "error");
    }
  };

  const handleEditCertificate = (record: Certificate) => {
    setForm({
      registrationNumber: record.regNumber,
      fullName: record.fullName,
      birthDate: record.birthDate,
      workplace: record.workplace,
      position: record.position,
      specialty: record.specialty,
      trainingType: record.trainingType,
      trainingCenter: record.trainingCenter,
      courseName: record.courseName,
      startDate: record.startDate,
      endDate: record.endDate,
      hours: record.hours,
      result: record.result,
      certificateDate: record.certificateDate,
      validityPeriod: record.validityPeriod,
      comments: record.comments,
    });
    setEditingCertificateId(record.id);
    certificateFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleDeleteCertificate = async (record: Certificate) => {
    if (user?.role !== "admin") return;
    if (!window.confirm(`Удалить сертификат ${record.regNumber}? Это действие нельзя отменить.`)) return;

    try {
      await fetchJson(`${API_BASE}/certificates/${record.id}`, { method: "DELETE" });
      if (editingCertificateId === record.id) {
        setEditingCertificateId(null);
        setForm(initialForm);
      }
      showNotice(`Сертификат ${record.regNumber} удалён`);
      await loadData();
    } catch (error) {
      showNotice((error as Error).message || "Не удалось удалить сертификат", "error");
    }
  };

  const handleApprove = async (id: string) => {
    if (!user) return;
    try {
      await fetchJson(`${API_BASE}/certificates/${id}/approve`, { method: "POST" });
      showNotice("Сертификат подтверждён");
      await loadData();
    } catch (error) {
      showNotice((error as Error).message || "Ошибка подтверждения", "error");
    }
  };

  const handleReject = async (id: string) => {
    if (!user) return;
    if (!window.confirm("Отклонить эту заявку? Заявитель получит уведомление.")) return;
    try {
      await fetchJson(`${API_BASE}/certificates/${id}/reject`, { method: "POST" });
      showNotice("Заявка отклонена");
      await loadData();
    } catch (error) {
      showNotice((error as Error).message || "Не удалось отклонить заявку", "error");
    }
  };

  const handleRevoke = async (id: string) => {
    if (!user) return;
    try {
      await fetchJson(`${API_BASE}/certificates/${id}/revoke`, { method: "POST" });
      showNotice("Сертификат аннулирован");
      await loadData();
    } catch (error) {
      showNotice((error as Error).message || "Ошибка аннулирования", "error");
    }
  };

  const filteredCertificates = certificates;

  const generateQr = async (record: Certificate) => {
    const qrDataUrl = record.qrUrl || await createQrDataUrl(record);
    setCertificates((prev) => prev.map((item) => (item.id === record.id ? { ...item, qrUrl: qrDataUrl } : item)));
    return qrDataUrl;
  };

  const exportExcel = async () => {
    try {
      const XLSX = await import("@e965/xlsx");
      const allFilteredCertificates = await fetchAllFilteredCertificates(search.trim(), statusFilter);
      const rows = allFilteredCertificates.map((record) => ({
        "Рег. номер": record.regNumber,
        "ФИО": record.fullName,
        "Место работы": record.workplace,
        "Курс": record.courseName,
        "Статус": statusLabels[record.status],
        "Дата выдачи": formatDate(record.certificateDate),
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Реестр");
      XLSX.writeFile(workbook, "реестр_сертификатов.xlsx");
    } catch (error) {
      console.error(error);
      showNotice((error as Error).message || "Не удалось создать файл Excel", "error");
    }
  };

  const exportPdf = async () => {
    try {
      const allFilteredCertificates = await fetchAllFilteredCertificates(search.trim(), statusFilter);
      await downloadRegistryPdf(allFilteredCertificates, "реестр_сертификатов.pdf");
    } catch (error) {
      console.error(error);
      showNotice((error as Error).message || "Не удалось создать PDF", "error");
    }
  };

  const exportCard = async (record: Certificate) => {
    try {
      await downloadCertificatePdf([record], `${record.regNumber}.pdf`);
    } catch (error) {
      console.error(error);
      showNotice((error as Error).message || "Не удалось создать PDF", "error");
    }
  };

  const yearStats = dashboard ? Object.entries(dashboard.years) : [];
  const productStats = dashboard ? Object.entries(dashboard.products) : [];
  const maxYearValue = Math.max(...yearStats.map(([, value]) => value), 1);
  const maxProductValue = Math.max(...productStats.map(([, value]) => value), 1);
  const yearChartStats = yearStats.slice(-7);
  const yearChartPoints = yearChartStats.map(([year, count], index) => {
    const x = 30 + (index * 620) / Math.max(yearChartStats.length - 1, 1);
    const y = 172 - (count / maxYearValue) * 132;
    return { year, count, x, y };
  });
  const yearChartPath = yearChartPoints.length > 1
    ? yearChartPoints.slice(0, -1).map((point, index) => {
      const nextPoint = yearChartPoints[index + 1];
      const controlX = (point.x + nextPoint.x) / 2;
      return `${index === 0 ? `M ${point.x} ${point.y}` : ""} C ${controlX} ${point.y}, ${controlX} ${nextPoint.y}, ${nextPoint.x} ${nextPoint.y}`;
    }).join(" ")
    : yearChartPoints.length ? `M ${yearChartPoints[0].x} ${yearChartPoints[0].y}` : "";
  const yearChartArea = yearChartPoints.length
    ? `${yearChartPath} L ${yearChartPoints[yearChartPoints.length - 1].x} 190 L ${yearChartPoints[0].x} 190 Z`
    : "";
  const adminPendingCount = certificateCounts.pending;
  const adminPublishedCount = certificateCounts.published;
  const adminRevokedCount = certificateCounts.revoked;
  const allCertificateCount = adminPendingCount + adminPublishedCount + adminRevokedCount;
  const adminStatusTotal = Math.max(adminPublishedCount + adminPendingCount + adminRevokedCount, 1);
  const adminPublishedShare = (adminPublishedCount / adminStatusTotal) * 100;
  const adminPendingShare = (adminPendingCount / adminStatusTotal) * 100;

  if (!user) {
    return (
      <Box className="registry-root registry-landing" sx={{ minHeight: "100vh", background: "linear-gradient(180deg, #f5f8fc 0%, #edf3f8 100%)", color: "#132238" }}>
        <SiteNavigation />

        <Container className="registry-container" maxWidth="xl" sx={{ py: 4 }}>
          {notice && (
            <Alert severity={noticeSeverity} sx={{ mb: 3 }} onClose={() => setNotice("")}>
              {notice}
            </Alert>
          )}

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Paper className="registry-hero" sx={{ p: 3, mb: 3, borderRadius: 4, border: "1px solid #dfeaf7" }}>
              <Stack direction={{ xs: "column", md: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" }, gap: 2 }}>
                <Box>
                  <Typography variant="overline" color="primary.main" sx={{ letterSpacing: 2, fontWeight: 700 }}>Единый государственный портал</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>Все сведения о реестре, лаборатории и сертификатах в одном месте</Typography>
                  <Typography variant="body1" color="text.secondary">Любой посетитель может посмотреть опубликованные сертификаты, новости и информацию о деятельности центра без отдельного входа.</Typography>
                </Box>
                <Chip label="Открытый доступ" color="success" variant="filled" sx={{ fontWeight: 700 }} />
              </Stack>
            </Paper>
          </motion.div>

          <Grid className="registry-auth-grid" container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12 }}>
              <Box className="registry-auth-panel registry-auth-card">
                <Stack direction="row" spacing={1} sx={{ mb: 3 }} role="tablist" aria-label="Вход или регистрация">
                  <Button
                    className="registry-auth-tab"
                    type="button"
                    role="tab"
                    aria-selected={authMode === "login"}
                    variant={authMode === "login" ? "contained" : "outlined"}
                    onClick={() => {
                      setAuthMode("login");
                      setLoginError("");
                      setRegisterError("");
                      setShowPassword(false);
                    }}
                  >
                    Войти
                  </Button>
                  <Button
                    className="registry-auth-tab"
                    type="button"
                    role="tab"
                    aria-selected={authMode === "register"}
                    variant={authMode === "register" ? "contained" : "outlined"}
                    onClick={() => {
                      setAuthMode("register");
                      setLoginError("");
                      setRegisterError("");
                      setShowPassword(false);
                    }}
                  >
                    Регистрация
                  </Button>
                </Stack>

                {authMode === "login" ? (
                  <>
                    <Typography className="registry-auth-title" variant="h5">С возвращением</Typography>
                    <Typography className="registry-auth-subtitle">Войдите в личный кабинет</Typography>
                    <form onSubmit={handleLogin}>
                      <Stack spacing={2}>
                        <TextField required label="Код пользователя или администратора" value={loginCode} onChange={(e) => setLoginCode(e.target.value)} autoComplete="username" fullWidth slotProps={{ htmlInput: { minLength: 3, maxLength: 80, autoComplete: "username" }, input: { startAdornment: <InputAdornment position="start"><Badge /></InputAdornment> } }} />
                        <TextField
                          required
                          label="Пароль"
                          type={showPassword ? "text" : "password"}
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          autoComplete="current-password"
                          fullWidth
                          slotProps={{
                            htmlInput: { minLength: 1, maxLength: 256, autoComplete: "current-password" },
                            input: {
                              startAdornment: <InputAdornment position="start"><Lock /></InputAdornment>,
                              endAdornment: (
                                <InputAdornment position="end">
                                  <IconButton
                                    aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                                    aria-pressed={showPassword}
                                    onClick={() => setShowPassword((shown) => !shown)}
                                    edge="end"
                                  >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                  </IconButton>
                                </InputAdornment>
                              ),
                            },
                          }}
                        />
                        {loginError && <Alert severity="error">{loginError}</Alert>}
                        <Button type="submit" variant="contained" size="large" disabled={loadingLogin} aria-busy={loadingLogin}>
                          {loadingLogin ? "Вход..." : "Войти"}
                        </Button>
                      </Stack>
                    </form>
                  </>
                ) : (
                  <>
                    <Typography className="registry-auth-title" variant="h5">Создать аккаунт</Typography>
                    <Typography className="registry-auth-subtitle">Зарегистрируйтесь как заявитель</Typography>
                    <form onSubmit={handleRegister}>
                      <Stack spacing={2}>
                        <TextField required label="ФИО" value={registerName} onChange={(e) => setRegisterName(e.target.value)} autoComplete="name" fullWidth slotProps={{ htmlInput: { minLength: 3, maxLength: 160, autoComplete: "name" } }} />
                        <TextField required label="Придумайте код" value={registerCode} onChange={(e) => setRegisterCode(e.target.value)} autoComplete="username" fullWidth slotProps={{ htmlInput: { minLength: 3, maxLength: 80, autoComplete: "username" } }} />
                        <TextField
                          required
                          label="Пароль (не менее 12 символов)"
                          type={showPassword ? "text" : "password"}
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          autoComplete="new-password"
                          fullWidth
                          slotProps={{
                            htmlInput: { minLength: 12, maxLength: 128, autoComplete: "new-password" },
                            input: {
                              startAdornment: <InputAdornment position="start"><Lock /></InputAdornment>,
                              endAdornment: (
                                <InputAdornment position="end">
                                  <IconButton
                                    aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                                    aria-pressed={showPassword}
                                    onClick={() => setShowPassword((shown) => !shown)}
                                    edge="end"
                                  >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                  </IconButton>
                                </InputAdornment>
                              ),
                            },
                          }}
                        />
                        {registerError && <Alert severity="error">{registerError}</Alert>}
                        <Button type="submit" variant="contained" size="large" disabled={loadingRegister} aria-busy={loadingRegister}>
                          {loadingRegister ? "Регистрация..." : "Зарегистрироваться"}
                        </Button>
                      </Stack>
                    </form>
                  </>
                )}
              </Box>
            </Grid>
          </Grid>

          <Grid className="registry-feature-grid" container spacing={3} sx={{ mb: 3 }}>
            {companyHighlights.map((item) => (
              <Grid key={item.title} size={{ xs: 12, sm: 6, md: 3 }}>
                <Card className="registry-feature-card" sx={{ height: "100%", borderRadius: 3, border: "1px solid #dfeaf7" }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>{item.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{item.text}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Paper className="registry-section-paper" sx={{ p: 3, mb: 3, borderRadius: 4, border: "1px solid #dfeaf7" }}>
            <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 2 }}>
              <Visibility color="primary" />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>Новости и объявления</Typography>
            </Stack>
            <Grid container spacing={2}>
              {news.length === 0 ? (
                <Grid size={{ xs: 12 }}><Typography color="text.secondary">Новостей пока нет.</Typography></Grid>
              ) : news.map((item) => (
                <Grid key={item.id} size={{ xs: 12, md: 6 }}>
                  <Card className="registry-news-card" sx={{ height: "100%", borderRadius: 3, border: "1px solid #e2e8f0" }}>
                    <CardContent>
                      {Array.isArray(item.images) && item.images.length > 0 && (
                        <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 1, mb: 1.5 }}>
                          {item.images.map((image, index) => (
                            <Box key={`${item.id}-${index}`} component="img" src={image} alt={`${item.title}-${index}`} sx={{ width: 120, height: 90, objectFit: "cover", borderRadius: 2, border: "1px solid #dbeafe", flexShrink: 0 }} />
                          ))}
                        </Stack>
                      )}
                      <Chip label={item.category} size="small" color="primary" variant="outlined" sx={{ mb: 1.5 }} />
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                        <Link href={`/news/${encodeURIComponent(item.id)}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {item.title}
                        </Link>
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={item.content.length > 240 ? {
                          whiteSpace: "pre-line",
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 4,
                          overflow: "hidden",
                        } : { whiteSpace: "pre-line" }}
                      >
                        {item.content}
                      </Typography>
                      <Link href={`/news/${encodeURIComponent(item.id)}`} style={{ display: "inline-block", marginTop: 8, color: "#0c7ec3", fontWeight: 700, textDecoration: "none" }}>
                        Читать полностью
                      </Link>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>{formatDate(item.published_at)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>

          <Paper className="registry-section-paper registry-table-paper" sx={{ p: 3, borderRadius: 4, border: "1px solid #dfeaf7" }}>
            <Stack direction={{ xs: "column", md: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" }, mb: 3, gap: 2 }}>
              <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                <Visibility color="primary" />
                <Typography variant="h5" sx={{ fontWeight: 800 }}>Открытый реестр сертификатов</Typography>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ width: { xs: "100%", md: "auto" } }}>
                <TextField
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCertificatePage(0);
                  }}
                  placeholder="Поиск по ФИО или номеру"
                  size="small"
                  sx={{ width: { xs: "100%", sm: 300 } }}
                  slotProps={{
                    htmlInput: { "aria-label": "Поиск по открытому реестру" },
                    input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> },
                  }}
                />
              </Stack>
            </Stack>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Рег. номер</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>ФИО</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Курс</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Статус</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredCertificates.length === 0 ? (
                    <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5, color: "text.secondary" }}>Записей не найдено</TableCell></TableRow>
                  ) : filteredCertificates.map((record) => (
                    <TableRow key={record.id} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{record.regNumber}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{record.fullName}</Typography>
                        <Typography variant="caption" color="text.secondary">{record.workplace}</Typography>
                      </TableCell>
                      <TableCell>{record.courseName}</TableCell>
                      <TableCell>
                        <Chip label={statusLabels[record.status]} color={record.status === "published" ? "success" : record.status === "revoked" || record.status === "rejected" ? "error" : "warning"} size="small" />
                        {isApplicant && record.comments && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                            {record.comments}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={certificateTotal}
              page={certificatePage}
              rowsPerPage={CERTIFICATES_PER_PAGE}
              rowsPerPageOptions={[]}
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} из ${count}`}
              onPageChange={(_, page) => setCertificatePage(page)}
            />
          </Paper>
        </Container>
        <SiteFooter />
      </Box>
    );
  }

  const canManage = user.role === "admin" || isApplicant;
  const isAdminOverview = user.role === "admin" && adminSection === "overview";
  const isAdminApplications = user.role === "admin" && adminSection === "applications";
  const isAdminNews = user.role === "admin" && adminSection === "news";
  const isAdminSiteContent = user.role === "admin" && adminSection === "site-content";
  const adminSectionCopy = {
    applications: {
      title: "Заявки и реестр",
      description: "Проверяйте новые заявки, управляйте сертификатами и отслеживайте статусы.",
    },
    news: {
      title: "Новости",
      description: "Публикуйте новости института и редактируйте уже размещённые материалы.",
    },
  } as const;

  return (
    <Box className={`registry-root registry-dashboard registry-dashboard--${user.role}`} sx={{ minHeight: "100vh", background: "linear-gradient(180deg, #f5f8fc 0%, #edf3f8 100%)", color: "#132238" }}>
      <DashboardSidebar role={user.role} />

      <Box className="registry-dashboard-main">
        <SiteNavigation
          rightContent={
            <Stack className="unified-site-header__account" direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Chip icon={<ShieldOutlined />} label={roleLabels[user.role]} color={user.role === "admin" ? "success" : "warning"} />
              <Typography variant="body2" sx={{ fontWeight: 700, color: "#1e293b" }}>{user.name}</Typography>
              <IconButton color="primary" onClick={handleLogout} aria-label="Выйти">
                <ExitToApp />
              </IconButton>
            </Stack>
          }
        />

      <Container id="dashboard-top" className="registry-container" maxWidth="xl" sx={{ py: 4 }}>
        {notice && (
          <Alert severity={noticeSeverity} sx={{ mb: 3 }} onClose={() => setNotice("")}>
            {notice}
          </Alert>
        )}

        {user.role === "admin" && !isAdminOverview && !isAdminSiteContent && (
          <Paper className="registry-admin-section-heading" sx={{ mb: 3 }}>
            <Typography variant="overline">ПАНЕЛЬ АДМИНИСТРАТОРА</Typography>
            <Typography variant="h4">{adminSectionCopy[adminSection as keyof typeof adminSectionCopy]?.title}</Typography>
            <Typography color="text.secondary">
              {adminSectionCopy[adminSection as keyof typeof adminSectionCopy]?.description}
            </Typography>
          </Paper>
        )}

        {isAdminOverview && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Paper className="registry-admin-welcome registry-dashboard-hero" sx={{ mb: 3 }}>
            <Box>
              <Typography variant="overline">АДМИНИСТРАТИВНАЯ ПАНЕЛЬ · РЕЕСТР СЕРТИФИКАТОВ</Typography>
              <Typography variant="h4">Добро пожаловать, {user.name}</Typography>
              <Typography variant="body1">
                Общая картина реестра, последние показатели и быстрый доступ к рабочим задачам.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
              <Chip
                icon={<ShieldOutlined />}
                label={`${adminPendingCount} на проверке`}
                className="registry-admin-pending"
              />
              <Button
                variant="contained"
                endIcon={<ArrowRight size={17} />}
                onClick={() => {
                  router.push("/?adminSection=applications");
                  window.setTimeout(notifyAdminSectionChange, 0);
                }}
              >
                Добавить сертификат
              </Button>
            </Stack>
            <span className="registry-dashboard-hero__date">{new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</span>
          </Paper>
          </motion.div>
        )}

        {isAdminOverview && <Grid container spacing={3} sx={{ mb: 3 }}>
          {[
            { label: "Всего записей", value: allCertificateCount, color: "#a9e3d3", gradient: "linear-gradient(135deg, #174a43 0%, #247965 100%)", icon: <Database size={20} />, note: "Все статусы реестра" },
            { label: "Опубликовано", value: adminPublishedCount, color: "#b5e5bb", gradient: "linear-gradient(135deg, #225745 0%, #3a8b61 100%)", icon: <BadgeCheck size={20} />, note: "Действующие сертификаты" },
            { label: "На проверке", value: adminPendingCount, color: "#ffdb9a", gradient: "linear-gradient(135deg, #725128 0%, #b5833b 100%)", icon: <Clock3 size={20} />, note: "Ожидают решения" },
            { label: "Заявителей", value: dashboard?.applicants ?? 0, color: "#d7cdf8", gradient: "linear-gradient(135deg, #454167 0%, #70669b 100%)", icon: <Users size={20} />, note: `${adminRevokedCount} аннулировано` },
          ].map((item) => (
            <Grid key={item.label} size={{ xs: 12, sm: 6, md: 3 }}>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.06 }}>
              <Card className="registry-stat-card registry-admin-stat glass-card" sx={{ "--stat-accent": item.color, "--stat-gradient": item.gradient } as CSSProperties}>
                <CardContent>
                  <Box className="registry-admin-stat__top">
                    <Typography variant="caption">{item.label}</Typography>
                    <Box className="registry-admin-stat__icon">{item.icon}</Box>
                  </Box>
                  <Box className="registry-admin-stat__value-row">
                    <Typography className="registry-admin-stat__value" variant="h4">{item.value.toLocaleString("ru-RU")}</Typography>
                    <ArrowUpRight className="registry-admin-stat__arrow" size={18} aria-hidden="true" />
                  </Box>
                  <Typography className="registry-admin-stat__note" variant="caption">{item.note}</Typography>
                </CardContent>
              </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>}

        {isAdminOverview && (
          <Grid container spacing={2.5} className="registry-admin-analytics">
            <Grid size={{ xs: 12, lg: 8 }}>
              <Paper className="registry-admin-chart-card">
                <Box className="registry-admin-chart-card__heading">
                  <Box>
                    <Typography className="registry-admin-chart-card__eyebrow">ДИНАМИКА РЕЕСТРА</Typography>
                    <Typography variant="h6">Сертификаты по годам</Typography>
                  </Box>
                  <Chip size="small" label="По дате выдачи" variant="outlined" />
                </Box>
                {yearChartPoints.length ? (
                  <>
                    <Box className="registry-admin-line-chart">
                      <svg viewBox="0 0 680 220" role="img" aria-label="График количества опубликованных сертификатов по годам">
                        <defs>
                          <linearGradient id="registry-chart-fill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#4a8fe0" stopOpacity=".22" />
                            <stop offset="100%" stopColor="#4a8fe0" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {[40, 84, 128, 172].map((y) => <line key={y} x1="30" x2="650" y1={y} y2={y} className="registry-admin-line-chart__grid" />)}
                        <path d={yearChartArea} className="registry-admin-line-chart__area" />
                        <path d={yearChartPath} className="registry-admin-line-chart__line" />
                        {yearChartPoints.map((point) => (
                          <g key={point.year}>
                            <circle cx={point.x} cy={point.y} r="5" className="registry-admin-line-chart__point" />
                            <text x={point.x} y={Math.max(point.y - 13, 20)} textAnchor="middle" className="registry-admin-line-chart__value">{point.count}</text>
                            <text x={point.x} y="210" textAnchor="middle" className="registry-admin-line-chart__label">{point.year}</text>
                          </g>
                        ))}
                      </svg>
                    </Box>
                    <Typography className="registry-admin-chart-card__footnote">
                      Маълумоти воқеӣ аз сертификатҳои нашршуда
                    </Typography>
                  </>
                ) : (
                  <Box className="registry-admin-chart-empty">Маълумот барои сохтани график ҳоло нест.</Box>
                )}
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              <Paper className="registry-admin-chart-card registry-admin-status-card">
                <Box className="registry-admin-chart-card__heading">
                  <Box>
                    <Typography className="registry-admin-chart-card__eyebrow">ҲОЛАТИ ҲУҶҶАТҲО</Typography>
                    <Typography variant="h6">Тақсимоти реестр</Typography>
                  </Box>
                </Box>
                <Box
                  className="registry-admin-donut"
                  style={{ "--published-share": `${adminPublishedShare}%`, "--pending-share": `${adminPublishedShare + adminPendingShare}%` } as CSSProperties}
                  role="img"
                  aria-label={`Опубликовано: ${adminPublishedCount}, на проверке: ${adminPendingCount}, аннулировано: ${adminRevokedCount}`}
                >
                  <Box className="registry-admin-donut__center">
                    <strong>{allCertificateCount.toLocaleString("ru-RU")}</strong>
                    <span>всего</span>
                  </Box>
                </Box>
                <Stack className="registry-admin-legend" spacing={1.5}>
                  {[
                    { label: "Опубликовано", value: adminPublishedCount, color: "#31846d" },
                    { label: "На проверке", value: adminPendingCount, color: "#e0a544" },
                    { label: "Аннулировано", value: adminRevokedCount, color: "#df7676" },
                  ].map((item) => (
                    <Box className="registry-admin-legend__item" key={item.label}>
                      <span className="registry-admin-legend__label"><i style={{ background: item.color }} />{item.label}</span>
                      <strong>{item.value.toLocaleString("ru-RU")}</strong>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Paper className="registry-admin-chart-card registry-admin-training-card">
                <Box className="registry-admin-chart-card__heading">
                  <Box>
                    <Typography className="registry-admin-chart-card__eyebrow">ПОПУЛЯРНЫЕ НАПРАВЛЕНИЯ</Typography>
                    <Typography variant="h6">Типы обучения</Typography>
                  </Box>
                  <Typography className="registry-admin-chart-card__footnote">Опубликованные сертификаты</Typography>
                </Box>
                {productStats.length ? (
                  <Stack className="registry-admin-training-list" spacing={1.5}>
                    {productStats.map(([label, count], index) => (
                      <Box className="registry-admin-training-row" key={label}>
                        <Box className="registry-admin-training-row__label">
                          <span>{label}</span>
                          <strong>{count}</strong>
                        </Box>
                        <Box className="registry-admin-training-row__track">
                          <span style={{ "--bar-width": `${(count / maxProductValue) * 100}%`, "--bar-delay": `${index * 80}ms` } as CSSProperties} />
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Box className="registry-admin-chart-empty">Маълумот барои гурӯҳбандии омӯзишҳо ҳоло нест.</Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}

        {isAdminSiteContent && <AdminSiteContent />}

        {isApplicant && (
          <Paper className="registry-dashboard-hero registry-dashboard-hero--applicant" sx={{ mb: 3 }}>
            <Box>
              <Typography variant="overline">КАБИНЕТ ЗАЯВИТЕЛЯ</Typography>
              <Typography variant="h4">Здравствуйте, {user.name}</Typography>
              <Typography variant="body1">
                Подавайте сведения на проверку и следите за статусом рассмотрения заявок в личном кабинете.
              </Typography>
            </Box>
            <Button
              variant="contained"
              endIcon={<ArrowRight size={17} />}
              onClick={() => certificateFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              Подать заявку
            </Button>
            <span className="registry-dashboard-hero__date">{new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</span>
          </Paper>
        )}

        {user.role !== "admin" && !isApplicant && <Paper className="registry-section-paper" sx={{ p: 3, mb: 3, borderRadius: 4, border: "1px solid #dfeaf7" }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 2 }}>
            <Business color="primary" />
            <Typography variant="h4" sx={{ fontWeight: 800 }}>О центре и реестре</Typography>
          </Stack>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Вся информация о деятельности организации, лаборатории, реестрах и квалификации специалистов собрана в одном интерфейсе для удобного просмотра и проверки данных.
          </Typography>
          <Grid container spacing={2}>
            {companyHighlights.map((item) => (
              <Grid key={item.title} size={{ xs: 12, sm: 6, md: 3 }}>
                <Card className="registry-feature-card" sx={{ height: "100%", borderRadius: 3, border: "1px solid #dfeaf7" }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>{item.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{item.text}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>}

        {isApplicant && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: "Мои заявки", value: allCertificateCount, color: "#1d4ed8" },
              { label: "На рассмотрении", value: certificateCounts.pending, color: "#f59e0b" },
              { label: "Опубликовано", value: certificateCounts.published, color: "#0f9f6e" },
            ].map((item, index) => (
              <Grid key={item.label} size={{ xs: 12, sm: 4 }}>
                <Card className="registry-applicant-stat" sx={{ borderRadius: 3, border: "1px solid #e2e8f0" }}>
                  <CardContent>
                    <Box className="registry-applicant-stat__heading">
                      <span className={`registry-applicant-stat__icon registry-applicant-stat__icon--${index}`}>
                        {index === 0 ? <FileText size={19} /> : index === 1 ? <Clock3 size={19} /> : <BadgeCheck size={19} />}
                      </span>
                      <Typography color="text.secondary">{item.label}</Typography>
                    </Box>
                    <Typography className="registry-applicant-stat__value" variant="h4" sx={{ color: item.color, fontWeight: 800 }}>{item.value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {(canManage && (isApplicant || isAdminApplications)) && (
          <Grid container spacing={3} sx={{ mb: 3 }}>
          {canManage && (
            <Grid size={{ xs: 12 }}>
              <Paper id="application-form" ref={certificateFormRef} className="registry-section-paper" sx={{ p: 3, borderRadius: 4, border: "1px solid #dfeaf7", scrollMarginTop: 100 }}>
                <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 3 }}>
                  <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                    <Business color="primary" />
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      {isApplicant ? "Подать заявку на сертификацию" : editingCertificateId ? "Редактировать сертификат" : "Добавить сертификат"}
                    </Typography>
                  </Stack>
                  <Chip
                    label={isApplicant ? "Проверка администратором" : editingCertificateId ? "Изменение данных" : "Публикация после проверки"}
                    color="warning"
                    variant="outlined"
                  />
                </Stack>

                {isApplicant && (
                  <Alert severity="info" sx={{ mb: 3 }}>
                    Укажите данные специалиста и пройденного обучения. После отправки заявка появится в разделе «Мои заявки» со статусом рассмотрения.
                  </Alert>
                )}

                <Box component="form" onSubmit={handleCreateCertificate}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12 }}><Box className="registry-form-section"><span className="registry-form-section__num">1</span><span>Данные специалиста</span></Box></Grid>
                    {user.role === "admin" && (
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label="Рег. номер"
                          value={form.registrationNumber}
                          onChange={(e) => handleChange("registrationNumber", e.target.value)}
                          disabled={Boolean(editingCertificateId)}
                          helperText={
                            editingCertificateId
                              ? "Регистрационный номер нельзя изменить после создания."
                              : "Заполните вручную или оставьте пустым — номер будет создан автоматически."
                          }
                        />
                      </Grid>
                    )}
                    <Grid size={{ xs: 12, sm: 6 }}><TextField required fullWidth label="ФИО специалиста" placeholder="Иванов Иван Иванович" value={form.fullName} onChange={(e) => handleChange("fullName", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="date" label="Дата рождения" slotProps={{ inputLabel: { shrink: true } }} value={form.birthDate} onChange={(e) => handleChange("birthDate", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Место работы" value={form.workplace} onChange={(e) => handleChange("workplace", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Должность" value={form.position} onChange={(e) => handleChange("position", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField required fullWidth label="Специальность" value={form.specialty} onChange={(e) => handleChange("specialty", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12 }}><Box className="registry-form-section"><span className="registry-form-section__num">2</span><span>Обучение</span></Box></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField fullWidth select label="Вид обучения" value={form.trainingType} onChange={(e) => handleChange("trainingType", e.target.value)}>
                        {['Первоначальное обучение', 'Переподготовка', 'Повышение квалификации'].map((option) => (
                          <MenuItem key={option} value={option}>{option}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField required fullWidth label="Учебный центр" value={form.trainingCenter} onChange={(e) => handleChange("trainingCenter", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField required fullWidth label="Название курса" placeholder="Экспертиза проектной документации" value={form.courseName} onChange={(e) => handleChange("courseName", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="date" label="Дата начала" slotProps={{ inputLabel: { shrink: true } }} value={form.startDate} onChange={(e) => handleChange("startDate", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="date" label="Дата окончания" slotProps={{ inputLabel: { shrink: true } }} value={form.endDate} onChange={(e) => handleChange("endDate", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Учебных часов" placeholder="например, 72" value={form.hours} onChange={(e) => handleChange("hours", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12 }}><Box className="registry-form-section"><span className="registry-form-section__num">3</span><span>Аттестация и сертификат</span></Box></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Результат аттестации" value={form.result} onChange={(e) => handleChange("result", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="date" label="Дата выдачи сертификата" slotProps={{ inputLabel: { shrink: true } }} value={form.certificateDate} onChange={(e) => handleChange("certificateDate", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Срок действия" placeholder="например, 5 лет" helperText="Укажите срок в годах или дату окончания." value={form.validityPeriod} onChange={(e) => handleChange("validityPeriod", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12 }}><Box className="registry-form-section"><span className="registry-form-section__num">4</span><span>Дополнительно</span></Box></Grid>
                    <Grid size={{ xs: 12 }}><TextField fullWidth multiline minRows={3} label="Комментарий" value={form.comments} onChange={(e) => handleChange("comments", e.target.value)} /></Grid>
                  </Grid>

                  <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end", mt: 3 }}>
                    {editingCertificateId && (
                      <Button
                        type="button"
                        variant="outlined"
                        onClick={() => {
                          setEditingCertificateId(null);
                          setForm(initialForm);
                        }}
                      >
                        Отменить
                      </Button>
                    )}
                    <Button type="submit" variant="contained" size="large" sx={{ borderRadius: 2, px: 4, py: 1.4, fontWeight: 700 }}>
                      {isApplicant ? "Отправить заявку" : editingCertificateId ? "Сохранить изменения" : "Сохранить"}
                    </Button>
                  </Stack>
                </Box>
              </Paper>
            </Grid>
          )}

          </Grid>
        )}

        {(user.role !== "admin" || isAdminNews) && <Paper id="dashboard-news" sx={{ p: 3, mb: 3, borderRadius: 4, border: "1px solid #dfeaf7" }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 2 }}>
            <Visibility color="primary" />
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Новости и объявления</Typography>
          </Stack>

          <Grid container spacing={2}>
            {news.length === 0 ? (
              <Grid size={{ xs: 12 }}>
                <Typography color="text.secondary">Новостей пока нет.</Typography>
              </Grid>
            ) : news.map((item) => (
              <Grid key={item.id} size={{ xs: 12, md: 6 }}>
                <Card className="registry-news-card" sx={{ height: "100%", borderRadius: 3, border: "1px solid #e2e8f0" }}>
                  <CardContent>
                    {Array.isArray(item.images) && item.images.length > 0 && (
                      <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 1, mb: 1.5 }}>
                        {item.images.map((image, index) => (
                          <Box key={`${item.id}-${index}`} component="img" src={image} alt={`${item.title}-${index}`} sx={{ width: 120, height: 90, objectFit: "cover", borderRadius: 2, border: "1px solid #dbeafe", flexShrink: 0 }} />
                        ))}
                      </Stack>
                    )}
                    <Chip label={item.category} size="small" color="primary" variant="outlined" sx={{ mb: 1.5 }} />
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                        <Link href={`/news/${encodeURIComponent(item.id)}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {item.title}
                        </Link>
                      </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={item.content.length > 240 ? {
                        whiteSpace: "pre-line",
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 4,
                        overflow: "hidden",
                      } : { whiteSpace: "pre-line" }}
                    >
                      {item.content}
                    </Typography>
                    <Link href={`/news/${encodeURIComponent(item.id)}`} style={{ display: "inline-block", marginTop: 8, color: "#0c7ec3", fontWeight: 700, textDecoration: "none" }}>
                      Читать полностью
                    </Link>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
                      {formatDate(item.published_at)}
                    </Typography>
                    {user.role === "admin" && (
                      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                        <Button size="small" variant="outlined" startIcon={<EditOutlined />} onClick={() => handleEditNews(item)}>
                          Редактировать
                        </Button>
                        <Button size="small" variant="outlined" color="error" startIcon={<DeleteOutlined />} onClick={() => handleDeleteNews(item)}>
                          Удалить
                        </Button>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {user.role === "admin" && (
            <Box ref={newsFormRef} component="form" onSubmit={handleSaveNews} sx={{ mt: 3, p: 2.5, borderRadius: 3, border: "1px dashed #bfd2ea", background: "#f8fbff", scrollMarginTop: 110 }}>
              <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, gap: 1, mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {editingNewsId ? "Редактировать новость" : "Новая новость"}
                </Typography>
                {editingNewsId && (
                    <Button type="button" size="small" variant="text" onClick={handleCancelNewsEdit}>Отменить</Button>
                )}
              </Stack>
              <Stack spacing={2}>
                <TextField required label="Заголовок" value={newsForm.title} onChange={(e) => setNewsForm((prev) => ({ ...prev, title: e.target.value }))} fullWidth />
                <TextField label="Категория" value={newsForm.category} onChange={(e) => setNewsForm((prev) => ({ ...prev, category: e.target.value }))} fullWidth />
                <TextField required label="Текст новости" value={newsForm.content} onChange={(e) => setNewsForm((prev) => ({ ...prev, content: e.target.value }))} multiline minRows={4} fullWidth />
                <Box>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>Изображения новости</Typography>
                  <Button variant="outlined" component="label" sx={{ mb: 1, mr: 1 }}>
                    Выбрать изображения
                    <input hidden accept="image/*" multiple type="file" onChange={handleNewsImagesChange} />
                  </Button>
                  {newsImages.length > 0 && (
                    <Button type="button" variant="text" color="error" sx={{ mb: 1 }} onClick={() => setNewsImages([])}>
                      Удалить изображения
                    </Button>
                  )}
                  {newsImages.length > 0 && (
                    <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 1 }}>
                      {newsImages.map((image, index) => (
                        <Box key={`${image.slice(0, 40)}-${index}`} component="img" src={image} alt={`preview-${index}`} sx={{ width: 120, height: 90, objectFit: "cover", borderRadius: 2, border: "1px solid #dbeafe" }} />
                      ))}
                    </Stack>
                  )}
                </Box>
                <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                  <Button type="submit" variant="contained">{editingNewsId ? "Сохранить изменения" : "Опубликовать новость"}</Button>
                </Stack>
              </Stack>
            </Box>
          )}
        </Paper>}

        {(user.role !== "admin" || isAdminApplications) && <Paper id="certificate-list" className="registry-section-paper registry-table-paper" sx={{ p: 3, borderRadius: 4, border: "1px solid #dfeaf7", scrollMarginTop: 24 }}>
          <Stack direction={{ xs: "column", md: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" }, mb: 3, gap: 2 }}>
            <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
              <Visibility color="primary" />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {isApplicant ? "Мои заявки" : user.role === "admin" ? "Заявки и реестр" : "Открытый реестр"}
              </Typography>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { xs: "stretch", sm: "center" } }}>
              {isApplicant && (
                <Button onClick={() => loadData()} variant="outlined">
                  Обновить статусы
                </Button>
              )}
              {!isApplicant && <TextField value={search} onChange={(e) => {
                setSearch(e.target.value);
                setCertificatePage(0);
              }} placeholder="Поиск по ФИО или номеру" size="small" slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }} />}
              <TextField select size="small" value={statusFilter} onChange={(e) => {
                setStatusFilter(e.target.value as "all" | Status);
                setCertificatePage(0);
              }} label="Статус">
                <MenuItem value="all">Все</MenuItem>
                <MenuItem value="published">Опубликован</MenuItem>
                <MenuItem value="pending">На утверждении</MenuItem>
                <MenuItem value="revoked">Аннулирован</MenuItem>
                <MenuItem value="rejected">Отклонена</MenuItem>
              </TextField>
              {!isApplicant && (
                <Button onClick={exportExcel} variant="outlined" startIcon={<Download />}>Excel</Button>
              )}
              <Button onClick={exportPdf} variant="contained" startIcon={<PictureAsPdf />}>PDF</Button>
            </Stack>
          </Stack>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Рег. номер</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>ФИО</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Курс</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Статус</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>QR</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCertificates.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5, color: "text.secondary" }}>{isApplicant ? "Вы ещё не отправляли заявки. Заполните форму выше, чтобы начать." : "Записей не найдено"}</TableCell></TableRow>
                ) : filteredCertificates.map((record) => (
                  <TableRow key={record.id} hover>
                    <TableCell sx={{ fontWeight: 700 }}>{record.regNumber}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{record.fullName}</Typography>
                      <Typography variant="caption" color="text.secondary">{record.workplace}</Typography>
                    </TableCell>
                    <TableCell>{record.courseName}</TableCell>
                    <TableCell>
                      <Chip label={statusLabels[record.status]} color={record.status === "published" ? "success" : record.status === "revoked" || record.status === "rejected" ? "error" : "warning"} size="small" />
                    </TableCell>
                    <TableCell>
                      {record.qrUrl ? <Image unoptimized src={record.qrUrl} alt="QR" width={42} height={42} style={{ width: 42, height: 42, borderRadius: 8, border: "1px solid #dfeaf7" }} /> : <QrCode color="disabled" />}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                        {user.role === "admin" && record.status !== "published" && (
                          <Button size="small" variant="contained" color="success" onClick={() => handleApprove(record.id)}>
                            {record.status === "revoked" || record.status === "rejected" ? "Восстановить и опубликовать" : "Опубликовать"}
                          </Button>
                        )}
                        {user.role === "admin" && (
                          <Button size="small" variant="outlined" startIcon={<EditOutlined />} onClick={() => handleEditCertificate(record)}>Редактировать</Button>
                        )}
                        {user.role === "admin" && (
                          <Button size="small" variant="outlined" color="error" startIcon={<DeleteOutlined />} onClick={() => handleDeleteCertificate(record)}>Удалить</Button>
                        )}
                        {user.role === "admin" && record.status === "pending" && (
                          <Button size="small" variant="outlined" color="warning" startIcon={<CancelOutlined />} onClick={() => handleReject(record.id)}>Отклонить</Button>
                        )}
                        {user.role === "admin" && record.status === "published" && (
                          <Button size="small" variant="contained" color="error" onClick={() => handleRevoke(record.id)}>Аннулировать</Button>
                        )}
                        <Button size="small" variant="outlined" startIcon={<PictureAsPdf />} aria-label={`Скачать сертификат ${record.fullName} в PDF`} onClick={() => exportCard(record)}>PDF специалиста</Button>
                        <Button size="small" variant="outlined" color="primary" onClick={async () => { await generateQr(record); }}>QR</Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={certificateTotal}
            page={certificatePage}
            rowsPerPage={CERTIFICATES_PER_PAGE}
            rowsPerPageOptions={[]}
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} из ${count}`}
            onPageChange={(_, page) => setCertificatePage(page)}
          />
        </Paper>}

        {isAdminApplications && <Paper className="registry-audit" sx={{ mt: 3, p: 3, borderRadius: 4, border: "1px solid #dfeaf7" }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 2 }}>
            <CheckCircle color="success" />
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Журнал аудита</Typography>
          </Stack>
          <Stack spacing={1.5}>
            {audit.length > 0 ? audit.map((entry) => (
              <Box className="registry-audit__entry" key={entry.id}>
                <Typography className="registry-audit__message" variant="body2">{entry.message}</Typography>
                <Typography className="registry-audit__date" variant="caption">{formatDate(entry.created_at)}</Typography>
              </Box>
            )) : (
              <Typography className="registry-audit__empty" variant="body2">
                Записей аудита пока нет.
              </Typography>
            )}
          </Stack>
        </Paper>}

        {loadingData && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
          </Box>
        )}
      </Container>
      <SiteFooter />
      </Box>
    </Box>
  );
}
