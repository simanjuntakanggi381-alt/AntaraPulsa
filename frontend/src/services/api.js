export class APIError extends Error {
  constructor(message, status = 0) { super(message); this.name = 'APIError'; this.status = status; }
}

export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
  } catch {
    throw new APIError('Koneksi ke server sedang terganggu. Coba lagi sebentar.', 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new APIError(data.error || 'Terjadi kesalahan pada server', response.status);
  return data;
}
