import type { NextApiRequest } from 'next';
import { customers } from './db';
import type { CustomerDoc } from './domain';

/**
 * AUTENTICACAO FALSA, EXCLUSIVA DESTE EXERCICIO.
 *
 * O cliente autenticado vem do header `x-customer-id`. Isso NAO e um
 * mecanismo de auth - e um atalho para voce nao perder tempo com login.
 * Nao copie este padrao para nada real.
 *
 * Trate o retorno como se viesse de um token ja validado: e a unica
 * fonte confiavel de quem esta chamando.
 */
const DEFAULT_CUSTOMER_ID = 'cus_ana';

export class UnauthenticatedError extends Error {}

export async function getCurrentCustomer(req: NextApiRequest): Promise<CustomerDoc> {
  const header = req.headers['x-customer-id'];
  const id = (Array.isArray(header) ? header[0] : header) || DEFAULT_CUSTOMER_ID;

  const customer = await (await customers()).findOne({ _id: id });
  if (!customer) {
    throw new UnauthenticatedError(
      `Cliente "${id}" nao existe. Rode "yarn seed" ou use um dos ids do README.`,
    );
  }
  return customer;
}
