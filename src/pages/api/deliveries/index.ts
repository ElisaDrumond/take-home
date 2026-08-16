import type { NextApiRequest, NextApiResponse } from 'next';

import { getCurrentCustomer, UnauthenticatedError } from '@/lib/auth';
import { deliveries } from '@/lib/db';
import { getSkipEligibility, getSkipWindowStart, MAX_SKIPS_IN_WINDOW } from '@/lib/skip-rules';
import { toDeliveryWithEligibilityDTO, type DeliveriesResponseDTO } from '@/lib/serializers';

type Response = DeliveriesResponseDTO | { error: string };

export default async function handler( req: NextApiRequest, res: NextApiResponse<Response> ) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  try {
    const customer = await getCurrentCustomer(req);
    const collection = await deliveries();
    const now = new Date();

    const upcomingDeliveries = await collection
      .find({
        customerId: customer._id,
        scheduledFor: { $gte: now },
      })
      .sort({ scheduledFor: 1 })
      .limit(4)
      .toArray();

    const recentSkipCount = await collection.countDocuments({
      customerId: customer._id,
      status: 'SKIPPED',
      skippedAt: {
        $gt: getSkipWindowStart(now),
        $lte: now,
      },
    });

    const response = upcomingDeliveries.map((delivery) => {
      const eligibility = getSkipEligibility({
        delivery,
        recentSkipCount,
        now,
      });

      return toDeliveryWithEligibilityDTO(
        delivery,
        eligibility,
      );
    });

    return res.status(200).json({
      deliveries: response,
      skipAllowance: {
        used: recentSkipCount,
        remaining: Math.max(MAX_SKIPS_IN_WINDOW - recentSkipCount, 0),
        limit: MAX_SKIPS_IN_WINDOW,
      },
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