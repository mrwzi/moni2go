"use client";

import { useEffect, useId, useRef, useState } from "react";

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
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const listboxId = useId();
  const selected =
    options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("mousedown", close);
    };
  }, [open]);

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
          className="money-select-menu"
          id={listboxId}
          role="listbox"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              buttonRef.current?.focus();
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
