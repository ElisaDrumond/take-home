import { toDeliveryDTO } from '@/lib/serializers';

/**
 * Teste de fumaca so para provar que o setup roda: `yarn test`.
 * Pode apagar. Os testes que valem sao os das regras de negocio.
 */
describe('setup', () => {
  it('serializa documento de entrega', () => {
    const dto = toDeliveryDTO({
      _id: 'dlv_1',
      customerId: 'cus_ana',
      scheduledFor: new Date('2026-08-10T15:00:00Z'),
      status: 'SCHEDULED',
      totalCents: 13490,
    });

    expect(dto.scheduledFor).toBe('2026-08-10T15:00:00.000Z');
    expect(dto.skippedAt).toBeNull();
  });
});
