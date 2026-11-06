"use client";

import { useEffect, useState } from "react";
import { Box, Button, Card, CardContent, Chip, Container, Stack, Typography } from "@mui/material";
import { API_BASE } from "../api-config";
import SiteNavigation from "../site-navigation";
import SiteFooter from "../site-footer";
import { useTr } from "../i18n";

type Item = { id: string; position: number; active: boolean; data: Record<string, string> };

export default function GoodsPage() {
  const tr = useTr();
  const [goods, setGoods] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const [g, c] = await Promise.all([fetch(`${API_BASE}/cms/goods`), fetch(`${API_BASE}/cms/goods-categories`)]);
        if (g.ok) setGoods((await g.json()) as Item[]);
        if (c.ok) setCategories((await c.json()) as Item[]);
      } finally {
        setLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const categoryName = (id: string) => {
    const found = categories.find((category) => category.id === id);
    return found ? tr(found.data.title, found.data.title_tj || found.data.title) : "";
  };

  return (
    <Box className="utility-page utility-page--documents" sx={{ minHeight: "100vh", pb: 6 }}>
      <Box className="utility-page__main">
        <SiteNavigation />
        <Container className="utility-page__container" maxWidth="lg" sx={{ py: 4 }}>
          <Stack spacing={2.5}>
            <Box className="utility-page__hero">
              <Typography variant="overline">{tr("Каталог", "Феҳрист")}</Typography>
              <Typography variant="h3" component="h1" sx={{ fontWeight: 800, fontSize: { xs: 30, md: 40 } }}>
                {tr("Товары", "Молҳо")}
              </Typography>
            </Box>
            {loaded && goods.length === 0 && <Typography color="text.secondary">{tr("Товаров пока нет.", "Ҳоло мол нест.")}</Typography>}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: 2 }}>
              {goods.map((item) => {
                const d = item.data;
                const category = d.category ? categoryName(d.category) : "";
                return (
                  <Card key={item.id} sx={{ borderRadius: 3, overflow: "hidden" }}>
                    {d.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.image} alt={d.title} style={{ width: "100%", height: 190, objectFit: "cover", display: "block" }} />
                    )}
                    <CardContent>
                      {category && <Chip size="small" label={category} sx={{ mb: 1 }} />}
                      <Typography variant="h6" sx={{ fontWeight: 750 }}>{tr(d.title, d.title_tj || d.title)}</Typography>
                      {d.sku && <Typography variant="caption" color="text.secondary">{tr("Артикул", "Рамз")}: {d.sku}</Typography>}
                      {(d.text || d.text_tj) && (
                        <Typography color="text.secondary" sx={{ mt: 1 }}>{tr(d.text, d.text_tj || d.text)}</Typography>
                      )}
                      <Typography variant="h6" sx={{ mt: 1.5, fontWeight: 800 }}>
                        {d.price} {tr("сомони", "сомонӣ")}
                      </Typography>
                      {d.document && (
                        <Button component="a" href={d.document} target="_blank" rel="noopener noreferrer" size="small" sx={{ mt: 1 }}>
                          {tr("Документ (PDF)", "Ҳуҷҷат (PDF)")}
                        </Button>
                      )}
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
