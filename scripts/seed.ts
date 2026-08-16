/**
 * Popula o banco com dados FICTICIOS para o exercicio.
 * Roda quantas vezes quiser: limpa e recria tudo.
 *
 *   yarn seed
 *
 * As datas sao relativas ao momento em que voce roda, para os cenarios
 * de prazo continuarem validos amanha.
 */
import { addDays, startOfDay } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { close, customers, deliveries } from '../src/lib/db';
import type { CustomerDoc, DeliveryDoc } from '../src/lib/domain';

const TZ = 'America/Sao_Paulo';

/** Daqui a `days` dias, as `hour`h no horario de Brasilia, convertido para UTC. */
function at(days: number, hour = 12): Date {
  const day = startOfDay(addDays(new Date(), days));
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, '0');
  const d = String(day.getDate()).padStart(2, '0');
  const h = String(hour).padStart(2, '0');
  return fromZonedTime(`${y}-${m}-${d}T${h}:00:00`, TZ);
}

const customerDocs: CustomerDoc[] = [
  { _id: 'cus_ana', name: 'Ana Souza', plan: 'STANDARD', city: 'Sao Paulo' },
  { _id: 'cus_bruno', name: 'Bruno Lima', plan: 'CLOSED_PLAN', city: 'Campinas' },
  { _id: 'cus_carla', name: 'Carla Dias', plan: 'STANDARD', city: 'Sao Paulo' },
];

const deliveryDocs: DeliveryDoc[] = [
  // --- Ana: um cenario isolado por entrega ---
  { _id: 'dlv_ana_1', customerId: 'cus_ana', scheduledFor: at(-7), status: 'DELIVERED', totalCents: 12990 },
  // prazo de corte ja passou (o corte foi ontem as 20h)
  { _id: 'dlv_ana_2', customerId: 'cus_ana', scheduledFor: at(1), status: 'SCHEDULED', totalCents: 13490 },
  // limitrofe de proposito: o corte e hoje as 20h
  { _id: 'dlv_ana_3', customerId: 'cus_ana', scheduledFor: at(2), status: 'SCHEDULED', totalCents: 13490 },
  // dentro do prazo, mas ja em producao
  { _id: 'dlv_ana_4', customerId: 'cus_ana', scheduledFor: at(3), status: 'IN_PRODUCTION', totalCents: 13490 },
  { _id: 'dlv_ana_5', customerId: 'cus_ana', scheduledFor: at(10), status: 'SCHEDULED', totalCents: 13490 },
  // ja pulada: serve para testar chamada repetida
  {
    _id: 'dlv_ana_6',
    customerId: 'cus_ana',
    scheduledFor: at(17),
    status: 'SKIPPED',
    totalCents: 13490,
    skippedAt: at(-1),
  },
  { _id: 'dlv_ana_7', customerId: 'cus_ana', scheduledFor: at(24), status: 'SCHEDULED', totalCents: 13490 },

  // --- Bruno: dois pulos dentro da janela ---
  {
    _id: 'dlv_bruno_1',
    customerId: 'cus_bruno',
    scheduledFor: at(-30),
    status: 'SKIPPED',
    totalCents: 15990,
    skippedAt: at(-33),
  },
  {
    _id: 'dlv_bruno_2',
    customerId: 'cus_bruno',
    scheduledFor: at(-9),
    status: 'SKIPPED',
    totalCents: 15990,
    skippedAt: at(-12),
  },
  { _id: 'dlv_bruno_3', customerId: 'cus_bruno', scheduledFor: at(4), status: 'SCHEDULED', totalCents: 15990 },
  { _id: 'dlv_bruno_4', customerId: 'cus_bruno', scheduledFor: at(11), status: 'SCHEDULED', totalCents: 15990 },
  { _id: 'dlv_bruno_5', customerId: 'cus_bruno', scheduledFor: at(18), status: 'SCHEDULED', totalCents: 15990 },

  // --- Carla: um pulo fora da janela ---
  {
    _id: 'dlv_carla_1',
    customerId: 'cus_carla',
    scheduledFor: at(-70),
    status: 'SKIPPED',
    totalCents: 11990,
    skippedAt: at(-73),
  },
  { _id: 'dlv_carla_2', customerId: 'cus_carla', scheduledFor: at(5), status: 'SCHEDULED', totalCents: 11990 },
  { _id: 'dlv_carla_3', customerId: 'cus_carla', scheduledFor: at(12), status: 'SCHEDULED', totalCents: 11990 },
  { _id: 'dlv_carla_4', customerId: 'cus_carla', scheduledFor: at(19), status: 'SCHEDULED', totalCents: 11990 },
];

async function main() {
  const cs = await customers();
  const ds = await deliveries();

  await cs.deleteMany({});
  await ds.deleteMany({});
  await cs.insertMany(customerDocs);
  await ds.insertMany(deliveryDocs);

  console.log(`${customerDocs.length} clientes e ${deliveryDocs.length} entregas inseridas.`);
  console.log('Clientes: cus_ana, cus_bruno, cus_carla');
  await close();
}

main().catch(async (err) => {
  console.error(
    '\nFalhou. O Mongo esta de pe? Sobe com:  docker compose up -d\n',
    err instanceof Error ? err.message : err,
  );
  await close();
  process.exit(1);
});
