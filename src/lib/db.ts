import { MongoClient, type Collection, type Db } from 'mongodb';
import { COLLECTIONS, type CustomerDoc, type DeliveryDoc } from './domain';

const url = process.env.MONGO_URL ?? 'mongodb://localhost:27017';
const dbName = process.env.MONGO_DB ?? 'livup_takehome';

/**
 * Em dev o Next recarrega o modulo a cada mudanca, entao a conexao vive
 * no global para nao vazar socket a cada hot reload.
 */
const globalForMongo = global as unknown as { _mongoClient?: MongoClient };

export async function connect(): Promise<Db> {
  if (!globalForMongo._mongoClient) {
    const client = new MongoClient(url, { serverSelectionTimeoutMS: 3000 });
    await client.connect();
    globalForMongo._mongoClient = client;
  }
  return globalForMongo._mongoClient.db(dbName);
}

export async function close(): Promise<void> {
  await globalForMongo._mongoClient?.close();
  globalForMongo._mongoClient = undefined;
}

export async function customers(): Promise<Collection<CustomerDoc>> {
  return (await connect()).collection<CustomerDoc>(COLLECTIONS.customers);
}

export async function deliveries(): Promise<Collection<DeliveryDoc>> {
  return (await connect()).collection<DeliveryDoc>(COLLECTIONS.deliveries);
}
