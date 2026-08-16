import type { NextApiRequest, NextApiResponse } from 'next';

import { getCurrentCustomer, UnauthenticatedError } from '@/lib/auth';
import { deliveries } from '@/lib/db';
import { skipDelivery, SkipDeliveryError } from '@/lib/skip-delivery';
import { toDeliveryWithEligibilityDTO, type DeliveryWithEligibilityDTO } from '@/lib/serializers';

type Response =
  | { delivery: DeliveryWithEligibilityDTO }
  | { error: string; code?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Response>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');

    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  try {
    const customer = await getCurrentCustomer(req);
    const collection = await deliveries();

    const deliveryId = Array.isArray(req.query.id)
      ? req.query.id[0]
      : req.query.id;

    if (!deliveryId) {
      return res.status(400).json({
        error: 'ID da entrega não informado',
        code: 'INVALID_DELIVERY_ID',
      });
    }

    const result = await skipDelivery({
      collection,
      customerId: customer._id,
      deliveryId,
      now: new Date(),
    });

    return res.status(200).json({
      delivery: toDeliveryWithEligibilityDTO(
        result.delivery,
        result.eligibility,
      ),
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return res.status(401).json({
        error: err.message,
      });
    }

    if (err instanceof SkipDeliveryError) {
      const status = err.code === 'DELIVERY_NOT_FOUND'
        ? 404
        : 409;

      return res.status(status).json({
        error: err.message,
        code: err.code,
      });
    }

    console.error(err);

    return res.status(500).json({
      error: 'Erro interno',
    });
  }
}