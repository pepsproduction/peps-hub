export type Page = 'home' | 'photos' | 'admin';

export type EventKind = 'live' | 'photo';

export type EventStatus = 'draft' | 'published' | 'live' | 'ended';

export type PhotoProvider = 'google-drive' | 'google-photos';

export type PhotoUploadStatus = 'ready' | 'partial' | 'empty';

export type PromoAspectRatio = '16:9' | '4:3' | '1:1';

export interface PepsEvent {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  kind: EventKind;
  status: EventStatus;
  venue: string;
  startsAt: string;
  endsAt?: string;
  cover: string;
  accent: string;
  liveUrl?: string;
  photoEventId?: string;
  tags: string[];
}

export interface Team {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  city: string;
  category: string;
  color: string;
  logo: string;
  photoCount: number;
  photoSources?: PhotoSource[];
}

export interface PhotoSource {
  eventId?: string;
  provider: PhotoProvider;
  url: string;
  label?: string;
  previewUrls?: string[];
  lastSyncedAt?: string;
  syncMode?: 'auto' | 'manual';
  syncStatus?: 'ready' | 'pending' | 'error';
  syncError?: string;
}

export interface PhotoAsset {
  id: string;
  photoEventId: string;
  teamSlug: string;
  image: string;
  label: string;
  capturedAt: string;
}

export interface PhotoEvent {
  id: string;
  eventId: string;
  title: string;
  status: Extract<EventStatus, 'draft' | 'published'>;
  dateLabel: string;
  location: string;
  cover: string;
  teamSlugs: string[];
  photoCount: number;
}

export interface MatchPair {
  id: string;
  photoEventId: string;
  teamAId: string;
  teamBId: string;
  label: string;
  photoSources?: PhotoSource[];
}

export interface PromoSlide {
  id: string;
  image: string;
  durationSeconds: number;
  aspectRatio: PromoAspectRatio;
}

export interface AppState {
  events: PepsEvent[];
  teams: Team[];
  photoEvents: PhotoEvent[];
  photos: PhotoAsset[];
  matchPairs: MatchPair[];
  promoSlides: PromoSlide[];
}

export interface EventDraft {
  title: string;
  subtitle: string;
  kind: EventKind;
  venue: string;
  startsAt: string;
  endsAt: string;
  liveUrl: string;
  tags: string;
}

export type ValidationErrors = Partial<Record<keyof EventDraft, string>>;
