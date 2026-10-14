import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);

export async function connectDb(uri = env.MONGODB_URI, options = {}) {
  mongoose.connection.on('disconnected', () => logger.warn('mongodb.disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('mongodb.reconnected'));
  mongoose.connection.on('error', (err) => logger.error('mongodb.error', { error: err.message }));
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, ...options });
  // Make sure unique indexes exist before the app accepts traffic.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  logger.info('mongodb.connected', { database: mongoose.connection.name });
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

export function isDbReady() {
  return mongoose.connection.readyState === 1;
}
