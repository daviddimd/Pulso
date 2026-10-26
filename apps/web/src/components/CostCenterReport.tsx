import { useState, type FormEvent } from "react";
import { API_URL, api, today } from "../operations";
import { Icon } from './Icon';


type Row = { id: string | null; code: string; name: string; completedTrips: number; completedKm: number; completedUnknownKm: number; cancelledTrips: number };
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
      const data = await response.json() as { rows: Row[] };
      const { downloadCostCentersExcel } = await import("../xlsx-export");
      downloadCostCentersExcel(data.rows.filter(row => showAll || row.completedTrips + row.cancelledTrips > 0), `pulso-centros-${report.from}_${report.to}.xlsx`);
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
  return <section className="ops-card"><div className="ops-form-heading"><span className="ops-form-symbol"><Icon name="chart" /></span><div><h2>Actividad por centro</h2><p>Viajes y kilómetros del período que elijas.</p></div></div>
    <form className="ops-export" onSubmit={e => void load(e)}><label>Desde<input name="from" type="date" defaultValue={today().slice(0, 8) + "01"} required /></label><label>Hasta<input name="to" type="date" defaultValue={today()} required /></label><button className="ops-primary-action" disabled={busy}>{busy ? "Consultando…" : "Consultar"}<Icon name="arrow" /></button></form>
    {error && <p role="alert" className="driver-error">{error}</p>}
    {report && <><div className="ops-report-summary"><div><span>Viajes completados</span><strong>{number(report.rows.reduce((sum,row)=>sum+row.completedTrips,0))}</strong></div><div><span>Recorrido registrado</span><strong>{number(report.rows.reduce((sum,row)=>sum+row.completedKm,0))}<small> km</small></strong></div><div><span>Centros con actividad</span><strong>{number(report.rows.filter(row=>row.completedTrips+row.cancelledTrips>0).length)}</strong></div></div>
      <div className="ops-actions ops-report-controls"><label className="ops-check"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />Incluir centros sin actividad</label><button type="button" disabled={exporting || busy} onClick={() => void exportReport()}><Icon name="download" />{exporting ? "Exportando…" : "Exportar Excel"}</button></div>
      {visibleRows.length === 0 && <p role="status">No hay centros con actividad en este período.</p>}
      <div className="ops-report-scroll" tabIndex={0} role="region" aria-label="Totales por centro de costos"><table className="ops-report-table"><caption>Viajes y kilómetros por centro</caption><thead><tr><th scope="col">Centro</th><th scope="col">Completados</th><th scope="col">Km completados</th><th scope="col">Cancelados</th><th scope="col">Sin km completos</th></tr></thead><tbody>{visibleRows.map(row => <tr key={row.id ?? "none"}><th scope="row">{row.code} {row.name}</th><td>{number(row.completedTrips)}</td><td>{number(row.completedKm)}</td><td>{number(row.cancelledTrips)}</td><td>{row.completedUnknownKm || "—"}</td></tr>)}</tbody><tfoot><tr><th scope="row">Total</th>{["completedTrips", "completedKm", "cancelledTrips"].map(key => <td key={key}>{number(report.rows.reduce((sum, row) => sum + Number(row[key as keyof Row]), 0))}</td>)}<td>{report.rows.reduce((sum, row) => sum + row.completedUnknownKm, 0)}</td></tr></tfoot></table></div>
      <p className="ops-report-note">Se consideran fechas de finalización o cancelación, en la zona horaria de la institución. Los kilómetros suman viajes con lecturas completas.</p>
    </>}
  </section>;
}
