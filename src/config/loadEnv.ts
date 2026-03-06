import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const loadedKey = '__nama_env_loaded__';

const globalWithEnv = globalThis as typeof globalThis & {
  [loadedKey]?: boolean;
};

if (!globalWithEnv[loadedKey]) {
  // Base env file (kept for compatibility with existing scripts and Prisma CLI).
  dotenv.config();

  // Local override for runtime in non-production environments.
  // Render/prod should rely on platform environment variables.
  const explicitOverride = process.env.ENV_FILE;
  const localOverride = process.env.NODE_ENV === 'production' ? null : '.env.local';
  const overrideFile = explicitOverride || localOverride;

  if (overrideFile) {
    const overridePath = path.resolve(process.cwd(), overrideFile);
    if (fs.existsSync(overridePath)) {
      dotenv.config({ path: overridePath, override: true });
    }
  }

  globalWithEnv[loadedKey] = true;
}
