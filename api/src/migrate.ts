import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from './config.js';

const execAsync = promisify(exec);

export async function runMigrations(): Promise<void> {
  const databaseUrl = `postgresql://${encodeURIComponent(config.postgres.user)}:${encodeURIComponent(config.postgres.password)}@${config.postgres.host}:${config.postgres.port}/${config.postgres.database}`;

  const { stdout, stderr } = await execAsync(
    `npx node-pg-migrate up --migrations-dir ../migrations --no-lock`,
    {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);
}
