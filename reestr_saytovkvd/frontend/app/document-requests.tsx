"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Chip, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { API_BASE } from "./api-config";

type DocStatus = "pending" | "published" | "rejected";
type DocumentRequest = {
  id: string;
  title: string;
  category: string;
  description: string;
  filename: string;
  file_size: number;
  created_at: string;
  status: DocStatus;
  owner_name: string;
};

const categories: Record<string, string> = {
  normative: "Нормативные документы",
  orders: "Приказы и распоряжения",
  methodical: "Методические материалы",
  forms: "Бланки и формы",
  other: "Другие документы",
};
const statusLabel: Record<DocStatus, string> = { pending: "На проверке", published: "Подтверждён", rejected: "Отклонён" };
const statusColor: Record<DocStatus, "warning" | "success" | "error"> = { pending: "warning", published: "success", rejected: "error" };
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.rtf,.txt";
const MAX_SIZE = 20 * 1024 * 1024;

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

async function readError(response: Response) {
  const text = await response.text();
  try {
    return (JSON.parse(text) as { detail?: string }).detail || text;
  } catch {
    return text || `Ошибка ${response.status}`;
  }
}

export default function DocumentRequests({ role }: { role: "admin" | "applicant" }) {
  const isAdmin = role === "admin";
  const [items, setItems] = useState<DocumentRequest[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("forms");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/documents/requests`, { credentials: "include" });
      if (response.ok) setItems((await response.json()) as DocumentRequest[]);
    } catch {
      // The list stays as it was when the network is unavailable.
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/documents/requests`, { credentials: "include" })
      .then((response) => (response.ok ? (response.json() as Promise<DocumentRequest[]>) : null))
      .then((data) => {
        if (active && data) setItems(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!file) return setMessage({ type: "error", text: "Выберите файл документа." });
    if (file.size > MAX_SIZE) return setMessage({ type: "error", text: "Максимальный размер файла — 20 МБ." });
    setBusy(true);
    try {
      const query = new URLSearchParams({ title: title.trim(), category, description: description.trim() });
      const response = await fetch(`${API_BASE}/documents?${query.toString()}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
        body: file,
      });
      if (!response.ok) throw new Error(await readError(response));
      setTitle("");
      setDescription("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setMessage({ type: "success", text: isAdmin ? "Документ опубликован." : "Документ отправлен на проверку администратору." });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Не удалось отправить документ." });
    } finally {
      setBusy(false);
    }
  }

  async function review(id: string, action: "approve" | "reject") {
    if (action === "reject" && !window.confirm("Отклонить этот документ?")) return;
    setMessage(null);
    const response = await fetch(`${API_BASE}/documents/${id}/${action}`, { method: "POST", credentials: "include" });
    if (!response.ok) return setMessage({ type: "error", text: await readError(response) });
    setMessage({ type: "success", text: action === "approve" ? "Документ подтверждён и опубликован." : "Документ отклонён." });
    await load();
  }

  const pendingCount = items.filter((item) => item.status === "pending").length;

  return (
    <Paper id="document-requests" className="registry-section-paper" sx={{ p: 3, mt: 3, borderRadius: 4, border: "1px solid #dfeaf7", scrollMarginTop: 100 }}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>{isAdmin ? "Документы на подтверждение" : "Мои документы"}</Typography>
        {isAdmin && <Chip label={`${pendingCount} на проверке`} color={pendingCount ? "warning" : "default"} variant="outlined" />}
      </Stack>

      {message && <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message.text}</Alert>}

      <Box component="form" onSubmit={submit} className="registry-doc-upload">
        <Typography className="registry-doc-upload__hint">
          {isAdmin ? "Опубликовать документ сразу" : "Отправьте документ файлом — после подтверждения он появится в разделе «Документы»."}
        </Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
          <TextField required fullWidth label="Название документа" value={title} onChange={(e) => setTitle(e.target.value)} slotProps={{ htmlInput: { minLength: 3, maxLength: 160 } }} />
          <TextField select fullWidth label="Категория" value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(categories).map(([id, label]) => <MenuItem key={id} value={id}>{label}</MenuItem>)}
          </TextField>
        </Stack>
        <TextField fullWidth multiline minRows={2} label="Описание" value={description} onChange={(e) => setDescription(e.target.value)} sx={{ mb: 2 }} slotProps={{ htmlInput: { maxLength: 1000 } }} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
          <Button component="label" variant="outlined" className="registry-doc-upload__pick">
            {file ? "Заменить файл" : "Выбрать файл"}
            <input ref={fileInput} hidden type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
            {file ? `${file.name} · ${formatSize(file.size)}` : "PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, RTF, TXT · до 20 МБ"}
          </Typography>
          <Button type="submit" variant="contained" disabled={busy}>{busy ? "Отправка..." : isAdmin ? "Опубликовать" : "Отправить на проверку"}</Button>
        </Stack>
      </Box>

      <Stack spacing={1.5} sx={{ mt: 3 }}>
        {items.length === 0 && <Typography color="text.secondary">{isAdmin ? "Документов от заявителей пока нет." : "Вы ещё не отправляли документы."}</Typography>}
        {items.map((item) => (
          <Box key={item.id} className="registry-doc-row">
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {categories[item.category] ?? item.category}
                {isAdmin && item.owner_name ? ` · ${item.owner_name}` : ""} · {item.filename} · {formatSize(item.file_size)} · {new Date(item.created_at).toLocaleDateString("ru-RU")}
              </Typography>
            </Box>
            <Chip size="small" label={statusLabel[item.status]} color={statusColor[item.status]} />
            <Button size="small" component="a" href={`${API_BASE}/documents/${item.id}/download`} target="_blank" rel="noreferrer">Скачать</Button>
            {isAdmin && item.status === "pending" && (
              <>
                <Button size="small" variant="contained" color="success" onClick={() => void review(item.id, "approve")}>Подтвердить</Button>
                <Button size="small" variant="outlined" color="error" onClick={() => void review(item.id, "reject")}>Отклонить</Button>
              </>
            )}
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}
