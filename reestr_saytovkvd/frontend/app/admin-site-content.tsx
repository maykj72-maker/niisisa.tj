"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Alert, Box, CircularProgress, Paper, Typography } from "@mui/material";
import { API_BASE } from "./api-config";

const SiteContentManager = dynamic(() => import("./architecture/site-content-manager"), { ssr: false });

export default function AdminSiteContent() {
  const [content, setContent] = useState<Record<string, unknown[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    fetch(`${API_BASE}/site-content`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.text();
          let message = body;
          try {
            message = (JSON.parse(body) as { detail?: string }).detail || body;
          } catch {
            // Keep the API response when it is not JSON.
          }
          throw new Error(message || `Не удалось загрузить содержимое сайта (${response.status})`);
        }
        return response.json() as Promise<Record<string, unknown>>;
      })
      .then((saved) => {
        if (!active) return;
        const collections: Record<string, unknown[]> = {};
        for (const [section, items] of Object.entries(saved)) {
          if (Array.isArray(items)) collections[section] = items;
        }
        setContent(collections);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить содержимое сайта");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSaved = useCallback((section: string, items: unknown[]) => {
    setContent((current) => ({ ...current, [section]: items }));
  }, []);

  return (
    <Box id="website-content" sx={{ mb: 3, scrollMarginTop: 24 }}>
      {loading ? (
        <Paper sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 3, borderRadius: 3 }}>
          <CircularProgress size={20} />
          <Typography color="text.secondary">Загружаем настройки содержимого сайта...</Typography>
        </Paper>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <SiteContentManager content={content} language="tg" onSaved={handleSaved} />
      )}
    </Box>
  );
}
