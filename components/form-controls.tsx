"use client";
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
function usePopover(
  open: boolean,
  close: () => void,
  trigger: RefObject<HTMLButtonElement | null>,
  panel: RefObject<HTMLDivElement | null>,
) {
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 220,
    maxHeight: 320,
  });
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = trigger.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(Math.max(r.width, 220), window.innerWidth - 24);
      const below = window.innerHeight - r.bottom - 16;
      const above = r.top - 16;
      const height = Math.min(360, Math.max(below, above));
      setPosition({
        left: Math.min(Math.max(12, r.left), window.innerWidth - width - 12),
        top:
          below >= Math.min(320, above)
            ? r.bottom + 6
            : Math.max(
                12,
                r.top -
                  Math.min(panel.current?.offsetHeight || 320, height) -
                  6,
              ),
        width,
        maxHeight: height,
      });
    };
    place();
    const frame = requestAnimationFrame(place);
    const outside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        !trigger.current?.contains(target) &&
        !panel.current?.contains(target)
      )
        close();
    };
    const scroll = (e: Event) => {
      if (!panel.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", scroll, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [open, close, trigger, panel]);
  return position;
}
export function SelectControl({
  value,
  onValueChange,
  children,
  className = "",
  disabled = false,
  ...props
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const options = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const p = (
        child as React.ReactElement<{ value?: string; children: ReactNode }>
      ).props;
      return { value: p.value ?? String(p.children), label: p.children };
    });
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null),
    id = useId();
  const close = useRef(() => setOpen(false)).current;
  const pos = usePopover(open, close, trigger, panel);
  useEffect(() => {
    if (open) panel.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (open)
      panel.current
        ?.querySelector('[data-active="true"]')
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  const choose = (index: number) => {
    onValueChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  };
  const show = (last = false) => {
    setActive(
      last
        ? options.length - 1
        : Math.max(
            0,
            options.findIndex((o) => o.value === value),
          ),
    );
    setOpen(true);
  };
  const typed = useRef(""),
    typedAt = useRef(0);
  return (
    <span className={`ui-select ${className}`}>
      <button
        {...props}
        ref={trigger}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? id : undefined}
        disabled={disabled}
        className="ui-select-trigger"
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show(e.key === "ArrowUp");
          }
        }}
      >
        <span>
          {options.find((o) => o.value === value)?.label ?? "Select…"}
        </span>
        <ChevronDown size={14} />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="listbox"
            aria-label={props["aria-label"] || "Options"}
            aria-activedescendant={`${id}-${active}`}
            tabIndex={-1}
            className="ui-options ui-floating"
            style={pos}
            onKeyDown={(e) => {
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                setActive((i) =>
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? options.length - 1
                      : (i +
                          (e.key === "ArrowDown" ? 1 : -1) +
                          options.length) %
                        options.length,
                );
              } else if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                choose(active);
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                close();
                trigger.current?.focus();
              } else if (e.key === "Tab") {
                close();
                trigger.current?.focus();
              } else if (e.key.length === 1) {
                typed.current =
                  Date.now() - typedAt.current > 600
                    ? e.key
                    : typed.current + e.key;
                typedAt.current = Date.now();
                const match = options.findIndex((o) =>
                  String(o.label)
                    .toLowerCase()
                    .startsWith(typed.current.toLowerCase()),
                );
                if (match >= 0) setActive(match);
              }
            }}
          >
            {options.map((o, i) => (
              <button
                type="button"
                role="option"
                id={`${id}-${i}`}
                key={o.value}
                aria-selected={o.value === value}
                tabIndex={-1}
                data-active={i === active}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span>{o.label}</span>
                {o.value === value && <Check size={14} />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </span>
  );
}
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export function DateControl({
  value,
  onValueChange,
  min,
  max,
  "aria-label": label,
}: {
  value: string;
  onValueChange: (value: string) => void;
  min?: string;
  max?: string;
  "aria-label": string;
}) {
  const [open, setOpen] = useState(false),
    [month, setMonth] = useState(() => parse(value || iso(new Date()))),
    [focused, setFocused] = useState(value || iso(new Date()));
  const trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null),
    id = useId();
  const close = useRef(() => setOpen(false)).current;
  const pos = usePopover(open, close, trigger, panel);
  const allowed = (v: string) => (!min || v >= min) && (!max || v <= max);
  useEffect(() => {
    if (open)
      panel.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)
        ?.focus({ preventScroll: true });
  }, [focused, open]);
  const select = (v: string) => {
    onValueChange(v);
    close();
    trigger.current?.focus();
  };
  const move = (n: number) => {
    const date = parse(focused);
    date.setDate(date.getDate() + n);
    const next = iso(date);
    if (allowed(next)) {
      setMonth(date);
      setFocused(next);
    }
  };
  const changeMonth = (n: number) => {
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  };
  const year = month.getFullYear(),
    m = month.getMonth(),
    first = (new Date(year, m, 1).getDay() + 6) % 7,
    days = new Date(year, m + 1, 0).getDate();
  return (
    <span className="ui-date">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className={`ui-date-trigger ${value ? "" : "is-empty"}`}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          const start =
            value ||
            (min && iso(new Date()) < min
              ? min
              : max && iso(new Date()) > max
                ? max
                : iso(new Date()));
          setMonth(parse(start));
          setFocused(start);
          setOpen(true);
        }}
      >
        <CalendarDays size={14} />
        <span>
          {value
            ? parse(value).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : label.startsWith("From")
              ? "Start date"
              : "End date"}
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-modal="false"
            aria-label={label}
            id={id}
            className="ui-calendar ui-floating"
            style={{
              ...pos,
              width: Math.min(296, window.innerWidth - 24),
              left: Math.min(
                pos.left,
                window.innerWidth - Math.min(296, window.innerWidth - 24) - 12,
              ),
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                close();
                trigger.current?.focus();
              } else if (e.key === "Tab") {
                const buttons = Array.from(
                  panel.current!.querySelectorAll<HTMLButtonElement>(
                    "button:not(:disabled)",
                  ),
                ).filter((b) => b.tabIndex !== -1);
                if (e.shiftKey && document.activeElement === buttons[0]) {
                  e.preventDefault();
                  buttons.at(-1)?.focus();
                } else if (
                  !e.shiftKey &&
                  document.activeElement === buttons.at(-1)
                ) {
                  e.preventDefault();
                  buttons[0]?.focus();
                }
              }
            }}
          >
            <div className="ui-calendar-label">{label}</div>
            <div className="ui-calendar-header">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => changeMonth(-1)}
              >
                <ChevronLeft size={16} />
              </button>
              <strong aria-live="polite">
                {month.toLocaleDateString("en-GB", {
                  month: "long",
                  year: "numeric",
                })}
              </strong>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => changeMonth(1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="ui-calendar-weekdays">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div
              className="ui-calendar-days"
              role="group"
              aria-label="Choose date"
            >
              {Array.from({ length: first }, (_, i) => (
                <span key={`empty${i}`} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const date = iso(new Date(year, m, i + 1));
                return (
                  <button
                    type="button"
                    key={date}
                    data-date={date}
                    disabled={!allowed(date)}
                    aria-label={parse(date).toLocaleDateString("en-GB", {
                      dateStyle: "full",
                    })}
                    aria-pressed={date === value}
                    aria-current={date === iso(new Date()) ? "date" : undefined}
                    className={date === value ? "selected" : ""}
                    tabIndex={
                      date === focused ||
                      (parse(focused).getMonth() !== m && i === 0)
                        ? 0
                        : -1
                    }
                    onClick={() => select(date)}
                    onFocus={() => setFocused(date)}
                    onKeyDown={(e) => {
                      const delta: Record<string, number> = {
                        ArrowLeft: -1,
                        ArrowRight: 1,
                        ArrowUp: -7,
                        ArrowDown: 7,
                      };
                      if (delta[e.key]) {
                        e.preventDefault();
                        move(delta[e.key]);
                      } else if (e.key === "PageUp" || e.key === "PageDown") {
                        e.preventDefault();
                        const d = new Date(
                          year,
                          m + (e.key === "PageUp" ? -1 : 1),
                          1,
                        );
                        if (allowed(iso(d))) {
                          setMonth(d);
                          setFocused(iso(d));
                        }
                      }
                    }}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="ui-calendar-footer">
              <button type="button" onClick={() => select("")}>
                Clear
              </button>
              <button
                type="button"
                disabled={!allowed(iso(new Date()))}
                onClick={() => select(iso(new Date()))}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  close();
                  trigger.current?.focus();
                }}
              >
                Done
              </button>
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
