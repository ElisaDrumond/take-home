import { subWeeks } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

import type { DeliveryDoc } from './domain';

const TIME_ZONE = 'America/Sao_Paulo';

export const MAX_SKIPS_IN_WINDOW = 2;
export const SKIP_WINDOW_WEEKS = 8;

export type SkipReason =
  | 'CUTOFF_PASSED'
  | 'SKIP_LIMIT_REACHED'
  | 'IN_PRODUCTION'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'ALREADY_SKIPPED';

export interface SkipEligibility {
  canSkip: boolean;
  reason: SkipReason | null;
}

interface GetSkipEligibilityParams {
  delivery: DeliveryDoc;
  recentSkipCount: number;
  now: Date;
}

export function getSkipCutoff(scheduledFor: Date): Date {
  const deliveryDate = formatInTimeZone(
    scheduledFor,
    TIME_ZONE,
    'yyyy-MM-dd',
  );

  const deliveryDayAtNoon = fromZonedTime(
    `${deliveryDate}T12:00:00`,
    TIME_ZONE,
  );

  const cutoffDate = formatInTimeZone(
    new Date(deliveryDayAtNoon.getTime() - 2 * 24 * 60 * 60 * 1000),
    TIME_ZONE,
    'yyyy-MM-dd',
  );

  return fromZonedTime(
    `${cutoffDate}T20:00:00`,
    TIME_ZONE,
  );
}

export function getSkipWindowStart(now: Date): Date {
  return subWeeks(now, SKIP_WINDOW_WEEKS);
}

export function isSkipInsideWindow(
  skippedAt: Date,
  now: Date,
): boolean {
  const windowStart = getSkipWindowStart(now);

  return skippedAt > windowStart && skippedAt <= now;
}

export function getSkipEligibility({
  delivery,
  recentSkipCount,
  now,
}: GetSkipEligibilityParams): SkipEligibility {
  if (delivery.status === 'SKIPPED') {
    return {
      canSkip: false,
      reason: 'ALREADY_SKIPPED',
    };
  }

  if (delivery.status === 'IN_PRODUCTION') {
    return {
      canSkip: false,
      reason: 'IN_PRODUCTION',
    };
  }

  if (delivery.status === 'OUT_FOR_DELIVERY') {
    return {
      canSkip: false,
      reason: 'OUT_FOR_DELIVERY',
    };
  }

  if (delivery.status === 'DELIVERED') {
    return {
      canSkip: false,
      reason: 'DELIVERED',
    };
  }

  if (delivery.status === 'CANCELLED') {
    return {
      canSkip: false,
      reason: 'CANCELLED',
    };
  }

  const cutoff = getSkipCutoff(delivery.scheduledFor);

  if (now > cutoff) {
    return {
      canSkip: false,
      reason: 'CUTOFF_PASSED',
    };
  }

  if (recentSkipCount >= MAX_SKIPS_IN_WINDOW) {
    return {
      canSkip: false,
      reason: 'SKIP_LIMIT_REACHED',
    };
  }

  return {
    canSkip: true,
    reason: null,
  };
}