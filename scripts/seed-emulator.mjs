/* global console, fetch, process, URL */

import { readFile } from 'node:fs/promises';

const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const projectId = process.env.GCLOUD_PROJECT ?? 'demo-pepshub';
const seed = JSON.parse(await readFile(new URL('../emulator/seed-data.json', import.meta.url), 'utf8'));

function firestoreValue(value) {
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { integerValue: String(value) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (value && typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, firestoreValue(item)])) } };
  return { stringValue: String(value) };
}

function documentFor(record) {
  return {
    fields: Object.fromEntries(Object.entries(record).map(([key, value]) => [key, firestoreValue(value)])),
  };
}

async function seedCollection(collection, records) {
  for (const record of records) {
    const response = await fetch(`http://${host}/v1/projects/${projectId}/databases/(default)/documents/${collection}/${record.id}`, {
      method: 'PATCH',
      // The emulator's owner token bypasses rules for local fixture loading only.
      // Production writes still go through Firebase Authentication and admin claims.
      headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
      body: JSON.stringify(documentFor(record)),
    });
    if (!response.ok) throw new Error(`Failed to seed ${collection}/${record.id}: ${response.status} ${await response.text()}`);
  }
}

await seedCollection('events', seed.events);
await seedCollection('teams', seed.teams);
await seedCollection('photoEvents', seed.photoEvents);
await seedCollection('matchPairs', seed.matchPairs ?? []);
console.log(`Seeded ${seed.events.length} events, ${seed.teams.length} teams, ${seed.photoEvents.length} photo events, and ${(seed.matchPairs ?? []).length} match pairs into ${host}.`);
