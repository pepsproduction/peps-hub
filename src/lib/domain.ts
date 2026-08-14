import type { EventDraft, EventStatus, MatchPair, PhotoAsset, PhotoEvent, PhotoUploadStatus, PepsEvent, Team, ValidationErrors } from '../types';

export function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase('th-TH');
}

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function searchTeams(teams: Team[], query: string): Team[] {
  const term = normalizeText(query);
  if (!term) return teams;

  return teams.filter((team) => [team.name, team.shortName, team.city, team.category, team.slug]
    .some((field) => normalizeText(field).includes(term)));
}

export function sortEvents(events: PepsEvent[]): PepsEvent[] {
  const statusWeight: Record<EventStatus, number> = { live: 0, published: 1, draft: 2, ended: 3 };
  return [...events].sort((a, b) => statusWeight[a.status] - statusWeight[b.status] || a.startsAt.localeCompare(b.startsAt));
}

export function sortEventsByStartTime(events: PepsEvent[]): PepsEvent[] {
  const timestamp = (value: string): number => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  };
  return [...events].sort((a, b) => timestamp(a.startsAt) - timestamp(b.startsAt) || a.id.localeCompare(b.id));
}

export function visibleEvents(events: PepsEvent[]): PepsEvent[] {
  return sortEvents(events.filter((event) => event.status === 'live' || event.status === 'published'));
}

export function eventStatusLabel(status: EventStatus): string {
  return { live: 'กำลังถ่ายทอดสด', published: 'กำลังจะเริ่ม', draft: 'แบบร่าง', ended: 'จบแล้ว' }[status];
}

export function eventKindLabel(kind: PepsEvent['kind']): string {
  return kind === 'live' ? 'LIVE' : 'PHOTO MATCH';
}

export function photoUploadStatus(photoEvent: PhotoEvent, photos: PhotoAsset[]): PhotoUploadStatus {
  const count = photos.filter((photo) => photo.photoEventId === photoEvent.id).length;
  if (count === 0) return 'empty';
  if (photoEvent.photoCount > 0 && count < photoEvent.photoCount) return 'partial';
  return 'ready';
}

export function photoUploadStatusLabel(status: PhotoUploadStatus): string {
  return { ready: 'ลงรูปแล้ว', partial: 'ลงรูปบางส่วน', empty: 'ยังไม่มีรูป' }[status];
}

export function photoUploadStatusTone(status: PhotoUploadStatus): string {
  return { ready: 'ready', partial: 'partial', empty: 'empty' }[status];
}

export function teamPhotoCount(photos: PhotoAsset[], photoEventId: string, teamSlug: string): number {
  return photos.filter((photo) => photo.photoEventId === photoEventId && photo.teamSlug === teamSlug).length;
}

export function matchPairExists(matchPairs: MatchPair[], photoEventId: string, teamAId: string, teamBId: string): boolean {
  return matchPairs.some((pair) => pair.photoEventId === photoEventId
    && ((pair.teamAId === teamAId && pair.teamBId === teamBId) || (pair.teamAId === teamBId && pair.teamBId === teamAId)));
}

export function formatEventDate(value: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function validateEventDraft(draft: EventDraft): ValidationErrors {
  const errors: ValidationErrors = {};
  if (draft.title.trim().length < 3) errors.title = 'ใส่ชื่องานอย่างน้อย 3 ตัวอักษร';
  if (draft.subtitle.trim().length < 5) errors.subtitle = 'เพิ่มคำอธิบายสั้น ๆ เพื่อช่วยให้ผู้ชมตัดสินใจ';
  if (!draft.venue.trim()) errors.venue = 'ระบุสถานที่จัดงาน';
  if (!draft.startsAt) {
    errors.startsAt = 'เลือกวันและเวลาเริ่มงาน';
  } else if (Number.isNaN(new Date(draft.startsAt).getTime())) {
    errors.startsAt = 'วันและเวลาไม่ถูกต้อง';
  }
  if (!draft.endsAt) {
    errors.endsAt = 'เลือกวันและเวลาจบงาน';
  } else if (Number.isNaN(new Date(draft.endsAt).getTime())) {
    errors.endsAt = 'วันและเวลาจบไม่ถูกต้อง';
  } else if (!errors.startsAt && new Date(draft.endsAt).getTime() <= new Date(draft.startsAt).getTime()) {
    errors.endsAt = 'เวลาจบต้องอยู่หลังเวลาเริ่ม';
  }
  if (draft.kind === 'live' && draft.liveUrl.trim()) {
    try {
      const url = new URL(draft.liveUrl);
      if (!['http:', 'https:'].includes(url.protocol)) errors.liveUrl = 'ลิงก์ต้องเป็น http หรือ https';
    } catch {
      errors.liveUrl = 'รูปแบบลิงก์ไม่ถูกต้อง';
    }
  }
  return errors;
}

export function validateImageUpload(file: { type: string; size: number }): string | null {
  if (!file.type.startsWith('image/')) return 'ไฟล์ Cover ต้องเป็นรูปภาพ';
  if (file.size > 5 * 1024 * 1024) return 'ไฟล์ Cover ต้องมีขนาดไม่เกิน 5MB';
  return null;
}

export function validateImageUrl(value: string): string | null {
  if (!value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return 'ลิงก์รูปต้องเป็น https://';
  } catch {
    return 'รูปแบบลิงก์รูปไม่ถูกต้อง';
  }
  return null;
}

export function createEventFromDraft(draft: EventDraft, index: number, cover: string): PepsEvent {
  const slug = slugify(draft.title) || `event-${index + 1}`;
  const id = `${slug}-${Date.now()}`;
  return {
    id,
    slug,
    title: draft.title.trim(),
    subtitle: draft.subtitle.trim(),
    kind: draft.kind,
    status: 'draft',
    venue: draft.venue.trim(),
    startsAt: new Date(draft.startsAt).toISOString(),
    endsAt: new Date(draft.endsAt).toISOString(),
    cover,
    accent: draft.kind === 'live' ? '#a6ff5b' : '#76d7ff',
    liveUrl: draft.kind === 'live' && draft.liveUrl.trim() ? draft.liveUrl.trim() : undefined,
    tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
  };
}
