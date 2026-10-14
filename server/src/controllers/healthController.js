import mongoose from 'mongoose';
import { isDbReady } from '../config/db.js';

export const health = (_req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()), timestamp: new Date().toISOString() });
};

// Readiness checks the critical dependency (MongoDB) without revealing connection details.
export const ready = async (_req, res) => {
  try {
    if (!isDbReady()) throw new Error('not connected');
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready', checks: { database: 'ok' } });
  } catch {
    res.status(503).json({ status: 'unavailable', checks: { database: 'down' } });
  }
};
