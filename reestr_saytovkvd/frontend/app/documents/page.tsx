"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DeleteOutlined, Download, EditOutlined, DescriptionOutlined, UploadFile } from "@mui/icons-material";
import { API_BASE } from "../api-config";
import SiteNavigation from "../site-navigation";
import SiteFooter from "../site-footer";
import DashboardSidebar from "../dashboard-sidebar";
import { motion } from "framer-motion";
import { useTr } from "../i18n";

const categories = [
  { id: "normative", label: "Нормативные документы", tg: "Ҳуҷҷатҳои меъёрӣ" },
  { id: "orders", label: "Приказы и распоряжения", tg: "Фармонҳо ва амрҳо" },
  { id: "methodical", label: "Методические материалы", tg: "Маводҳои методӣ" },
  { id: "forms", label: "Бланки и формы", tg: "Бланкаҳо ва шаклҳо" },
  { id: "other", label: "Другие документы", tg: "Ҳуҷҷатҳои дигар" },
];

type DocumentItem = {
  id: string;
  title: string;
  category: string;
  description: string;
  filename: string;
  content_type: string;
  file_size: number;
  created_at: string;
};

type AdminAuth = { user: { role: string } } | null;
type DashboardRole = "admin" | "applicant";
type DocumentForm = { title: string; category: string; description: string };
const emptyForm: DocumentForm = { title: "", category: "normative", description: "" };

function getErrorMessage(body: string, fallback: string) {
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
  } catch {
    if (body) return body;
  }
  return fallback;
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

