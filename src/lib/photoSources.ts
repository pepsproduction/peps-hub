import type { PhotoProvider, PhotoSource } from '../types';

const GOOGLE_HOSTS = new Set(['drive.google.com', 'docs.google.com', 'photos.google.com', 'photos.app.goo.gl']);

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

export function photoSourceForTeam(teamSources: PhotoSource[] | undefined, eventId: string): PhotoSource | undefined {
  return teamSources?.map((source) => normalizePhotoSource(source, eventId)).find(Boolean);
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
  return fileId ? `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}` : undefined;
}
