import { useLayoutEffect, useRef, useState } from "react";

const statusFilters = [
  ["", "Todos"],
  ["IN_PROGRESS", "En curso"],
  ["COMPLETED", "Completados"],
  ["ASSIGNED", "Asignados"],
  ["PENDING", "Pendientes"],
  ["CANCELLED", "Cancelados"],
] as const;
type StatusFilterBarProps = {
  value: string;
  onChange: (value: string, animate: boolean) => void;
  label: string;
};

export function StatusFilterBar({ value, onChange, label }: StatusFilterBarProps) {
  const [instant, setInstant] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const container = bar.current;
    const line = indicator.current;
    if (!container || !line) return;
    const position = () => {
      const button = container.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
      const text = button?.querySelector<HTMLSpanElement>(".ops-status-label");
      if (!button || !text) return;
      const origin = container.getBoundingClientRect();
      const bounds = text.getBoundingClientRect();
      const bottom = button.getBoundingClientRect().bottom;
      const x = bounds.left - origin.left + container.scrollLeft;
      const y = bottom - origin.top + container.scrollTop - 3;
      line.style.transform = `translate3d(${x}px, ${y}px, 0) scaleX(${bounds.width / 100})`;
      line.dataset.ready = "true";
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(container);
    container.querySelectorAll("button").forEach((button) => observer.observe(button));
    return () => observer.disconnect();
  }, [value]);
  return (
    <div
      ref={bar}
      className="ops-status-filters"
      role="group"
      aria-label={label}
      data-instant={instant}
    >
      {statusFilters.map(([filterValue, filterLabel]) => (
        <button
          key={filterValue}
          type="button"
          className="ops-status-filter"
          data-state={filterValue}
          aria-pressed={value === filterValue}
          onClick={(event) => {
            const animate = event.detail !== 0;
            setInstant(!animate);
            onChange(filterValue, animate);
          }}
        >
          <span className="ops-status-label">{filterLabel}</span>
        </button>
      ))}
      <span
        ref={indicator}
        className="ops-status-indicator"
        data-state={value}
        aria-hidden="true"
      />
    </div>
  );
}
