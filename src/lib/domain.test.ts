import { describe, expect, it } from 'vitest';
import { createEventFromDraft, matchPairExists, photoUploadStatus, searchTeams, slugify, sortEvents, teamPhotoCount, validateEventDraft, validateImageUpload, validateImageUrl, visibleEvents } from './domain';
import { directImageUrl, isSafePhotoSourceUrl } from './photoSources';
import type { EventDraft, MatchPair, PepsEvent, PhotoAsset, PhotoEvent, Team } from '../types';

const teams: Team[] = [
  { id: '1', slug: 'peps-united', name: 'PEPS UNITED', shortName: 'PU', city: 'กรุงเทพฯ', category: 'ประชาชน', color: '#fff', logo: '', photoCount: 1 },
  { id: '2', slug: 'north-star', name: 'NORTH STAR FC', shortName: 'NS', city: 'เชียงใหม่', category: 'ประชาชน', color: '#fff', logo: '', photoCount: 2 },
];

const event = (id: string, status: PepsEvent['status'], startsAt: string): PepsEvent => ({ id, slug: id, title: id, subtitle: '', kind: 'live', status, venue: '', startsAt, cover: '', accent: '', tags: [] });

describe('PepsHub domain logic', () => {
  it('creates stable URL-friendly slugs', () => {
    expect(slugify('PEPS LIVE CUP 2026!')).toBe('peps-live-cup-2026');
    expect(slugify('  Hello   World  ')).toBe('hello-world');
  });

  it('searches by team name, short name, city, and slug', () => {
    expect(searchTeams(teams, 'เชียงใหม่').map((team) => team.slug)).toEqual(['north-star']);
    expect(searchTeams(teams, 'pu').map((team) => team.slug)).toEqual(['peps-united']);
    expect(searchTeams(teams, '').length).toBe(2);
  });

  it('only exposes published or live events publicly and prioritizes live', () => {
    const events = [event('draft', 'draft', '2026-01-01'), event('up-next', 'published', '2026-01-01'), event('live', 'live', '2026-12-01')];
    expect(visibleEvents(events).map((item) => item.id)).toEqual(['live', 'up-next']);
    expect(sortEvents(events).map((item) => item.id)).toEqual(['live', 'up-next', 'draft']);
  });

  it('requires the minimum event fields and validates live URLs', () => {
    const invalid: EventDraft = { title: 'x', subtitle: '', kind: 'live', venue: '', startsAt: '', endsAt: '', liveUrl: 'javascript:alert(1)', tags: '' };
    const errors = validateEventDraft(invalid);
    expect(errors.title).toBeTruthy();
    expect(errors.venue).toBeTruthy();
    expect(errors.startsAt).toBeTruthy();
    expect(errors.endsAt).toBeTruthy();
    expect(errors.liveUrl).toBeTruthy();
    expect(validateEventDraft({ ...invalid, title: 'Valid title', subtitle: 'Valid subtitle', venue: 'Arena', startsAt: 'not-a-date', endsAt: '2026-08-13T14:00', liveUrl: '' }).startsAt).toBeTruthy();
  });

  it('rejects unsafe or oversized cover uploads before reading them', () => {
    expect(validateImageUpload({ type: 'text/html', size: 10 })).toContain('รูปภาพ');
    expect(validateImageUpload({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })).toContain('5MB');
    expect(validateImageUpload({ type: 'image/jpeg', size: 1024 })).toBeNull();
  });

  it('creates draft events without exposing them until published', () => {
    const draft: EventDraft = { title: 'New Match', subtitle: 'A useful description', kind: 'photo', venue: 'Arena', startsAt: '2026-08-13T12:00', endsAt: '2026-08-13T14:00', liveUrl: '', tags: 'photo, final' };
    const created = createEventFromDraft(draft, 0, 'cover');
    expect(created.status).toBe('draft');
    expect(created.kind).toBe('photo');
    expect(created.slug).toBe('new-match');
    expect(created.tags).toEqual(['photo', 'final']);
    expect(created.endsAt).toBeTruthy();
  });

  it('reports Photo Event upload status and team-specific counts', () => {
    const photoEvent: PhotoEvent = { id: 'photo-event-1', eventId: 'event-1', title: 'Photo Day', status: 'published', dateLabel: 'วันนี้', location: 'Arena', cover: '', teamSlugs: ['peps-united'], photoCount: 2 };
    const photos: PhotoAsset[] = [
      { id: 'photo-1', photoEventId: 'photo-event-1', teamSlug: 'peps-united', image: '', label: 'one', capturedAt: '10:00' },
      { id: 'photo-2', photoEventId: 'photo-event-1', teamSlug: 'peps-united', image: '', label: 'two', capturedAt: '10:01' },
    ];
    expect(photoUploadStatus(photoEvent, photos)).toBe('ready');
    expect(teamPhotoCount(photos, photoEvent.id, 'peps-united')).toBe(2);
    expect(photoUploadStatus({ ...photoEvent, photoCount: 3 }, photos)).toBe('partial');
    expect(photoUploadStatus({ ...photoEvent, photoCount: 0 }, [])).toBe('empty');
  });

  it('accepts only Google source links and derives a public Drive file preview URL', () => {
    expect(isSafePhotoSourceUrl('https://drive.google.com/drive/folders/folder-id')).toBe(true);
    expect(isSafePhotoSourceUrl('http://drive.google.com/drive/folders/folder-id')).toBe(false);
    expect(isSafePhotoSourceUrl('https://example.com/folder')).toBe(false);
    expect(directImageUrl({ provider: 'google-drive', url: 'https://drive.google.com/file/d/file-id/view' })).toBe('https://drive.google.com/uc?export=view&id=file-id');
  });

  it('validates externally hosted cover image links', () => {
    expect(validateImageUrl('https://cdn.example.com/cover.jpg')).toBeNull();
    expect(validateImageUrl('http://cdn.example.com/cover.jpg')).toContain('https');
    expect(validateImageUrl('not-a-url')).toContain('ไม่ถูกต้อง');
  });
});
describe('Match pair domain logic', () => {
  it('treats a match pair as the same matchup regardless of team order', () => {
    const pairs: MatchPair[] = [{ id: 'pair-1', photoEventId: 'photo-1', teamAId: '1', teamBId: '2', label: 'คู่ที่ 1' }];
    expect(matchPairExists(pairs, 'photo-1', '1', '2')).toBe(true);
    expect(matchPairExists(pairs, 'photo-1', '2', '1')).toBe(true);
    expect(matchPairExists(pairs, 'photo-1', '1', '3')).toBe(false);
  });
});
