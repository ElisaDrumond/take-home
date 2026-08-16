import type { Collection } from 'mongodb';

import type { DeliveryDoc } from '@/lib/domain';
import { getSkipEligibility, getSkipWindowStart, type SkipEligibility, type SkipReason } from '@/lib/skip-rules';

export type SkipDeliveryErrorCode = SkipReason | 'DELIVERY_NOT_FOUND';

export class SkipDeliveryError extends Error {
  constructor(
    public readonly code: SkipDeliveryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SkipDeliveryError';
  }
}

interface SkipDeliveryParams {
  collection: Collection<DeliveryDoc>;
  customerId: string;
  deliveryId: string;
  now: Date;
}

interface SkipDeliveryResult {
  delivery: DeliveryDoc;
  eligibility: SkipEligibility;
}

export async function skipDelivery({
  collection,
  customerId,
  deliveryId,
  now,
}: SkipDeliveryParams): Promise<SkipDeliveryResult> {
  const delivery = await collection.findOne({
    _id: deliveryId,
    customerId,
  });

  if (!delivery) {
    throw new SkipDeliveryError(
      'DELIVERY_NOT_FOUND',
      'Entrega não encontrada',
    );
  }

  // Uma nova tentativa sobre uma entrega já pulada é idempotente:
  // não altera skippedAt e não consome uma nova unidade da cota.
  if (delivery.status === 'SKIPPED') {
    return {
      delivery,
      eligibility: getSkipEligibility({
        delivery,
        recentSkipCount: 0,
        now,
      }),
    };
  }

  const recentSkipCount = await collection.countDocuments({
    customerId,
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
    throw new SkipDeliveryError(
      eligibility.reason!,
      getSkipErrorMessage(eligibility.reason),
    );
  }

  const result = await collection.updateOne(
    {
      _id: delivery._id,
      customerId,
      status: 'SCHEDULED',
    },
    {
      $set: {
        status: 'SKIPPED',
        skippedAt: now,
      },
    },
  );

  /*
   * Entre a leitura e o update, outra requisição pode ter alterado
   * esta mesma entrega. Nesse caso buscamos novamente o estado atual,
   * preservando o comportamento idempotente.
   */
  if (result.modifiedCount === 0) {
    const currentDelivery = await collection.findOne({
      _id: delivery._id,
      customerId,
    });

    if (!currentDelivery) {
      throw new SkipDeliveryError(
        'DELIVERY_NOT_FOUND',
        'Entrega não encontrada',
      );
    }

    if (currentDelivery.status === 'SKIPPED') {
      return {
        delivery: currentDelivery,
        eligibility: getSkipEligibility({
          delivery: currentDelivery,
          recentSkipCount,
          now,
        }),
      };
    }

    const currentEligibility = getSkipEligibility({
      delivery: currentDelivery,
      recentSkipCount,
      now,
    });

    if (!currentEligibility.canSkip) {
      throw new SkipDeliveryError(
        currentEligibility.reason!,
        getSkipErrorMessage(currentEligibility.reason),
      );
    }

    throw new Error('Não foi possível atualizar a entrega');
  }

  const updatedDelivery: DeliveryDoc = {
    ...delivery,
    status: 'SKIPPED',
    skippedAt: now,
  };

  return {
    delivery: updatedDelivery,
    eligibility: getSkipEligibility({
      delivery: updatedDelivery,
      recentSkipCount: recentSkipCount + 1,
      now,
    }),
  };
}

export function getSkipErrorMessage(reason: SkipReason | null): string {
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