"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrganizationPhoto } from "./organization-data";

export default function PhotoGallery({
  photos,
  className = "",
  mosaic = false,
}: {
  photos: OrganizationPhoto[];
  className?: string;
  mosaic?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const activePhoto = activeIndex === null ? null : photos[activeIndex];
  const isOpen = activePhoto !== null;
  const closePhoto = useCallback(() => {
    setActiveIndex(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePhoto();
      } else if (event.key === "ArrowRight" && photos.length > 1) {
        event.preventDefault();
        setActiveIndex((current) => current === null ? null : (current + 1) % photos.length);
      } else if (event.key === "ArrowLeft" && photos.length > 1) {
        event.preventDefault();
        setActiveIndex((current) => current === null ? null : (current - 1 + photos.length) % photos.length);
      } else if (event.key === "Tab") {
        const controls = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closePhoto, photos.length]);

  return (
    <>
      <div className={`portal-photo-grid${mosaic ? " portal-photo-grid--mosaic" : ""} ${className}`}>
        {photos.map((item, index) => {
          return (
          <figure
            className={[
              "portal-photo-card",
              item.document && "portal-photo-card--document",
              item.orientation && `portal-photo-card--${item.orientation}`,
            ].filter(Boolean).join(" ")}
            key={item.src}
          >
            {item.type === "video" ? (
              <video
                className="portal-photo-card__video"
                controls
                playsInline
                preload="metadata"
                aria-label={item.alt || item.caption}
              >
                <source src={item.src} />
                {item.caption}
              </video>
            ) : (
              <button
                aria-label={`Калон дидани акс: ${item.caption}`}
                className="portal-photo-card__image"
                onClick={(event) => {
                  triggerRef.current = event.currentTarget;
                  setFailedImageSrc(null);
                  setActiveIndex(index);
                }}
                type="button"
              >
                <Image
                  src={item.src}
                  alt={item.alt}
                  width={720}
                  height={480}
                  sizes="(max-width: 720px) 50vw, (max-width: 1020px) 50vw, 33vw"
                  unoptimized={!item.src.startsWith("/company/")}
                />
                <span className="portal-photo-card__zoom" aria-hidden="true">
                  <ZoomIn size={18} />
                </span>
              </button>
            )}
            <figcaption>{item.caption}</figcaption>
            {item.description && <p className="portal-photo-card__description">{item.description}</p>}
          </figure>
          );
        })}
      </div>

      {activePhoto && typeof document !== "undefined" && createPortal(
        <div
          aria-label={activePhoto.alt || activePhoto.caption}
          aria-modal="true"
          className="portal-lightbox"
          onClick={(event) => {
            if (event.target === event.currentTarget) closePhoto();
          }}
          ref={dialogRef}
          role="dialog"
          tabIndex={-1}
        >
          <div className="portal-lightbox__topbar">
            <span className="portal-lightbox__count">
              {(activeIndex ?? 0) + 1} / {photos.length}
            </span>
            <button
              aria-label="Бастани акси калон"
              className="portal-lightbox__close"
              onClick={closePhoto}
              ref={closeButtonRef}
              type="button"
            >
              <X size={22} />
            </button>
          </div>
          {photos.length > 1 && (
            <button
              aria-label="Акси қаблӣ"
              className="portal-lightbox__previous"
              onClick={() => setActiveIndex((current) => current === null ? null : (current - 1 + photos.length) % photos.length)}
              type="button"
            >
              <ChevronLeft size={25} />
            </button>
          )}
          <figure className="portal-lightbox__figure">
            <div className="portal-lightbox__image">
              {activePhoto.type === "video" ? (
                <video key={activePhoto.src} src={activePhoto.src} controls playsInline />
              ) : failedImageSrc === activePhoto.src ? (
                <div className="portal-lightbox__error" role="status">Акс бор карда нашуд. Баъдтар дубора кӯшиш кунед.</div>
              ) : (
                <Image
                  key={activePhoto.src}
                  src={activePhoto.src}
                  alt={activePhoto.alt}
                  fill
                  sizes="(max-width: 720px) 96vw, 90vw"
                  unoptimized={!activePhoto.src.startsWith("/company/")}
                  onError={() => setFailedImageSrc(activePhoto.src)}
                />
              )}
            </div>
            <figcaption>{activePhoto.caption}</figcaption>
          </figure>
          {photos.length > 1 && (
            <button
              aria-label="Акси навбатӣ"
              className="portal-lightbox__next"
              onClick={() => setActiveIndex((current) => current === null ? null : (current + 1) % photos.length)}
              type="button"
            >
              <ChevronRight size={25} />
            </button>
          )}
          <span className="portal-lightbox__hint">Тугмаҳои ← → барои гузаштан · Esc барои пӯшидан</span>
        </div>,
        document.body,
      )}
    </>
  );
}
