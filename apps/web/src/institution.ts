let timezone = 'UTC';

export function setInstitutionTimezone(value: string): void {
  // Reject an invalid server configuration instead of silently showing another institution's time.
  new Intl.DateTimeFormat('es-CL', { timeZone: value });
  timezone = value;
}

export function institutionTimezone(): string { return timezone; }
