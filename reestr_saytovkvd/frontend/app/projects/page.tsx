"use client";

import { useEffect, useState } from "react";
import { Box, Card, CardContent, Chip, Container, Stack, Typography } from "@mui/material";
import { API_BASE } from "../api-config";
import SiteNavigation from "../site-navigation";
import SiteFooter from "../site-footer";
import { useTr } from "../i18n";

type Item = { id: string; data: Record<string, string> };

export default function ProjectsPage() {
  const tr = useTr();
  const [projects, setProjects] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Item[]>([]);
  const [active, setActive] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const [p, c] = await Promise.all([fetch(`${API_BASE}/cms/projects`), fetch(`${API_BASE}/cms/project-categories`)]);
        if (p.ok) setProjects((await p.json()) as Item[]);
        if (c.ok) setCategories((await c.json()) as Item[]);
      } finally {
        setLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const visible = active ? projects.filter((item) => item.data.category === active) : projects;

  return (
    <Box className="utility-page utility-page--documents" sx={{ minHeight: "100vh", pb: 6 }}>
      <Box className="utility-page__main">
        <SiteNavigation />
        <Container className="utility-page__container" maxWidth="lg" sx={{ py: 4 }}>
          <Stack spacing={2.5}>
            <Box className="utility-page__hero">
              <Typography variant="overline">{tr("Портфолио", "Портфолио")}</Typography>
              <Typography variant="h3" component="h1" sx={{ fontWeight: 800, fontSize: { xs: 30, md: 40 } }}>
                {tr("Проекты", "Лоиҳаҳо")}
              </Typography>
            </Box>
            {categories.length > 0 && (
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                <Chip label={tr("Все", "Ҳама")} color={active ? "default" : "primary"} onClick={() => setActive("")} />
                {categories.map((category) => (
                  <Chip
                    key={category.id}
                    label={tr(category.data.title, category.data.title_tj || category.data.title)}
                    color={active === category.id ? "primary" : "default"}
                    onClick={() => setActive(category.id)}
                  />
                ))}
              </Stack>
            )}
            {loaded && visible.length === 0 && <Typography color="text.secondary">{tr("Проектов пока нет.", "Ҳоло лоиҳа нест.")}</Typography>}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: 2 }}>
              {visible.map((item) => {
                const d = item.data;
                const category = categories.find((entry) => entry.id === d.category);
                return (
                  <Card key={item.id} sx={{ borderRadius: 3, overflow: "hidden" }}>
                    {d.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.image} alt={d.title} style={{ width: "100%", height: 190, objectFit: "cover", display: "block" }} />
                    )}
                    <CardContent>
                      <Stack direction="row" sx={{ gap: 1, mb: 1, flexWrap: "wrap" }}>
                        {category && <Chip size="small" label={tr(category.data.title, category.data.title_tj || category.data.title)} />}
                        {d.year && <Chip size="small" variant="outlined" label={d.year} />}
                      </Stack>
                      <Typography variant="h6" sx={{ fontWeight: 750 }}>{tr(d.title, d.title_tj || d.title)}</Typography>
                      {(d.text || d.text_tj) && <Typography color="text.secondary" sx={{ mt: 1 }}>{tr(d.text, d.text_tj || d.text)}</Typography>}
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          </Stack>
        </Container>
        <SiteFooter />
      </Box>
    </Box>
  );
}
