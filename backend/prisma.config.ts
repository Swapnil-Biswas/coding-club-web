import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Points to the same SQLite file the app uses
const dbPath = path.resolve(__dirname, 'data', 'app.db');

export default defineConfig({
  earlyAccess: true,
  schema: path.resolve(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: `file:${dbPath}`,
  },
});
