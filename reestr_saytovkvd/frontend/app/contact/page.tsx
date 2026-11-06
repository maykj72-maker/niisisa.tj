"use client";

import { useState, type FormEvent } from "react";
import { Alert, Box, Button, Card, CardContent, Container, Stack, TextField, Typography } from "@mui/material";
import { SendOutlined } from "@mui/icons-material";
import { API_BASE } from "../api-config";
import SiteNavigation from "../site-navigation";
import SiteFooter from "../site-footer";
import { useTr } from "../i18n";

export default function ContactPage() {
  const tr = useTr();
  const [form, setForm] = useState({ name: "", contact: "", message: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        let detail = "";
        try {
          const body = (await response.json()) as { detail?: unknown };
          if (typeof body.detail === "string") detail = body.detail;
        } catch {
          // keep fallback
        }
        throw new Error(detail || tr("Не удалось отправить сообщение", "Паём фиристода нашуд"));
      }
      setSent(true);
      setForm({ name: "", contact: "", message: "" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : tr("Не удалось отправить сообщение", "Паём фиристода нашуд"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Box className="utility-page utility-page--documents" sx={{ minHeight: "100vh", pb: 6 }}>
      <Box className="utility-page__main">
        <SiteNavigation />
        <Container className="utility-page__container" maxWidth="md" sx={{ py: 4 }}>
          <Stack spacing={2.5}>
            <Box className="utility-page__hero">
              <Typography variant="overline">{tr("Контакты", "Тамос")}</Typography>
              <Typography variant="h3" component="h1" sx={{ fontWeight: 800, fontSize: { xs: 30, md: 40 } }}>
                {tr("Обратная связь", "Алоқа")}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                {tr("Напишите нам — мы ответим по указанным контактам.", "Ба мо нависед — мо тавассути тамоси нишондода ҷавоб медиҳем.")}
              </Typography>
            </Box>
            {sent && <Alert severity="success">{tr("Сообщение отправлено. Спасибо!", "Паём фиристода шуд. Ташаккур!")}</Alert>}
            {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
            <Card component="form" onSubmit={submit} sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack spacing={2}>
                  <TextField required label={tr("Ваше имя", "Номи шумо")} value={form.name} slotProps={{ htmlInput: { minLength: 2, maxLength: 120 } }} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <TextField required label={tr("Телефон или e-mail", "Телефон ё e-mail")} value={form.contact} slotProps={{ htmlInput: { minLength: 3, maxLength: 160 } }} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
                  <TextField required multiline minRows={4} label={tr("Сообщение", "Паём")} value={form.message} slotProps={{ htmlInput: { minLength: 5, maxLength: 3000 } }} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                  <Button type="submit" variant="contained" disabled={sending} startIcon={<SendOutlined />}>
                    {sending ? tr("Отправляем...", "Фиристода истодаем...") : tr("Отправить", "Фиристодан")}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Container>
        <SiteFooter />
      </Box>
    </Box>
  );
}
