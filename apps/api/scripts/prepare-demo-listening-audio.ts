import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { config } from '../src/shared/config.js';
import { db, pool } from '../src/infrastructure/persistence/db.js';
import { storage } from '../src/infrastructure/object-storage/storage.js';
import * as schema from '../src/infrastructure/persistence/schema.js';
import { SEED_IDS } from '../src/infrastructure/persistence/seed.js';

const DEMO_AUDIO_KEY = 'demo-rehearsal/listening/campus-library-orientation.mp3';

function assertDemoTarget(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to prepare demo audio in production.');
  }

  const database = new URL(config.databaseUrl).pathname.replace(/^\//, '');
  if (database !== 'acorn' || config.objectStorage.bucket !== 'acorn-dev') {
    throw new Error(
      `Refusing to prepare demo audio for database "${database}" and bucket "${config.objectStorage.bucket}". ` +
      'This command only supports the local demo targets acorn and acorn-dev.'
    );
  }
}

async function prepareDemoListeningAudio(): Promise<void> {
  assertDemoTarget();

  const fixturePath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../web/e2e/fixtures/test-audio.mp3'
  );
  if (!existsSync(fixturePath)) {
    throw new Error(`Required Listening fixture is missing: ${fixturePath}`);
  }

  const [file] = await db
    .select()
    .from(schema.materialFiles)
    .where(eq(schema.materialFiles.materialId, SEED_IDS.matListeningCampus));

  if (!file || file.fileKey !== DEMO_AUDIO_KEY) {
    throw new Error('Demo seed data is missing the expected Listening audio file row. Run db:seed first.');
  }

  const audio = readFileSync(fixturePath);
  await storage.putObject(DEMO_AUDIO_KEY, audio, 'audio/mpeg');
  await db
    .update(schema.materialFiles)
    .set({ fileSize: audio.byteLength, mimeType: 'audio/mpeg' })
    .where(eq(schema.materialFiles.id, file.id));

  console.log(`Prepared playable Listening audio (${audio.byteLength} bytes) in ${config.objectStorage.bucket}.`);
}

prepareDemoListeningAudio()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    console.error('[demo:prepare-listening] Failed:', error);
    await pool.end();
    process.exitCode = 1;
  });
