# Frontend

Ин қисми сомона бо Next.js, React ва TypeScript сохта шудааст.

## Роҳнамо барои хондани код

1. `app/layout.tsx` — қолаби умумии саҳифа ва сабкҳои глобалӣ.
2. `app/page.tsx` — феҳристи сертификатҳо, сабти довталаб, кабинет ва PDF/Excel.
3. `app/architecture/page.tsx` ва `app/architecture/architecture-content.tsx` — портали пажӯҳишгоҳ ва матни саҳифа.
4. `app/architecture/organization-data.ts` ва `app/architecture/russian-content.ts` — маълумоти ибтидоӣ ба тоҷикӣ ва русӣ.
5. `app/architecture/architecture.css` — тарҳи сохторӣ; `app/architecture/modern-theme.css` — услуби нави саҳифаи пажӯҳишгоҳ ва ахбор.
6. `app/architecture/site-content-manager.tsx` — идоракунии бахшҳои сомона; бахши «Хизматрасониҳо» имкон медиҳад, ки администратор ном, тавсиф, нишона ва истиноди ҳар хизматрасониро тағйир дода, фавран нашр кунад.
7. `app/architecture/news-feed.tsx` ва `app/news/` — рӯйхат, идоракунӣ ва саҳифаи муфассали хабарҳо.
8. `app/media-upload.ts` — санҷиши суроғаи медиавӣ ва боркунии файл ба backend (акс то 5 МБ, видео то 100 МБ).
9. `public/` — логотип, аксҳо ва дигар файлҳои намоишӣ.

Маълумоти зинда аз API-и FastAPI дар `backend/` гирифта мешавад. Барои тағйир додани суроғаи API `NEXT_PUBLIC_API_BASE`-ро танзим кунед; анхдагчӣ `http://localhost:8000/api` мебошад.
Дар сохти истеҳсолӣ `NEXT_PUBLIC_API_BASE` ҳатман бояд URL-и HTTPS бошад ва бо `/api` анҷом ёбад; API URL-и оммавӣ аст ва набояд сир ё калиди API дошта бошад. Cookie-и сессия ба сервери API фиристода мешавад, бинобар ин `REGISTRY_CORS_ORIGINS`-и backend бояд origin-и дақиқи frontend-ро дар бар гирад.

## Оғоз ва санҷиш

Фармонҳои зеринро аз ҳамин ҷузвдони `frontend` иҷро кунед. Барномаи Next.js дар ин ҷузвдон ҷойгир аст; ҷузвдони `app` дар сатҳи боло барои мутобиқати кӯҳна нигоҳ дошта шудааст.

```powershell
npm install
npm run dev
```

Барои санҷиш дар терминали дигар:

```powershell
npm run lint
npm run build
```

Вход в систему: `NEXT_PUBLIC_API_BASE` должен указывать на домен самого фронтенда (`https://<фронтенд>/api`). Next.js проксирует `/api` и `/media` на бэкенд (`API_PROXY_TARGET`), поэтому cookie сессии остаётся first-party и не блокируется браузером.
