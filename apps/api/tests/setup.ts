import { config } from 'dotenv';
import { resolve } from 'path';

// Load the root .env file
config({ path: resolve(__dirname, '../../../.env') });

// Automatically configure API tests to use a dedicated PostgreSQL database named acorn_test
// and S3-compatible bucket named acorn-test.
const defaultDbUrl = process.env.DATABASE_URL || 'postgresql://acorn:acorn_dev_only@localhost:5435/acorn';
process.env.DATABASE_URL = defaultDbUrl.replace(/\/[^/?#]+([?#]|$)/, '/acorn_test$1');

process.env.OBJECT_STORAGE_BUCKET = 'acorn-test';
