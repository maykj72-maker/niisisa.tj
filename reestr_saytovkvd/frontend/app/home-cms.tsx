"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Box, Card, CardContent, Typography } from "@mui/material";
import { API_BASE } from "./api-config";
import { useTr } from "./i18n";

type Item = { id: string; data: Record<string, string> };

async function load(name: string): Promise<Item[]> {
  try {
    const response = await fetch(`${API_BASE}/cms/${name}`);
    return response.ok ? ((await response.json()) as Item[]) : [];
  } catch {
    return [];
  }
}

function Wrap({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return <>{children}</>;
  const external = /^https?:\/\//.test(href);
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{children}</a>
  ) : (
    <Link href={href} style={{ color: "inherit", textDecoration: "none" }}>{children}</Link>
  );
}

export default function HomeCms() {
  const tr = useTr();
  const [slides, setSlides] = useState<Item[]>([]);
  const [blocks, setBlocks] = useState<Item[]>([]);
  const [advantages, setAdvantages] = useState<Item[]>([]);
  const [products, setProducts] = useState<Item[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const [s, b, a, p] = await Promise.all([load("slides"), load("home-blocks"), load("advantages"), load("products")]);
      setSlides(s);
      setBlocks(b);
      setAdvantages(a);
      setProducts(p);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % slides.length), 6000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const slide = slides[index % Math.max(slides.length, 1)];
  const grid = { display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: 2 };
  const heading = (text: string) => (
    <Typography variant="h5" component="h2" sx={{ fontWeight: 800, mb: 1.5 }}>{text}</Typography>
  );

  return (
    <Box className="home-cms" sx={{ display: "grid", gap: 4, mb: 4 }}>
      {slide && (
        <Wrap href={slide.data.link}>
          <Box
            className="home-cms__slide"
            sx={{
              position: "relative",
              minHeight: { xs: 200, md: 320 },
              borderRadius: 4,
              overflow: "hidden",
              display: "flex",
              alignItems: "flex-end",
              color: "#fff",
              background: slide.data.image ? `url(${slide.data.image}) center/cover` : "linear-gradient(135deg, #0f2f57, #1d6b8f)",
            }}
          >
            <Box sx={{ p: { xs: 2, md: 4 }, width: "100%", background: "linear-gradient(0deg, rgba(5,20,40,0.82), rgba(5,20,40,0))" }}>
              <Typography variant="h4" component="h2" sx={{ fontWeight: 800, fontSize: { xs: 22, md: 32 } }}>
                {tr(slide.data.title, slide.data.title_tj || slide.data.title)}
              </Typography>
              {(slide.data.subtitle || slide.data.subtitle_tj) && (
                <Typography sx={{ mt: 0.5, opacity: 0.92 }}>{tr(slide.data.subtitle, slide.data.subtitle_tj || slide.data.subtitle)}</Typography>
              )}
              {slides.length > 1 && (
                <Box sx={{ display: "flex", gap: 0.75, mt: 1.5 }}>
                  {slides.map((item, i) => (
                    <Box key={item.id} sx={{ width: i === index ? 22 : 8, height: 8, borderRadius: 4, bgcolor: i === index ? "#e0b54a" : "rgba(255,255,255,0.5)", transition: "width .2s" }} />
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        </Wrap>
      )}

      {blocks.length > 0 && (
        <Box sx={grid}>
          {blocks.map((item) => (
            <Wrap key={item.id} href={item.data.link}>
              <Card sx={{ borderRadius: 3, overflow: "hidden", height: "100%" }}>
                {item.data.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.data.image} alt="" style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                )}
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 750 }}>{tr(item.data.title, item.data.title_tj || item.data.title)}</Typography>
                  {(item.data.text || item.data.text_tj) && (
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>{tr(item.data.text, item.data.text_tj || item.data.text)}</Typography>
                  )}
                </CardContent>
              </Card>
            </Wrap>
          ))}
        </Box>
      )}

      {advantages.length > 0 && (
        <Box>
          {heading(tr("Преимущества", "Бартариҳо"))}
          <Box sx={grid}>
            {advantages.map((item) => (
              <Card key={item.id} sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 750 }}>{tr(item.data.title, item.data.title_tj || item.data.title)}</Typography>
                  {(item.data.text || item.data.text_tj) && (
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>{tr(item.data.text, item.data.text_tj || item.data.text)}</Typography>
                  )}
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      )}

      {products.length > 0 && (
        <Box>
          {heading(tr("Наши продукты", "Маҳсулоти мо"))}
          <Box sx={grid}>
            {products.map((item) => (
              <Card key={item.id} sx={{ borderRadius: 3, overflow: "hidden" }}>
                {item.data.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.data.image} alt="" style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                )}
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 750 }}>{tr(item.data.title, item.data.title_tj || item.data.title)}</Typography>
                  {(item.data.text || item.data.text_tj) && (
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>{tr(item.data.text, item.data.text_tj || item.data.text)}</Typography>
                  )}
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
