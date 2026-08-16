/**
 * Cliente HTTP minimo do front. Troque por react-query, SWR ou o que
 * preferir - so registre a escolha no README.
 */

/** So existe por causa da auth falsa do exercicio. */
let currentCustomerId = 'cus_ana';

export function setCustomerId(id: string) {
  currentCustomerId = id;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-customer-id': currentCustomerId,
      ...(init?.headers ?? {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ?? `Falha na chamada (${res.status})`);
  }
  return body as T;
}
