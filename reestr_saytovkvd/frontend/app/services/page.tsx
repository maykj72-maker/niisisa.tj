"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Container,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AssignmentOutlined, ArrowForward, CheckCircleOutlined } from "@mui/icons-material";
import { API_BASE } from "../api-config";
import SiteNavigation from "../site-navigation";
import SiteFooter from "../site-footer";
import DashboardSidebar from "../dashboard-sidebar";
import { motion } from "framer-motion";
import { useTr } from "../i18n";

const serviceInfo: Record<string, string> = {
  "urban-planning": "Генеральные планы городов, планировка территорий и транспортная инфраструктура.",
  design: "Проектирование жилых, общественных и инфраструктурных объектов.",
  inspection: "Техническое обследование зданий и инженерные изыскания.",
  laboratory: "Испытания строительных материалов и контроль их качества.",
  standards: "Разработка и предоставление нормативных и методических материалов.",
  training: "Повышение квалификации, обучение и аттестация специалистов.",
  digital: "Цифровые услуги и профессиональные консультации.",
  printing: "Печать, сканирование и издательские услуги.",
};
const serviceInfoTg: Record<string, string> = {
  "urban-planning": "Нақшаҳои асосии шаҳрҳо, банақшагирии ҳудудҳо ва инфрасохтори нақлиётӣ.",
  design: "Тарҳрезии объектҳои истиқоматӣ, ҷамъиятӣ ва инфрасохторӣ.",
  inspection: "Баррасии техникии биноҳо ва таҳқиқоти муҳандисӣ.",
  laboratory: "Озмоиши маводҳои сохтмонӣ ва назорати сифати онҳо.",
  standards: "Таҳия ва пешниҳоди маводҳои меъёрӣ ва методӣ.",
  training: "Такмили ихтисос, омӯзиш ва аттестатсияи мутахассисон.",
  digital: "Хизматрасониҳои рақамӣ ва маслиҳатҳои касбӣ.",
  printing: "Чоп, сканер ва хизматрасониҳои нашриётӣ.",
};
const categoryTg: Record<string, string> = {
  "urban-planning": "Шаҳрсозӣ",
  design: "Тарҳрезӣ",
  inspection: "Баррасии техникӣ",
  laboratory: "Озмоишҳои озмоишгоҳӣ",
  standards: "Ҳуҷҷатҳои меъёрӣ",
  training: "Омӯзиш ва аттестатсия",
  digital: "Хизматрасониҳои рақамӣ ва маслиҳат",
  printing: "Чоп ва хизматрасониҳои нашриётӣ",
};
const orderStatusesTg: Record<string, string> = {
  new: "Нав",
  in_progress: "Дар кор",
  completed: "Анҷом ёфт",
  cancelled: "Бекор карда шуд",
};
const orderStatuses: Record<string, string> = {
  new: "Новая",
  in_progress: "В работе",
  completed: "Завершена",
  cancelled: "Отменена",
};

type ServiceCategory = { id: string; title: string };
type Order = {
  id: string;
  customer_name: string;
  category: string;
  service_name: string;
  phone: string;
  organization: string;
  details: string;
  status: string;
  admin_note: string;
  created_at: string;
};
type StoredAuth = { user: { role: string } } | null;
type OrderForm = { category: string; serviceName: string; phone: string; organization: string; details: string };

function readError(responseText: string, fallback: string) {
  try {
    const body = JSON.parse(responseText) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    if (responseText) return responseText;
  }
  return fallback;
}

