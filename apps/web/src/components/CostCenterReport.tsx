import { useState, type FormEvent } from "react";
import { API_URL, api, today } from "../operations";

type Row = { id: string | null; code: string; name: string; completedTrips: number; completedKm: number; completedUnknownKm: number; cancelledTrips: number; cancelledKm: number; cancelledUnknownKm: number };
export function CostCenterReport() {
  const [report, setReport] = useState<{ from: string; to: string; rows: Row[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  async function exportReport() {
    if (!report) return;
    setExporting(true); setError("");
    try {
      const response = await fetch(`${API_URL}/api/cost-centers/export?from=${report.from}&to=${report.to}&includeInactive=${showAll}`, { credentials: "include" });
      if (!response.ok) throw new Error("No se pudo exportar el resumen. Revisa tu sesión e inténtalo nuevamente.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = `pulso-centros-${report.from}_${report.to}.xlsx`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo exportar el resumen."); }
    finally { setExporting(false); }
  }
  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setReport(null);
    try { setReport(await api(`/api/cost-centers/summary?from=${form.get("from")}&to=${form.get("to")}`, undefined, "GET")); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar el resumen."); }
    finally { setBusy(false); }
  }
  const number = (n: number) => new Intl.NumberFormat("es-CL").format(n);
  const visibleRows = report?.rows.filter(row => showAll || row.completedTrips + row.cancelledTrips > 0) ?? [];
  return <section className="ops-card"><h2>Centros de costos</h2>
    <form className="ops-export" onSubmit={e => void load(e)}><label>Desde<input name="from" type="date" defaultValue={today().slice(0, 8) + "01"} required /></label><label>Hasta<input name="to" type="date" defaultValue={today()} required /></label><button disabled={busy}>{busy ? "Consultando…" : "Consultar"}</button></form>
    {error && <p role="alert" className="driver-error">{error}</p>}
    {report && <><p>Período: {report.from} al {report.to} · Fecha de cierre, hora de Chile.</p><p>Cancelados: con salida y recorrido registrado o pendiente de determinar. Cada regreso cuenta como otro viaje.</p>
      <div className="ops-actions"><label className="ops-check"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />Mostrar también centros sin actividad</label><button type="button" disabled={exporting || busy} onClick={() => void exportReport()}>{exporting ? "Exportando…" : "Exportar Excel"}</button></div>
      {visibleRows.length === 0 && <p role="status">No hay centros con actividad en este período.</p>}
      <div className="ops-report-scroll" tabIndex={0} role="region" aria-label="Totales por centro de costos"><table className="ops-report-table"><caption>Viajes y kilómetros por centro</caption><thead><tr><th scope="col">Centro</th><th scope="col">Completados</th><th scope="col">Km completados</th><th scope="col">Cancelados con salida</th><th scope="col">Km cancelados</th><th scope="col">Sin km completos</th></tr></thead><tbody>{visibleRows.map(row => <tr key={row.id ?? "none"}><th scope="row">{row.code} {row.name}</th><td>{number(row.completedTrips)}</td><td>{number(row.completedKm)}</td><td>{number(row.cancelledTrips)}</td><td>{number(row.cancelledKm)}</td><td>{row.completedUnknownKm + row.cancelledUnknownKm ? `${row.completedUnknownKm} completados / ${row.cancelledUnknownKm} cancelados` : "—"}</td></tr>)}</tbody><tfoot><tr><th scope="row">Total</th>{["completedTrips", "completedKm", "cancelledTrips", "cancelledKm"].map(key => <td key={key}>{number(report.rows.reduce((sum, row) => sum + Number(row[key as keyof Row]), 0))}</td>)}<td>{report.rows.reduce((sum, row) => sum + row.completedUnknownKm + row.cancelledUnknownKm, 0)}</td></tr></tfoot></table></div>
      <p>Los kilómetros suman solo viajes con lecturas completas. Los servicios antiguos sin centro se muestran por separado. El Excel de servicios mantiene únicamente los completados.</p>
    </>}
  </section>;
}
