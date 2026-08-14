import type { MatchPair, PhotoProvider, PhotoSource, Team } from '../types';

const GOOGLE_HOSTS = new Set(['drive.google.com', 'docs.google.com', 'photos.google.com', 'photos.app.goo.gl']);
const GOOGLE_PREVIEW_HOSTS = new Set(['drive.google.com', 'drive.usercontent.google.com', 'lh3.googleusercontent.com', 'photos.google.com', 'photos.googleusercontent.com']);

export const PHOTO_PREVIEW_LIMIT = 6;

export function limitPhotoPreviews<T>(items: T[]): T[] {
  return items.slice(0, PHOTO_PREVIEW_LIMIT);
}

export function isSafePhotoPreviewUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && GOOGLE_PREVIEW_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function photoProviderLabel(provider: PhotoProvider): string {
  return provider === 'google-drive' ? 'Google Drive' : 'Google Photos';
}

export function isSafePhotoSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && GOOGLE_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function normalizePhotoSource(source: PhotoSource | undefined, eventId: string): PhotoSource | undefined {
  if (!source || !source.url || !isSafePhotoSourceUrl(source.url)) return undefined;
  if (!source.eventId || source.eventId === eventId) return source;
  return undefined;
}

export function normalizePhotoSourcePreviews(source: PhotoSource | undefined): string[] {
  if (!source) return [];
  const previewUrls = Array.isArray(source.previewUrls) ? source.previewUrls.filter(isSafePhotoPreviewUrl) : [];
  const directUrl = directImageUrl(source);
  return limitPhotoPreviews(Array.from(new Set(directUrl ? [directUrl, ...previewUrls] : previewUrls)));
}

export function photoSourceForTeam(teamSources: PhotoSource[] | undefined, eventId: string): PhotoSource | undefined {
  return teamSources?.map((source) => normalizePhotoSource(source, eventId)).find(Boolean);
}

export function photoSourcesForPair(pair: MatchPair | undefined, teams: Team[], eventId: string): PhotoSource[] {
  if (!pair) return [];
  const pairSources = Array.isArray(pair.photoSources)
    ? pair.photoSources.map((source) => normalizePhotoSource(source, eventId)).filter((source): source is PhotoSource => Boolean(source))
    : [];
  if (pairSources.length > 0) return pairSources;

  const legacySources = [
    photoSourceForTeam(teams.find((team) => team.id === pair.teamAId)?.photoSources, eventId),
    photoSourceForTeam(teams.find((team) => team.id === pair.teamBId)?.photoSources, eventId),
  ].filter((source): source is PhotoSource => Boolean(source));
  return Array.from(new Map(legacySources.map((source) => [`${source.provider}:${source.url}`, source])).values());
}

export function pairPreviewUrls(pair: MatchPair | undefined, teams: Team[], eventId: string): string[] {
  return limitPhotoPreviews(photoSourcesForPair(pair, teams, eventId).flatMap(normalizePhotoSourcePreviews));
}

export function pairDisplayName(pair: MatchPair, teams: Team[]): string {
  const teamA = teams.find((team) => team.id === pair.teamAId)?.name ?? 'ทีม A';
  const teamB = teams.find((team) => team.id === pair.teamBId)?.name ?? 'ทีม B';
  return `${teamA} VS ${teamB}`;
}

export function extractGoogleDriveFileId(value: string): string | undefined {
  try {
    const url = new URL(value);
    const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
    return fileMatch?.[1] ?? url.searchParams.get('id') ?? undefined;
  } catch {
    return undefined;
  }
}

export function directImageUrl(source: PhotoSource | undefined): string | undefined {
  if (!source || source.provider !== 'google-drive') return undefined;
  const fileId = extractGoogleDriveFileId(source.url);
  return fileId ? `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w1200` : undefined;
}
