# Деплой

## Backend — Render

1. Создайте Blueprint в Render и выберите этот GitHub-репозиторий.
2. Render прочитает `render.yaml`. Для сервиса предусмотрен платный план Starter, потому что для постоянной SQLite-базы и файлов нужен Persistent Disk.
3. В Environment добавьте:
   - `REGISTRY_ADMIN_CODE` — новый код администратора (3–80 символов).
   - `REGISTRY_ADMIN_PASSWORD` — уникальный сложный пароль не короче 16 символов.
   - `REGISTRY_CORS_ORIGINS` — точный HTTPS origin сайта Vercel, например `https://имя-проекта.vercel.app`, без пути и завершающего слеша.
4. После первого успешного деплоя скопируйте публичный HTTPS URL Render-сервиса. Проверка: `https://ВАШ-БЭКЕНД.onrender.com/api/health`.

База SQLite, публичные медиа и приватные документы будут храниться на диске Render в `/var/data`. Не удаляйте и не пересоздавайте диск: на нём находятся данные сайта.

## Frontend — Vercel

1. Импортируйте тот же репозиторий в Vercel.
2. В **Root Directory** укажите `reestr_saytovkvd/frontend`.
3. Framework Preset: **Next.js**. Build Command: `npm run build`.
4. В Environment Variables добавьте:
   - `NEXT_PUBLIC_API_BASE` = `https://ВАШ-БЭКЕНД.onrender.com/api`
5. Запустите Deploy.

После получения домена Vercel вернитесь в Render и обновите `REGISTRY_CORS_ORIGINS` точным HTTPS origin Vercel. Затем перезапустите backend.

## Важно о базе данных

Текущая версия backend использует SQLite. Этот Render Blueprint сохраняет SQLite на постоянном диске и рассчитан на один экземпляр backend. Это позволяет развернуть текущий код без опасной автоматической переделки SQL-запросов. PostgreSQL пока не подключён; для него нужна отдельная миграция схемы и запросов, а не только переменная `DATABASE_URL`.

## Проверка

- Backend: `/api/health` должен вернуть JSON со статусом `ok`.
- Frontend: откройте сайт Vercel, проверьте вход администратора, новости, загрузку медиа и документов.
- Секреты вводите только в панели Render/Vercel. Не добавляйте пароли и ключи в Git.
