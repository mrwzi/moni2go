"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

export type MoneySelectOption<T extends string> = Readonly<{
  value: T;
  label: string;
  disabled?: boolean;
}>;

export function MoneySelect<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: Readonly<{
  label: string;
  value: T;
  options: readonly MoneySelectOption<T>[];
  onChange: (value: T) => void;
  hint?: string;
}>) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({
    visibility: "hidden",
  });
  const [placement, setPlacement] = useState<"up" | "down">("down");
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const listboxId = useId();
  const selected =
    options.find((option) => option.value === value) ?? options[0];

  const positionMenu = useCallback(() => {
    const trigger = buttonRef.current?.getBoundingClientRect();
    if (!trigger) return;
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportBottom = viewportTop + viewportHeight;
    const viewportRight = viewportLeft + viewportWidth;
    const form = rootRef.current?.closest("form");
    const dialog = rootRef.current?.closest<HTMLElement>('[role="dialog"]');
    const headerRect = dialog
      ?.querySelector<HTMLElement>(":scope > header")
      ?.getBoundingClientRect();
    const submit = form?.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    const submitRect = submit?.getBoundingClientRect();
    const upperBoundary = Math.max(
      viewportTop + 12,
      headerRect && headerRect.bottom < trigger.top
        ? headerRect.bottom + 8
        : viewportTop + 12,
    );
    const lowerBoundary =
      submitRect && submitRect.top > trigger.bottom
        ? Math.min(viewportBottom - 12, submitRect.top - 8)
        : viewportBottom - 12;
    const below = Math.max(0, lowerBoundary - trigger.bottom - 6);
    const above = Math.max(0, trigger.top - upperBoundary - 6);
    const nextPlacement = below >= 160 || below >= above ? "down" : "up";
    const available = nextPlacement === "up" ? above : below;
    const maxHeight = Math.max(0, Math.min(224, available));
    const width = Math.min(trigger.width, viewportRight - trigger.left - 12);
    const left = Math.max(
      viewportLeft + 12,
      Math.min(trigger.left, viewportRight - width - 12),
    );
    setPlacement(nextPlacement);
    setMenuStyle({
      position: "fixed",
      visibility: "visible",
      left,
      width,
      maxHeight,
      ...(nextPlacement === "up"
        ? { top: trigger.top - maxHeight - 6, bottom: "auto" }
        : { top: trigger.bottom + 6, bottom: "auto" }),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    positionMenu();
  }, [open, positionMenu, options.length]);

  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    viewport?.addEventListener("resize", positionMenu);
    viewport?.addEventListener("scroll", positionMenu);
    const close = (event: MouseEvent) => {
      if (
        !rootRef.current?.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      viewport?.removeEventListener("resize", positionMenu);
      viewport?.removeEventListener("scroll", positionMenu);
    };
  }, [open, positionMenu]);

  useEffect(() => {
    if (!open) return;
    const selectedOption = menuRef.current?.querySelector<HTMLButtonElement>(
      '[role="option"][aria-selected="true"]',
    );
    selectedOption?.focus({ preventScroll: true });
  }, [open]);

  return (
    <div className="money-select" ref={rootRef}>
      <span className="money-select-label" id={labelId}>
        {label}
      </span>
      <button
        ref={buttonRef}
        className="money-select-trigger"
        type="button"
        role="combobox"
        aria-labelledby={labelId}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          if (open) setOpen(false);
          else {
            positionMenu();
            setOpen(true);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            buttonRef.current?.focus();
          }
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            positionMenu();
            setOpen(true);
          }
        }}
      >
        <span>{selected?.label ?? "Choose an option"}</span>
        <span className="money-select-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className={`money-select-menu money-select-menu-${placement}`}
            style={menuStyle}
            id={listboxId}
            role="listbox"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                buttonRef.current?.focus();
                return;
              }
              if (event.key === "Tab") {
                setOpen(false);
                return;
              }
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
              event.preventDefault();
              const options = Array.from(
                menuRef.current?.querySelectorAll<HTMLButtonElement>(
                  '[role="option"]:not(:disabled)',
                ) ?? [],
              );
              const currentIndex = options.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              const direction = event.key === "ArrowDown" ? 1 : -1;
              const nextIndex =
                (currentIndex + direction + options.length) % options.length;
              options[nextIndex]?.focus();
            }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                disabled={option.disabled}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
              >
                <span>{option.label}</span>
                {option.value === value && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>,
          document.body,
        )}
      {hint && <small>{hint}</small>}
    </div>
  );
}
