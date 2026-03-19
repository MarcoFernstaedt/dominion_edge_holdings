// Singleton Prisma client — import this everywhere instead of new PrismaClient()
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global;

const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

export default db;
