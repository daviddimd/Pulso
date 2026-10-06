import { useEffect, useState } from "react";
import type { Service } from "../operations";

function readAcknowledged(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function AddressChangeAlerts({ userId, services }: { userId: string; services: Service[] }) {
  const storageKey = `pulso:address-acknowledgements:${userId}`;
  const [acknowledged, setAcknowledged] = useState(() => readAcknowledged(storageKey));
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey) setAcknowledged(readAcknowledged(storageKey));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [storageKey]);

  function acknowledge(revisionId: string) {
    const next = [...new Set([...readAcknowledged(storageKey), ...acknowledged, revisionId])];
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep dismissal for this session if storage is unavailable. */ }
    setAcknowledged(next);
  }

  const changes = [...new Map(services.map(service => [service.id, service])).values()]
    .filter(service => {
      const revision = service.addressRevisions[0];
      return revision && revision.revision > 1 && revision.source !== "LEGACY" && !acknowledged.includes(revision.id);
    });

  if (!changes.length) return null;
  return <aside className="ops-address-alerts" aria-label="Cambios de destino">
    {changes.map(service => <div className="ops-address-alert" key={service.addressRevisions[0].id} role="alert">
      <div><strong><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 2 21h20L12 3Z" /><path d="M12 9v5m0 3h.01" /></svg>Administración cambió el destino</strong><p>{service.actionPerformed}</p><p className="ops-address-alert-destination">{service.serviceAddress}</p></div>
      <button type="button" onClick={() => acknowledge(service.addressRevisions[0].id)}>Entendido</button>
    </div>)}
  </aside>;
}
