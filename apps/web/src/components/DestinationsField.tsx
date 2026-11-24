import { useState } from "react";

const MAX_STOPS = 10;

export function DestinationsField({
  label = "Destinos",
  initial = [],
  wide = false,
}: {
  label?: string;
  initial?: { address: string; activity?: string | null }[];
  wide?: boolean;
}) {
  const [stops, setStops] = useState(() =>
    (initial.length ? initial : [{ address: "" }]).map((stop, i) => ({
      id: i,
      address: stop.address,
      activity: stop.activity ?? "",
    })),
  );
  const [nextId, setNextId] = useState(stops.length);

  function add() {
    setStops([...stops, { id: nextId, address: "", activity: "" }]);
    setNextId(nextId + 1);
  }

  function remove(id: number) {
    setStops(stops.filter((stop) => stop.id !== id));
  }

  function update(id: number, address: string) {
    setStops(stops.map((stop) => (stop.id === id ? { ...stop, address } : stop)));
  }

  return (
    <fieldset className={"ops-destinations" + (wide ? " ops-field-wide" : "")}>
      <legend>{label}</legend>
      <ol>
        {stops.map((stop, i) => (
          <li key={stop.id}>
            <label>
              <span>{stops.length > 1 ? `Parada ${i + 1}` : "Dirección"}</span>
              <input
                name="address"
                value={stop.address}
                onChange={(event) => update(stop.id, event.target.value)}
                minLength={3}
                maxLength={350}
                required
                autoComplete="off"
                placeholder="Calle, número y comuna"
              />
              <input type="hidden" name="activity" value={stop.activity} />
              {stop.activity && <small>Tarea: {stop.activity}</small>}
            </label>
            {stops.length > 1 && (
              <button
                type="button"
                className="ops-destination-remove"
                onClick={() => remove(stop.id)}
                aria-label={`Quitar parada ${i + 1}`}
              >
                Quitar
              </button>
            )}
          </li>
        ))}
      </ol>
      {stops.length < MAX_STOPS && (
        <button type="button" className="ops-destination-add" onClick={add}>
          + Agregar parada
        </button>
      )}
    </fieldset>
  );
}
