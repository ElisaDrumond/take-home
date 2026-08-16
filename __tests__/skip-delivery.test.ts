import type { Collection } from 'mongodb';

import type { DeliveryDoc } from '@/lib/domain';
import { skipDelivery, SkipDeliveryError } from '@/lib/skip-delivery';

function createCollectionMock() {
  return {
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    updateOne: jest.fn(),
  } as unknown as jest.Mocked<Collection<DeliveryDoc>>;
}

function scheduledDelivery(
  overrides: Partial<DeliveryDoc> = {},
): DeliveryDoc {
  return {
    _id: 'dlv_test',
    customerId: 'cus_test',
    scheduledFor: new Date('2026-08-20T15:00:00.000Z'),
    status: 'SCHEDULED',
    totalCents: 13490,
    ...overrides,
  };
}

describe('skipDelivery', () => {
  const now = new Date('2026-08-16T13:00:00.000Z');

  it('pula uma entrega elegível', async () => {
    const collection = createCollectionMock();
    const delivery = scheduledDelivery();

    collection.findOne.mockResolvedValueOnce(delivery);
    collection.countDocuments.mockResolvedValueOnce(0);

    collection.updateOne.mockResolvedValueOnce({
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
      upsertedCount: 0,
      upsertedId: null,
    });

    const result = await skipDelivery({
      collection,
      customerId: 'cus_test',
      deliveryId: 'dlv_test',
      now,
    });

    expect(collection.updateOne).toHaveBeenCalledWith(
      {
        _id: 'dlv_test',
        customerId: 'cus_test',
        status: 'SCHEDULED',
      },
      {
        $set: {
          status: 'SKIPPED',
          skippedAt: now,
        },
      },
    );

    expect(result.delivery.status).toBe('SKIPPED');
    expect(result.delivery.skippedAt).toEqual(now);

    expect(result.eligibility).toEqual({
      canSkip: false,
      reason: 'ALREADY_SKIPPED',
    });
  });

  it('é idempotente quando a entrega já foi pulada', async () => {
    const collection = createCollectionMock();

    const skippedAt = new Date('2026-08-15T13:00:00.000Z');

    collection.findOne.mockResolvedValueOnce(
      scheduledDelivery({
        status: 'SKIPPED',
        skippedAt,
      }),
    );

    const result = await skipDelivery({
      collection,
      customerId: 'cus_test',
      deliveryId: 'dlv_test',
      now,
    });

    expect(collection.countDocuments).not.toHaveBeenCalled();
    expect(collection.updateOne).not.toHaveBeenCalled();

    expect(result.delivery.status).toBe('SKIPPED');
    expect(result.delivery.skippedAt).toEqual(skippedAt);
  });

  it('bloqueia quando a cota já foi utilizada', async () => {
    const collection = createCollectionMock();

    collection.findOne.mockResolvedValueOnce(
      scheduledDelivery(),
    );

    collection.countDocuments.mockResolvedValueOnce(2);

    await expect(
      skipDelivery({
        collection,
        customerId: 'cus_test',
        deliveryId: 'dlv_test',
        now,
      }),
    ).rejects.toMatchObject({
      code: 'SKIP_LIMIT_REACHED',
    });

    expect(collection.updateOne).not.toHaveBeenCalled();
  });

  it('bloqueia entrega em produção', async () => {
    const collection = createCollectionMock();

    collection.findOne.mockResolvedValueOnce(
      scheduledDelivery({
        status: 'IN_PRODUCTION',
      }),
    );

    collection.countDocuments.mockResolvedValueOnce(0);

    await expect(
      skipDelivery({
        collection,
        customerId: 'cus_test',
        deliveryId: 'dlv_test',
        now,
      }),
    ).rejects.toMatchObject({
      code: 'IN_PRODUCTION',
    });

    expect(collection.updateOne).not.toHaveBeenCalled();
  });

  it('não encontra entrega de outro cliente', async () => {
    const collection = createCollectionMock();

    collection.findOne.mockResolvedValueOnce(null);

    try {
      await skipDelivery({
        collection,
        customerId: 'cus_ana',
        deliveryId: 'dlv_bruno_1',
        now,
      });

      throw new Error('Era esperado um erro');
    } catch (err) {
      expect(err).toBeInstanceOf(SkipDeliveryError);

      expect(err).toMatchObject({
        code: 'DELIVERY_NOT_FOUND',
      });
    }
  });

  it('trata atualização concorrente como idempotente quando a entrega já virou SKIPPED', async () => {
    const collection = createCollectionMock();
    const delivery = scheduledDelivery();

    const skippedAt = new Date('2026-08-16T13:00:00.000Z');

    collection.findOne
      .mockResolvedValueOnce(delivery)
      .mockResolvedValueOnce({
        ...delivery,
        status: 'SKIPPED',
        skippedAt,
      });

    collection.countDocuments.mockResolvedValueOnce(0);

    collection.updateOne.mockResolvedValueOnce({
      acknowledged: true,
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0,
      upsertedId: null,
    });

    const result = await skipDelivery({
      collection,
      customerId: 'cus_test',
      deliveryId: 'dlv_test',
      now,
    });

    expect(result.delivery.status).toBe('SKIPPED');
    expect(result.delivery.skippedAt).toEqual(skippedAt);
  });
});