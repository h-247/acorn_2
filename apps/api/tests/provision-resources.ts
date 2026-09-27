import pg from 'pg';
import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { config } from '../src/shared/config.js';

async function provision() {
  const dbNameMatch = config.databaseUrl.match(/\/\/.*\/([^\/?#]+)/);
  const dbName = dbNameMatch ? dbNameMatch[1] : '';

  if (dbName !== 'acorn_test') {
    throw new Error('provision-resources can only be run for acorn_test');
  }

  // Connect to the default 'postgres' database to create 'acorn_test'
  const adminDbUrl = config.databaseUrl.replace(/\/[^/?#]+([?#]|$)/, '/postgres$1');
  const pool = new pg.Pool({ connectionString: adminDbUrl });

  try {
    const res = await pool.query(`SELECT 1 FROM pg_database WHERE datname = 'acorn_test'`);
    if (res.rowCount !== 0) {
      console.log('[provision] Recreating database acorn_test...');
      // A schema-only reset can leave PostgreSQL composite types behind when a
      // prior migration was interrupted. Recreate the dedicated test database
      // instead, so every migration run starts from an actually empty catalog.
      await pool.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = 'acorn_test' AND pid <> pg_backend_pid()
      `);
      await pool.query('DROP DATABASE acorn_test');
    } else {
      console.log('[provision] Creating database acorn_test...');
    }
    await pool.query('CREATE DATABASE acorn_test');
  } catch (err) {
    console.error('[provision] Failed to provision database:', err);
    throw err;
  } finally {
    await pool.end();
  }

  const s3 = new S3Client({
    endpoint: config.objectStorage.endpoint,
    region: config.objectStorage.region,
    credentials: {
      accessKeyId: config.objectStorage.accessKey,
      secretAccessKey: config.objectStorage.secretKey,
    },
    forcePathStyle: config.objectStorage.forcePathStyle,
  });

  try {
    await s3.send(new HeadBucketCommand({ Bucket: 'acorn-test' }));
    console.log('[provision] Bucket acorn-test already exists.');
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      console.log('[provision] Creating bucket acorn-test...');
      await s3.send(new CreateBucketCommand({ Bucket: 'acorn-test' }));
    } else {
      console.error('[provision] Failed to provision bucket:', err);
      throw err;
    }
  }
}

provision().catch(err => {
  console.error(err);
  process.exit(1);
});
