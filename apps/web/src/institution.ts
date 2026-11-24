let timezone = "UTC";

export function setInstitutionTimezone(value: string): void {
  new Intl.DateTimeFormat("es-CL", { timeZone: value });
  timezone = value;
}

export function institutionTimezone(): string {
  return timezone;
}
