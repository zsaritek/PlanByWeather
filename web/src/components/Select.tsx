import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SelectOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<SelectOption<T>>;
  disabled?: boolean;
  placeholder?: string;
};

export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
  placeholder,
}: Props<T>) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (!open) return;
      const t = e.target as Node | null;
      if (!t) return;
      if (menuRef.current?.contains(t)) return;
      if (buttonRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open]);

  useEffect(() => {
    function onDocKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onDocKeyDown);
    return () => document.removeEventListener("keydown", onDocKeyDown);
  }, [open]);

  function pick(next: T) {
    onChange(next);
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-left text-zinc-100 outline-none focus:border-zinc-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <span className={selected ? "text-zinc-100" : "text-zinc-500"}>
          {selected?.label ?? placeholder ?? "Select…"}
        </span>
        <span className="text-zinc-500">▾</span>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="listbox"
          aria-labelledby={id}
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl shadow-black/40"
        >
          <div className="max-h-64 overflow-auto p-1">
            {options.map((o) => {
              const isActive = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => pick(o.value)}
                  className={[
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm",
                    isActive
                      ? "bg-zinc-800/70 text-zinc-50"
                      : "text-zinc-200 hover:bg-zinc-900 hover:text-zinc-50",
                  ].join(" ")}
                >
                  <span>{o.label}</span>
                  {isActive ? <span className="text-zinc-300">✓</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


