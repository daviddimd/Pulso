import { useId, useState } from "react";
import type { CostCenter } from "../operations";

const label = (center: CostCenter) => `${center.code} · ${center.name}`;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function CostCenterField({ centers, initial = "" }: { centers: CostCenter[]; initial?: string }) {
  const id = useId();
  const [selected, setSelected] = useState(initial);
  const [search, setSearch] = useState(() => {
    const center = centers.find(c => c.id === initial);
    return center ? label(center) : "";
  });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const filtered = centers.filter(c => normalize(label(c)).includes(normalize(selected ? "" : search)))
    .sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true }));

  function choose(center: CostCenter) {
    setSelected(center.id);
    setSearch(label(center));
    setOpen(false);
    setActive(-1);
  }

  return <div className="ops-cost-field">
    <label htmlFor={id}>Centro de costos</label>
    <input id={id} type="text" role="combobox" autoComplete="off" required
      aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`}
      aria-activedescendant={open && active >= 0 && filtered[active] ? `${id}-option-${active}` : undefined}
      ref={input => { input?.setCustomValidity(search && !selected ? "Selecciona un centro de costos de las sugerencias." : ""); }}
      value={search} placeholder="Escribe código o nombre"
      onFocus={() => { setOpen(true); setActive(-1); }}
      onBlur={() => setOpen(false)}
      onChange={event => { setSearch(event.target.value); setSelected(""); setOpen(true); setActive(0); }}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setOpen(true);
          const next = !open || active < 0 ? (event.key === "ArrowDown" ? 0 : filtered.length - 1)
            : Math.max(0, Math.min(filtered.length - 1, active + (event.key === "ArrowDown" ? 1 : -1)));
          setActive(next);
          document.getElementById(`${id}-option-${next}`)?.scrollIntoView({ block: "nearest" });
        }
        if (event.key === "Enter" && open && filtered[active]) {
          event.preventDefault(); choose(filtered[active]);
        }
      }} />
    <input type="hidden" name="costCenter" value={selected} />
    {open && <div className="ops-cost-suggestions">
      <ul id={`${id}-list`} role="listbox" aria-label="Centros de costos">
        {filtered.map((center, index) => <li key={center.id} id={`${id}-option-${index}`}
          role="option" aria-selected={center.id === selected} data-highlighted={active === index}
          onMouseDown={event => event.preventDefault()}
          onClick={() => choose(center)}>
          <strong>{center.code}</strong><span>{center.name}</span>
        </li>)}
      </ul>
      {!filtered.length && <p role="status">No se encontraron centros de costos.</p>}
    </div>}
  </div>;
}
