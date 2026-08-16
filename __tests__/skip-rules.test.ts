import { fromZonedTime } from 'date-fns-tz';

import type { DeliveryDoc } from '@/lib/domain';
import {
  getSkipCutoff,
  getSkipEligibility,
  isSkipInsideWindow,
} from '@/lib/skip-rules';

const TZ = 'America/Sao_Paulo';

function inBrasilia(value: string): Date {
  return fromZonedTime(value, TZ);
}

function delivery(
  overrides: Partial<DeliveryDoc> = {},
): DeliveryDoc {
  return {
    _id: 'dlv_test',
    customerId: 'cus_test',
    scheduledFor: inBrasilia('2026-08-18T12:00:00'),
    status: 'SCHEDULED',
    totalCents: 13490,
    ...overrides,
  };
}

describe('getSkipCutoff', () => {
  it('calcula o corte dois dias antes às 20h em Brasília', () => {
    const scheduledFor = inBrasilia(
      '2026-08-18T12:00:00',
    );

    const cutoff = getSkipCutoff(scheduledFor);

    expect(cutoff).toEqual(
      inBrasilia('2026-08-16T20:00:00'),
    );
  });
});

describe('isSkipInsideWindow', () => {
  const now = inBrasilia('2026-08-16T14:30:00');

  it('considera um pulo recente dentro das últimas 8 semanas', () => {
    const skippedAt = inBrasilia(
      '2026-08-01T10:00:00',
    );

    expect(isSkipInsideWindow(skippedAt, now)).toBe(true);
  });

  it('não considera um pulo ocorrido exatamente há 8 semanas', () => {
    const skippedAt = inBrasilia(
      '2026-06-21T14:30:00',
    );

    expect(isSkipInsideWindow(skippedAt, now)).toBe(false);
  });

  it('não considera um pulo anterior à janela de 8 semanas', () => {
    const skippedAt = inBrasilia(
      '2026-06-20T14:30:00',
    );

    expect(isSkipInsideWindow(skippedAt, now)).toBe(false);
  });
});

describe('getSkipEligibility', () => {
  it('permite pular antes do cutoff', () => {
    const result = getSkipEligibility({
      delivery: delivery(),
      recentSkipCount: 0,
      now: inBrasilia('2026-08-16T19:59:59'),
    });

    expect(result).toEqual({
      canSkip: true,
      reason: null,
    });
  });

  it('permite pular exatamente às 20h no dia do cutoff', () => {
    const result = getSkipEligibility({
      delivery: delivery(),
      recentSkipCount: 0,
      now: inBrasilia('2026-08-16T20:00:00'),
    });

    expect(result).toEqual({
      canSkip: true,
      reason: null,
    });
  });

  it('bloqueia após as 20h no dia do cutoff', () => {
    const result = getSkipEligibility({
      delivery: delivery(),
      recentSkipCount: 0,
      now: inBrasilia('2026-08-16T20:00:01'),
    });

    expect(result).toEqual({
      canSkip: false,
      reason: 'CUTOFF_PASSED',
    });
  });

  it('bloqueia quando o cliente já utilizou os dois pulos', () => {
    const result = getSkipEligibility({
      delivery: delivery(),
      recentSkipCount: 2,
      now: inBrasilia('2026-08-15T10:00:00'),
    });

    expect(result).toEqual({
      canSkip: false,
      reason: 'SKIP_LIMIT_REACHED',
    });
  });

  it('bloqueia entrega que já entrou em produção', () => {
    const result = getSkipEligibility({
      delivery: delivery({
        status: 'IN_PRODUCTION',
      }),
      recentSkipCount: 0,
      now: inBrasilia('2026-08-15T10:00:00'),
    });

    expect(result).toEqual({
      canSkip: false,
      reason: 'IN_PRODUCTION',
    });
  });

  it('bloqueia entrega que já saiu para entrega', () => {
    const result = getSkipEligibility({
      delivery: delivery({
        status: 'OUT_FOR_DELIVERY',
      }),
      recentSkipCount: 0,
      now: inBrasilia('2026-08-15T10:00:00'),
    });

    expect(result).toEqual({
      canSkip: false,
      reason: 'OUT_FOR_DELIVERY',
    });
  });

  it('bloqueia entrega já realizada', () => {
    const result = getSkipEligibility({
      delivery: delivery({
        status: 'DELIVERED',
      }),
      recentSkipCount: 0,
      now: inBrasilia('2026-08-15T10:00:00'),
    });

    expect(result).toEqual({
      canSkip: false,
      reason: 'DELIVERED',
    });
  });

  it('identifica entrega que já foi pulada', () => {
    const result = getSkipEligibility({
      delivery: delivery({
        status: 'SKIPPED',
        skippedAt: inBrasilia(
          '2026-08-15T10:00:00',
        ),
      }),
      recentSkipCount: 1,
      now: inBrasilia('2026-08-16T10:00:00'),
    });

    expect(result).toEqual({
      canSkip: false,
      reason: 'ALREADY_SKIPPED',
    });
  });

  it('bloqueia entrega cancelada', () => {
    const result = getSkipEligibility({
      delivery: delivery({
        status: 'CANCELLED',
      }),
      recentSkipCount: 0,
      now: inBrasilia('2026-08-15T10:00:00'),
    });

    expect(result).toEqual({
      canSkip: false,
      reason: 'CANCELLED',
    });
  });
});