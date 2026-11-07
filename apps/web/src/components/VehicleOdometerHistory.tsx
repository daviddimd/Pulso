import { useEffect, useState } from 'react';
import { api } from '../operations';
import { institutionTimezone } from '../institution';
import { Icon } from './Icon';

type Correction = {
  id: string; createdAt: string | null; previousOdometerKm: number | null; newOdometerKm: number | null;
  reason: string | null; actor: { fullName: string } | null;
};
type History = { corrections: Correction[]; total: number; page: number; pageSize: number };
const km = (value: number | null) => value === null ? 'Sin registro' : `${new Intl.NumberFormat('es-CL').format(value)} km`;
const recordedAt = (value: string | null) => value ? new Intl.DateTimeFormat('es-CL', { timeZone: institutionTimezone(), dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value)) : 'Fecha no registrada';

export function VehicleOdometerHistory({ vehicleId }: { vehicleId: string }) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<History | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api<History>(`/api/vehicles/${vehicleId}/odometer-history?page=${page}`, undefined, 'GET', controller.signal)
      .then(data => { if (!controller.signal.aborted) { setResult(data); setError(''); } })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudieron cargar las correcciones.'); });
    return () => controller.abort();
  }, [vehicleId, page, revision]);
  function refresh() { setResult(null); setError(''); setRevision(value => value + 1); }
  function changePage(next: number) { setResult(null); setError(''); setPage(next); }
  return <section className="ops-odometer-history" aria-label="Correcciones de kilometraje" aria-busy={!result && !error}>
    <div className="ops-history-heading"><h3>Correcciones de kilometraje</h3><button type="button" className="ops-icon-button" aria-label="Actualizar correcciones" onClick={refresh}><Icon name="refresh" /></button></div>
    {error ? <p className="driver-error" role="alert">{error} <button type="button" onClick={refresh}>Reintentar</button></p> : !result ? <p role="status">Cargando correcciones…</p> : <>
      <p className="ops-history-count" role="status">{result.total} {result.total === 1 ? 'corrección registrada' : 'correcciones registradas'}</p>
      {!result.corrections.length && <p className="ops-history-empty">No se han registrado correcciones de kilometraje.</p>}
      <ol className="ops-corrections">{result.corrections.map(correction => <li key={correction.id}>
        <div className="ops-correction-meta"><time dateTime={correction.createdAt ?? undefined}>{recordedAt(correction.createdAt)}</time><span>Por <strong>{correction.actor?.fullName ?? 'Autor no disponible'}</strong></span></div>
        <dl className="ops-correction-readings"><div><dt>Lectura anterior</dt><dd>{km(correction.previousOdometerKm)}</dd></div><div><dt>Lectura corregida</dt><dd>{km(correction.newOdometerKm)}</dd></div></dl>
        <p className="ops-correction-reason"><span>Motivo</span>{correction.reason || 'Motivo no registrado'}</p>
      </li>)}</ol>
      {result.total > result.pageSize && <div className="ops-pagination"><button disabled={page === 1} onClick={() => changePage(page - 1)}>Anterior</button><span>Página {page}</span><button disabled={page * result.pageSize >= result.total} onClick={() => changePage(page + 1)}>Siguiente</button></div>}
    </>}
  </section>;
}
