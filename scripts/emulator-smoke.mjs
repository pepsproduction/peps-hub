/* global URL, console, process */

import { readFile } from 'node:fs/promises';

const seed = JSON.parse(await readFile(new URL('../emulator/seed-data.json', import.meta.url), 'utf8'));

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST is not set; this script must run under firebase emulators:exec');
}

console.log(`Firestore emulator reachable at ${process.env.FIRESTORE_EMULATOR_HOST}`);
console.log(`Seed manifest: ${seed.events.length} events, ${seed.teams.length} teams, ${seed.photoEvents.length} photo events`);
