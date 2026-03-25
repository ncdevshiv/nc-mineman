import { $ } from 'bun';

// Initialize database on dev start
const { initDatabase } = await import('../lib/database');
await initDatabase();

// Launch Next.js dev server
await $`next dev`;
