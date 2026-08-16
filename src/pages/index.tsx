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

const STATUS_STYLES: Record<
  DeliveryWithEligibilityDTO['status'],
  { background: string; color: string }
> = {
  SCHEDULED: {
    background: '#EEF4FF',
    color: '#315A9A',
  },
  IN_PRODUCTION: {
    background: '#FFF4D8',
    color: '#8B6413',
  },
  OUT_FOR_DELIVERY: {
    background: '#F3E8FF',
    color: '#6B3FA0',
  },
  DELIVERED: {
    background: '#E8F7EE',
    color: '#2F7A4E',
  },
  SKIPPED: {
    background: '#F1F1F1',
    color: '#666666',
  },
  CANCELLED: {
    background: '#FDECEC',
    color: '#A33B3B',
  },
};

export default function Home() {
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

      const deliveries = await api<DeliveriesResponseDTO>('/api/deliveries').catch(() => null);

      if (deliveries) {
        setDeliveriesData(deliveries);
      }
    } finally {
      setSkippingId(null);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <span style={styles.eyebrow}>Minhas entregas</span>
            <h1 style={styles.title}>Organize suas próximas entregas</h1>
            <p style={styles.subtitle}>
              Acompanhe seus pedidos e use seus pulos quando precisar.
            </p>
          </div>
        </header>

        <div style={styles.customerSwitcher}>
          {CUSTOMERS.map((id) => {
            const active = id === customerId;

            return (
              <button
                key={id}
                type="button"
                onClick={() => setCurrentCustomer(id)}
                style={{
                  ...styles.customerButton,
                  ...(active ? styles.customerButtonActive : {}),
                }}
              >
                {id.replace('cus_', '')}
              </button>
            );
          })}
        </div>

        {error && (
          <div style={styles.errorBox}>
            {error}
          </div>
        )}

        {loading && (
          <div style={styles.loadingBox}>
            Carregando suas entregas...
          </div>
        )}

        {!loading && me && deliveriesData && (
          <>
            <section style={styles.summaryCard}>
              <div>
                <span style={styles.summaryLabel}>Olá, {me.name}</span>
                <p style={styles.summaryText}>
                  {me.city} · Plano {me.plan}
                </p>
              </div>

              <div style={styles.allowanceBlock}>
                <div>
                  <span style={styles.allowanceLabel}>Seus pulos</span>
                  <div style={styles.allowanceDots}>
                    {Array.from({
                      length: deliveriesData.skipAllowance.limit,
                    }).map((_, index) => {
                      const available = index < deliveriesData.skipAllowance.remaining;

                      return (
                        <span
                          key={index}
                          title={available ? 'Pulo disponível' : 'Pulo utilizado'}
                          style={{
                            ...styles.allowanceDot,
                            ...(available
                              ? styles.allowanceDotAvailable
                              : styles.allowanceDotUsed),
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                <div style={styles.allowanceTextBlock}>
                  <strong style={styles.allowanceNumber}>
                    {deliveriesData.skipAllowance.remaining}
                  </strong>
                  <span style={styles.allowanceText}>
                    {deliveriesData.skipAllowance.remaining === 1
                      ? 'pulo disponível'
                      : 'pulos disponíveis'}
                  </span>
                </div>
              </div>
            </section>

            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Próximas entregas</h2>
                  <p style={styles.sectionSubtitle}>
                    Você pode visualizar até quatro entregas futuras.
                  </p>
                </div>
              </div>

              <div style={styles.deliveryList}>
                {deliveriesData.deliveries.map((delivery) => {
                  const isSkipping = skippingId === delivery.id;
                  const statusStyle = STATUS_STYLES[delivery.status];

                  return (
                    <article key={delivery.id} style={styles.deliveryCard}>
                      <div style={styles.deliveryTop}>
                        <div>
                          <div style={styles.deliveryDate}>
                            {formatDeliveryDate(delivery.scheduledFor)}
                          </div>

                          <div style={styles.deliveryMeta}>
                            <span
                              style={{
                                ...styles.statusBadge,
                                background: statusStyle.background,
                                color: statusStyle.color,
                              }}
                            >
                              {STATUS_LABELS[delivery.status]}
                            </span>

                            <span style={styles.price}>
                              {formatCurrency(delivery.totalCents)}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={!delivery.canSkip || isSkipping}
                          onClick={() => handleSkip(delivery.id)}
                          style={{
                            ...styles.skipButton,
                            ...(delivery.canSkip && !isSkipping
                              ? styles.skipButtonActive
                              : styles.skipButtonDisabled),
                          }}
                        >
                          {isSkipping ? 'Pulando...' : 'Pular entrega'}
                        </button>
                      </div>

                      {!delivery.canSkip && delivery.skipReason && (
                        <div style={styles.reasonBox}>
                          <span style={styles.reasonIcon}>i</span>
                          <span>
                            {SKIP_REASON_MESSAGES[delivery.skipReason]}
                          </span>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function formatDeliveryDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
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

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#F7F6F2',
    padding: '48px 20px',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: '#1F1F1F',
  },

  shell: {
    width: '100%',
    maxWidth: 760,
    margin: '0 auto',
  },

  header: {
    marginBottom: 24,
  },

  eyebrow: {
    display: 'inline-block',
    marginBottom: 8,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#7C7A70',
  },

  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.15,
    letterSpacing: '-0.03em',
  },

  subtitle: {
    margin: '10px 0 0',
    fontSize: 16,
    color: '#68675F',
  },

  customerSwitcher: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 24,
  },

  customerButton: {
    border: '1px solid #D8D5CB',
    background: '#FFFFFF',
    borderRadius: 999,
    padding: '8px 14px',
    cursor: 'pointer',
    textTransform: 'capitalize',
    fontSize: 14,
  },

  customerButtonActive: {
    background: '#20201D',
    color: '#FFFFFF',
    borderColor: '#20201D',
  },

  loadingBox: {
    padding: 20,
    background: '#FFFFFF',
    borderRadius: 16,
    border: '1px solid #E7E4DB',
    color: '#66645D',
  },

  errorBox: {
    marginBottom: 20,
    padding: '12px 14px',
    background: '#FFF0F0',
    border: '1px solid #F3CCCC',
    borderRadius: 12,
    color: '#9A3B3B',
    fontSize: 14,
  },

  summaryCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
    padding: 22,
    background: '#FFFFFF',
    border: '1px solid #E7E4DB',
    borderRadius: 18,
    boxShadow: '0 10px 30px rgba(41, 38, 28, 0.04)',
  },

  summaryLabel: {
    display: 'block',
    fontSize: 18,
    fontWeight: 700,
  },

  summaryText: {
    margin: '6px 0 0',
    fontSize: 14,
    color: '#78766E',
  },

  allowanceBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 18,
    padding: '12px 16px',
    background: '#F8F7F3',
    borderRadius: 14,
  },

  allowanceLabel: {
    display: 'block',
    marginBottom: 7,
    fontSize: 12,
    fontWeight: 700,
    color: '#77756E',
  },

  allowanceDots: {
    display: 'flex',
    gap: 7,
  },

  allowanceDot: {
    width: 15,
    height: 15,
    borderRadius: '50%',
    display: 'inline-block',
  },

  allowanceDotAvailable: {
    background: '#78A081',
    border: '1px solid #78A081',
    boxShadow: 'inset 0 0 0 3px #E7F0E9',
  },

  allowanceDotUsed: {
    background: '#DDD9CF',
    border: '1px solid #CCC8BD',
  },

  allowanceTextBlock: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
  },

  allowanceNumber: {
    fontSize: 24,
    lineHeight: 1,
  },

  allowanceText: {
    maxWidth: 70,
    fontSize: 12,
    lineHeight: 1.2,
    color: '#747169',
  },

  section: {
    marginTop: 30,
  },

  sectionHeader: {
    marginBottom: 14,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 21,
  },

  sectionSubtitle: {
    margin: '5px 0 0',
    color: '#807D75',
    fontSize: 14,
  },

  deliveryList: {
    display: 'grid',
    gap: 12,
  },

  deliveryCard: {
    background: '#FFFFFF',
    border: '1px solid #E7E4DB',
    borderRadius: 16,
    padding: 18,
    boxShadow: '0 6px 20px rgba(41, 38, 28, 0.025)',
  },

  deliveryTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 20,
    alignItems: 'flex-start',
  },

  deliveryDate: {
    fontSize: 18,
    fontWeight: 700,
    textTransform: 'capitalize',
  },

  deliveryMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },

  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    padding: '5px 9px',
    fontSize: 12,
    fontWeight: 700,
  },

  price: {
    fontSize: 14,
    fontWeight: 600,
    color: '#55534D',
  },

  skipButton: {
    borderRadius: 10,
    padding: '10px 14px',
    border: 0,
    fontSize: 14,
    fontWeight: 700,
    transition: 'all 0.15s ease',
  },

  skipButtonActive: {
    background: '#20201D',
    color: '#FFFFFF',
    cursor: 'pointer',
  },

  skipButtonDisabled: {
    background: '#ECEAE4',
    color: '#99968E',
    cursor: 'not-allowed',
  },

  reasonBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTop: '1px solid #F0EEE8',
    color: '#747169',
    fontSize: 13,
    lineHeight: 1.4,
  },

  reasonIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: '#EEECE6',
    color: '#6B6963',
    fontSize: 11,
    fontWeight: 800,
  },
};