export default function ServicesPage() {
  const tr = useTr();
  const catTitle = (category: ServiceCategory) => tr(category.title, categoryTg[category.id] ?? category.title);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [auth, setAuth] = useState<StoredAuth>(null);
  const [form, setForm] = useState<OrderForm>({
    category: "urban-planning",
    serviceName: "",
    phone: "",
    organization: "",
    details: "",
  });
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const dashboardRole = auth?.user.role === "admin" || auth?.user.role === "applicant"
    ? auth.user.role
    : null;

  const fetchOrders = useCallback(async () => {
    const response = await fetch(`${API_BASE}/orders`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error(readError(await response.text(), "Не удалось загрузить заявки"));
    return response.json() as Promise<Order[]>;
  }, []);

  const loadOrders = useCallback(async () => {
    const result = await fetchOrders();
    setOrders(result);
    setAdminNotes(Object.fromEntries(result.map((order) => [order.id, order.admin_note || ""])));
  }, [fetchOrders]);

  useEffect(() => {
    const updateAuth = (event?: Event) => {
      try {
        const stored = JSON.parse(window.localStorage.getItem("gov_registry_auth") || "null") as { token?: string; user?: { role: string } } | null;
        const nextAuth = stored?.user?.role ? { user: stored.user } : null;
        if (stored?.token && nextAuth) window.localStorage.setItem("gov_registry_auth", JSON.stringify(nextAuth));
        setAuth(nextAuth);
        if (event) {
          setLoading(Boolean(nextAuth));
          if (!nextAuth) setOrders([]);
        }
      } catch {
        setAuth(null);
        if (event) {
          setLoading(false);
          setOrders([]);
        }
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
    let active = true;
    fetch(`${API_BASE}/service-categories`)
      .then(async (response) => {
        if (!response.ok) throw new Error(readError(await response.text(), "Не удалось загрузить каталог услуг"));
        return response.json() as Promise<ServiceCategory[]>;
      })
      .then((result) => {
        if (!active) return;
        setCategories(result);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить каталог услуг");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!auth) return () => { active = false; };
    fetchOrders()
      .then((result) => {
        if (!active) return;
        setOrders(result);
        setAdminNotes(Object.fromEntries(result.map((order) => [order.id, order.admin_note || ""])));
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить заявки");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [auth, fetchOrders]);

  const submitOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth || auth.user.role !== "applicant") return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: form.category,
          service_name: form.serviceName.trim(),
          phone: form.phone.trim(),
          organization: form.organization.trim(),
          details: form.details.trim(),
        }),
      });
      if (!response.ok) throw new Error(readError(await response.text(), "Не удалось отправить заявку"));
      setForm((current) => ({ ...current, serviceName: "", phone: "", organization: "", details: "" }));
      setNotice("Заявка отправлена. Администратор свяжется с вами.");
      await loadOrders();
    } catch (submitError) {
      console.error(submitError);
      setError(submitError instanceof Error ? submitError.message : "Не удалось отправить заявку");
    } finally {
      setSaving(false);
    }
  };

  const updateOrder = async (order: Order, status: string) => {
    if (!auth || auth.user.role !== "admin") return;
    setError("");
    try {
      const response = await fetch(`${API_BASE}/orders/${encodeURIComponent(order.id)}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, admin_note: adminNotes[order.id] || "" }),
      });
      if (!response.ok) throw new Error(readError(await response.text(), "Не удалось обновить заявку"));
      setNotice("Статус заявки обновлён");
      await loadOrders();
    } catch (updateError) {
      console.error(updateError);
      setError(updateError instanceof Error ? updateError.message : "Не удалось обновить заявку");
    }
  };

  const removeOrder = async (order: Order) => {
    if (!auth || auth.user.role !== "admin" || !window.confirm("Удалить эту заявку?")) return;
    setError("");
    try {
      const response = await fetch(`${API_BASE}/orders/${encodeURIComponent(order.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error(readError(await response.text(), "Не удалось удалить заявку"));
      setNotice("Заявка удалена");
      await loadOrders();
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить заявку");
    }
  };

  return (
    <Box className={`utility-page utility-page--services${dashboardRole ? " utility-page--with-dashboard" : ""}`} sx={{ minHeight: "100vh", pb: 6 }}>
      {dashboardRole && <DashboardSidebar role={dashboardRole} />}
      <Box className="utility-page__main">
      <SiteNavigation />

      <Container className="utility-page__container" maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Box className="utility-page__hero">
            <Typography variant="overline">{tr("Каталог услуг", "Феҳристи хизматрасониҳо")}</Typography>
            <Typography variant="h3" component="h1" sx={{ fontWeight: 800, fontSize: { xs: 30, md: 40 } }}>
              {tr("Услуги и заявки", "Хизматрасониҳо ва дархостҳо")}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {tr("Выберите категорию, укажите задачу и отправьте заявку институту.", "Категорияро интихоб кунед, вазифаро нависед ва дархостро ба пажӯҳишгоҳ фиристед.")}
            </Typography>
          </Box>
          {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
          {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}

          <Box className="utility-page__service-grid" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
            {categories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.32, delay: Math.min(index * 0.05, 0.25) }}
                whileHover={{ y: -4 }}
              >
                <Card sx={{ borderRadius: 3, height: "100%" }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 750 }}>{catTitle(category)}</Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    {tr(serviceInfo[category.id], serviceInfoTg[category.id]) || tr("Услуги и консультации института по этому направлению.", "Хизматрасониҳо ва маслиҳатҳои пажӯҳишгоҳ дар ин самт.")}
                  </Typography>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2 }}>
                  <Button
                    endIcon={<ArrowForward />}
                    onClick={() => {
                      setForm((current) => ({ ...current, category: category.id }));
                      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    {tr("Оставить заявку", "Дархост гузоштан")}
                  </Button>
                </CardActions>
                </Card>
              </motion.div>
            ))}
          </Box>

          {auth?.user.role === "applicant" ? (
            <Card ref={formRef} component="form" onSubmit={submitOrder} sx={{ borderRadius: 3, scrollMarginTop: 24 }}>
              <CardContent>
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>{tr("Заявка на услугу", "Дархост барои хизматрасонӣ")}</Typography>
                <Stack spacing={2}>
                  <TextField
                    select
                    required
                    label={tr("Категория услуги", "Категорияи хизматрасонӣ")}
                    value={form.category}
                    onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  >
                    {categories.map((category) => <MenuItem key={category.id} value={category.id}>{catTitle(category)}</MenuItem>)}
                  </TextField>
                  <TextField
                    required
                    label={tr("Какая услуга вам нужна?", "Кадом хизматрасонӣ ба шумо лозим аст?")}
                    value={form.serviceName}
                    slotProps={{ htmlInput: { minLength: 3, maxLength: 160 } }}
                    onChange={(event) => setForm((current) => ({ ...current, serviceName: event.target.value }))}
                  />
                  <TextField
                    required
                    label={tr("Телефон для связи", "Телефон барои тамос")}
                    value={form.phone}
                    slotProps={{ htmlInput: { maxLength: 32, inputMode: "tel", autoComplete: "tel" } }}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  />
                  <TextField
                    label={tr("Организация (необязательно)", "Ташкилот (ихтиёрӣ)")}
                    value={form.organization}
                    slotProps={{ htmlInput: { maxLength: 160 } }}
                    onChange={(event) => setForm((current) => ({ ...current, organization: event.target.value }))}
                  />
                  <TextField
                    multiline
                    minRows={3}
                    label={tr("Описание задачи", "Шарҳи вазифа")}
                    value={form.details}
                    slotProps={{ htmlInput: { maxLength: 2000 } }}
                    onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))}
                  />
                  <Button type="submit" variant="contained" disabled={saving} startIcon={<AssignmentOutlined />}>
                    {saving ? tr("Отправляем...", "Фиристода истодаем...") : tr("Отправить заявку", "Фиристодани дархост")}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ) : auth?.user.role === "admin" ? (
            <Alert severity="info">
              {tr("Вы вошли как администратор. Заявки отображаются ниже; подавать заявку можно из кабинета заявителя.", "Шумо ҳамчун маъмур ворид шудаед. Дархостҳо дар поён нишон дода мешаванд; дархост гузоштан аз кабинети довталаб имконпазир аст.")}
            </Alert>
          ) : (
            <Alert
              severity="info"
              action={<Button component={Link} href="/" color="inherit">{tr("Войти / регистрация", "Воридшавӣ / бақайдгирӣ")}</Button>}
            >
              {tr("Для отправки и отслеживания заявки войдите в кабинет заявителя.", "Барои фиристодан ва пайгирии дархост ба кабинети довталаб ворид шавед.")}
            </Alert>
          )}

          {auth && (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
                {auth.user.role === "admin" ? tr("Заявки клиентов", "Дархостҳои муштариён") : tr("Мои заявки", "Дархостҳои ман")}
              </Typography>
              {loading ? <Typography color="text.secondary">{tr("Загружаем заявки...", "Дархостҳо бор карда мешаванд...")}</Typography> : orders.length === 0 ? (
                <Card sx={{ borderRadius: 3 }}><CardContent><Typography color="text.secondary">{tr("Заявок пока нет.", "Ҳоло дархост нест.")}</Typography></CardContent></Card>
              ) : (
                <Stack spacing={2}>
                  {orders.map((order) => (
                    <Card key={order.id} sx={{ borderRadius: 3 }}>
                      <CardContent>
                        <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", gap: 1 }}>
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 750 }}>{order.service_name}</Typography>
                            <Typography color="text.secondary">
                              {(() => { const found = categories.find((category) => category.id === order.category); return found ? catTitle(found) : order.category; })()}
                            </Typography>
                          </Box>
                          <Chip
                            icon={<CheckCircleOutlined />}
                            color={order.status === "completed" ? "success" : order.status === "cancelled" ? "default" : "primary"}
                            label={tr(orderStatuses[order.status], orderStatusesTg[order.status]) || order.status}
                          />
                        </Stack>
                        <Typography sx={{ mt: 1 }}>{order.details || tr("Описание не указано", "Шарҳ нишон дода нашудааст")}</Typography>
                        {auth.user.role === "admin" && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {tr("Заявитель", "Довталаб")}: {order.customer_name} · {order.phone}{order.organization ? ` · ${order.organization}` : ""}
                          </Typography>
                        )}
                        {order.admin_note && (
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            {tr("Ответ института", "Ҷавоби пажӯҳишгоҳ")}: {order.admin_note}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                          {new Date(order.created_at).toLocaleString("ru-RU")}
                        </Typography>
                        {auth.user.role === "admin" && (
                          <Stack spacing={1.5} sx={{ mt: 2 }}>
                            <TextField
                              label={tr("Ответ / примечание для заявителя", "Ҷавоб / эзоҳ барои довталаб")}
                              value={adminNotes[order.id] || ""}
                              slotProps={{ htmlInput: { maxLength: 1000 } }}
                              onChange={(event) => setAdminNotes((current) => ({ ...current, [order.id]: event.target.value }))}
                            />
                            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                              {Object.entries(orderStatuses).map(([status, title]) => (
                                <Button key={status} size="small" variant={order.status === status ? "contained" : "outlined"} onClick={() => void updateOrder(order, status)}>
                                  {tr(title, orderStatusesTg[status])}
                                </Button>
                              ))}
                              <Button color="error" size="small" onClick={() => void removeOrder(order)}>{tr("Удалить", "Нест кардан")}</Button>
                            </Stack>
                          </Stack>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </Box>
          )}
        </Stack>
      </Container>
      <SiteFooter />
      </Box>
    </Box>
  );
}
