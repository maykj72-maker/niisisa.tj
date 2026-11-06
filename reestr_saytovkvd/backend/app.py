import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import sqlite3
import threading
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any
from urllib.parse import unquote, urlsplit

from fastapi import FastAPI, Header, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.abspath(os.getenv("REGISTRY_DB_PATH", os.path.join(BASE_DIR, "registry.db")))
MEDIA_DIR = os.path.abspath(os.getenv("REGISTRY_MEDIA_DIR", os.path.join(BASE_DIR, "uploads")))
DOCUMENTS_DIR = os.path.abspath(os.getenv("REGISTRY_DOCUMENTS_DIR", os.path.join(BASE_DIR, "private_documents")))
APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV == "production"
if APP_ENV not in {"development", "test", "production"}:
    raise RuntimeError("APP_ENV must be development, test, or production")
ADMIN_CODE = os.getenv("REGISTRY_ADMIN_CODE", "").strip()
ADMIN_PASSWORD = os.getenv("REGISTRY_ADMIN_PASSWORD", "")
ADMIN_NAME = os.getenv("REGISTRY_ADMIN_NAME", "Администратор реестра").strip()
LEGACY_ADMIN_PASSWORD_HASH = "7e0a95b5e233cda6ae6d85ed4caebfc21430c5e4e10ab1086169fa1c68fac254"
LEGACY_PASSWORD_SALT = b"gov-registry-v1"
MAX_JSON_BODY_SIZE = 2 * 1024 * 1024
SESSION_COOKIE_NAME = "__Host-registry_session" if IS_PRODUCTION else "registry_session"
MAINTENANCE_TEXT_TJ = (
    "Сомонаи мо муваққатан барои корҳои техникӣ дастнорас мебошад. "
    "Мутахассисони мо барои беҳтар намудани сифати хизматрасонӣ корҳои заруриро анҷом медиҳанд. "
    "Лутфан, каме интизор шавед"
)
MAINTENANCE_TEXT_RU = (
    "Наш сайт временно находится на техническом обслуживании. "
    "Наши специалисты проводят необходимые работы для улучшения качества обслуживания. "
    "Пожалуйста, зайдите немного позже"
)
RATE_LIMITS: dict[str, list[float]] = {}
RATE_LIMIT_LOCK = threading.Lock()
if bool(ADMIN_CODE) != bool(ADMIN_PASSWORD):
    raise RuntimeError("REGISTRY_ADMIN_CODE and REGISTRY_ADMIN_PASSWORD must be configured together")
if ADMIN_CODE and (len(ADMIN_CODE) < 3 or len(ADMIN_CODE) > 80):
    raise RuntimeError("REGISTRY_ADMIN_CODE must contain between 3 and 80 characters")
if ADMIN_PASSWORD and len(ADMIN_PASSWORD) < 12:
    raise RuntimeError("REGISTRY_ADMIN_PASSWORD must contain at least 12 characters")
if IS_PRODUCTION and not ADMIN_CODE:
    raise RuntimeError("REGISTRY_ADMIN_CODE and REGISTRY_ADMIN_PASSWORD are required in production")
if IS_PRODUCTION and ADMIN_PASSWORD and (len(ADMIN_PASSWORD) < 16 or ADMIN_PASSWORD.isalpha() or ADMIN_PASSWORD.isdigit()):
    raise RuntimeError("REGISTRY_ADMIN_PASSWORD must be at least 16 characters and not all letters or digits")
os.makedirs(MEDIA_DIR, exist_ok=True)
os.makedirs(DOCUMENTS_DIR, exist_ok=True)
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

app = FastAPI(
    title="Государственный реестр сертификатов",
    version="1.0.0",
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)
configured_origins = os.getenv("REGISTRY_CORS_ORIGINS", "").strip()
allowed_origins = (
    [origin.strip().rstrip("/") for origin in configured_origins.split(",") if origin.strip()]
    if configured_origins
    else ["http://localhost:3000", "http://127.0.0.1:3000"]
)
for origin in allowed_origins:
    parsed_origin = urlsplit(origin)
    if (
        parsed_origin.scheme not in {"http", "https"}
        or not parsed_origin.netloc
        or parsed_origin.path
        or parsed_origin.query
        or parsed_origin.fragment
        or parsed_origin.username
        or parsed_origin.password
        or (IS_PRODUCTION and parsed_origin.scheme != "https")
    ):
        raise RuntimeError("REGISTRY_CORS_ORIGINS must contain only valid HTTPS origins in production")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-File-Name"],
)
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    content_length = request.headers.get("content-length")
    is_stream_upload = request.url.path in {"/api/media", "/api/documents"}
    if (
        not is_stream_upload
        and content_length
        and content_length.isdigit()
        and int(content_length) > MAX_JSON_BODY_SIZE
    ):
        return JSONResponse({"detail": "Размер запроса превышает допустимый предел"}, status_code=413)

    if request.url.path.startswith("/api/") and request.method in {"POST", "PUT", "DELETE"}:
        origin = request.headers.get("origin")
        if (IS_PRODUCTION and origin not in allowed_origins) or (
            origin is not None and origin not in allowed_origins
        ):
            return JSONResponse({"detail": "Недопустимый источник запроса"}, status_code=403)

    if request.url.path.startswith("/api/") and not request.headers.get("authorization"):
        session_token = request.cookies.get(SESSION_COOKIE_NAME)
        if session_token:
            request.scope["headers"] = [
                (name, value)
                for name, value in request.scope["headers"]
                if name.lower() != b"authorization"
            ]
            request.scope["headers"].append(
                (b"authorization", ("Bearer " + session_token).encode("latin-1"))
            )
    if request.url.path.startswith("/api/") or request.url.path.startswith("/media/"):
        is_public_maintenance_route = (
            request.url.path == "/api/maintenance/status" and request.method == "GET"
        ) or request.url.path in {
            "/api/health",
            "/api/login",
            "/api/admin/login",
            "/api/me",
            "/api/logout",
        }
        if not is_public_maintenance_route:
            maintenance = get_maintenance_state()
            if maintenance["enabled"]:
                auth_header = request.headers.get("authorization")
                if not auth_header:
                    session_token = request.cookies.get(SESSION_COOKIE_NAME)
                    auth_header = f"Bearer {session_token}" if session_token else None
                try:
                    user = get_user_from_token(auth_header)
                except HTTPException:
                    user = None
                if user is None or user["role"] != "admin":
                    return JSONResponse(
                        {
                            "detail": "Сайт находится на техническом обслуживании",
                            "maintenance": True,
                        },
                        status_code=503,
                        headers={"Retry-After": "300"},
                    )
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    if IS_PRODUCTION:
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
    return response


def enforce_rate_limit(request: Request, action: str, limit: int, window_seconds: int) -> None:
    client_ip = request.client.host if request.client else "unknown"
    key = f"{action}:{client_ip}"
    now = time.monotonic()
    with RATE_LIMIT_LOCK:
        recent = [stamp for stamp in RATE_LIMITS.get(key, []) if now - stamp < window_seconds]
        if len(recent) >= limit:
            raise HTTPException(
                status_code=429,
                detail="Слишком много запросов. Попробуйте позже.",
                headers={"Retry-After": str(window_seconds)},
            )
        recent.append(now)
        RATE_LIMITS[key] = recent
        if len(RATE_LIMITS) > 10_000:
            for old_key in list(RATE_LIMITS)[:5_000]:
                RATE_LIMITS.pop(old_key, None)


class LoginRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=80)
    password: str = Field(..., min_length=1, max_length=256)


class MaintenanceUpdateRequest(BaseModel):
    enabled: bool
    reason: str = Field(default="", max_length=300)
    ends_at: datetime | None = None
    auto_restore: bool = False
    text_tj: str = Field(..., min_length=10, max_length=2000)
    text_ru: str = Field(..., min_length=10, max_length=2000)

    @field_validator("ends_at")
    @classmethod
    def normalize_ends_at(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    @field_validator("reason", "text_tj", "text_ru")
    @classmethod
    def trim_maintenance_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("text_tj", "text_ru")
    @classmethod
    def require_maintenance_text(cls, value: str) -> str:
        if not value:
            raise ValueError("Текст страницы обслуживания не может быть пустым")
        return value

    @field_validator("auto_restore")
    @classmethod
    def require_restore_time(cls, value: bool, info):
        if value and info.data.get("ends_at") is None:
            raise ValueError("Для автоматического восстановления укажите дату и время")
        return value


class RegistrationRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=160)
    code: str = Field(..., min_length=3, max_length=80)
    password: str = Field(..., min_length=12, max_length=128)


class CertificateInput(BaseModel):
    full_name: str = Field(..., min_length=3, max_length=200)
    registration_number: str | None = Field(default=None, max_length=100)
    birth_date: str | None = Field(default=None, max_length=32)
    workplace: str | None = Field(default=None, max_length=200)
    position: str | None = Field(default=None, max_length=160)
    specialty: str | None = Field(default=None, max_length=200)
    training_type: str = Field(default="Первоначальное обучение", max_length=160)
    training_center: str | None = Field(default=None, max_length=200)
    course_name: str | None = Field(default=None, max_length=200)
    start_date: str | None = Field(default=None, max_length=32)
    end_date: str | None = Field(default=None, max_length=32)
    hours: str | None = Field(default=None, max_length=32)
    result: str | None = Field(default="Сдал успешно", max_length=160)
    certificate_date: str | None = Field(default=None, max_length=32)
    validity_period: str | None = Field(default=None, max_length=100)
    comments: str | None = Field(default=None, max_length=2000)
    status: str | None = Field(default=None, pattern="^(pending|published|revoked|rejected)$")

    @field_validator("birth_date", "start_date", "end_date", "certificate_date")
    @classmethod
    def validate_date_fields(cls, value: str | None) -> str | None:
        if value:
            try:
                if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                    raise ValueError("invalid format")
                date.fromisoformat(value)
            except ValueError as error:
                raise ValueError("Дата должна быть в формате ГГГГ-ММ-ДД") from error
        return value

    @field_validator("hours")
    @classmethod
    def validate_hours(cls, value: str | None) -> str | None:
        if value:
            try:
                hours = int(value)
            except ValueError as error:
                raise ValueError("Количество часов должно быть целым числом") from error
            if hours < 1 or hours > 10_000:
                raise ValueError("Количество часов должно быть от 1 до 10000")
        return value


