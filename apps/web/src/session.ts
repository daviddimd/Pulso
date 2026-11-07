/** Share only an in-flight request, never a previously resolved identity. */
export function createSessionLoader<T>(url: string) {
  let pending: Promise<T> | null = null;
  return function loadSession(): Promise<T> {
    pending ??= fetch(url, { credentials: "include", cache: "no-store" })
      .then(response => {
        if (!response.ok) throw new Error("Session check failed");
        return response.json() as Promise<T>;
      })
      .finally(() => { pending = null; });
    return pending;
  };
}
