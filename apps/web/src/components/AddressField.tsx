export function AddressField({ label = "Destino", initial = "", wide = false }: { label?: string; initial?: string; wide?: boolean }) {
  return <label className={wide ? "ops-field-wide" : undefined}>{label}
    <input name="address" defaultValue={initial} minLength={3} maxLength={350} required
      autoComplete="off" placeholder="Calle, número y comuna" />
  </label>;
}
