import { useEffect, useState } from 'react';

import { api, setCustomerId } from '@/lib/api-client';
import type { CustomerDTO, DeliveriesResponseDTO, DeliveryWithEligibilityDTO } from '@/lib/serializers';

const CUSTOMERS = ['cus_ana', 'cus_bruno', 'cus_carla'];

const SKIP_REASON_MESSAGES: Record<
  NonNullable<DeliveryWithEligibilityDTO['skipReason']>,
  string
> = {
  CUTOFF_PASSED: 'O prazo para pular esta entrega já encerrou.',
  SKIP_LIMIT_REACHED: 'Você já utilizou seus 2 pulos nas últimas 8 semanas.',
  IN_PRODUCTION: 'Seu pedido já entrou em produção.',
  OUT_FOR_DELIVERY: 'Seu pedido já saiu para entrega.',
  DELIVERED: 'Esta entrega já foi realizada.',
  CANCELLED: 'Esta entrega foi cancelada.',
  ALREADY_SKIPPED: 'Esta entrega já foi pulada.',
};

const STATUS_LABELS: Record<DeliveryWithEligibilityDTO['status'], string> = {
  SCHEDULED: 'Agendada',
  IN_PRODUCTION: 'Em produção',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  SKIPPED: 'Pulada',
  CANCELLED: 'Cancelada',
};

export default function Home() {
  // Existe so por causa da auth falsa do exercicio.
  const [customerId, setCurrentCustomer] = useState(CUSTOMERS[0]);
  const [me, setMe] = useState<CustomerDTO | null>(null);
  const [deliveriesData, setDeliveriesData] = useState<DeliveriesResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [skippingId, setSkippingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCustomerId(customerId);
    loadData();
  }, [customerId]);

  async function loadData() {
    setLoading(true);
    setError(null);
    setMe(null);
    setDeliveriesData(null);

    try {
      const [customer, deliveries] = await Promise.all([
        api<CustomerDTO>('/api/me'),
        api<DeliveriesResponseDTO>('/api/deliveries'),
      ]);

      setMe(customer);
      setDeliveriesData(deliveries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip(deliveryId: string) {
    setSkippingId(deliveryId);
    setError(null);

    try {
      await api(`/api/deliveries/${deliveryId}/skip`, {
        method: 'POST',
      });

      const deliveries = await api<DeliveriesResponseDTO>('/api/deliveries');
      setDeliveriesData(deliveries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao pular entrega.');

      // A regra pode ter mudado desde o carregamento da tela.
      // Recarregamos os dados para refletir o estado atual.
      const deliveries = await api<DeliveriesResponseDTO>('/api/deliveries').catch(() => null);

      if (deliveries) {
        setDeliveriesData(deliveries);
      }
    } finally {
      setSkippingId(null);
    }
  }

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 640,
        margin: '48px auto',
        padding: '0 16px',
      }}
    >
      <h1 style={{ fontSize: 22 }}>Minhas entregas</h1>

      <div style={{ display: 'flex', gap: 8, margin: '16px 0 24px' }}>
        {CUSTOMERS.map((id) => (
          <button
            key={id}
            onClick={() => setCurrentCustomer(id)}
            style={{
              padding: '6px 10px',
              cursor: 'pointer',
              fontWeight: id === customerId ? 700 : 400,
            }}
          >
            {id}
          </button>
        ))}
      </div>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {loading && <p>Carregando...</p>}

      {!loading && me && deliveriesData && (
        <>
          <p style={{ color: '#555' }}>
            {me.name} — plano {me.plan} — {me.city}
          </p>

          <section
            style={{
              margin: '24px 0',
              padding: 16,
              border: '1px solid #ddd',
              borderRadius: 8,
            }}
          >
            <strong>Seus pulos</strong>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 10,
              }}
            >
              {Array.from({ length: deliveriesData.skipAllowance.limit }).map((_, index) => {
                const available = index < deliveriesData.skipAllowance.remaining;

                return (
                  <span
                    key={index}
                    title={available ? 'Pulo disponível' : 'Pulo utilizado'}
                    style={{
                      display: 'inline-block',
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      border: '1px solid #666',
                      background: available ? '#666' : 'transparent',
                    }}
                  />
                );
              })}

              <span style={{ marginLeft: 6, color: '#555' }}>
                {deliveriesData.skipAllowance.remaining}{' '}
                {deliveriesData.skipAllowance.remaining === 1
                  ? 'pulo disponível'
                  : 'pulos disponíveis'}
              </span>
            </div>
          </section>

          <section style={{ display: 'grid', gap: 12 }}>
            {deliveriesData.deliveries.map((delivery) => {
              const isSkipping = skippingId === delivery.id;

              return (
                <article
                  key={delivery.id}
                  style={{
                    padding: 16,
                    border: '1px solid #ddd',
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 16,
                    }}
                  >
                    <div>
                      <strong>{formatDeliveryDate(delivery.scheduledFor)}</strong>

                      <div style={{ marginTop: 4, color: '#555' }}>
                        {STATUS_LABELS[delivery.status]}
                      </div>

                      <div style={{ marginTop: 4 }}>
                        {formatCurrency(delivery.totalCents)}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!delivery.canSkip || isSkipping}
                      onClick={() => handleSkip(delivery.id)}
                      style={{
                        alignSelf: 'flex-start',
                        padding: '8px 12px',
                        cursor: delivery.canSkip && !isSkipping ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {isSkipping ? 'Pulando...' : 'Pular entrega'}
                    </button>
                  </div>

                  {!delivery.canSkip && delivery.skipReason && (
                    <p
                      style={{
                        margin: '12px 0 0',
                        color: '#666',
                        fontSize: 14,
                      }}
                    >
                      {SKIP_REASON_MESSAGES[delivery.skipReason]}
                    </p>
                  )}
                </article>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}

function formatDeliveryDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}

function formatCurrency(totalCents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(totalCents / 100);
}