export default function DocumentsPage() {
  const tr = useTr();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [auth, setAuth] = useState<AdminAuth>(null);
  const [dashboardRole, setDashboardRole] = useState<DashboardRole | null>(null);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<DocumentForm>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [editingDocument, setEditingDocument] = useState<DocumentItem | null>(null);
  const [editingForm, setEditingForm] = useState<DocumentForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchDocuments = useCallback(async () => {
    const response = await fetch(`${API_BASE}/documents`, { credentials: "include" });
    if (!response.ok) throw new Error(getErrorMessage(await response.text(), "Не удалось загрузить документы"));
    return response.json() as Promise<DocumentItem[]>;
  }, []);

  const loadDocuments = useCallback(async () => {
    setDocuments(await fetchDocuments());
  }, [fetchDocuments]);

  useEffect(() => {
    const updateAuth = () => {
      try {
        const stored = JSON.parse(window.localStorage.getItem("gov_registry_auth") || "null") as { token?: string; user?: { role: string } } | null;
        const role = stored?.user?.role;
        setDashboardRole(role === "admin" || role === "applicant" ? role : null);
        const nextAuth = role === "admin" && stored?.user ? { user: stored.user } : null;
        if (stored?.token && nextAuth) window.localStorage.setItem("gov_registry_auth", JSON.stringify(nextAuth));
        setAuth(nextAuth);
      } catch {
        setAuth(null);
        setDashboardRole(null);
      }
    };
    updateAuth();
    window.addEventListener("storage", updateAuth);
    window.addEventListener("gov-registry-auth", updateAuth);
    return () => {
      window.removeEventListener("storage", updateAuth);
      window.removeEventListener("gov-registry-auth", updateAuth);
    };
  }, []);

  useEffect(() => {
    fetchDocuments()
      .then(setDocuments)
      .catch((loadError: unknown) => {
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить документы");
      })
      .finally(() => setLoading(false));
  }, [fetchDocuments]);

  const filteredDocuments = useMemo(() => documents.filter((document) => {
    const matchesCategory = category === "all" || document.category === category;
    const matchesSearch = `${document.title} ${document.description} ${document.filename}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase());
    return matchesCategory && matchesSearch;
  }), [category, documents, search]);

  const uploadDocument = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth || !file) {
      setError("Выберите файл документа");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const params = new URLSearchParams({
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
      });
      const response = await fetch(`${API_BASE}/documents?${params}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
        },
        body: file,
      });
      if (!response.ok) throw new Error(getErrorMessage(await response.text(), "Не удалось добавить документ"));
      setForm(emptyForm);
      setFile(null);
      const input = document.getElementById("document-file-input") as HTMLInputElement | null;
      if (input) input.value = "";
      setNotice("Документ добавлен и доступен для скачивания");
      await loadDocuments();
    } catch (uploadError) {
      console.error(uploadError);
      setError(uploadError instanceof Error ? uploadError.message : "Не удалось добавить документ");
    } finally {
      setSaving(false);
    }
  };

  const saveMetadata = async () => {
    if (!auth || !editingDocument) return;
    setSaving(true);
    setError("");
    try {
      const params = new URLSearchParams({
        title: editingForm.title.trim(),
        category: editingForm.category,
        description: editingForm.description.trim(),
      });
      const response = await fetch(`${API_BASE}/documents/${encodeURIComponent(editingDocument.id)}?${params}`, {
        method: "PUT",
        credentials: "include",
      });
      if (!response.ok) throw new Error(getErrorMessage(await response.text(), "Не удалось сохранить документ"));
      setEditingDocument(null);
      setNotice("Сведения о документе изменены");
      await loadDocuments();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить документ");
    } finally {
      setSaving(false);
    }
  };

  const removeDocument = async (item: DocumentItem) => {
    if (!auth || !window.confirm(`Удалить документ «${item.title}»?`)) return;
    setError("");
    try {
      const response = await fetch(`${API_BASE}/documents/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error(getErrorMessage(await response.text(), "Не удалось удалить документ"));
      setNotice("Документ удалён");
      await loadDocuments();
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить документ");
    }
  };

  return (
    <Box className={`utility-page utility-page--documents${dashboardRole ? " utility-page--with-dashboard" : ""}`} sx={{ minHeight: "100vh", pb: 6 }}>
      {dashboardRole && <DashboardSidebar role={dashboardRole} />}
      <Box className="utility-page__main">
      <SiteNavigation />

      <Container className="utility-page__container" maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={2.5}>
          <Box className="utility-page__hero">
            <Typography variant="overline">{tr("Открытая библиотека", "Китобхонаи кушод")}</Typography>
            <Typography variant="h3" component="h1" sx={{ fontWeight: 800, fontSize: { xs: 30, md: 40 } }}>
              {tr("Документы и нормативы", "Ҳуҷҷатҳо ва меъёрҳо")}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {tr("Нормативные акты, приказы, методические материалы и формы для скачивания.", "Санадҳои меъёрӣ, фармонҳо, маводҳои методӣ ва шаклҳо барои зеркашӣ.")}
            </Typography>
          </Box>

          {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
          {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}

          {auth?.user.role === "admin" && (
            <Card component="form" onSubmit={uploadDocument} sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 750, mb: 2 }}>Добавить документ (администратор)</Typography>
                <Stack spacing={2}>
                  <TextField
                    required
                    label="Название"
                    value={form.title}
                    slotProps={{ htmlInput: { maxLength: 160 } }}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  />
                  <TextField
                    select
                    label="Категория"
                    value={form.category}
                    onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  >
                    {categories.map((option) => <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>)}
                  </TextField>
                  <TextField
                    multiline
                    minRows={2}
                    label="Описание (необязательно)"
                    value={form.description}
                    slotProps={{ htmlInput: { maxLength: 1000 } }}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  />
                  <Button component="label" variant="outlined" startIcon={<UploadFile />}>
                    {file ? file.name : "Выбрать файл (PDF, Office, RTF, TXT; до 20 МБ)"}
                    <input
                      id="document-file-input"
                      hidden
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.rtf,.txt"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    />
                  </Button>
                  <Button type="submit" variant="contained" disabled={saving || !file} startIcon={<UploadFile />}>
                    {saving ? "Сохраняем..." : "Добавить в библиотеку"}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              fullWidth
              label={tr("Поиск по документам", "Ҷустуҷӯ дар ҳуҷҷатҳо")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <TextField
              select
              label={tr("Категория", "Категория")}
              value={category}
              sx={{ minWidth: { sm: 270 } }}
              onChange={(event) => setCategory(event.target.value)}
            >
              <MenuItem value="all">{tr("Все категории", "Ҳамаи категорияҳо")}</MenuItem>
              {categories.map((option) => <MenuItem key={option.id} value={option.id}>{tr(option.label, option.tg)}</MenuItem>)}
            </TextField>
          </Stack>

          {loading && <Typography color="text.secondary">{tr("Загружаем документы...", "Ҳуҷҷатҳо бор карда мешаванд...")}</Typography>}
          {!loading && filteredDocuments.length === 0 && (
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography color="text.secondary">{tr("Документы пока не добавлены или не найдены.", "Ҳуҷҷатҳо ҳоло илова нашудаанд ё ёфт нашуданд.")}</Typography>
              </CardContent>
            </Card>
          )}
          <Stack spacing={1.5}>
            {filteredDocuments.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.32, delay: Math.min(index * 0.04, 0.2) }}
                whileHover={{ y: -3 }}
              >
                <Card className="documents-card" sx={{ borderRadius: 3 }}>
                <CardContent sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                  <span className="documents-card__icon"><DescriptionOutlined /></span>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 750 }}>{item.title}</Typography>
                    <Typography variant="body2" color="primary.main" sx={{ mt: 0.5 }}>
                      {(() => { const found = categories.find((option) => option.id === item.category); return found ? tr(found.label, found.tg) : item.category; })()}
                    </Typography>
                    {item.description && <Typography color="text.secondary" sx={{ mt: 1, whiteSpace: "pre-line" }}>{item.description}</Typography>}
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                      {item.filename} · {formatFileSize(item.file_size)}
                    </Typography>
                  </Box>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2, justifyContent: "space-between", flexWrap: "wrap" }}>
                  <Button
                    component="a"
                    href={`${API_BASE}/documents/${encodeURIComponent(item.id)}/download`}
                    download
                    variant="contained"
                    startIcon={<Download />}
                  >
                    {tr("Скачать документ", "Зеркашии ҳуҷҷат")}
                  </Button>
                  {auth?.user.role === "admin" && (
                    <Stack direction="row">
                      <Button
                        startIcon={<EditOutlined />}
                        onClick={() => {
                          setEditingDocument(item);
                          setEditingForm({ title: item.title, category: item.category, description: item.description });
                        }}
                      >
                        Изменить
                      </Button>
                      <Button color="error" startIcon={<DeleteOutlined />} onClick={() => void removeDocument(item)}>
                        Удалить
                      </Button>
                    </Stack>
                  )}
                </CardActions>
                </Card>
              </motion.div>
            ))}
          </Stack>
        </Stack>
      </Container>

      <SiteFooter />
      </Box>
      <Dialog open={Boolean(editingDocument)} onClose={() => setEditingDocument(null)} fullWidth maxWidth="sm">
        <DialogTitle>Изменить сведения о документе</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              required
              label="Название"
              value={editingForm.title}
              onChange={(event) => setEditingForm((current) => ({ ...current, title: event.target.value }))}
            />
            <TextField
              select
              label="Категория"
              value={editingForm.category}
              onChange={(event) => setEditingForm((current) => ({ ...current, category: event.target.value }))}
            >
              {categories.map((option) => <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>)}
            </TextField>
            <TextField
              multiline
              minRows={2}
              label="Описание"
              value={editingForm.description}
              onChange={(event) => setEditingForm((current) => ({ ...current, description: event.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingDocument(null)}>Отмена</Button>
          <Button onClick={() => void saveMetadata()} variant="contained" disabled={saving || editingForm.title.trim().length < 3}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
