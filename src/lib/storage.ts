import { seedState } from '../data';
import { normalizePhotoSource, photoSourceForTeam } from './photoSources';
import type { AppState, PromoAspectRatio } from '../types';

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
  const seededPairs = cloneState(seedState).matchPairs;
  const seededPromoSlides = cloneState(seedState).promoSlides;
  const promoSlides = (Array.isArray(state.promoSlides) ? state.promoSlides : seededPromoSlides).map((slide) => ({
    ...slide,
    aspectRatio: (slide.aspectRatio ?? '16:9') as PromoAspectRatio,
  }));
  const matchPairs = (Array.isArray(state.matchPairs) ? state.matchPairs : seededPairs).map((pair) => {
    const seededSources = seededPairs.find((seedPair) => seedPair.id === pair.id)?.photoSources ?? [];
    if (Array.isArray(pair.photoSources) && pair.photoSources.length > 0) {
      const photoSources = pair.photoSources.map((source) => {
        const seededSource = seededSources.find((item) => item.provider === source.provider && item.url === source.url);
        return seededSource?.previewUrls?.length && !source.previewUrls?.length
          ? { ...seededSource, ...source, previewUrls: seededSource.previewUrls, syncStatus: source.syncStatus ?? seededSource.syncStatus }
          : source;
      });
      return { ...pair, photoSources };
    }
    const legacySources = [
      photoSourceForTeam(teams.find((team) => team.id === pair.teamAId)?.photoSources, pair.photoEventId),
      photoSourceForTeam(teams.find((team) => team.id === pair.teamBId)?.photoSources, pair.photoEventId),
    ].filter((source): source is NonNullable<typeof source> => Boolean(source))
      .map((source) => normalizePhotoSource(source, pair.photoEventId))
      .filter((source): source is NonNullable<typeof source> => Boolean(source));
    if (legacySources.length > 0) return { ...pair, photoSources: legacySources };
    return seededSources.length > 0 ? { ...pair, photoSources: seededSources } : { ...pair, photoSources: [] };
  });
  return {
    events: state.events,
    teams,
    photoEvents: state.photoEvents,
    photos: state.photos
      .map((photo) => ({ ...photo, photoEventId: photo.photoEventId || fallbackPhotoEventId }))
      .filter((photo) => Boolean(photo.photoEventId)),
    matchPairs,
    promoSlides,
  };
}

export function recoverIncompleteCloudState(state: AppState): AppState {
  const hasExistingContent = state.events.length > 0
    || state.photoEvents.length > 0
    || state.photos.length > 0
    || state.matchPairs.length > 0;
  if (hasExistingContent || state.teams.length === 0) return state;
  const seeded = cloneState(seedState);
  return {
    ...state,
    events: seeded.events,
    photoEvents: seeded.photoEvents,
    photos: seeded.photos,
    matchPairs: seeded.matchPairs,
  };
}

export function normalizeAppState(value: unknown): AppState | null {
  return isAppState(value) ? migrateState(value) : null;
}

export function loadState(): AppState {
  if (typeof window === 'undefined') return cloneState(seedState);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneState(seedState);
    const parsed: unknown = JSON.parse(raw);
    return normalizeAppState(parsed) ?? cloneState(seedState);
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
