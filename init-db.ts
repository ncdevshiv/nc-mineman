import { initDatabase } from './lib/database';

async function main() {
  const success = await initDatabase();
  if (success) {
    console.log('Successfully created all SQL tables!');
  } else {
    console.log('Failed to create tables.');
  }
}
main();
