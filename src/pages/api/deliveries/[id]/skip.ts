import type { NextApiRequest, NextApiResponse } from 'next';

import { getCurrentCustomer, UnauthenticatedError } from '@/lib/auth';
import { deliveries } from '@/lib/db';
import { getSkipEligibility, getSkipWindowStart } from '@/lib/skip-rules';
import { toDeliveryWithEligibilityDTO, type DeliveryWithEligibilityDTO } from '@/lib/serializers';

type Response = | { delivery: DeliveryWithEligibilityDTO } | { error: string; code?: string };

export default async function handler( req: NextApiRequest, res: NextApiResponse<Response>) {
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

    const delivery = await collection.findOne({
      _id: deliveryId,
      customerId: customer._id,
    });

    if (!delivery) {
      return res.status(404).json({
        error: 'Entrega não encontrada',
        code: 'DELIVERY_NOT_FOUND',
      });
    }

    // Idempotência: se já foi pulada, não alteramos nada
    // e retornamos sucesso.
    if (delivery.status === 'SKIPPED') {
      const eligibility = getSkipEligibility({
        delivery,
        recentSkipCount: 0,
        now: new Date(),
      });

      return res.status(200).json({
        delivery: toDeliveryWithEligibilityDTO(
          delivery,
          eligibility,
        ),
      });
    }

    const now = new Date();

    const recentSkipCount = await collection.countDocuments({
      customerId: customer._id,
      status: 'SKIPPED',
      skippedAt: {
        $gt: getSkipWindowStart(now),
        $lte: now,
      },
    });

    const eligibility = getSkipEligibility({
      delivery,
      recentSkipCount,
      now,
    });

    if (!eligibility.canSkip) {
      return res.status(409).json({
        error: getSkipErrorMessage(eligibility.reason),
        code: eligibility.reason ?? undefined,
      });
    }

    await collection.updateOne(
      {
        _id: delivery._id,
        customerId: customer._id,
        status: 'SCHEDULED',
      },
      {
        $set: {
          status: 'SKIPPED',
          skippedAt: now,
        },
      },
    );

    const updatedDelivery = await collection.findOne({
      _id: delivery._id,
      customerId: customer._id,
    });

    if (!updatedDelivery) {
      return res.status(404).json({
        error: 'Entrega não encontrada após atualização',
        code: 'DELIVERY_NOT_FOUND',
      });
    }

    const updatedEligibility = getSkipEligibility({
      delivery: updatedDelivery,
      recentSkipCount: recentSkipCount + 1,
      now,
    });

    return res.status(200).json({
      delivery: toDeliveryWithEligibilityDTO(
        updatedDelivery,
        updatedEligibility,
      ),
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return res.status(401).json({
        error: err.message,
      });
    }

    console.error(err);

    return res.status(500).json({
      error: 'Erro interno',
    });
  }
}

function getSkipErrorMessage(
  reason: | DeliveryWithEligibilityDTO['skipReason'] | null,
): string {
  switch (reason) {
    case 'CUTOFF_PASSED':
      return 'O prazo para pular esta entrega já encerrou.';

    case 'SKIP_LIMIT_REACHED':
      return 'Você já utilizou os 2 pulos disponíveis nas últimas 8 semanas.';

    case 'IN_PRODUCTION':
      return 'Este pedido já entrou em produção.';

    case 'OUT_FOR_DELIVERY':
      return 'Este pedido já saiu para entrega.';

    case 'DELIVERED':
      return 'Esta entrega já foi realizada.';

    case 'CANCELLED':
      return 'Esta entrega foi cancelada.';

    case 'ALREADY_SKIPPED':
      return 'Esta entrega já foi pulada.';

    default:
      return 'Não foi possível pular esta entrega.';
  }
}