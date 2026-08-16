/**
 * Tipos do dominio. Voce pode remodelar o que quiser - se remodelar,
 * registre o motivo no README.
 */

export type CustomerPlan = 'STANDARD' | 'CLOSED_PLAN';

export type DeliveryStatus =
  | 'SCHEDULED'
  | 'IN_PRODUCTION'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'SKIPPED'
  | 'CANCELLED';

export interface CustomerDoc {
  _id: string;
  name: string;
  plan: CustomerPlan;
  city: string;
}

export interface DeliveryDoc {
  _id: string;
  customerId: string;
  /** Data/hora prevista da entrega, em UTC. */
  scheduledFor: Date;
  status: DeliveryStatus;
  totalCents: number;
  /** Preenchido quando a entrega foi pulada. */
  skippedAt?: Date;
}

export const COLLECTIONS = {
  customers: 'customers',
  deliveries: 'deliveries',
} as const;
