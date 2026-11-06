"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
import { AddOutlined, DeleteOutlined, EditOutlined } from "@mui/icons-material";
import { API_BASE } from "../api-config";
import SiteNavigation from "../site-navigation";
import SiteFooter from "../site-footer";
import DashboardSidebar from "../dashboard-sidebar";
import { useTr } from "../i18n";

type Activity = { id: string; position: number; title: string; head: string; active: boolean };
type Role = "admin" | "applicant" | null;
const empty = { title: "", head: "", position: 0, active: true };

async function errorText(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // keep fallback
  }
  return fallback;
}

export default function ActivitiesPage() {
  const tr = useTr();
  const [items, setItems] = useState<Activity[]>([]);
  const [role, setRole] = useState<Role>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Activity | "new" | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/activities`, { credentials: "include" });
      if (!response.ok) throw new Error();
      setItems((await response.json()) as Activity[]);
    } catch {
      setError("Не удалось загрузить список направлений");
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      try {
        const stored = JSON.parse(window.localStorage.getItem("gov_registry_auth") || "null") as { user?: { role: string } } | null;
        const value = stored?.user?.role;
        setRole(value === "admin" || value === "applicant" ? value : null);
      } catch {
        setRole(null);
      }
    };
    sync();
    const timer = window.setTimeout(() => void load(), 0);
    window.addEventListener("storage", sync);
    window.addEventListener("gov-registry-auth", sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", sync);
      window.removeEventListener("gov-registry-auth", sync);
    };
  }, [load]);

  const isAdmin = role === "admin";

  const openEditor = (item: Activity | "new") => {
    setEditing(item);
    setForm(item === "new" ? { ...empty, position: (items.at(-1)?.position ?? 0) + 1 } : { title: item.title, head: item.head, position: item.position, active: item.active });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      const isNew = editing === "new";
      const response = await fetch(`${API_BASE}/activities${isNew ? "" : `/${editing.id}`}`, {
        method: isNew ? "POST" : "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, position: Number(form.position) || 0 }),
      });
      if (!response.ok) throw new Error(await errorText(response, "Не удалось сохранить"));
      setEditing(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: Activity) => {
    if (!window.confirm(`Удалить «${item.title}»?`)) return;
    const response = await fetch(`${API_BASE}/activities/${item.id}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) setError(await errorText(response, "Не удалось удалить"));
    await load();
  };

  return (
    <Box className={`utility-page utility-page--documents${role ? " utility-page--with-dashboard" : ""}`} sx={{ minHeight: "100vh", pb: 6 }}>
      {role && <DashboardSidebar role={role} />}
      <Box className="utility-page__main">
        <SiteNavigation />
        <Container className="utility-page__container" maxWidth="lg" sx={{ py: 4 }}>
          <Stack spacing={2.5}>
            <Box className="utility-page__hero">
              <Typography variant="overline">{tr("ГУП НИИСА", "КВД ПИСМ")}</Typography>
              <Typography variant="h3" component="h1" sx={{ fontWeight: 800, fontSize: { xs: 30, md: 40 } }}>
                {tr("Наша деятельность", "Фаъолияти мо")}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                {tr("Отделы, лаборатории и центры института и их руководители.", "Шӯъбаҳо, озмоишгоҳ ва марказҳои пажӯҳишгоҳ ва роҳбарони онҳо.")}
              </Typography>
            </Box>
            {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
            {isAdmin && (
              <Box><Button variant="contained" startIcon={<AddOutlined />} onClick={() => openEditor("new")}>Добавить направление</Button></Box>
            )}
            <TableContainer className="activities-table">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell width={80}>{tr("Порядок", "Тартиб")}</TableCell>
                    <TableCell>{tr("Название", "Ном")}</TableCell>
                    <TableCell>{tr("Руководитель", "Роҳбар")}</TableCell>
                    <TableCell>{tr("Статус", "Ҳолат")}</TableCell>
                    {isAdmin && <TableCell align="right">Действия</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>{item.position}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{item.title}</TableCell>
                      <TableCell>{item.head || "—"}</TableCell>
                      <TableCell><Chip size="small" color={item.active ? "success" : "default"} label={item.active ? tr("Активно", "Фаъол") : tr("Скрыто", "Пинҳон")} /></TableCell>
                      {isAdmin && (
                        <TableCell align="right">
                          <Button size="small" startIcon={<EditOutlined />} onClick={() => openEditor(item)}>Изменить</Button>
                          <Button size="small" color="error" startIcon={<DeleteOutlined />} onClick={() => void remove(item)}>Удалить</Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {items.length === 0 && <TableRow><TableCell colSpan={5} align="center">{tr("Записей нет", "Сабтҳо нест")}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </Container>
        <SiteFooter />
      </Box>
      <Dialog open={editing !== null} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>{editing === "new" ? "Новое направление" : "Изменить направление"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Название" value={form.title} multiline minRows={2} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <TextField label="Руководитель" value={form.head} onChange={(e) => setForm({ ...form, head: e.target.value })} />
            <TextField label="Порядок" type="number" value={form.position} onChange={(e) => setForm({ ...form, position: Number(e.target.value) })} />
            <FormControlLabel control={<Switch checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />} label="Активно (показывать на сайте)" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Отмена</Button>
          <Button variant="contained" disabled={saving || form.title.trim().length < 2} onClick={() => void save()}>Сохранить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
