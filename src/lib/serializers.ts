import type { CustomerDoc, DeliveryDoc } from './domain';

/** Formato que a API devolve para o cliente. Mude a vontade. */
export interface CustomerDTO {
  id: string;
  name: string;
  plan: CustomerDoc['plan'];
  city: string;
}

export interface DeliveryDTO {
  id: string;
  /** ISO 8601, em UTC. */
  scheduledFor: string;
  status: DeliveryDoc['status'];
  totalCents: number;
  /** ISO 8601, em UTC. Nulo quando a entrega nao foi pulada. */
  skippedAt: string | null;
}

export function toCustomerDTO(doc: CustomerDoc): CustomerDTO {
  return { id: doc._id, name: doc.name, plan: doc.plan, city: doc.city };
}

/** Util de mapeamento, ja que Date -> JSON costuma dar retrabalho. */
export function toDeliveryDTO(doc: DeliveryDoc): DeliveryDTO {
  return {
    id: doc._id,
    scheduledFor: doc.scheduledFor.toISOString(),
    status: doc.status,
    totalCents: doc.totalCents,
    skippedAt: doc.skippedAt ? doc.skippedAt.toISOString() : null,
  };
}
