"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";

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
  const [menuStyle, setMenuStyle] = useState<CSSProperties>();
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
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const form = rootRef.current?.closest("form");
    const submit = form?.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    const submitRect = submit?.getBoundingClientRect();
    const lowerBoundary =
      submitRect && submitRect.top > trigger.bottom
        ? Math.min(viewportHeight - 12, submitRect.top - 8)
        : viewportHeight - 12;
    const below = Math.max(72, lowerBoundary - trigger.bottom - 6);
    const above = Math.max(72, trigger.top - 12);
    const nextPlacement = below < 160 && above > below ? "up" : "down";
    const available = nextPlacement === "up" ? above : below;
    setPlacement(nextPlacement);
    setMenuStyle({
      position: "fixed",
      left: trigger.left,
      width: trigger.width,
      maxHeight: Math.min(224, available),
      ...(nextPlacement === "up"
        ? { bottom: viewportHeight - trigger.top + 6, top: "auto" }
        : { top: trigger.bottom + 6, bottom: "auto" }),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    positionMenu();
    const viewport = window.visualViewport;
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    viewport?.addEventListener("resize", positionMenu);
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      viewport?.removeEventListener("resize", positionMenu);
    };
  }, [open, positionMenu]);

  useEffect(() => {
    if (!open) return;
    const selectedOption = menuRef.current?.querySelector<HTMLButtonElement>(
      '[role="option"][aria-selected="true"]',
    );
    selectedOption?.focus();
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
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            buttonRef.current?.focus();
          }
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{selected?.label ?? "Choose an option"}</span>
        <span className="money-select-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
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
        </div>
      )}
      {hint && <small>{hint}</small>}
    </div>
  );
}