class NewsInput(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    category: str = Field(default="Новости", max_length=80)
    content: str = Field(..., min_length=10, max_length=20_000)
    title_ru: str | None = Field(default=None, min_length=3, max_length=200)
    category_ru: str | None = Field(default=None, max_length=80)
    content_ru: str | None = Field(default=None, min_length=10, max_length=20_000)
    images: list[str] = Field(default_factory=list, max_length=20)
    media: list[dict[str, Any]] = Field(default_factory=list, max_length=20)

    @field_validator("images")
    @classmethod
    def validate_images(cls, images: list[str]) -> list[str]:
        for image in images:
            if len(image) > 2048 or not is_safe_media_url(image):
                raise ValueError("Недопустимый адрес изображения")
        return images

    @field_validator("media")
    @classmethod
    def validate_media(cls, media: list[dict[str, Any]]) -> list[dict[str, Any]]:
        for item in media:
            src = item.get("src")
            if not isinstance(src, str) or len(src) > 2048 or not is_safe_media_url(src):
                raise ValueError("Недопустимый адрес медиафайла")
        return media


class NewsViewInput(BaseModel):
    visitor_id: str = Field(..., min_length=16, max_length=64)


class SiteContentUpdate(BaseModel):
    items: list[Any] = Field(..., max_length=200)

    @field_validator("items")
    @classmethod
    def validate_items(cls, items: list[Any]) -> list[Any]:
        if len(json.dumps(items, ensure_ascii=False)) > MAX_JSON_BODY_SIZE:
            raise ValueError("Содержимое слишком большое")
        for item in items:
            validate_safe_content_urls(item)
        return items


class ServiceOrderInput(BaseModel):
    category: str = Field(..., min_length=2, max_length=80)
    service_name: str = Field(..., min_length=3, max_length=160)
    phone: str = Field(..., min_length=5, max_length=32)
    organization: str = Field(default="", max_length=160)
    details: str = Field(default="", max_length=2000)


class ServiceOrderUpdate(BaseModel):
    status: str
    admin_note: str = Field(default="", max_length=1000)


SITE_CONTENT_SECTIONS = {
    "leaders",
    "focusAreas",
    "services",
    "contacts",
    "contactInfo",
    "siteCopy",
    "historyPhotos",
    "projectPhotos",
    "engineeringPhotos",
    "laboratoryPhotos",
    "standardsPhotos",
    "trainingPhotos",
    "digitalPhotos",
    "printingPhotos",
    "newsPhotos",
    "inspectionReasons",
    "inspectionInstruments",
    "inspectionSteps",
    "inspectionReport",
    "laboratoryMaterials",
    "trainingCourses",
    "printingServices",
    "digitalBenefits",
}
SITE_CONTENT_SECTIONS.update({f"{section}Ru" for section in SITE_CONTENT_SECTIONS})


def notify_users(user_ids: list[str], message: str) -> None:
    if not user_ids:
        return
    conn = get_db()
    created = now_iso()
    conn.executemany(
        "INSERT INTO notifications (id, user_id, message, read, created_at) VALUES (?, ?, ?, 0, ?)",
        [(uuid.uuid4().hex, uid, message, created) for uid in user_ids],
    )
    conn.execute(
        "DELETE FROM notifications WHERE id IN ("
        "SELECT id FROM notifications WHERE user_id IN ({}) ORDER BY created_at DESC LIMIT -1 OFFSET 100)".format(
            ",".join("?" for _ in user_ids)
        ),
        user_ids,
    )
    conn.commit()
    conn.close()


def notify_admins(message: str) -> None:
    conn = get_db()
    ids = [row["id"] for row in conn.execute("SELECT id FROM users WHERE role = 'admin'").fetchall()]
    conn.close()
    notify_users(ids, message)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=2**14,
        r=8,
        p=1,
        dklen=64,
    )
    return f"scrypt$16384$8$1${salt.hex()}${derived.hex()}"


def verify_password(password: str, stored_hash: str) -> tuple[bool, bool]:
    if stored_hash.startswith("scrypt$"):
        try:
            algorithm, n, r, p, salt_hex, digest_hex = stored_hash.split("$")
            if algorithm != "scrypt":
                return False, False
            expected = bytes.fromhex(digest_hex)
            actual = hashlib.scrypt(
                password.encode("utf-8"),
                salt=bytes.fromhex(salt_hex),
                n=int(n),
                r=int(r),
                p=int(p),
                dklen=len(expected),
            )
            return hmac.compare_digest(actual, expected), False
        except (ValueError, TypeError):
            return False, False

    legacy_digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), LEGACY_PASSWORD_SALT, 100_000
    ).hex()
    return hmac.compare_digest(legacy_digest, stored_hash), True


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def is_safe_media_url(value: str) -> bool:
    value = value.strip()
    if not value or any(ord(char) < 32 for char in value) or value.startswith("//"):
        return False
    parsed = urlsplit(value)
    if not parsed.scheme and value.startswith("/media/"):
        return True
    if parsed.scheme == "https":
        return bool(parsed.netloc) and not parsed.username and not parsed.password
    if not IS_PRODUCTION and parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}:
        return True
    return False


def is_safe_link_url(value: str) -> bool:
    value = value.strip()
    if not value or any(ord(char) < 32 for char in value) or value.startswith("//"):
        return False
    parsed = urlsplit(value)
    if parsed.scheme in {"https", "mailto", "tel"}:
        return parsed.scheme != "https" or bool(parsed.netloc)
    if parsed.scheme == "http" and not IS_PRODUCTION:
        return bool(parsed.netloc)
    return not parsed.scheme and value.startswith("/")


def validate_safe_content_urls(value: Any, key: str = "") -> None:
    if isinstance(value, dict):
        for child_key, child_value in value.items():
            validate_safe_content_urls(child_value, str(child_key).casefold())
    elif isinstance(value, list):
        for item in value:
            validate_safe_content_urls(item, key)
    elif isinstance(value, str):
        if key in {"href", "url", "mapurl", "governmenturl", "link"} and not is_safe_link_url(value):
            raise ValueError(f"Недопустимый URL в поле {key}")
        if key in {"src", "image", "photo"} and value.startswith(("javascript:", "data:", "vbscript:")):
            raise ValueError(f"Недопустимый URL в поле {key}")


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 5000")
    conn.execute("PRAGMA trusted_schema = OFF")
    conn.create_function("casefold", 1, lambda value: str(value or "").casefold())
    return conn


