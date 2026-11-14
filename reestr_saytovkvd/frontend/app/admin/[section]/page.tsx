"use client";

import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
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
import { useTr } from "../../i18n";

type Field = { key: string; label: string; type: "text" | "textarea" | "image" | "number" | "select" | "pdf"; required?: boolean; optionsFrom?: string };
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
  const tr = useTr();
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
    const response = await fetch(`${API_BASE}/messages/${item.id}/read`, { method: "POST", credentials: "include" });
    if (!response.ok) onError(await errorText(response, tr("Не удалось обновить сообщение", "Паёмро нав кардан имконнопазир шуд")));
    await load();
  };
  const remove = async (item: Message) => {
    if (!window.confirm(tr("Удалить сообщение?", "Паём нест карда шавад?"))) return;
    const response = await fetch(`${API_BASE}/messages/${item.id}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) onError(await errorText(response, tr("Не удалось удалить", "Нест кардан имконнопазир шуд")));
    await load();
  };
  return (
    <Stack spacing={2}>
      {items.length === 0 && <Typography color="text.secondary">{tr("Сообщений пока нет.", "Ҳоло паём нест.")}</Typography>}
      {items.map((item) => (
        <Box key={item.id} className="activities-table" sx={{ p: 2.5 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontWeight: 700 }}>{item.name} · {item.contact}</Typography>
            <Chip size="small" color={item.is_read ? "default" : "primary"} label={item.is_read ? tr("Прочитано", "Хонда шуд") : tr("Новое", "Нав")} />
          </Stack>
          <Typography sx={{ mt: 1, whiteSpace: "pre-wrap" }}>{item.message}</Typography>
          <Typography variant="caption" color="text.secondary">{formatDate(item.created_at)}</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {!item.is_read && <Button size="small" onClick={() => void markRead(item)}>{tr("Отметить прочитанным", "Хондашуда қайд кардан")}</Button>}
            <Button size="small" color="error" startIcon={<DeleteOutlined />} onClick={() => void remove(item)}>{tr("Удалить", "Нест кардан")}</Button>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

function LogsView({ onError }: { onError: (text: string) => void }) {
  const tr = useTr();
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
        <TableHead><TableRow><TableCell width={190}>{tr("Время", "Вақт")}</TableCell><TableCell>{tr("Событие", "Ҳодиса")}</TableCell></TableRow></TableHead>
        <TableBody>
          {items.map((row) => (
            <TableRow key={row.id} hover><TableCell>{formatDate(row.created_at)}</TableCell><TableCell>{row.message}</TableCell></TableRow>
          ))}
          {items.length === 0 && <TableRow><TableCell colSpan={2} align="center">{tr("Записей нет", "Сабт нест")}</TableCell></TableRow>}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function CollectionView({ name, onError }: { name: string; onError: (text: string) => void }) {
  const tr = useTr();
  const loadFailText = tr("Не удалось загрузить раздел", "Бахшро бор кардан имконнопазир шуд");
  const [loadFailed, setLoadFailed] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [schema, setSchema] = useState<Schema | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [data, setData] = useState<Record<string, string>>({});
  const [position, setPosition] = useState(0);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [options, setOptions] = useState<Record<string, Item[]>>({});

  const load = useCallback(async () => {
    const [schemaResponse, itemsResponse] = await Promise.all([
      fetch(`${API_BASE}/cms/schema`, { credentials: "include" }),
      fetch(`${API_BASE}/cms/${name}`, { credentials: "include" }),
    ]);
    if (!schemaResponse.ok || !itemsResponse.ok) {
      setLoadFailed(true);
      return onError(await errorText(itemsResponse.ok ? schemaResponse : itemsResponse, loadFailText));
    }
    setLoadFailed(false);
    const loadedSchema = (await schemaResponse.json()) as Schema;
    setSchema(loadedSchema);
    const loaded = (await itemsResponse.json()) as Item[];
    setItems(loaded);
    const sources = Array.from(new Set(loadedSchema[name]?.fields.map((field) => field.optionsFrom).filter(Boolean) as string[]));
    const entries = await Promise.all(sources.map(async (source) => {
      const response = await fetch(`${API_BASE}/cms/${source}`, { credentials: "include" });
      return [source, response.ok ? ((await response.json()) as Item[]) : []] as const;
    }));
    setOptions(Object.fromEntries(entries));
  }, [name, onError, loadFailText]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const definition = schema?.[name];
  if (!definition) return <Typography color="text.secondary">{loadFailed ? tr("Данные недоступны. Войдите заново как администратор.", "Маълумот дастнорас. Аз нав ҳамчун маъмур ворид шавед.") : tr("Загрузка...", "Бор шуда истодааст...")}</Typography>;

  const open = (item: Item | "new") => {
    setEditing(item);
    setDialogError("");
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
      if (!response.ok) throw new Error(await errorText(response, tr("Не удалось сохранить", "Захира кардан имконнопазир шуд")));
      setEditing(null);
      await load();
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : tr("Не удалось сохранить", "Захира кардан имконнопазир шуд"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: Item) => {
    if (!window.confirm(tr(`Удалить «${item.data.title ?? ""}»?`, `«${item.data.title ?? ""}» нест карда шавад?`))) return;
    const response = await fetch(`${API_BASE}/cms/${name}/${item.id}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) onError(await errorText(response, tr("Не удалось удалить", "Нест кардан имконнопазир шуд")));
    await load();
  };

  const upload = async (key: string, file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      let src: string;
      if (file.name.toLowerCase().endsWith(".pdf")) {
        if (file.size > 10 * 1024 * 1024) throw new Error("PDF не должен быть больше 10 МБ");
        const response = await fetch(`${API_BASE}/media`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/pdf", "X-File-Name": encodeURIComponent(file.name) },
          body: file,
        });
        if (!response.ok) throw new Error(await errorText(response, "Не удалось загрузить PDF"));
        src = ((await response.json()) as { url: string }).url;
      } else {
        src = (await uploadMediaFile(file)).src;
      }
      setData((current) => ({ ...current, [key]: src }));
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : tr("Не удалось загрузить файл", "Файлро бор кардан имконнопазир шуд"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Box><Button variant="contained" startIcon={<AddOutlined />} onClick={() => open("new")}>{tr("Добавить", "Илова кардан")}</Button></Box>
      <TableContainer className="activities-table">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={80}>{tr("Порядок", "Тартиб")}</TableCell>
              <TableCell>{tr("Название", "Ном")}</TableCell>
              {name === "goods" && <TableCell>{tr("Цена", "Нарх")}</TableCell>}
              <TableCell>{tr("Статус", "Ҳолат")}</TableCell>
              <TableCell align="right">{tr("Действия", "Амалҳо")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>{item.position}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{item.data.title || "—"}</TableCell>
                {name === "goods" && <TableCell>{item.data.price ? `${item.data.price} ${tr("сом.", "сом.")}` : "—"}</TableCell>}
                <TableCell><Chip size="small" color={item.active ? "success" : "default"} label={item.active ? tr("Активно", "Фаъол") : tr("Скрыто", "Пинҳон")} /></TableCell>
                <TableCell align="right">
                  <Button size="small" startIcon={<EditOutlined />} onClick={() => open(item)}>{tr("Изменить", "Тағйир додан")}</Button>
                  <Button size="small" color="error" startIcon={<DeleteOutlined />} onClick={() => void remove(item)}>{tr("Удалить", "Нест кардан")}</Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={5} align="center">{tr("Записей нет", "Сабт нест")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={editing !== null} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>{tr(definition.title, TITLES_TG[name] ?? definition.title)}: {editing === "new" ? tr("новая запись", "сабти нав") : tr("изменить", "тағйир додан")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {dialogError && <Alert severity="error" onClose={() => setDialogError("")}>{dialogError}</Alert>}
            {definition.fields.map((field) =>
              field.type === "pdf" ? (
                <Stack key={field.key} spacing={1}>
                  <Typography variant="body2" color="text.secondary">{field.label}</Typography>
                  {data[field.key] && <Typography variant="body2" sx={{ wordBreak: "break-all" }}>{data[field.key].split("/").pop()}</Typography>}
                  <Stack direction="row" spacing={1}>
                    <Button component="label" variant="outlined" disabled={uploading}>
                      {uploading ? "Загрузка..." : "Выбрать PDF"}
                      <input hidden type="file" accept="application/pdf,.pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file && !file.name.toLowerCase().endsWith(".pdf")) onError("Нужен файл PDF"); else void upload(field.key, file); e.target.value = ""; }} />
                    </Button>
                    {data[field.key] && <Button color="error" onClick={() => setData({ ...data, [field.key]: "" })}>Убрать</Button>}
                  </Stack>
                </Stack>
              ) : field.type === "select" ? (
                <TextField
                  key={field.key}
                  select
                  label={field.label}
                  value={data[field.key] ?? ""}
                  onChange={(e) => setData({ ...data, [field.key]: e.target.value })}
                  slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                >
                  <option value="">Без категории</option>
                  {(options[field.optionsFrom ?? ""] ?? []).map((option) => (
                    <option key={option.id} value={option.id}>{option.data.title}</option>
                  ))}
                </TextField>
              ) : field.type === "image" ? (
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
                  type={field.type === "number" ? "number" : "text"}
                  slotProps={field.type === "number" ? { htmlInput: { min: 0, step: "0.01" } } : undefined}
                  multiline={field.type === "textarea"}
                  minRows={field.type === "textarea" ? 3 : undefined}
                  value={data[field.key] ?? ""}
                  onChange={(e) => setData({ ...data, [field.key]: e.target.value })}
                />
              ),
            )}
            <TextField label={tr("Порядок", "Тартиб")} type="number" value={position} onChange={(e) => setPosition(Number(e.target.value))} />
            <FormControlLabel control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />} label={tr("Активно (показывать на сайте)", "Фаъол (дар сомона нишон дода шавад)")} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>{tr("Отмена", "Бекор кардан")}</Button>
          <Button variant="contained" disabled={saving || uploading} onClick={() => void save()}>{tr("Сохранить", "Захира кардан")}</Button>
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

const TITLES_TG: Record<string, string> = {
  slides: "Слайдҳо", "home-blocks": "Блокҳои саҳифаи асосӣ", advantages: "Бартариҳо", products: "Маҳсулоти мо",
  goods: "Молҳо", "goods-categories": "Категорияҳои молҳо", projects: "Лоиҳаҳо", "project-categories": "Категорияҳои лоиҳаҳо",
  pages: "Саҳифаҳо", about: "Дар бораи корхона", settings: "Танзимот", messages: "Паёмҳо ва алоқаи баръакс", logs: "Журнал",
};

function AdminSection() {
  const tr = useTr();
  const section = String(useParams<{ section: string }>().section ?? "");
  const gate = useAdminGate();
  const [error, setError] = useState("");
  const onError = useCallback((text: string) => setError(text), []);
  const title = TITLES[section] ? tr(TITLES[section], TITLES_TG[section] ?? TITLES[section]) : undefined;

  return (
    <Box className="utility-page utility-page--documents utility-page--with-dashboard" sx={{ minHeight: "100vh", pb: 6 }}>
      {gate === "admin" && <DashboardSidebar role="admin" />}
      <Box className="utility-page__main">
        <SiteNavigation />
        <Container className="utility-page__container" maxWidth="lg" sx={{ py: 4 }}>
          <Stack spacing={2.5}>
            <Box className="utility-page__hero">
              <Typography variant="overline">{tr("Администрирование", "Идоракунӣ")}</Typography>
              <Typography variant="h3" component="h1" sx={{ fontWeight: 800, fontSize: { xs: 30, md: 40 } }}>
                {title ?? tr("Раздел не найден", "Бахш ёфт нашуд")}
              </Typography>
            </Box>
            {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
            {gate === "denied" && (
              <Alert severity="warning" action={<Button color="inherit" size="small" href="/">{tr("Войти", "Ворид шудан")}</Button>}>
                {tr("Раздел доступен только администратору. Войдите как администратор.", "Ин бахш танҳо барои маъмур дастрас аст. Ҳамчун маъмур ворид шавед.")}
              </Alert>
            )}
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

export default function AdminSectionPage() {
  return (
    <Suspense fallback={null}>
      <AdminSection />
    </Suspense>
  );
}
