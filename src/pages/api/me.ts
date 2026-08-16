import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentCustomer, UnauthenticatedError } from '@/lib/auth';
import { toCustomerDTO, type CustomerDTO } from '@/lib/serializers';

/**
 * GET /api/me
 *
 * Esta rota esta pronta de proposito: serve de referencia para o padrao
 * de handler, auth e serializacao. O resto e seu.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CustomerDTO | { error: string }>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const customer = await getCurrentCustomer(req);
    return res.status(200).json(toCustomerDTO(customer));
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return res.status(401).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
