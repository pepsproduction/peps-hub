import { seedState } from '../data';
import { normalizePhotoSource, photoSourceForTeam } from './photoSources';
import type { AppState } from '../types';

const STORAGE_KEY = 'pepshub-state-v1';

function cloneState(state: AppState): AppState {
  return JSON.parse(JSON.stringify(state)) as AppState;
}

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<AppState>;
  return Array.isArray(state.events) && Array.isArray(state.teams) && Array.isArray(state.photoEvents) && Array.isArray(state.photos);
}

function migrateState(state: AppState): AppState {
  const fallbackPhotoEventId = state.photoEvents[0]?.id ?? '';
  const teams = state.teams.map((team) => ({ ...team, photoSources: Array.isArray(team.photoSources) ? team.photoSources : [] }));
  const matchPairs = (Array.isArray(state.matchPairs) ? state.matchPairs : cloneState(seedState).matchPairs).map((pair) => {
    if (Array.isArray(pair.photoSources) && pair.photoSources.length > 0) return pair;
    const legacySources = [
      photoSourceForTeam(teams.find((team) => team.id === pair.teamAId)?.photoSources, pair.photoEventId),
      photoSourceForTeam(teams.find((team) => team.id === pair.teamBId)?.photoSources, pair.photoEventId),
    ].filter((source): source is NonNullable<typeof source> => Boolean(source))
      .map((source) => normalizePhotoSource(source, pair.photoEventId))
      .filter((source): source is NonNullable<typeof source> => Boolean(source));
    return legacySources.length > 0 ? { ...pair, photoSources: legacySources } : { ...pair, photoSources: [] };
  });
  return {
    ...state,
    matchPairs,
    teams,
    photos: state.photos
      .map((photo) => ({ ...photo, photoEventId: photo.photoEventId || fallbackPhotoEventId }))
      .filter((photo) => Boolean(photo.photoEventId)),
  };
}

export function loadState(): AppState {
  if (typeof window === 'undefined') return cloneState(seedState);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneState(seedState);
    const parsed: unknown = JSON.parse(raw);
    return isAppState(parsed) ? migrateState(parsed) : cloneState(seedState);
  } catch {
    return cloneState(seedState);
  }
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState(): AppState {
  const next = cloneState(seedState);
  if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
  return next;
}

export function isFirebaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID && import.meta.env.VITE_FIREBASE_API_KEY);
}
