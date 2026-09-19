import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'acorn_super_secret_jwt_key_for_dev_123',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://acorn:acorn_dev_only@localhost:5432/acorn',
  recentEvidenceCount: parseInt(process.env.RECENT_EVIDENCE_COUNT || '20', 10),
  objectStorage: {
    provider: process.env.OBJECT_STORAGE_PROVIDER || 'minio',
    endpoint: process.env.OBJECT_STORAGE_ENDPOINT || 'http://localhost:9000',
    bucket: process.env.OBJECT_STORAGE_BUCKET || 'acorn-dev',
    accessKey: process.env.OBJECT_STORAGE_ACCESS_KEY || 'acorn',
    secretKey: process.env.OBJECT_STORAGE_SECRET_KEY || 'acorn_dev_only',
    region: process.env.OBJECT_STORAGE_REGION || 'auto',
    forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === 'true',
  },
  ai: {
    provider: process.env.AI_PROVIDER || 'mock',
    model: process.env.AI_MODEL || 'mock',
    apiKey: process.env.AI_API_KEY || '',
  },
};
