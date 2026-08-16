import { useEffect, useState } from 'react';
import { api, setCustomerId } from '@/lib/api-client';
import type { CustomerDTO } from '@/lib/serializers';

const CUSTOMERS = ['cus_ana', 'cus_bruno', 'cus_carla'];

export default function Home() {
  // Existe so por causa da auth falsa do exercicio.
  const [customerId, setCurrentCustomer] = useState(CUSTOMERS[0]);
  const [me, setMe] = useState<CustomerDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCustomerId(customerId);
    setMe(null);
    setError(null);
    api<CustomerDTO>('/api/me')
      .then(setMe)
      .catch((err: Error) => setError(err.message));
  }, [customerId]);

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
      {me && (
        <p style={{ color: '#555' }}>
          {me.name} — plano {me.plan} — {me.city}
        </p>
      )}

      {/* TODO(candidato): lista das proximas entregas + botao de pular.
          Visual nao conta nota. Comportamento conta. */}
      <section
        style={{ marginTop: 32, padding: 16, border: '1px dashed #bbb', borderRadius: 8 }}
      >
        <strong>TODO</strong>
        <p style={{ color: '#666', marginBottom: 0 }}>
          Lista das proximas entregas com botao de pular, mostrando o motivo quando nao
          for possivel.
        </p>
      </section>
    </main>
  );
}
