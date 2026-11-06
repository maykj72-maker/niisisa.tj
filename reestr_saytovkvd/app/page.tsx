"use client";

import Image from "next/image";
import Link from "next/link";
import CompanyIdentity from "../frontend/app/company-identity";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
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
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import type { AlertColor } from "@mui/material";
import {
  Badge,
  BarChart,
  Business,
  CheckCircle,
  DeleteOutlined,
  Download,
  EditOutlined,
  ExitToApp,
  Lock,
  Person,
  PictureAsPdf,
  QrCode,
  Search,
  Shield,
  ShieldOutlined,
  TableChart,
  Verified,
  Visibility,
} from "@mui/icons-material";

type Role = "admin" | "applicant";
type Status = "pending" | "published" | "revoked";

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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api";
const AUTH_KEY = "gov_registry_auth";

type StoredAuth = { token: string; user: User };

function getVerificationUrl(record: Certificate) {
  const apiBase = API_BASE.replace(/\/+$/, "");
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
    const parsed = JSON.parse(raw) as StoredAuth;
    authSnapshot = parsed.token && parsed.user?.id && parsed.user?.role ? parsed : null;
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
    status: status === "published" || status === "revoked" ? status : "pending",
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
  const pages: HTMLCanvasElement[] = [];
  const createPage = (continuation: boolean) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 2263;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Не удалось подготовить страницу PDF");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#082a43";
    context.fillRect(0, 0, canvas.width, 330);
    context.fillStyle = "#ffffff";
    context.font = "bold 42px Arial, sans-serif";
    drawWrappedText(context, "Пажӯҳишгоҳи илмию тадқиқотии сохтмон ва меъморӣ", 90, 90, 1180, 54);
    context.font = "bold 34px Arial, sans-serif";
    context.fillText(`Регистрационный номер: ${record.regNumber}`, 90, 220);
    context.font = "30px Arial, sans-serif";
    context.fillText(continuation ? "Продолжение документа" : `Статус: ${statusLabels[record.status]}`, 90, 275);
    if (!continuation) context.drawImage(qrImage, 1300, 45, 220, 220);
    pages.push(canvas);
    return { canvas, context, y: 390 };
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
    if (page.y > page.canvas.height - 170) page = createPage(true);
    page.context.fillStyle = "#52677b";
    page.context.font = "bold 28px Arial, sans-serif";
    page.context.fillText(`${label}:`, 90, page.y);
    page.y += 42;
    page.context.fillStyle = "#132238";
    page.context.font = "32px Arial, sans-serif";
    const wrappedLines = wrapCanvasText(page.context, value, 1030);
    let nextLine = 0;
    while (nextLine < wrappedLines.length) {
      if (page.y > page.canvas.height - 125) page = createPage(true);
      page.context.fillStyle = "#132238";
      page.context.font = "32px Arial, sans-serif";
      const availableLines = Math.max(1, Math.floor((page.canvas.height - 125 - page.y) / 42));
      const endLine = Math.min(wrappedLines.length, nextLine + availableLines);
      wrappedLines.slice(nextLine, endLine).forEach((text, index) => {
        page.context.fillText(text, 470, page.y + index * 42);
      });
      page.y += (endLine - nextLine) * 42;
      nextLine = endLine;
    }
    page.y += 22;
  }

  return pages.map((canvas) => {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Не удалось подготовить страницу PDF");
    context.fillStyle = "#52677b";
    context.font = "24px Arial, sans-serif";
    context.fillText(`QR содержит ссылку проверки и номер ${record.regNumber}`, 90, canvas.height - 55);
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

    const statusColor = record.status === "published" ? "#168364" : record.status === "revoked" ? "#bd3e4c" : "#b7791f";
    const pillWidth = columnWidths[5] - 24;
    const pillHeight = Math.max(38, statusLines.length * 25 + 14);
    const pillY = rowY + (rowHeight - pillHeight) / 2;
    rowPage.context.fillStyle = record.status === "published" ? "#e1f3eb" : record.status === "revoked" ? "#fbe8e8" : "#fff3d8";
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

async function fetchJson<T>(url: string, token?: string, options?: RequestInit): Promise<T> {
  const headers = { ...(options?.headers || {}) } as Record<string, string>;
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Ошибка запроса");
  }
  return response.json() as Promise<T>;
}

export default function Home() {
  const auth = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, () => null);
  const user = auth?.user ?? null;
  const token = auth?.token ?? "";
  const isApplicant = user?.role === "applicant";
  const [loginCode, setLoginCode] = useState("GOS-ADMIN");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerCode, setRegisterCode] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
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

  const requestData = async (authToken?: string, includeAudit = false) => {
    const [dashboardData, certificateData, auditData, newsData] = await Promise.all([
      fetchJson<DashboardData>(`${API_BASE}/dashboard`, authToken),
      fetchJson<Record<string, unknown>[]>(`${API_BASE}/certificates`, authToken),
      includeAudit && authToken ? fetchJson<AuditEntry[]>(`${API_BASE}/audit`, authToken) : Promise.resolve([]),
      fetchJson<NewsItem[]>(`${API_BASE}/news`, authToken),
    ]);
    return {
      dashboardData,
      certificates: certificateData.map(normalizeCertificate),
      audit: includeAudit ? auditData : [],
      news: newsData,
    };
  };

  const applyData = useCallback((data: Awaited<ReturnType<typeof requestData>>) => {
    setDashboard(data.dashboardData);
    setCertificates(data.certificates);
    setAudit(data.audit);
    setNews(data.news);
  }, []);

  const loadData = async (authToken?: string) => {
    setLoadingData(true);
    try {
      applyData(await requestData(authToken, user?.role === "admin"));
    } catch (error) {
      console.error(error);
      showNotice((error as Error).message || "Не удалось загрузить данные", "error");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    let active = true;

    requestData(token, user?.role === "admin")
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
  }, [token, user?.role, applyData]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoadingLogin(true);
    setLoginError("");

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: loginCode, password: loginPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Неверный код или пароль");
      }
      const auth = { token: data.token, user: data.user as User };
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
    if (!token) {
      storeAuth(null);
      return;
    }
    try {
      await fetchJson(`${API_BASE}/logout`, token, { method: "POST" });
    } catch (error) {
      console.error("Could not invalidate the server session", error);
      showNotice("Аз ин браузер баромадед, аммо қатъи сессияи сервер муваффақ нашуд.", "warning");
    } finally {
      storeAuth(null);
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
    if (!token || !user || user.role !== "admin") return;

    try {
      const editingId = editingNewsId;
      await fetchJson(editingId ? `${API_BASE}/news/${editingId}` : `${API_BASE}/news`, token, {
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
      await loadData(token);
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
    if (!token || user?.role !== "admin") return;
    if (!window.confirm(`Удалить новость «${item.title}»? Это действие нельзя отменить.`)) return;

    try {
      await fetchJson(`${API_BASE}/news/${item.id}`, token, { method: "DELETE" });
      if (editingNewsId === item.id) handleCancelNewsEdit();
      showNotice("Новость удалена");
      await loadData(token);
    } catch (error) {
      showNotice((error as Error).message || "Не удалось удалить новость", "error");
    }
  };

  const handleCreateCertificate = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !user) return;
    if (user.role !== "admin" && user.role !== "applicant") {
      showNotice("У вас нет прав на создание записи", "error");
      return;
    }

    try {
      const editingId = editingCertificateId;
      await fetchJson(
        editingId ? `${API_BASE}/certificates/${editingId}` : `${API_BASE}/certificates`,
        token,
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
      await loadData(token);
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
    if (!token || user?.role !== "admin") return;
    if (!window.confirm(`Удалить сертификат ${record.regNumber}? Это действие нельзя отменить.`)) return;

    try {
      await fetchJson(`${API_BASE}/certificates/${record.id}`, token, { method: "DELETE" });
      if (editingCertificateId === record.id) {
        setEditingCertificateId(null);
        setForm(initialForm);
      }
      showNotice(`Сертификат ${record.regNumber} удалён`);
      await loadData(token);
    } catch (error) {
      showNotice((error as Error).message || "Не удалось удалить сертификат", "error");
    }
  };

  const handleApprove = async (id: string) => {
    if (!token) return;
    try {
      await fetchJson(`${API_BASE}/certificates/${id}/approve`, token, { method: "POST" });
      showNotice("Сертификат подтверждён");
      await loadData(token);
    } catch (error) {
      showNotice((error as Error).message || "Ошибка подтверждения", "error");
    }
  };

  const handleRevoke = async (id: string) => {
    if (!token) return;
    try {
      await fetchJson(`${API_BASE}/certificates/${id}/revoke`, token, { method: "POST" });
      showNotice("Сертификат аннулирован");
      await loadData(token);
    } catch (error) {
      showNotice((error as Error).message || "Ошибка аннулирования", "error");
    }
  };

  const filteredCertificates = useMemo(() => {
    return certificates.filter((item) => {
      const haystack = `${item.fullName} ${item.regNumber}`.toLowerCase();
      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [certificates, search, statusFilter]);

  const generateQr = async (record: Certificate) => {
    const qrDataUrl = record.qrUrl || await createQrDataUrl(record);
    setCertificates((prev) => prev.map((item) => (item.id === record.id ? { ...item, qrUrl: qrDataUrl } : item)));
    return qrDataUrl;
  };

  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const rows = filteredCertificates.map((record) => ({
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
      await downloadRegistryPdf(filteredCertificates, "реестр_сертификатов.pdf");
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

  if (!user || !token) {
    return (
      <Box className="registry-root registry-landing" sx={{ minHeight: "100vh", background: "linear-gradient(180deg, #f5f8fc 0%, #edf3f8 100%)", color: "#132238" }}>
        <AppBar className="registry-appbar" position="sticky" color="transparent" elevation={0} sx={{ backdropFilter: "blur(10px)", background: "rgba(255,255,255,0.74)", borderBottom: "1px solid #dfeaf7" }}>
          <Toolbar className="registry-toolbar" sx={{ maxWidth: 1400, width: "100%", mx: "auto", minHeight: 88 }}>
            <CompanyIdentity className="registry-brand" />
            <Button className="registry-nav-link" href="/architecture" variant="outlined" sx={{ flexShrink: 0, borderRadius: 2 }}>
              Сомонаи пажӯҳишгоҳ
            </Button>
          </Toolbar>
        </AppBar>

        <Container className="registry-container" maxWidth="xl" sx={{ py: 4 }}>
          {notice && (
            <Alert severity={noticeSeverity} sx={{ mb: 3 }} onClose={() => setNotice("")}>
              {notice}
            </Alert>
          )}

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

          <Grid className="registry-auth-grid" container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12 }}>
              <Box className="registry-auth-panel" sx={{ p: 2.5, borderRadius: 3, border: "1px solid #dfeaf7", background: "#f8fbff" }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 3 }}>
                  <Button
                    type="button"
                    variant={authMode === "login" ? "contained" : "outlined"}
                    onClick={() => {
                      setAuthMode("login");
                      setLoginError("");
                      setRegisterError("");
                    }}
                    sx={{ flex: 1, borderRadius: 2, py: 1.2, fontWeight: 700 }}
                  >
                    Войти
                  </Button>
                  <Button
                    type="button"
                    variant={authMode === "register" ? "contained" : "outlined"}
                    onClick={() => {
                      setAuthMode("register");
                      setLoginError("");
                      setRegisterError("");
                    }}
                    sx={{ flex: 1, borderRadius: 2, py: 1.2, fontWeight: 700 }}
                  >
                    Регистрация заявителя
                  </Button>
                </Stack>

                {authMode === "login" ? (
                  <>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Вход в личный кабинет</Typography>
                    <form onSubmit={handleLogin}>
                      <Stack spacing={2}>
                        <TextField required label="Код пользователя или администратора" value={loginCode} onChange={(e) => setLoginCode(e.target.value)} fullWidth slotProps={{ htmlInput: { minLength: 3 }, input: { startAdornment: <InputAdornment position="start"><Badge /></InputAdornment> } }} />
                        <TextField required label="Пароль" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} fullWidth slotProps={{ htmlInput: { minLength: 4 }, input: { startAdornment: <InputAdornment position="start"><Lock /></InputAdornment> } }} />
                        {loginError && <Alert severity="error">{loginError}</Alert>}
                        <Button type="submit" variant="contained" size="large" disabled={loadingLogin} sx={{ borderRadius: 2, py: 1.4, fontWeight: 700 }}>
                          {loadingLogin ? "Вход..." : "Войти"}
                        </Button>
                      </Stack>
                    </form>
                  </>
                ) : (
                  <>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Регистрация заявителя</Typography>
                    <form onSubmit={handleRegister}>
                      <Stack spacing={2}>
                        <TextField required label="ФИО" value={registerName} onChange={(e) => setRegisterName(e.target.value)} fullWidth slotProps={{ htmlInput: { minLength: 3 } }} />
                        <TextField required label="Придумайте код" value={registerCode} onChange={(e) => setRegisterCode(e.target.value)} fullWidth slotProps={{ htmlInput: { minLength: 3 } }} />
                        <TextField required label="Пароль" type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} fullWidth slotProps={{ htmlInput: { minLength: 4 } }} />
                        {registerError && <Alert severity="error">{registerError}</Alert>}
                        <Button type="submit" variant="contained" size="large" disabled={loadingRegister} sx={{ borderRadius: 2, py: 1.4, fontWeight: 700 }}>
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
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Поиск по ФИО или номеру"
                  size="small"
                  sx={{ width: { xs: "100%", sm: 300 } }}
                  slotProps={{
                    htmlInput: { "aria-label": "Поиск по открытому реестру" },
                    input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> },
                  }}
                />
                <Button
                  onClick={exportPdf}
                  variant="contained"
                  startIcon={<PictureAsPdf />}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  Скачать реестр PDF
                </Button>
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
                        <Chip label={statusLabels[record.status]} color={record.status === "published" ? "success" : record.status === "revoked" ? "error" : "warning"} size="small" />
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
          </Paper>
        </Container>
      </Box>
    );
  }

  const canManage = user.role === "admin" || isApplicant;

  return (
    <Box className="registry-root registry-dashboard" sx={{ minHeight: "100vh", background: "linear-gradient(180deg, #f5f8fc 0%, #edf3f8 100%)", color: "#132238" }}>
      <AppBar className="registry-appbar" position="sticky" color="transparent" elevation={0} sx={{ backdropFilter: "blur(10px)", background: "rgba(255,255,255,0.74)", borderBottom: "1px solid #dfeaf7" }}>
        <Toolbar className="registry-toolbar" sx={{ maxWidth: 1400, width: "100%", mx: "auto", minHeight: 88 }}>
        <CompanyIdentity className="registry-brand" />

          <Stack className="registry-toolbar-actions" direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Button href="/architecture" variant="outlined" sx={{ borderRadius: 2 }}>
              Сомонаи пажӯҳишгоҳ
            </Button>
            <Chip icon={<ShieldOutlined />} label={roleLabels[user.role]} color={user.role === "admin" ? "success" : "warning"} />
            <Typography variant="body2" sx={{ fontWeight: 700, color: "#1e293b" }}>{user.name}</Typography>
            <IconButton color="primary" onClick={handleLogout} aria-label="logout">
              <ExitToApp />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container className="registry-container" maxWidth="xl" sx={{ py: 4 }}>
        {notice && (
          <Alert severity={noticeSeverity} sx={{ mb: 3 }} onClose={() => setNotice("")}>
            {notice}
          </Alert>
        )}

        {user.role === "admin" && (
          <Paper className="registry-admin-welcome" sx={{ mb: 3 }}>
            <Box>
              <Typography variant="overline">ГОСУДАРСТВЕННЫЙ РЕЕСТР · ПАНЕЛЬ УПРАВЛЕНИЯ</Typography>
              <Typography variant="h4">Здравствуйте, {user.name}</Typography>
              <Typography variant="body1">
                Управляйте заявками, сертификатами, публикациями и сведениями реестра из одного рабочего пространства.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
              <Chip
                icon={<ShieldOutlined />}
                label={`${certificates.filter((item) => item.status === "pending").length} на проверке`}
                className="registry-admin-pending"
              />
              <Button
                variant="contained"
                onClick={() => certificateFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                Добавить сертификат
              </Button>
            </Stack>
          </Paper>
        )}

        {!isApplicant && <Grid container spacing={3} sx={{ mb: 3 }}>
          {[
            { label: "Всего сертификатов", value: dashboard?.total ?? 0, color: "#1d4ed8", icon: <TableChart /> },
            { label: "Действующих", value: dashboard?.active ?? 0, color: "#0f9f6e", icon: <Verified /> },
            { label: "Аннулировано", value: dashboard?.revoked ?? 0, color: "#e11d48", icon: <Shield /> },
            { label: "Заявителей", value: dashboard?.applicants ?? 0, color: "#f59e0b", icon: <Person /> },
          ].map((item) => (
            <Grid key={item.label} size={{ xs: 12, sm: 6, md: 3 }}>
              <Card className="registry-stat-card" sx={{ borderRadius: 3, border: "1px solid #e2e8f0", boxShadow: "0 12px 28px rgba(15,23,42,0.06)" }}>
                <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box sx={{ background: `${item.color}15`, color: item.color, borderRadius: 2, p: 1.4, display: "grid", placeItems: "center" }}>{item.icon}</Box>
                  <Box sx={{ textAlign: "right" }}>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: "#0f172a" }}>{item.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>}

        {isApplicant && (
          <Paper sx={{ p: 3, mb: 3, borderRadius: 4, border: "1px solid #dfeaf7", background: "#f8fbff" }}>
            <Typography variant="overline" color="primary.main" sx={{ letterSpacing: 2, fontWeight: 700 }}>Личный кабинет заявителя</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>Здравствуйте, {user.name}</Typography>
            <Typography color="text.secondary">
              Заполните форму, чтобы отправить сведения на проверку. Здесь вы сможете следить за статусом и результатом рассмотрения своих заявок.
            </Typography>
          </Paper>
        )}

        {!isApplicant && <Paper className="registry-section-paper" sx={{ p: 3, mb: 3, borderRadius: 4, border: "1px solid #dfeaf7" }}>
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
              { label: "Мои заявки", value: certificates.length, color: "#1d4ed8" },
              { label: "На рассмотрении", value: certificates.filter((item) => item.status === "pending").length, color: "#f59e0b" },
              { label: "Опубликовано", value: certificates.filter((item) => item.status === "published").length, color: "#0f9f6e" },
            ].map((item) => (
              <Grid key={item.label} size={{ xs: 12, sm: 4 }}>
                <Card sx={{ borderRadius: 3, border: "1px solid #e2e8f0" }}>
                  <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography color="text.secondary">{item.label}</Typography>
                    <Typography variant="h4" sx={{ color: item.color, fontWeight: 800 }}>{item.value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        <Grid container spacing={3} sx={{ mb: 3 }}>
          {canManage && (
            <Grid size={{ xs: 12, lg: isApplicant ? 12 : 7 }}>
              <Paper ref={certificateFormRef} className="registry-section-paper" sx={{ p: 3, borderRadius: 4, border: "1px solid #dfeaf7", scrollMarginTop: 100 }}>
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
                    <Grid size={{ xs: 12, sm: 6 }}><TextField required fullWidth label="ФИО специалиста" value={form.fullName} onChange={(e) => handleChange("fullName", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="date" label="Дата рождения" slotProps={{ inputLabel: { shrink: true } }} value={form.birthDate} onChange={(e) => handleChange("birthDate", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Место работы" value={form.workplace} onChange={(e) => handleChange("workplace", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Должность" value={form.position} onChange={(e) => handleChange("position", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField required fullWidth label="Специальность" value={form.specialty} onChange={(e) => handleChange("specialty", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField fullWidth select label="Вид обучения" value={form.trainingType} onChange={(e) => handleChange("trainingType", e.target.value)}>
                        {['Первоначальное обучение', 'Переподготовка', 'Повышение квалификации'].map((option) => (
                          <MenuItem key={option} value={option}>{option}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField required fullWidth label="Учебный центр" value={form.trainingCenter} onChange={(e) => handleChange("trainingCenter", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField required fullWidth label="Название курса" value={form.courseName} onChange={(e) => handleChange("courseName", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="date" label="Дата начала" slotProps={{ inputLabel: { shrink: true } }} value={form.startDate} onChange={(e) => handleChange("startDate", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="date" label="Дата окончания" slotProps={{ inputLabel: { shrink: true } }} value={form.endDate} onChange={(e) => handleChange("endDate", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Учебных часов" value={form.hours} onChange={(e) => handleChange("hours", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Результат аттестации" value={form.result} onChange={(e) => handleChange("result", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="date" label="Дата выдачи сертификата" slotProps={{ inputLabel: { shrink: true } }} value={form.certificateDate} onChange={(e) => handleChange("certificateDate", e.target.value)} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Срок действия" value={form.validityPeriod} onChange={(e) => handleChange("validityPeriod", e.target.value)} /></Grid>
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

          {!isApplicant && <Grid size={{ xs: 12, lg: canManage ? 5 : 12 }}>
            <Paper sx={{ p: 3, borderRadius: 4, border: "1px solid #dfeaf7", height: "100%" }}>
              <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 3 }}>
                <BarChart color="primary" />
                <Typography variant="h5" sx={{ fontWeight: 800 }}>Аналитическая панель</Typography>
              </Stack>

              <Stack spacing={2}>
                {yearStats.length === 0 ? <Typography color="text.secondary">Нет данных</Typography> : yearStats.map(([year, count]) => (
                  <Box key={year}>
                    <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">{year}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{count}</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={(count / maxYearValue) * 100} sx={{ height: 8, borderRadius: 999 }} />
                  </Box>
                ))}
              </Stack>

              <Divider sx={{ my: 3 }} />

              <Stack spacing={2}>
                {productStats.length === 0 ? <Typography color="text.secondary">Нет данных</Typography> : productStats.map(([label, count]) => (
                  <Box key={label}>
                    <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">{label}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{count}</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={(count / maxProductValue) * 100} sx={{ height: 8, borderRadius: 999, backgroundColor: "#dbeafe" }} />
                  </Box>
                ))}
              </Stack>
            </Paper>
          </Grid>}
        </Grid>

        <Paper sx={{ p: 3, mb: 3, borderRadius: 4, border: "1px solid #dfeaf7" }}>
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
        </Paper>

        <Paper className="registry-section-paper registry-table-paper" sx={{ p: 3, borderRadius: 4, border: "1px solid #dfeaf7" }}>
          <Stack direction={{ xs: "column", md: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" }, mb: 3, gap: 2 }}>
            <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
              <Visibility color="primary" />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {isApplicant ? "Мои заявки" : user.role === "admin" ? "Заявки и реестр" : "Открытый реестр"}
              </Typography>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { xs: "stretch", sm: "center" } }}>
              {isApplicant && (
                <Button onClick={() => loadData(token)} variant="outlined">
                  Обновить статусы
                </Button>
              )}
              {!isApplicant && <TextField value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по ФИО или номеру" size="small" slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }} />}
              <TextField select size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | Status)} label="Статус">
                <MenuItem value="all">Все</MenuItem>
                <MenuItem value="published">Опубликован</MenuItem>
                <MenuItem value="pending">На утверждении</MenuItem>
                <MenuItem value="revoked">Аннулирован</MenuItem>
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
                      <Chip label={statusLabels[record.status]} color={record.status === "published" ? "success" : record.status === "revoked" ? "error" : "warning"} size="small" />
                    </TableCell>
                    <TableCell>
                      {record.qrUrl ? <Image unoptimized src={record.qrUrl} alt="QR" width={42} height={42} style={{ width: 42, height: 42, borderRadius: 8, border: "1px solid #dfeaf7" }} /> : <QrCode color="disabled" />}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                        {user.role === "admin" && record.status !== "published" && (
                          <Button size="small" variant="contained" color="success" onClick={() => handleApprove(record.id)}>
                            {record.status === "revoked" ? "Восстановить и опубликовать" : "Опубликовать"}
                          </Button>
                        )}
                        {user.role === "admin" && (
                          <Button size="small" variant="outlined" startIcon={<EditOutlined />} onClick={() => handleEditCertificate(record)}>Редактировать</Button>
                        )}
                        {user.role === "admin" && (
                          <Button size="small" variant="outlined" color="error" startIcon={<DeleteOutlined />} onClick={() => handleDeleteCertificate(record)}>Удалить</Button>
                        )}
                        {user.role === "admin" && (
                          <Button size="small" variant="contained" color="error" onClick={() => handleRevoke(record.id)}>Аннулировать</Button>
                        )}
                        <Button size="small" variant="outlined" onClick={() => exportCard(record)}>PDF</Button>
                        <Button size="small" variant="outlined" color="primary" onClick={async () => { await generateQr(record); }}>QR</Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {user.role === "admin" && <Paper sx={{ mt: 3, p: 3, borderRadius: 4, border: "1px solid #dfeaf7" }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 2 }}>
            <CheckCircle color="success" />
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Журнал аудита</Typography>
          </Stack>
          <Stack spacing={1.5}>
            {audit.map((entry) => (
              <Box key={entry.id} sx={{ p: 1.6, borderRadius: 2, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <Typography variant="body2">{entry.message}</Typography>
                <Typography variant="caption" color="text.secondary">{formatDate(entry.created_at)}</Typography>
              </Box>
            ))}
          </Stack>
        </Paper>}

        {loadingData && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
          </Box>
        )}
      </Container>
    </Box>
  );
}