def ensure_db() -> None:
    conn = get_db()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS certificates (
            id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            birth_date TEXT,
            workplace TEXT,
            position TEXT,
            specialty TEXT,
            training_type TEXT,
            training_center TEXT,
            course_name TEXT,
            start_date TEXT,
            end_date TEXT,
            hours TEXT,
            result TEXT,
            registration_number TEXT UNIQUE NOT NULL,
            certificate_date TEXT,
            validity_period TEXT,
            status TEXT NOT NULL,
            approved INTEGER DEFAULT 0,
            publication_date TEXT,
            comments TEXT,
            created_by TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS registration_sequences (
            year INTEGER PRIMARY KEY,
            last_number INTEGER NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_certificates_public_order "
        "ON certificates (status, certificate_date DESC, created_at DESC)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_certificates_owner_order "
        "ON certificates (created_by, created_at DESC)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_certificates_admin_order "
        "ON certificates (created_at DESC)"
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            message TEXT NOT NULL,
            read INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC)"
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_log (
            id TEXT PRIMARY KEY,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS maintenance_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            enabled INTEGER NOT NULL DEFAULT 0,
            reason TEXT NOT NULL DEFAULT '',
            ends_at TEXT,
            auto_restore INTEGER NOT NULL DEFAULT 0,
            text_tj TEXT NOT NULL,
            text_ru TEXT NOT NULL,
            updated_by TEXT,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS maintenance_events (
            id TEXT PRIMARY KEY,
            actor_id TEXT NOT NULL,
            actor_name TEXT NOT NULL,
            action TEXT NOT NULL,
            details TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_maintenance_events_created "
        "ON maintenance_events (created_at DESC)"
    )
    conn.execute(
        """
        INSERT OR IGNORE INTO maintenance_settings
            (id, enabled, reason, ends_at, auto_restore, text_tj, text_ru, updated_by, updated_at)
        VALUES (1, 0, '', NULL, 0, ?, ?, NULL, ?)
        """,
        (MAINTENANCE_TEXT_TJ, MAINTENANCE_TEXT_RU, now_iso()),
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS news (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            content TEXT NOT NULL,
            title_ru TEXT,
            category_ru TEXT,
            content_ru TEXT,
            images TEXT DEFAULT '[]',
            media TEXT DEFAULT '[]',
            published_at TEXT NOT NULL,
            created_by TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS news_views (
            news_id TEXT NOT NULL,
            visitor_id TEXT NOT NULL,
            viewed_at TEXT NOT NULL,
            PRIMARY KEY (news_id, visitor_id)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS site_content (
            section TEXT NOT NULL,
            item_id TEXT NOT NULL,
            position INTEGER NOT NULL,
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (section, item_id)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            stored_name TEXT NOT NULL UNIQUE,
            original_name TEXT NOT NULL,
            content_type TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_documents_category_date ON documents (category, created_at DESC)")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS service_orders (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            category TEXT NOT NULL,
            service_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            organization TEXT NOT NULL DEFAULT '',
            details TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'new',
            admin_note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_service_orders_owner_date "
        "ON service_orders (user_id, created_at DESC)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_service_orders_status_date "
        "ON service_orders (status, created_at DESC)"
    )
    news_columns = conn.execute("PRAGMA table_info(news)").fetchall()
    existing_news_columns = {column[1] for column in news_columns}
    for column, declaration in {
        "images": "TEXT DEFAULT '[]'",
        "title_ru": "TEXT",
        "category_ru": "TEXT",
        "content_ru": "TEXT",
        "media": "TEXT DEFAULT '[]'",
    }.items():
        if column not in existing_news_columns:
            conn.execute(f"ALTER TABLE news ADD COLUMN {column} {declaration}")

    existing_document_columns = {column[1] for column in conn.execute("PRAGMA table_info(documents)").fetchall()}
    for column, declaration in {
        "status": "TEXT NOT NULL DEFAULT 'published'",
        "owner_id": "TEXT",
        "owner_name": "TEXT NOT NULL DEFAULT ''",
        "review_note": "TEXT NOT NULL DEFAULT ''",
    }.items():
        if column not in existing_document_columns:
            conn.execute(f"ALTER TABLE documents ADD COLUMN {column} {declaration}")

    legacy_admin = conn.execute(
        "SELECT id FROM users WHERE code = ? AND password_hash = ?",
        ("GOS-ADMIN", LEGACY_ADMIN_PASSWORD_HASH),
    ).fetchone()
    if legacy_admin is not None:
        if ADMIN_CODE:
            configured_admin = conn.execute("SELECT id, role FROM users WHERE code = ?", (ADMIN_CODE,)).fetchone()
            if configured_admin is not None and configured_admin["id"] != legacy_admin["id"]:
                if configured_admin["role"] != "admin":
                    conn.close()
                    raise RuntimeError("REGISTRY_ADMIN_CODE is already assigned to a non-admin account")
                conn.execute("DELETE FROM users WHERE id = ?", (legacy_admin["id"],))
            else:
                conn.execute("UPDATE users SET code = ? WHERE id = ?", (ADMIN_CODE, legacy_admin["id"]))
        else:
            conn.execute("DELETE FROM sessions WHERE user_id = ?", (legacy_admin["id"],))
            conn.execute("DELETE FROM users WHERE id = ?", (legacy_admin["id"],))
            logging.warning(
                "Removed the insecure built-in administrator account. "
                "Set REGISTRY_ADMIN_CODE and REGISTRY_ADMIN_PASSWORD to provision an administrator."
            )

    if ADMIN_CODE:
        configured_admin = conn.execute(
            "SELECT id, role FROM users WHERE code = ?",
            (ADMIN_CODE,),
        ).fetchone()
        if configured_admin is not None and configured_admin["role"] != "admin":
            conn.close()
            raise RuntimeError("REGISTRY_ADMIN_CODE is already assigned to a non-admin account")
        if configured_admin is None:
            conn.execute(
                "INSERT INTO users (id, code, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (uuid.uuid4().hex, ADMIN_CODE, hash_password(ADMIN_PASSWORD), "admin", ADMIN_NAME, now_iso()),
            )
        else:
            conn.execute(
                "UPDATE users SET password_hash = ?, name = ? WHERE id = ?",
                (hash_password(ADMIN_PASSWORD), ADMIN_NAME, configured_admin["id"]),
            )
    elif conn.execute("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").fetchone() is None:
        logging.warning(
            "No administrator is configured. Set REGISTRY_ADMIN_CODE and "
            "REGISTRY_ADMIN_PASSWORD (at least 12 characters) before starting the API."
        )

    cert_count = conn.execute("SELECT COUNT(*) FROM certificates").fetchone()[0]
    if cert_count == 0:
        sample_certificates = [
            (
                "cert-1",
                "Мирзоев Салим Нуриддин",
                "1992-05-02",
                "Управление архитектуры и строительства г. Душанбе",
                "Главный инженер",
                "Архитектура и градостроительство",
                "Повышение квалификации",
                "Таджикский институт строительного менеджмента",
                "Нормы проектирования и контроля строительства",
                "2024-01-15",
                "2024-02-10",
                "72",
                "Сдал успешно",
                "CERT-2024-00001",
                "2024-02-15",
                "3 года",
                "published",
                1,
                "2024-02-20",
                "Проверка подтверждена уполномоченным сотрудником",
                "admin-1",
                "2024-02-20T11:00:00+00:00",
                "2024-02-20T11:00:00+00:00",
            ),
            (
                "cert-2",
                "Халимова Фарзона Сайфиддин",
                "1987-09-18",
                "ООО «Сарпам»",
                "Проектировщик",
                "Строительство объектов",
                "Переподготовка",
                "Центр профессионального развития",
                "Проверка и экспертиза проектной документации",
                "2023-09-01",
                "2023-11-25",
                "96",
                "Сдал успешно",
                "CERT-2023-00004",
                "2023-11-30",
                "5 лет",
                "revoked",
                0,
                None,
                "Аннулировано по решению проверки",
                "admin-1",
                "2023-11-30T10:10:00+00:00",
                "2023-11-30T10:10:00+00:00",
            ),
        ]
        conn.executemany(
            """
            INSERT INTO certificates (
                id, full_name, birth_date, workplace, position, specialty, training_type,
                training_center, course_name, start_date, end_date, hours, result,
                registration_number, certificate_date, validity_period, status, approved,
                publication_date, comments, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            sample_certificates,
        )

    audit_count = conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
    if audit_count == 0:
        conn.executemany(
            "INSERT INTO audit_log (id, message, created_at) VALUES (?, ?, ?)",
            [
                ("audit-1", "Зарегистрировано 2 демонстрационных сертификата", now_iso()),
                ("audit-2", "Проверка публикации подтверждена для CERT-2024-00001", now_iso()),
                ("audit-3", "Сертификат CERT-2023-00004 аннулирован", now_iso()),
            ],
        )

    news_count = conn.execute("SELECT COUNT(*) FROM news").fetchone()[0]
    if news_count == 0:
        conn.executemany(
            "INSERT INTO news (id, title, category, content, published_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    "news-1",
                    "Открытие лаборатории строительной экспертизы",
                    "Новости",
                    "В центре проводится запуск нового лабораторного блока, где выполняются проверки строительных материалов, качества смеси и технических характеристик конструкций.",
                    now_iso(),
                    "admin-1",
                    now_iso(),
                ),
                (
                    "news-2",
                    "Обновление реестра сертификации",
                    "Реестр",
                    "Для повышения прозрачности и скорости проверки внесены обновления в электронный реестр сертификатов и журнал аудита.",
                    now_iso(),
                    "admin-1",
                    now_iso(),
                ),
            ],
        )

    conn.commit()
    conn.close()
    if os.name != "nt":
        os.chmod(DB_PATH, 0o600)


ensure_db()


def add_maintenance_event(
    conn: sqlite3.Connection,
    actor_id: str,
    actor_name: str,
    action: str,
    details: str,
    created_at: str,
) -> None:
    conn.execute(
        "INSERT INTO maintenance_events (id, actor_id, actor_name, action, details, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (uuid.uuid4().hex, actor_id, actor_name, action, details, created_at),
    )
    conn.execute(
        "INSERT INTO audit_log (id, message, created_at) VALUES (?, ?, ?)",
        (uuid.uuid4().hex, f"Техническое обслуживание: {action} — {details}", created_at),
    )


def get_maintenance_state() -> dict[str, Any]:
    conn = get_db()
    row = conn.execute("SELECT * FROM maintenance_settings WHERE id = 1").fetchone()
    if row is None:
        conn.close()
        raise RuntimeError("Настройки технического обслуживания отсутствуют")

    ends_at = datetime.fromisoformat(row["ends_at"]) if row["ends_at"] else None
    current_time = datetime.now(timezone.utc)
    if (
        row["enabled"]
        and row["auto_restore"]
        and ends_at is not None
        and ends_at <= current_time
    ):
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT * FROM maintenance_settings WHERE id = 1").fetchone()
        ends_at = datetime.fromisoformat(row["ends_at"]) if row["ends_at"] else None
        if (
            row["enabled"]
            and row["auto_restore"]
            and ends_at is not None
            and ends_at <= current_time
        ):
            restored_at = now_iso()
            conn.execute(
                "UPDATE maintenance_settings SET enabled = 0, updated_by = ?, updated_at = ? WHERE id = 1",
                ("system", restored_at),
            )
            add_maintenance_event(
                conn,
                "system",
                "Система",
                "automatic_restore",
                f"Автоматическое завершение работ по расписанию ({row['ends_at']})",
                restored_at,
            )
        conn.commit()
        row = conn.execute("SELECT * FROM maintenance_settings WHERE id = 1").fetchone()

    state = {
        "enabled": bool(row["enabled"]),
        "reason": row["reason"],
        "ends_at": row["ends_at"],
        "auto_restore": bool(row["auto_restore"]),
        "text_tj": row["text_tj"],
        "text_ru": row["text_ru"],
        "updated_by": row["updated_by"],
        "updated_at": row["updated_at"],
    }
    conn.close()
    return state


def require_admin(auth_token: str | None) -> dict[str, str]:
    user = get_user_from_token(auth_token)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Доступ разрешён только администратору")
    return user


def get_user_from_token(auth_token: str | None):
    if not auth_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется токен доступа")
    if not auth_token.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный формат токена")

    token = auth_token[len("Bearer "):].strip()
    if not token or len(token) > 256:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный формат токена")
    conn = get_db()
    row = conn.execute(
        """
        SELECT u.id, u.code, u.role, u.name, u.created_at
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > ?
        """,
        (hash_session_token(token), now_iso()),
    ).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Сессия истекла или недействительна")
    return {
        "id": row["id"],
        "code": row["code"],
        "role": row["role"],
        "name": row["name"],
    }


def make_reg_number(conn: sqlite3.Connection) -> str:
    year = datetime.now(timezone.utc).year
    conn.execute("BEGIN IMMEDIATE")
    sequence = conn.execute(
        "SELECT last_number FROM registration_sequences WHERE year = ?",
        (year,),
    ).fetchone()
    rows = conn.execute(
        "SELECT registration_number FROM certificates WHERE registration_number LIKE ?",
        (f"CERT-{year}-%",),
    ).fetchall()
    last_number = sequence["last_number"] if sequence is not None else 0
    for row in rows:
        try:
            last_number = max(last_number, int(row["registration_number"].split("-")[-1]))
        except ValueError:
            continue
    next_number = last_number + 1
    if sequence is None:
        conn.execute(
            "INSERT INTO registration_sequences (year, last_number) VALUES (?, ?)",
            (year, next_number),
        )
    else:
        conn.execute(
            "UPDATE registration_sequences SET last_number = ? WHERE year = ?",
            (next_number, year),
        )
    return f"CERT-{year}-{str(next_number).zfill(5)}"


def append_audit(message: str) -> None:
    conn = get_db()
    conn.execute(
        "INSERT INTO audit_log (id, message, created_at) VALUES (?, ?, ?)",
        (uuid.uuid4().hex, message, now_iso()),
    )
    conn.commit()
    conn.close()


def parse_images(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        cleaned = value.strip()
        if not cleaned:
            return []
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except json.JSONDecodeError:
            pass
        return [cleaned]
    return []


def parse_news_media(value: Any, legacy_images: Any) -> list[dict[str, str]]:
    try:
        parsed = json.loads(value) if isinstance(value, str) else value
    except json.JSONDecodeError:
        parsed = []

    media: list[dict[str, str]] = []
    if isinstance(parsed, list):
        for item in parsed:
            if not isinstance(item, dict):
                continue
            src = str(item.get("src") or "").strip()
            if not src:
                continue
            media.append(
                {
                    "src": src,
                    "type": "video" if item.get("type") == "video" else "image",
                    "caption": str(item.get("caption") or ""),
                    "caption_ru": str(item.get("caption_ru") or ""),
                    "alt": str(item.get("alt") or ""),
                }
            )
    if media:
        return media
    return [
        {"src": image, "type": "image", "caption": "", "caption_ru": "", "alt": ""}
        for image in parse_images(legacy_images)
    ]


@app.post("/api/media")
async def upload_media(
    request: Request,
    authorization: str | None = Header(default=None),
    filename: str | None = Header(default=None, alias="X-File-Name"),
):
    user = get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Только администратор может загружать файлы")

    extension = os.path.splitext(os.path.basename(unquote(filename or "")))[1].lower()
    media_types = {
        ".jpg": ("image/jpeg", "image"),
        ".jpeg": ("image/jpeg", "image"),
        ".png": ("image/png", "image"),
        ".webp": ("image/webp", "image"),
        ".gif": ("image/gif", "image"),
        ".mp4": ("video/mp4", "video"),
        ".webm": ("video/webm", "video"),
    }
    media_info = media_types.get(extension)
    if media_info is None:
        raise HTTPException(status_code=415, detail="Разрешены изображения и видео MP4/WebM")

    expected_type, media_kind = media_info
    enforce_rate_limit(request, "media-upload", 20, 3600)
    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if content_type and content_type not in (expected_type, "application/octet-stream"):
        raise HTTPException(status_code=415, detail="Тип файла не соответствует его расширению")

    max_size = 100 * 1024 * 1024 if media_kind == "video" else 5 * 1024 * 1024
    saved_name = f"{uuid.uuid4().hex}{extension}"
    saved_path = os.path.join(MEDIA_DIR, saved_name)
    total_size = 0
    first_bytes = b""
    try:
        with open(saved_path, "wb") as target:
            async for chunk in request.stream():
                if len(first_bytes) < 12:
                    first_bytes += chunk[: 12 - len(first_bytes)]
                total_size += len(chunk)
                if total_size > max_size:
                    raise HTTPException(status_code=413, detail="Ҳаҷми файл аз маҳдудияти иҷозатдодашуда зиёд аст")
                target.write(chunk)
        signatures = {
            ".jpg": lambda data: data.startswith(b"\xff\xd8\xff"),
            ".jpeg": lambda data: data.startswith(b"\xff\xd8\xff"),
            ".png": lambda data: data.startswith(b"\x89PNG\r\n\x1a\n"),
            ".webp": lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP",
            ".gif": lambda data: data.startswith((b"GIF87a", b"GIF89a")),
            ".mp4": lambda data: data[4:8] == b"ftyp",
            ".webm": lambda data: data.startswith(b"\x1a\x45\xdf\xa3"),
        }
        if total_size and not signatures[extension](first_bytes):
            raise HTTPException(status_code=415, detail="Содержимое файла не соответствует его типу")
    except Exception:
        if os.path.exists(saved_path):
            os.remove(saved_path)
        raise

    if total_size == 0:
        os.remove(saved_path)
        raise HTTPException(status_code=400, detail="Файли холӣ бор карда намешавад")

    return {
        "url": f"{str(request.base_url).rstrip('/')}/media/{saved_name}",
        "type": media_kind,
        "filename": saved_name,
    }


DOCUMENT_CATEGORIES = {
    "normative": "Нормативные документы",
    "orders": "Приказы и распоряжения",
    "methodical": "Методические материалы",
    "forms": "Бланки и формы",
    "other": "Другие документы",
}
DOCUMENT_TYPES = {
    ".pdf": ("application/pdf", b"%PDF-"),
    ".doc": ("application/msword", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"),
    ".docx": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        b"PK",
    ),
    ".xls": ("application/vnd.ms-excel", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"),
    ".xlsx": (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        b"PK",
    ),
    ".ppt": ("application/vnd.ms-powerpoint", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"),
    ".pptx": (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        b"PK",
    ),
    ".rtf": ("application/rtf", b"{\\rtf"),
    ".txt": ("text/plain", None),
}
MAX_DOCUMENT_SIZE = 20 * 1024 * 1024


def public_document(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "category": row["category"],
        "description": row["description"],
        "filename": row["original_name"],
        "content_type": row["content_type"],
        "file_size": row["file_size"],
        "created_at": row["created_at"],
        "status": row["status"],
        "owner_name": row["owner_name"],
    }


DOCUMENT_COLUMNS = "id, title, category, description, original_name, content_type, file_size, created_at, status, owner_id, owner_name"


@app.get("/api/documents/requests")
def get_document_requests(authorization: str | None = Header(default=None)):
    user = get_user_from_token(authorization)
    conn = get_db()
    if user["role"] == "admin":
        rows = conn.execute(
            f"SELECT {DOCUMENT_COLUMNS} FROM documents WHERE owner_id IS NOT NULL "
            "ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC"
        ).fetchall()
    else:
        rows = conn.execute(
            f"SELECT {DOCUMENT_COLUMNS} FROM documents WHERE owner_id = ? ORDER BY created_at DESC",
            (user["id"],),
        ).fetchall()
    conn.close()
    return [public_document(row) for row in rows]


@app.get("/api/documents")
def get_documents(category: str | None = None):
    if category and category not in DOCUMENT_CATEGORIES:
        raise HTTPException(status_code=400, detail="Некорректная категория документа")
    conn = get_db()
    if category:
        rows = conn.execute(
            "SELECT id, title, category, description, original_name, content_type, file_size, created_at, status, owner_id, owner_name "
            "FROM documents WHERE status = 'published' AND category = ? ORDER BY created_at DESC, id DESC",
            (category,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, title, category, description, original_name, content_type, file_size, created_at, status, owner_id, owner_name "
            "FROM documents WHERE status = 'published' ORDER BY created_at DESC, id DESC"
        ).fetchall()
    conn.close()
    return [public_document(row) for row in rows]


@app.post("/api/documents")
async def upload_document(
    request: Request,
    title: str = Query(..., min_length=3, max_length=160),
    category: str = Query(...),
    description: str = Query(default="", max_length=1000),
    authorization: str | None = Header(default=None),
    filename: str | None = Header(default=None, alias="X-File-Name"),
):
    user = get_user_from_token(authorization)
    is_admin = user["role"] == "admin"
    if category not in DOCUMENT_CATEGORIES:
        raise HTTPException(status_code=400, detail="Некорректная категория документа")

    original_name = (filename or "").replace("\\", "/").rsplit("/", 1)[-1]
    original_name = "".join(
        character for character in unquote(original_name)
        if ord(character) >= 32 and character not in "/\\"
    )[:160].strip()
    extension = os.path.splitext(original_name)[1].lower()
    document_type = DOCUMENT_TYPES.get(extension)
    if not original_name or document_type is None:
        raise HTTPException(status_code=415, detail="Поддерживаются только PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, RTF и TXT")

    expected_type, signature = document_type
    enforce_rate_limit(request, "document-upload", 20, 3600)
    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if content_type not in (expected_type, "application/octet-stream"):
        raise HTTPException(status_code=415, detail="Тип файла не соответствует его расширению")

    stored_name = f"{uuid.uuid4().hex}{extension}"
    saved_path = os.path.join(DOCUMENTS_DIR, stored_name)
    total_size = 0
    first_bytes = b""
    try:
        with open(saved_path, "wb") as target:
            async for chunk in request.stream():
                if not first_bytes:
                    first_bytes = chunk[:16]
                total_size += len(chunk)
                if total_size > MAX_DOCUMENT_SIZE:
                    raise HTTPException(status_code=413, detail="Максимальный размер документа — 20 МБ")
                target.write(chunk)
        if total_size == 0:
            raise HTTPException(status_code=400, detail="Нельзя загрузить пустой файл")
        if signature and not first_bytes.startswith(signature):
            raise HTTPException(status_code=415, detail="Содержимое файла не соответствует его типу")

        document_id = uuid.uuid4().hex
        created_at = now_iso()
        conn = get_db()
        conn.execute(
            "INSERT INTO documents (id, title, category, description, stored_name, original_name, content_type, file_size, created_by, created_at, status, owner_id, owner_name) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                document_id,
                title.strip(),
                category,
                description.strip(),
                stored_name,
                original_name,
                expected_type,
                total_size,
                user["id"],
                created_at,
                "published" if is_admin else "pending",
                None if is_admin else user["id"],
                "" if is_admin else user["name"],
            ),
        )
        conn.commit()
        row = conn.execute(
            f"SELECT {DOCUMENT_COLUMNS} FROM documents WHERE id = ?",
            (document_id,),
        ).fetchone()
        conn.close()
    except Exception:
        if os.path.exists(saved_path):
            os.remove(saved_path)
        raise

    append_audit(f"Илова шуд ҳуҷҷати «{title.strip()}»")
    if not is_admin:
        notify_admins(f"Новый документ на проверку: «{title.strip()}» от {user['name']}")
    return public_document(row)


@app.get("/api/documents/{document_id}/download")
def download_document(document_id: str, authorization: str | None = Header(default=None)):
    conn = get_db()
    row = conn.execute(
        "SELECT stored_name, original_name, content_type, status, owner_id FROM documents WHERE id = ?",
        (document_id,),
    ).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Документ не найден")
    if row["status"] != "published":
        viewer = get_user_from_token(authorization)
        if viewer["role"] != "admin" and viewer["id"] != row["owner_id"]:
            raise HTTPException(status_code=404, detail="Документ не найден")
    saved_path = os.path.abspath(os.path.join(DOCUMENTS_DIR, row["stored_name"]))
    if os.path.commonpath((os.path.abspath(DOCUMENTS_DIR), saved_path)) != os.path.abspath(DOCUMENTS_DIR):
        raise HTTPException(status_code=404, detail="Документ не найден")
    if not os.path.isfile(saved_path):
        raise HTTPException(status_code=404, detail="Файл документа не найден")
    return FileResponse(
        saved_path,
        media_type=row["content_type"],
        filename=row["original_name"],
        headers={"X-Content-Type-Options": "nosniff"},
    )


@app.put("/api/documents/{document_id}")
def update_document(
    document_id: str,
    title: str = Query(..., min_length=3, max_length=160),
    category: str = Query(...),
    description: str = Query(default="", max_length=1000),
    authorization: str | None = Header(default=None),
):
    user = get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Только администратор может изменять документы")
    if category not in DOCUMENT_CATEGORIES:
        raise HTTPException(status_code=400, detail="Некорректная категория документа")
    conn = get_db()
    updated = conn.execute(
        "UPDATE documents SET title = ?, category = ?, description = ? WHERE id = ?",
        (title.strip(), category, description.strip(), document_id),
    ).rowcount
    if not updated:
        conn.close()
        raise HTTPException(status_code=404, detail="Документ не найден")
    conn.commit()
    row = conn.execute(
        f"SELECT {DOCUMENT_COLUMNS} FROM documents WHERE id = ?",
        (document_id,),
    ).fetchone()
    conn.close()
    append_audit(f"Тағйир дода шуд ҳуҷҷати «{title.strip()}»")
    return public_document(row)


def review_document(document_id: str, new_status: str, authorization: str | None):
    user = get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Только администратор может проверять документы")
    conn = get_db()
    row = conn.execute(
        "SELECT title, status, owner_id FROM documents WHERE id = ?", (document_id,)
    ).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Документ не найден")
    if row["status"] != "pending":
        conn.close()
        raise HTTPException(status_code=409, detail="Проверить можно только документ на рассмотрении")
    conn.execute("UPDATE documents SET status = ? WHERE id = ?", (new_status, document_id))
    conn.commit()
    result = conn.execute(f"SELECT {DOCUMENT_COLUMNS} FROM documents WHERE id = ?", (document_id,)).fetchone()
    conn.close()
    verdict = "подтверждён" if new_status == "published" else "отклонён"
    append_audit(f"Документ «{row['title']}» {verdict}")
    if row["owner_id"]:
        notify_users([row["owner_id"]], f"Ваш документ «{row['title']}» {verdict}")
    return public_document(result)


@app.post("/api/documents/{document_id}/approve")
def approve_document(document_id: str, authorization: str | None = Header(default=None)):
    return review_document(document_id, "published", authorization)


@app.post("/api/documents/{document_id}/reject")
def reject_document(document_id: str, authorization: str | None = Header(default=None)):
    return review_document(document_id, "rejected", authorization)


@app.delete("/api/documents/{document_id}")
def delete_document(document_id: str, authorization: str | None = Header(default=None)):
    user = get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Только администратор может удалять документы")
    conn = get_db()
    row = conn.execute(
        "SELECT title, stored_name FROM documents WHERE id = ?",
        (document_id,),
    ).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Документ не найден")
    saved_path = os.path.abspath(os.path.join(DOCUMENTS_DIR, row["stored_name"]))
    if os.path.commonpath((os.path.abspath(DOCUMENTS_DIR), saved_path)) != os.path.abspath(DOCUMENTS_DIR):
        conn.close()
        raise HTTPException(status_code=404, detail="Документ не найден")
    if os.path.exists(saved_path):
        os.remove(saved_path)
    conn.execute("DELETE FROM documents WHERE id = ?", (document_id,))
    conn.commit()
    conn.close()
    append_audit(f"Нест карда шуд ҳуҷҷати «{row['title']}»")
    return {"status": "deleted"}


SERVICE_CATEGORIES = {
    "urban-planning": "Градостроительство",
    "design": "Проектирование",
    "inspection": "Техническое обследование",
    "laboratory": "Лабораторные испытания",
    "standards": "Нормативные документы",
    "training": "Обучение и аттестация",
    "digital": "Цифровые услуги и консультации",
    "printing": "Печать и издательские услуги",
}
SERVICE_ORDER_STATUSES = {"new", "in_progress", "completed", "cancelled"}


@app.get("/api/service-categories")
def get_service_categories():
    return [{"id": category_id, "title": title} for category_id, title in SERVICE_CATEGORIES.items()]


@app.get("/api/orders")
def get_service_orders(authorization: str | None = Header(default=None)):
    user = get_user_from_token(authorization)
    conn = get_db()
    if user["role"] == "admin":
        rows = conn.execute(
            "SELECT id, user_id, customer_name, category, service_name, phone, organization, details, status, admin_note, created_at, updated_at "
            "FROM service_orders ORDER BY created_at DESC, id DESC"
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, user_id, customer_name, category, service_name, phone, organization, details, status, admin_note, created_at, updated_at "
            "FROM service_orders WHERE user_id = ? ORDER BY created_at DESC, id DESC",
            (user["id"],),
        ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


@app.post("/api/orders")
def create_service_order(
    payload: ServiceOrderInput,
    request: Request,
    authorization: str | None = Header(default=None),
):
    enforce_rate_limit(request, "service-order", 20, 3600)
    user = get_user_from_token(authorization)
    if user["role"] != "applicant":
        raise HTTPException(status_code=403, detail="Для заказа услуги войдите как заявитель")
    if payload.category not in SERVICE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Некорректная категория услуги")
    digits = "".join(character for character in payload.phone if character.isdigit())
    if len(digits) < 5 or len(digits) > 15 or any(
        character not in "0123456789+()-. " for character in payload.phone
    ):
        raise HTTPException(status_code=422, detail="Укажите действительный номер телефона")

    order_id = uuid.uuid4().hex
    created_at = now_iso()
    conn = get_db()
    conn.execute(
        "INSERT INTO service_orders (id, user_id, customer_name, category, service_name, phone, organization, details, status, admin_note, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', '', ?, ?)",
        (
            order_id,
            user["id"],
            user["name"],
            payload.category,
            payload.service_name.strip(),
            payload.phone.strip(),
            payload.organization.strip(),
            payload.details.strip(),
            created_at,
            created_at,
        ),
    )
    conn.commit()
    row = conn.execute(
        "SELECT id, user_id, customer_name, category, service_name, phone, organization, details, status, admin_note, created_at, updated_at "
        "FROM service_orders WHERE id = ?",
        (order_id,),
    ).fetchone()
    conn.close()
    append_audit(f"Дархости хизматрасонӣ аз ҷониби {user['name']}: {payload.service_name.strip()}")
    return dict(row)


@app.put("/api/orders/{order_id}")
def update_service_order(
    order_id: str,
    payload: ServiceOrderUpdate,
    authorization: str | None = Header(default=None),
):
    user = get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Только администратор может обрабатывать заказы")
    if payload.status not in SERVICE_ORDER_STATUSES:
        raise HTTPException(status_code=400, detail="Некорректный статус заказа")
    conn = get_db()
    updated = conn.execute(
        "UPDATE service_orders SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?",
        (payload.status, payload.admin_note.strip(), now_iso(), order_id),
    ).rowcount
    if not updated:
        conn.close()
        raise HTTPException(status_code=404, detail="Заказ не найден")
    conn.commit()
    row = conn.execute(
        "SELECT id, user_id, customer_name, category, service_name, phone, organization, details, status, admin_note, created_at, updated_at "
        "FROM service_orders WHERE id = ?",
        (order_id,),
    ).fetchone()
    conn.close()
    append_audit(f"Обновлён статус заказа {order_id}: {payload.status}")
    return dict(row)


@app.delete("/api/orders/{order_id}")
def delete_service_order(order_id: str, authorization: str | None = Header(default=None)):
    user = get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Только администратор может удалять заказы")
    conn = get_db()
    deleted = conn.execute("DELETE FROM service_orders WHERE id = ?", (order_id,)).rowcount
    conn.commit()
    conn.close()
    if not deleted:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    append_audit(f"Удалён заказ {order_id}")
    return {"status": "deleted"}


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "registry-backend"}


def authenticate_user(payload: LoginRequest, request: Request, admin_only: bool) -> JSONResponse:
    action = "admin-login" if admin_only else "login"
    enforce_rate_limit(request, action, 10, 900)
    conn = get_db()
    user = conn.execute(
        "SELECT id, code, role, name, password_hash FROM users WHERE code = ?",
        (payload.code.strip(),),
    ).fetchone()
    conn.close()
    is_valid_password, needs_rehash = (
        verify_password(payload.password, user["password_hash"]) if user is not None else (False, False)
    )
    if user is None or not is_valid_password or (admin_only and user["role"] != "admin"):
        raise HTTPException(status_code=401, detail="Неверный код или пароль")

    token = secrets.token_urlsafe(32)
    token_hash = hash_session_token(token)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=12)).isoformat()
    conn = get_db()
    if needs_rehash:
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (hash_password(payload.password), user["id"]),
        )
    conn.execute("DELETE FROM sessions WHERE expires_at <= ?", (now_iso(),))
    conn.execute(
        "INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
        (token_hash, user["id"], expires_at, now_iso()),
    )
    conn.commit()
    conn.close()

    response = JSONResponse({
        "user": {
            "id": user["id"],
            "code": user["code"],
            "role": user["role"],
            "name": user["name"],
        },
    })
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=12 * 60 * 60,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="none" if IS_PRODUCTION else "lax",
        path="/",
    )
    return response


@app.post("/api/login")
def login(payload: LoginRequest, request: Request):
    return authenticate_user(payload, request, admin_only=False)


@app.post("/api/admin/login")
def admin_login(payload: LoginRequest, request: Request):
    return authenticate_user(payload, request, admin_only=True)


@app.get("/api/maintenance/status")
def get_public_maintenance_status() -> dict[str, Any]:
    state = get_maintenance_state()
    return {
        "enabled": state["enabled"],
        "reason": state["reason"],
        "ends_at": state["ends_at"],
        "text_tj": state["text_tj"],
        "text_ru": state["text_ru"],
    }


@app.get("/api/maintenance")
def get_maintenance_settings(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    require_admin(authorization)
    state = get_maintenance_state()
    conn = get_db()
    events = conn.execute(
        "SELECT id, actor_id, actor_name, action, details, created_at "
        "FROM maintenance_events ORDER BY created_at DESC, id DESC LIMIT 50"
    ).fetchall()
    conn.close()
    return {**state, "events": [dict(event) for event in events]}


@app.put("/api/maintenance")
def update_maintenance_settings(
    payload: MaintenanceUpdateRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    user = require_admin(authorization)
    current = get_maintenance_state()
    ends_at = payload.ends_at.isoformat() if payload.ends_at else None
    updated_at = now_iso()
    conn = get_db()
    conn.execute("BEGIN IMMEDIATE")
    conn.execute(
        "UPDATE maintenance_settings "
        "SET enabled = ?, reason = ?, ends_at = ?, auto_restore = ?, text_tj = ?, text_ru = ?, "
        "updated_by = ?, updated_at = ? WHERE id = 1",
        (
            int(payload.enabled),
            payload.reason,
            ends_at,
            int(payload.auto_restore),
            payload.text_tj,
            payload.text_ru,
            user["name"],
            updated_at,
        ),
    )
    if current["enabled"] != payload.enabled:
        action = "enabled" if payload.enabled else "disabled"
        details = payload.reason or ("Включён режим технического обслуживания" if payload.enabled else "Сайт открыт")
        add_maintenance_event(conn, user["id"], user["name"], action, details, updated_at)
    changed_texts = [
        label
        for label, key in (("тоҷикӣ", "text_tj"), ("русский", "text_ru"))
        if current[key] != getattr(payload, key)
    ]
    if changed_texts:
        add_maintenance_event(
            conn,
            user["id"],
            user["name"],
            "text_updated",
            f"Изменён текст страницы обслуживания: {', '.join(changed_texts)}",
            updated_at,
        )
    if current["ends_at"] != ends_at or current["auto_restore"] != payload.auto_restore:
        schedule = (
            f"Окончание: {ends_at or 'не задано'}; "
            f"автоматическое восстановление: {'включено' if payload.auto_restore else 'выключено'}"
        )
        add_maintenance_event(conn, user["id"], user["name"], "schedule_updated", schedule, updated_at)
    if current["reason"] != payload.reason and current["enabled"] == payload.enabled:
        add_maintenance_event(
            conn,
            user["id"],
            user["name"],
            "reason_updated",
            payload.reason or "Причина технических работ удалена",
            updated_at,
        )
    conn.commit()
    conn.close()
    return get_maintenance_settings(authorization)


@app.post("/api/register")
def register(payload: RegistrationRequest, request: Request):
    enforce_rate_limit(request, "register", 5, 3600)
    code = payload.code.strip()
    name = payload.name.strip()
    if not code or not name:
        raise HTTPException(status_code=400, detail="Код и имя обязательны")

    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE code = ?", (code,)).fetchone()
    if existing is not None:
        conn.close()
        raise HTTPException(status_code=400, detail="Такой код уже зарегистрирован")

    user_id = uuid.uuid4().hex
    try:
        conn.execute(
            "INSERT INTO users (id, code, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, code, hash_password(payload.password), "applicant", name, now_iso()),
        )
        conn.commit()
    except sqlite3.IntegrityError as error:
        conn.close()
        raise HTTPException(status_code=409, detail="Такой код уже зарегистрирован") from error
    conn.close()
    append_audit(f"Заявитель зарегистрирован: {name} ({code})")
    notify_admins(f"Новый заявитель зарегистрирован: {name} ({code})")
    return {"status": "registered", "role": "applicant"}


@app.post("/api/logout")
def logout(authorization: str | None = Header(default=None)):
    user = get_user_from_token(authorization)
    token = authorization[len("Bearer "):].strip()
    conn = get_db()
    conn.execute("DELETE FROM sessions WHERE token = ? AND user_id = ?", (hash_session_token(token), user["id"]))
    conn.commit()
    conn.close()
    response = JSONResponse({"status": "logged_out"})
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="none" if IS_PRODUCTION else "lax",
        path="/",
    )
    return response


@app.get("/api/me")
def me(authorization: str | None = Header(default=None)):
    user = get_user_from_token(authorization)
    return {"user": user}


@app.get("/api/notifications")
def get_notifications(authorization: str | None = Header(default=None)):
    user = get_user_from_token(authorization)
    conn = get_db()
    rows = conn.execute(
        "SELECT id, message, read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30",
        (user["id"],),
    ).fetchall()
    unread = conn.execute(
        "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0", (user["id"],)
    ).fetchone()["n"]
    conn.close()
    return {
        "unread": unread,
        "items": [
            {"id": r["id"], "message": r["message"], "read": bool(r["read"]), "created_at": r["created_at"]}
            for r in rows
        ],
    }


@app.post("/api/notifications/read")
def read_notifications(authorization: str | None = Header(default=None)):
    user = get_user_from_token(authorization)
    conn = get_db()
    conn.execute("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0", (user["id"],))
    conn.commit()
    conn.close()
    return {"status": "ok"}


@app.get("/api/certificates")
def get_certificates(
    authorization: str | None = Header(default=None),
    search: str = Query(default="", max_length=200),
    certificate_status: str | None = Query(default=None, alias="status"),
    offset: int = Query(default=0, ge=0),
    limit: int | None = Query(default=None, ge=1, le=200),
):
    user = get_user_from_token(authorization) if authorization else None
    conn = get_db()
    base_conditions: list[str] = []
    base_params: list[str] = []
    if user is None:
        base_conditions.append("status = 'published'")
    elif user["role"] == "applicant":
        base_conditions.append("created_by = ?")
        base_params.append(user["id"])

    base_where = f" WHERE {' AND '.join(base_conditions)}" if base_conditions else ""
    search_text = search.strip().casefold()
    search_conditions = list(base_conditions)
    search_params = list(base_params)
    if search_text:
        escaped_search = search_text.replace("!", "!!").replace("%", "!%").replace("_", "!_")
        search_pattern = f"%{escaped_search}%"
        search_conditions.append(
            "(casefold(COALESCE(full_name, '')) LIKE ? ESCAPE '!' "
            "OR casefold(COALESCE(registration_number, '')) LIKE ? ESCAPE '!')"
        )
        search_params.extend([search_pattern, search_pattern])
    if certificate_status and certificate_status != "all":
        if certificate_status not in {"pending", "published", "revoked", "rejected"}:
            conn.close()
            raise HTTPException(status_code=400, detail="Некорректный статус сертификата")
        search_conditions.append("status = ?")
        search_params.append(certificate_status)

    search_where = f" WHERE {' AND '.join(search_conditions)}" if search_conditions else ""
    sort_order = (
        "certificate_date DESC, created_at DESC, id DESC"
        if user is None
        else "created_at DESC, id DESC"
    )
    selected_columns = (
        "id, full_name, specialty, training_center, course_name, registration_number, "
        "certificate_date, validity_period, status, approved, publication_date"
        if user is None
        else "*"
    )
    wants_pagination = limit is not None or offset > 0 or bool(search_text) or bool(certificate_status)
    if not wants_pagination:
        rows = conn.execute(
            f"SELECT {selected_columns} FROM certificates{base_where} ORDER BY {sort_order}",
            base_params,
        ).fetchall()
        conn.close()
        return [dict(row) for row in rows]

    status_counts = {"pending": 0, "published": 0, "revoked": 0, "rejected": 0}
    for row in conn.execute(
        f"SELECT status, COUNT(*) AS count FROM certificates{base_where} GROUP BY status",
        base_params,
    ):
        if row["status"] in status_counts:
            status_counts[row["status"]] = row["count"]

    total = conn.execute(
        f"SELECT COUNT(*) FROM certificates{search_where}",
        search_params,
    ).fetchone()[0]
    query = f"SELECT {selected_columns} FROM certificates{search_where} ORDER BY {sort_order}"
    query_params: list[Any] = list(search_params)
    if limit is not None:
        query += " LIMIT ? OFFSET ?"
        query_params.extend([limit, offset])
    else:
        query += " LIMIT -1 OFFSET ?"
        query_params.append(offset)
    rows = conn.execute(query, query_params).fetchall()
    conn.close()
    return {
        "items": [dict(row) for row in rows],
        "total": total,
        "counts": status_counts,
    }


@app.get("/api/certificates/verify/{certificate_id}")
def verify_certificate(certificate_id: str, number: str):
    conn = get_db()
    row = conn.execute(
        """
        SELECT id, registration_number, full_name, specialty, training_center,
               course_name, certificate_date, validity_period, status
        FROM certificates WHERE id = ?
        """,
        (certificate_id,),
    ).fetchone()
    conn.close()
    if row is None or row["registration_number"] != number:
        raise HTTPException(status_code=404, detail="Сертификат не найден")
    if row["status"] == "pending":
        return {
            "registration_number": row["registration_number"],
            "status": row["status"],
            "message": "Сертификат ещё не опубликован",
        }
    return dict(row)


@app.get("/api/audit")
def get_audit(authorization: str | None = Header(default=None)):
    user = get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Журнал аудита доступен только администратору")
    conn = get_db()
    rows = conn.execute("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 20").fetchall()
    conn.close()
    return [dict(row) for row in rows]


@app.get("/api/news")
def get_news(authorization: str | None = Header(default=None)):
    if authorization is not None:
        get_user_from_token(authorization)
    conn = get_db()
    rows = conn.execute(
        """
        SELECT news.*,
               (SELECT COUNT(*) FROM news_views WHERE news_views.news_id = news.id) AS view_count
        FROM news
        ORDER BY published_at DESC
        """
    ).fetchall()
    conn.close()
    items = []
    for row in rows:
        item = dict(row)
        item["images"] = parse_images(item.get("images"))
        item["media"] = parse_news_media(item.get("media"), item["images"])
        items.append(item)
    return items


@app.get("/api/news/{news_id}")
def get_news_by_id(news_id: str):
    conn = get_db()
    row = conn.execute(
        """
        SELECT news.*,
               (SELECT COUNT(*) FROM news_views WHERE news_views.news_id = news.id) AS view_count
        FROM news
        WHERE id = ?
        """,
        (news_id,),
    ).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Хабар ёфт нашуд")

    item = dict(row)
    item["images"] = parse_images(item.get("images"))
    item["media"] = parse_news_media(item.get("media"), item["images"])
    return item


@app.post("/api/news/{news_id}/views")
def record_news_view(news_id: str, payload: NewsViewInput, request: Request):
    enforce_rate_limit(request, "news-view", 30, 60)
    try:
        visitor_id = str(uuid.UUID(payload.visitor_id))
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Нишондиҳандаи хонанда нодуруст аст") from error

    conn = get_db()
    exists = conn.execute("SELECT 1 FROM news WHERE id = ?", (news_id,)).fetchone()
    if exists is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Хабар ёфт нашуд")
    conn.execute(
        "INSERT OR IGNORE INTO news_views (news_id, visitor_id, viewed_at) VALUES (?, ?, ?)",
        (news_id, visitor_id, now_iso()),
    )
    count = conn.execute(
        "SELECT COUNT(*) FROM news_views WHERE news_id = ?",
        (news_id,),
    ).fetchone()[0]
    conn.commit()
    conn.close()
    return {"view_count": count}


@app.post("/api/news")
def create_news(payload: NewsInput, authorization: str | None = Header(default=None)):
    user = get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Только администратор может публиковать новости")

    cleaned_media = parse_news_media(payload.media, payload.images)
    cleaned_images = [item["src"] for item in cleaned_media if item["type"] == "image"]
    conn = get_db()
    conn.execute(
        "INSERT INTO news (id, title, category, content, title_ru, category_ru, content_ru, images, media, published_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            uuid.uuid4().hex,
            payload.title.strip(),
            payload.category.strip() or "Новости",
            payload.content.strip(),
            payload.title_ru.strip() if payload.title_ru else None,
            (payload.category_ru or "").strip() or None,
            payload.content_ru.strip() if payload.content_ru else None,
            json.dumps(cleaned_images, ensure_ascii=False),
            json.dumps(cleaned_media, ensure_ascii=False),
            now_iso(),
            user["id"],
            now_iso(),
        ),
    )
    conn.commit()
    conn.close()
    append_audit(f"Добавлена новость: {payload.title.strip()}")
    return {"status": "created"}


@app.put("/api/news/{news_id}")
def update_news(news_id: str, payload: NewsInput, authorization: str | None = Header(default=None)):
    user = get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Только администратор может изменять новости")

    conn = get_db()
    row = conn.execute(
        "SELECT title, title_ru, category_ru, content_ru FROM news WHERE id = ?",
        (news_id,),
    ).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Хабар ёфт нашуд")

    translations = {
        field: getattr(payload, field) if field in payload.model_fields_set else row[field]
        for field in ("title_ru", "category_ru", "content_ru")
    }
    cleaned_media = parse_news_media(payload.media, payload.images)
    cleaned_images = [item["src"] for item in cleaned_media if item["type"] == "image"]
    conn.execute(
        "UPDATE news SET title = ?, category = ?, content = ?, title_ru = ?, category_ru = ?, content_ru = ?, images = ?, media = ? WHERE id = ?",
        (
            payload.title.strip(),
            payload.category.strip() or "Новости",
            payload.content.strip(),
            translations["title_ru"].strip() if translations["title_ru"] else None,
            (translations["category_ru"] or "").strip() or None,
            translations["content_ru"].strip() if translations["content_ru"] else None,
            json.dumps(cleaned_images, ensure_ascii=False),
            json.dumps(cleaned_media, ensure_ascii=False),
            news_id,
        ),
    )
    conn.commit()
    conn.close()
    append_audit(f"Тағйир дода шуд хабари «{row['title']}»")
    return {"status": "updated"}


@app.delete("/api/news/{news_id}")
def delete_news(news_id: str, authorization: str | None = Header(default=None)):
    user = get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Только администратор может удалять новости")

    conn = get_db()
    row = conn.execute("SELECT title FROM news WHERE id = ?", (news_id,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Хабар ёфт нашуд")
    conn.execute("DELETE FROM news_views WHERE news_id = ?", (news_id,))
    conn.execute("DELETE FROM news WHERE id = ?", (news_id,))
    conn.commit()
    conn.close()
    append_audit(f"Нест карда шуд хабари «{row['title']}»")
    return {"status": "deleted"}


@app.get("/api/site-content")
def get_site_content():
    conn = get_db()
    rows = conn.execute(
        "SELECT section, item_id, data FROM site_content ORDER BY section, position"
    ).fetchall()
    conn.close()
    content: dict[str, list[Any]] = {}
    for row in rows:
        if row["item_id"] == "__empty__":
            content.setdefault(row["section"], [])
            continue
        content.setdefault(row["section"], []).append(json.loads(row["data"]))
    return content


@app.put("/api/site-content/{section}")
def update_site_content(
    section: str,
    payload: SiteContentUpdate,
    authorization: str | None = Header(default=None),
):
    user = get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Только администратор может изменять содержимое сайта")
    if section not in SITE_CONTENT_SECTIONS:
        raise HTTPException(status_code=404, detail="Раздел содержимого сайта не найден")
    for item in payload.items:
        if not isinstance(item, (str, dict)):
            raise HTTPException(status_code=422, detail="Элементы раздела должны быть текстом или объектом")

    conn = get_db()
    conn.execute("BEGIN IMMEDIATE")
    conn.execute("DELETE FROM site_content WHERE section = ?", (section,))
    timestamp = now_iso()
    if not payload.items:
        conn.execute(
            "INSERT INTO site_content (section, item_id, position, data, updated_at) VALUES (?, ?, ?, ?, ?)",
            (section, "__empty__", 0, "null", timestamp),
        )
    else:
        conn.executemany(
            "INSERT INTO site_content (section, item_id, position, data, updated_at) VALUES (?, ?, ?, ?, ?)",
            [
                (section, uuid.uuid4().hex, index, json.dumps(item, ensure_ascii=False), timestamp)
                for index, item in enumerate(payload.items)
            ],
        )
    conn.commit()
    conn.close()
    append_audit(f"Обновлён раздел содержимого сайта: {section}")
    return {"status": "updated", "section": section, "count": len(payload.items)}


@app.get("/api/dashboard")
def get_dashboard(authorization: str | None = Header(default=None)):
    user = get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Статистика доступна только администратору")
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) FROM certificates WHERE status = 'published'").fetchone()[0]
    active = conn.execute("SELECT COUNT(*) FROM certificates WHERE status = 'published'").fetchone()[0]
    revoked = conn.execute("SELECT COUNT(*) FROM certificates WHERE status = 'revoked'").fetchone()[0]
    applicants = conn.execute("SELECT COUNT(DISTINCT created_by) FROM certificates WHERE created_by IS NOT NULL").fetchone()[0]

    years_rows = conn.execute(
        "SELECT substr(certificate_date, 1, 4) AS year, COUNT(*) AS total FROM certificates WHERE status = 'published' GROUP BY substr(certificate_date, 1, 4) ORDER BY year"
    ).fetchall()
    training_rows = conn.execute(
        "SELECT training_type, COUNT(*) AS total FROM certificates WHERE status = 'published' GROUP BY training_type ORDER BY total DESC LIMIT 5"
    ).fetchall()
    conn.close()

    return {
        "total": total,
        "active": active,
        "revoked": revoked,
        "applicants": applicants,
        "years": {str(row["year"]) if row["year"] else "unknown": row["total"] for row in years_rows},
        "products": {row["training_type"]: row["total"] for row in training_rows},
    }


@app.post("/api/certificates")
def create_certificate(
    payload: CertificateInput,
    request: Request,
    authorization: str | None = Header(default=None),
):
    enforce_rate_limit(request, "certificate-create", 30, 3600)
    user = get_user_from_token(authorization)
    if user["role"] not in {"admin", "applicant"}:
        raise HTTPException(status_code=403, detail="У вас нет прав для создания сертификата")

    conn = get_db()
    manual_reg_number = (payload.registration_number or "").strip()
    if user["role"] == "admin" and manual_reg_number:
        conn.execute("BEGIN IMMEDIATE")
        if conn.execute(
            "SELECT 1 FROM certificates WHERE registration_number = ?",
            (manual_reg_number,),
        ).fetchone():
            conn.rollback()
            conn.close()
            raise HTTPException(status_code=409, detail="Ин рақами бақайдгирӣ аллакай истифода шудааст")
        reg_number = manual_reg_number
    else:
        reg_number = make_reg_number(conn)
    created_at = now_iso()
    status_value = "pending" if user["role"] == "applicant" else payload.status or "published"
    approved_value = 1 if status_value == "published" else 0
    certificate_id = uuid.uuid4().hex

    try:
        conn.execute(
            """
            INSERT INTO certificates (
                id, full_name, birth_date, workplace, position, specialty, training_type,
                training_center, course_name, start_date, end_date, hours, result,
                registration_number, certificate_date, validity_period, status,
                approved, publication_date, comments, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                certificate_id,
                payload.full_name,
                payload.birth_date,
                payload.workplace,
                payload.position,
                payload.specialty,
                payload.training_type,
                payload.training_center,
                payload.course_name,
                payload.start_date,
                payload.end_date,
                payload.hours,
                payload.result,
                reg_number,
                payload.certificate_date or created_at,
                payload.validity_period,
                status_value,
                approved_value,
                created_at if status_value == "published" else None,
                payload.comments or "Рассматривается для публикации",
                user["id"],
                created_at,
                created_at,
            ),
        )
    except sqlite3.IntegrityError as error:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=409, detail="Ин рақами бақайдгирӣ аллакай истифода шудааст") from error
    conn.commit()
    conn.close()

    append_audit(f"Создана заявка {reg_number} пользователем {user['code']}")
    if user["role"] == "applicant":
        notify_admins(f"Новая заявка {reg_number} от {user['code']} ожидает проверки")
    else:
        notify_users([user["id"]], f"Сертификат {reg_number} создан")

    return {"status": "created", "registration_number": reg_number}


@app.post("/api/certificates/{certificate_id}/approve")
def approve_certificate(certificate_id: str, authorization: str | None = Header(default=None)):
    user = get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Только администратор может подтверждать сертификаты")

    conn = get_db()
    row = conn.execute("SELECT registration_number, created_by FROM certificates WHERE id = ?", (certificate_id,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Сертификат не найден")
    conn.execute(
        "UPDATE certificates SET status = 'published', approved = 1, publication_date = ?, updated_at = ?, comments = ? WHERE id = ?",
        (now_iso(), now_iso(), "Подтверждено уполномоченным сотрудником", certificate_id),
    )
    conn.commit()
    conn.close()
    append_audit(f"Подтверждён сертификат {row['registration_number']}")
    if row["created_by"]:
        notify_users([row["created_by"]], f"Ваша заявка {row['registration_number']} подтверждена и опубликована")
    return {"status": "approved"}


@app.put("/api/certificates/{certificate_id}")
def update_certificate(
    certificate_id: str,
    payload: CertificateInput,
    authorization: str | None = Header(default=None),
):
    user = get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Только администратор может изменять сертификаты")

    conn = get_db()
    row = conn.execute(
        "SELECT registration_number FROM certificates WHERE id = ?",
        (certificate_id,),
    ).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Сертификат не найден")

    updated_at = now_iso()
    conn.execute(
        """
        UPDATE certificates SET
            full_name = ?, birth_date = ?, workplace = ?, position = ?, specialty = ?,
            training_type = ?, training_center = ?, course_name = ?, start_date = ?,
            end_date = ?, hours = ?, result = ?, certificate_date = ?, validity_period = ?,
            comments = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            payload.full_name,
            payload.birth_date,
            payload.workplace,
            payload.position,
            payload.specialty,
            payload.training_type,
            payload.training_center,
            payload.course_name,
            payload.start_date,
            payload.end_date,
            payload.hours,
            payload.result,
            payload.certificate_date,
            payload.validity_period,
            payload.comments,
            updated_at,
            certificate_id,
        ),
    )
    conn.commit()
    conn.close()
    append_audit(f"Изменён сертификат {row['registration_number']}")
    return {"status": "updated"}


@app.delete("/api/certificates/{certificate_id}")
def delete_certificate(certificate_id: str, authorization: str | None = Header(default=None)):
    user = get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Только администратор может удалять сертификаты")

    conn = get_db()
    row = conn.execute(
        "SELECT registration_number FROM certificates WHERE id = ?",
        (certificate_id,),
    ).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Сертификат не найден")
    conn.execute("DELETE FROM certificates WHERE id = ?", (certificate_id,))
    conn.commit()
    conn.close()
    append_audit(f"Удалён сертификат {row['registration_number']}")
    return {"status": "deleted"}


@app.post("/api/certificates/{certificate_id}/revoke")
def revoke_certificate(certificate_id: str, authorization: str | None = Header(default=None)):
    user = get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Только администратор может аннулировать сертификаты")

    conn = get_db()
    row = conn.execute("SELECT registration_number, created_by FROM certificates WHERE id = ?", (certificate_id,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Сертификат не найден")
    conn.execute(
        "UPDATE certificates SET status = 'revoked', approved = 0, updated_at = ?, comments = ? WHERE id = ?",
        (now_iso(), "Аннулировано в соответствии с решением проверки", certificate_id),
    )
    conn.commit()
    conn.close()
    append_audit(f"Аннулирован сертификат {row['registration_number']}")
    if row["created_by"]:
        notify_users([row["created_by"]], f"Сертификат {row['registration_number']} аннулирован")
    return {"status": "revoked"}


@app.post("/api/certificates/{certificate_id}/reject")
def reject_certificate(certificate_id: str, authorization: str | None = Header(default=None)):
    user = get_user_from_token(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Только администратор может отклонять заявки")

    conn = get_db()
    row = conn.execute(
        "SELECT registration_number, created_by, status FROM certificates WHERE id = ?", (certificate_id,)
    ).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Сертификат не найден")
    if row["status"] != "pending":
        conn.close()
        raise HTTPException(status_code=409, detail="Отклонить можно только заявку на рассмотрении")
    conn.execute(
        "UPDATE certificates SET status = 'rejected', approved = 0, updated_at = ?, comments = ? WHERE id = ?",
        (now_iso(), "Заявка отклонена администратором", certificate_id),
    )
    conn.commit()
    conn.close()
    append_audit(f"Отклонена заявка {row['registration_number']}")
    if row["created_by"]:
        notify_users([row["created_by"]], f"Ваша заявка {row['registration_number']} отклонена")
    return {"status": "rejected"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.app:app", host="127.0.0.1", port=8000, reload=True)
