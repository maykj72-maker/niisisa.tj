"use client";

import { use, useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
import { AddOutlined, DeleteOutlined, EditOutlined } from "@mui/icons-material";
import { API_BASE } from "../../api-config";
import SiteNavigation from "../../site-navigation";
import SiteFooter from "../../site-footer";
import DashboardSidebar from "../../dashboard-sidebar";
import { uploadMediaFile } from "../../media-upload";

type Field = { key: string; label: string; type: "text" | "textarea" | "image"; required?: boolean };
type Schema = Record<string, { title: string; fields: Field[] }>;
type Item = { id: string; position: number; active: boolean; data: Record<string, string> };
type Message = { id: string; name: string; contact: string; message: string; is_read: boolean; created_at: string };
type AuditRow = { id: string; message: string; created_at: string };

async function errorText(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // keep fallback
  }
  return fallback;
}

function useAdminGate() {
  const [state, setState] = useState<"loading" | "admin" | "denied">("loading");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem("gov_registry_auth") || "null") as { user?: { role: string } } | null;
        setState(stored?.user?.role === "admin" ? "admin" : "denied");
      } catch {
        setState("denied");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return state;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}

function MessagesView({ onError }: { onError: (text: string) => void }) {
  const [items, setItems] = useState<Message[]>([]);
  const load = useCallback(async () => {
    const response = await fetch(`${API_BASE}/messages`, { credentials: "include" });
    if (!response.ok) return onError(await errorText(response, "Не удалось загрузить сообщения"));
    setItems((await response.json()) as Message[]);
  }, [onError]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const markRead = async (item: Message) => {
    await fetch(`${API_BASE}/messages/${item.id}/read`, { method: "POST", credentials: "include" });
    await load();
  };
  const remove = async (item: Message) => {
    if (!window.confirm("Удалить сообщение?")) return;
    await fetch(`${API_BASE}/messages/${item.id}`, { method: "DELETE", credentials: "include" });
    await load();
  };
  return (
    <Stack spacing={2}>
      {items.length === 0 && <Typography color="text.secondary">Сообщений пока нет.</Typography>}
      {items.map((item) => (
        <Box key={item.id} className="activities-table" sx={{ p: 2.5 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontWeight: 700 }}>{item.name} · {item.contact}</Typography>
            <Chip size="small" color={item.is_read ? "default" : "primary"} label={item.is_read ? "Прочитано" : "Новое"} />
          </Stack>
          <Typography sx={{ mt: 1, whiteSpace: "pre-wrap" }}>{item.message}</Typography>
          <Typography variant="caption" color="text.secondary">{formatDate(item.created_at)}</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {!item.is_read && <Button size="small" onClick={() => void markRead(item)}>Отметить прочитанным</Button>}
            <Button size="small" color="error" startIcon={<DeleteOutlined />} onClick={() => void remove(item)}>Удалить</Button>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

function LogsView({ onError }: { onError: (text: string) => void }) {
  const [items, setItems] = useState<AuditRow[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const response = await fetch(`${API_BASE}/audit?limit=200`, { credentials: "include" });
      if (!response.ok) return onError(await errorText(response, "Не удалось загрузить журнал"));
      setItems((await response.json()) as AuditRow[]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [onError]);
  return (
    <TableContainer className="activities-table">
      <Table size="small">
        <TableHead><TableRow><TableCell width={190}>Время</TableCell><TableCell>Событие</TableCell></TableRow></TableHead>
        <TableBody>
          {items.map((row) => (
            <TableRow key={row.id} hover><TableCell>{formatDate(row.created_at)}</TableCell><TableCell>{row.message}</TableCell></TableRow>
          ))}
          {items.length === 0 && <TableRow><TableCell colSpan={2} align="center">Записей нет</TableCell></TableRow>}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function CollectionView({ name, onError }: { name: string; onError: (text: string) => void }) {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [data, setData] = useState<Record<string, string>>({});
  const [position, setPosition] = useState(0);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const [schemaResponse, itemsResponse] = await Promise.all([
      fetch(`${API_BASE}/cms/schema`, { credentials: "include" }),
      fetch(`${API_BASE}/cms/${name}`, { credentials: "include" }),
    ]);
    if (!schemaResponse.ok || !itemsResponse.ok) return onError(await errorText(itemsResponse, "Не удалось загрузить раздел"));
    setSchema((await schemaResponse.json()) as Schema);
    setItems((await itemsResponse.json()) as Item[]);
  }, [name, onError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const definition = schema?.[name];
  if (!definition) return <Typography color="text.secondary">Загрузка...</Typography>;

  const open = (item: Item | "new") => {
    setEditing(item);
    setData(item === "new" ? {} : item.data);
    setPosition(item === "new" ? 0 : item.position);
    setActive(item === "new" ? true : item.active);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const isNew = editing === "new";
      const response = await fetch(`${API_BASE}/cms/${name}${isNew ? "" : `/${editing.id}`}`, {
        method: isNew ? "POST" : "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, position: Number(position) || 0, active }),
      });
      if (!response.ok) throw new Error(await errorText(response, "Не удалось сохранить"));
      setEditing(null);
      await load();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: Item) => {
    if (!window.confirm(`Удалить «${item.data.title ?? ""}»?`)) return;
    const response = await fetch(`${API_BASE}/cms/${name}/${item.id}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) onError(await errorText(response, "Не удалось удалить"));
    await load();
  };

  const upload = async (key: string, file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const media = await uploadMediaFile(file);
      setData((current) => ({ ...current, [key]: media.src }));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось загрузить файл");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Box><Button variant="contained" startIcon={<AddOutlined />} onClick={() => open("new")}>Добавить</Button></Box>
      <TableContainer className="activities-table">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={80}>Порядок</TableCell>
              <TableCell>Название</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell align="right">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>{item.position}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{item.data.title || "—"}</TableCell>
                <TableCell><Chip size="small" color={item.active ? "success" : "default"} label={item.active ? "Активно" : "Скрыто"} /></TableCell>
                <TableCell align="right">
                  <Button size="small" startIcon={<EditOutlined />} onClick={() => open(item)}>Изменить</Button>
                  <Button size="small" color="error" startIcon={<DeleteOutlined />} onClick={() => void remove(item)}>Удалить</Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={4} align="center">Записей нет</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={editing !== null} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>{definition.title}: {editing === "new" ? "новая запись" : "изменить"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {definition.fields.map((field) =>
              field.type === "image" ? (
                <Stack key={field.key} spacing={1}>
                  <Typography variant="body2" color="text.secondary">{field.label}</Typography>
                  {data[field.key] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data[field.key]} alt="" style={{ maxWidth: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 8 }} />
                  )}
                  <Stack direction="row" spacing={1}>
                    <Button component="label" variant="outlined" disabled={uploading}>
                      {uploading ? "Загрузка..." : "Загрузить файл"}
                      <input hidden type="file" accept="image/*" onChange={(e) => { void upload(field.key, e.target.files?.[0]); e.target.value = ""; }} />
                    </Button>
                    {data[field.key] && <Button color="error" onClick={() => setData({ ...data, [field.key]: "" })}>Убрать</Button>}
                  </Stack>
                </Stack>
              ) : (
                <TextField
                  key={field.key}
                  label={field.label}
                  required={field.required}
                  multiline={field.type === "textarea"}
                  minRows={field.type === "textarea" ? 3 : undefined}
                  value={data[field.key] ?? ""}
                  onChange={(e) => setData({ ...data, [field.key]: e.target.value })}
                />
              ),
            )}
            <TextField label="Порядок" type="number" value={position} onChange={(e) => setPosition(Number(e.target.value))} />
            <FormControlLabel control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />} label="Активно (показывать на сайте)" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Отмена</Button>
          <Button variant="contained" disabled={saving || uploading} onClick={() => void save()}>Сохранить</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

const TITLES: Record<string, string> = {
  slides: "Слайды", "home-blocks": "Блоки главной", advantages: "Преимущества", products: "Наши продукты",
  goods: "Товары", "goods-categories": "Категории товаров", projects: "Проекты", "project-categories": "Категории проектов",
  pages: "Страницы", about: "О предприятии", settings: "Настройки", messages: "Сообщения и обратная связь", logs: "Логи",
};

export default function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = use(params);
  const gate = useAdminGate();
  const [error, setError] = useState("");
  const onError = useCallback((text: string) => setError(text), []);
  const title = TITLES[section];

  return (
    <Box className="utility-page utility-page--documents utility-page--with-dashboard" sx={{ minHeight: "100vh", pb: 6 }}>
      {gate === "admin" && <DashboardSidebar role="admin" />}
      <Box className="utility-page__main">
        <SiteNavigation />
        <Container className="utility-page__container" maxWidth="lg" sx={{ py: 4 }}>
          <Stack spacing={2.5}>
            <Box className="utility-page__hero">
              <Typography variant="overline">Администрирование</Typography>
              <Typography variant="h3" component="h1" sx={{ fontWeight: 800, fontSize: { xs: 30, md: 40 } }}>
                {title ?? "Раздел не найден"}
              </Typography>
            </Box>
            {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
            {gate === "denied" && <Alert severity="warning">Раздел доступен только администратору. Войдите как администратор.</Alert>}
            {gate === "admin" && title && (
              section === "messages" ? <MessagesView onError={onError} /> :
              section === "logs" ? <LogsView onError={onError} /> :
              <CollectionView name={section} onError={onError} />
            )}
          </Stack>
        </Container>
        <SiteFooter />
      </Box>
    </Box>
  );
}
