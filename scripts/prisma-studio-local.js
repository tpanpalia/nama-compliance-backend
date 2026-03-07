require('dotenv').config({ path: '.env.local' });

const { spawn } = require('child_process');

const databaseUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL || databaseUrl;

if (!databaseUrl) {
  console.error('Missing DATABASE_URL in .env.local');
  process.exit(1);
}

const child =
  process.platform === 'win32'
    ? spawn('cmd.exe', ['/c', 'npx prisma studio'], {
        stdio: 'inherit',
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          DIRECT_URL: directUrl,
        },
      })
    : spawn('npx', ['prisma', 'studio'], {
        stdio: 'inherit',
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          DIRECT_URL: directUrl,
        },
      });

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
