import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  createEventFromDraft,
  eventKindLabel,
  eventStatusLabel,
  formatEventDate,
  matchPairExists,
  normalizeText,
  photoUploadStatus,
  photoUploadStatusLabel,
  photoUploadStatusTone,
  slugify,
  sortEventsByStartTime,
  validateEventDraft,
  validateImageUpload,
  validateImageUrl,
} from './lib/domain';
import { loadState, saveState } from './lib/storage';
import { auth, cloudStateNeedsBootstrap, firebaseEnabled, observeAuth, observeCloudState, persistCloudState, persistImage, signInAdmin, signOutAdmin } from './lib/firebase';
import { directImageUrl, isSafePhotoSourceUrl, limitPhotoPreviews, pairDisplayName, pairPreviewUrls, photoProviderLabel, photoSourcesForPair } from './lib/photoSources';
import { seedState } from './data';
import type { EventDraft, MatchPair, Page, PhotoAsset, PhotoEvent, PhotoProvider, PhotoSource, PhotoUploadStatus, PromoAspectRatio, PromoSlide, PepsEvent, Team, ValidationErrors } from './types';
import './styles.css';

const EMPTY_DRAFT: EventDraft = {
  title: '',
  subtitle: '',
  kind: 'live',
  venue: '',
  startsAt: '',
  endsAt: '',
  liveUrl: 'https://www.youtube.com/@PEPSLIVE',
  tags: 'LIVE, ฟุตบอล',
};

const PROMO_DURATION_MIN = 2;
const PROMO_DURATION_MAX = 60;

function normalizePromoDuration(value: number): number {
  if (!Number.isFinite(value)) return 6;
  return Math.min(PROMO_DURATION_MAX, Math.max(PROMO_DURATION_MIN, Math.round(value)));
}

function promoRatioCss(ratio: PromoAspectRatio = '16:9'): string {
  return ratio === '1:1' ? '1 / 1' : ratio === '4:3' ? '4 / 3' : '16 / 9';
}

function inferPromoAspectRatio(width: number, height: number): PromoAspectRatio {
  const ratio = width / Math.max(height, 1);
  if (Math.abs(ratio - 1) < .14) return '1:1';
  if (Math.abs(ratio - 4 / 3) < .16) return '4:3';
  return '16:9';
}

const PROMO_RATIOS: Array<{ value: PromoAspectRatio; label: string }> = [
  { value: '16:9', label: 'Wide 16:9' },
  { value: '4:3', label: 'Classic 4:3' },
  { value: '1:1', label: 'Square 1:1' },
];

function isPastEvent(event: PepsEvent, now = Date.now()): boolean {
  if (event.status === 'ended') return true;
  if (event.status === 'draft' || !event.endsAt) return false;
  const endsAt = new Date(event.endsAt).getTime();
  return Number.isFinite(endsAt) && endsAt < now;
}

function compactCount(value: number): string {
  if (value < 1000) return String(value);
  const compact = value / 1000;
  return `${compact.toFixed(compact >= 10 ? 0 : 1).replace(/\.0$/, '')}k`;
}

type Notice = { tone: 'success' | 'info'; message: string } | null;

function Icon({ name }: { name: 'arrow' | 'calendar' | 'camera' | 'check' | 'chevron' | 'close' | 'external' | 'home' | 'live' | 'menu' | 'play' | 'search' | 'settings' | 'spark' | 'trash' | 'users' }) {
  const paths: Record<typeof name, string> = {
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    calendar: 'M7 3v3m10-3v3M4.5 9.5h15M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
    camera: 'M4 8.5h3l1.4-2h3.2l1.4 2h3A1.5 1.5 0 0 1 17.5 10v7A1.5 1.5 0 0 1 16 18.5H4A1.5 1.5 0 0 1 2.5 17v-7A1.5 1.5 0 0 1 4 8.5Zm6 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    check: 'm5 12 4.5 4.5L19 7',
    chevron: 'm7 10 5 5 5-5',
    close: 'm6 6 12 12M18 6 6 18',
    external: 'M14 5h5v5m-1-4-8 8m-6 4h12a1 1 0 0 0 1-1v-7M5 5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h7',
    home: 'm3 10 9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z',
    live: 'M4 7.5a7 7 0 0 0 0 9M20 7.5a7 7 0 0 1 0 9M7.5 10.5a3 3 0 0 0 0 3M16.5 10.5a3 3 0 0 1 0 3M12 12v.01',
    menu: 'M4 6h16M4 12h16M4 18h16',
    play: 'm9 6 8 6-8 6V6Z',
    search: 'm20 20-4.5-4.5m2-5.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z',
    settings: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0-5 1 .2.5 2 1.6.7 1.8-.9 1.5 1.5.7 1.8-.9.7 1.6.5 2 1 0 1-2 .5-.7 1.6.9 1.8-1.5.7-1.5-1.5-1.6.7-.5 2-1 .2-1-.2-.5-2-1.6-.7-1.5 1.5-1.8-.7.9-1.8-.7-1.6-2-.5v-1l2-.5.7-1.6-.9-1.8 1.8-.7 1.5 1.5 1.6-.7.5-2 1-.2Z',
    spark: 'm12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Zm7 13 .5 2.5L22 19l-2.5.5L19 22l-.5-2.5L16 19l2.5-.5L19 16Z',
    trash: 'M5 7h14m-9 4v5m4-5v5M9 7V4h6v3m-8 0 .7 13h8.6L17 7',
    users: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20m6-9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm5-6.5a3.5 3.5 0 0 1 0 6.8m1 3.7h.5A3.5 3.5 0 0 1 20 18.5V20',
  };

  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function App() {
  const [state, setState] = useState(loadState);
  const [page, setPage] = useState<Page>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<PepsEvent | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [cloudStateReady, setCloudStateReady] = useState(!firebaseEnabled);
  const [authError, setAuthError] = useState('');
  const [cloudError, setCloudError] = useState('');
  const lastCloudStateFingerprint = useRef('');
  const cloudWriteQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => saveState(state), [state]);

  useEffect(() => observeAuth((user) => {
    setFirebaseUser(user);
    setAdminUnlocked(Boolean(user));
    setAuthError('');
  }), []);

  useEffect(() => {
    if (firebaseUser) lastCloudStateFingerprint.current = '';
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseEnabled) return undefined;
    setCloudStateReady(false);
    return observeCloudState((cloudState) => {
      const nextState = cloudState ?? seedState;
      lastCloudStateFingerprint.current = cloudStateNeedsBootstrap ? '' : JSON.stringify(nextState);
      setState(nextState);
      setCloudStateReady(true);
      setCloudError('');
    }, (error) => {
      setCloudStateReady(true);
      setCloudError(error.message || 'เชื่อมต่อ Firebase ไม่สำเร็จ');
    });
  }, []);

  useEffect(() => {
    if (!firebaseEnabled || !firebaseUser || !cloudStateReady) return;
    const fingerprint = JSON.stringify(state);
    if (fingerprint === lastCloudStateFingerprint.current) return;
    lastCloudStateFingerprint.current = fingerprint;
    cloudWriteQueue.current = cloudWriteQueue.current
      .catch(() => undefined)
      .then(() => persistCloudState(state))
      .catch((error: unknown) => {
        if (lastCloudStateFingerprint.current === fingerprint) lastCloudStateFingerprint.current = '';
        setCloudError(error instanceof Error ? error.message : 'บันทึกข้อมูลไป Firebase ไม่สำเร็จ');
      });
  }, [cloudStateReady, firebaseUser, state]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const navigate = (nextPage: Page) => {
    setPage(nextPage);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openPhotoMatch = (pairId?: string) => {
    setSelectedPairId(pairId ?? null);
    navigate('photos');
  };

  const deleteEvent = (eventId: string) => {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) return;
    const linkedPhotoEventIds = new Set(state.photoEvents.filter((item) => item.eventId === eventId).map((item) => item.id));
    setState((current) => ({
      ...current,
      events: current.events.filter((item) => item.id !== eventId),
      photoEvents: current.photoEvents.filter((item) => item.eventId !== eventId),
      photos: current.photos.filter((item) => !linkedPhotoEventIds.has(item.photoEventId)),
      matchPairs: current.matchPairs.filter((item) => !linkedPhotoEventIds.has(item.photoEventId)),
    }));
    if (selectedEvent?.id === eventId) setSelectedEvent(null);
    setNotice({ tone: 'success', message: `ลบงาน ${event.title} และข้อมูลที่เกี่ยวข้องแล้ว` });
  };

  const publishEvent = (eventId: string) => {
    if (eventId.startsWith('delete:')) {
      deleteEvent(eventId.slice('delete:'.length));
      return;
    }
    setState((current) => ({
      ...current,
      events: current.events.map((event) => event.id === eventId ? { ...event, status: 'published' } : event),
      photoEvents: current.photoEvents.map((photoEvent) => photoEvent.eventId === eventId ? { ...photoEvent, status: 'published' } : photoEvent),
    }));
    setNotice({ tone: 'success', message: 'เผยแพร่งานแล้ว — ผู้ชมจะเห็นงานนี้ในหน้าหลักทันที' });
  };

  const addEvent = async (draft: EventDraft, cover: string) => {
    const eventDraft = createEventFromDraft(draft, state.events.length, cover || state.events[0]?.cover || '');
    let persistedCover = eventDraft.cover;
    if (firebaseUser && firebaseEnabled && cover.startsWith('data:')) {
      try {
        persistedCover = await persistImage(cover, `covers/${eventDraft.id}/cover`);
      } catch (error: unknown) {
        setNotice({ tone: 'info', message: error instanceof Error ? error.message : 'อัปโหลด Cover ไป Firebase ไม่สำเร็จ' });
        return;
      }
    }
    const event = { ...eventDraft, status: 'published' as const, cover: persistedCover };
    const photoEventId = draft.kind === 'photo' ? `photo-${event.id}` : undefined;
    const nextEvent = photoEventId ? { ...event, photoEventId } : event;
    const photoEvent: PhotoEvent | null = photoEventId ? {
      id: photoEventId,
      eventId: event.id,
      title: event.title,
      status: 'published',
      dateLabel: new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(event.startsAt)),
      location: event.venue,
      cover: event.cover,
      teamSlugs: state.teams.map((team) => team.slug),
      photoCount: 0,
    } : null;
    setState((current) => ({ ...current, events: [nextEvent, ...current.events], photoEvents: photoEvent ? [photoEvent, ...current.photoEvents] : current.photoEvents }));
    setNotice({ tone: 'success', message: 'บันทึกและเผยแพร่งานแล้ว ผู้ชมจะเห็นงานนี้บนหน้าแรกทันที' });
  };

  const addMatchPair = (photoEventId: string, teamAName: string, teamBName: string): string | undefined => {
    const cleanTeamAName = teamAName.trim();
    const cleanTeamBName = teamBName.trim();
    if (!photoEventId || !cleanTeamAName || !cleanTeamBName) {
      setNotice({ tone: 'info', message: 'กรุณาใส่ชื่อทีมทั้งทีม A และทีม B ก่อนบันทึกคู่แข่งขัน' });
      return undefined;
    }
    if (normalizeText(cleanTeamAName) === normalizeText(cleanTeamBName)) {
      setNotice({ tone: 'info', message: 'ทีม A และทีม B ต้องเป็นคนละทีมกัน' });
      return undefined;
    }
    if (!state.photoEvents.some((photoEvent) => photoEvent.id === photoEventId)) return undefined;

    const timestamp = Date.now();
    const findTeam = (name: string) => state.teams.find((team) => normalizeText(team.name) === normalizeText(name));
    const createTeam = (name: string, index: number): Team => {
      const slug = slugify(name) || `team-${timestamp}-${index}`;
      const shortName = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 3).toUpperCase() || name.slice(0, 3).toUpperCase();
      return {
        id: `team-${slug}-${timestamp}`,
        slug,
        name,
        shortName,
        city: 'ไม่ระบุ',
        category: 'ทีมแข่งขัน',
        color: index === 1 ? '#76d7ff' : '#f6a7ff',
        logo: '',
        photoCount: 0,
        photoSources: [],
      };
    };
    const teamA = findTeam(cleanTeamAName) ?? createTeam(cleanTeamAName, 1);
    const teamB = findTeam(cleanTeamBName) ?? createTeam(cleanTeamBName, 2);
    if (matchPairExists(state.matchPairs, photoEventId, teamA.id, teamB.id)) {
      setNotice({ tone: 'info', message: 'คู่นี้มีอยู่แล้วใน Photo Event นี้' });
      return undefined;
    }
    const pairId = `match-pair-${timestamp}`;
    const pair: MatchPair = {
      id: pairId,
      photoEventId,
      teamAId: teamA.id,
      teamBId: teamB.id,
      label: `คู่ที่ ${state.matchPairs.filter((item) => item.photoEventId === photoEventId).length + 1}`,
    };
    const newTeams = [teamA, teamB].filter((team, index, items) => !state.teams.some((existing) => existing.id === team.id) && items.findIndex((item) => item.id === team.id) === index);
    setState((current) => ({
      ...current,
      teams: newTeams.length > 0 ? [...current.teams, ...newTeams] : current.teams,
      matchPairs: [...current.matchPairs, pair],
      photoEvents: current.photoEvents.map((photoEvent) => photoEvent.id === photoEventId
        ? { ...photoEvent, teamSlugs: Array.from(new Set([...photoEvent.teamSlugs, teamA.slug, teamB.slug])) }
        : photoEvent),
    }));
    setNotice({ tone: 'success', message: `เพิ่ม ${cleanTeamAName} VS ${cleanTeamBName} แล้ว` });
    return pairId;
  };

  const updateEventSchedule = (eventId: string, startsAt: string, endsAt: string) => {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
      setNotice({ tone: 'info', message: 'กรุณาตรวจสอบเวลาเริ่มและเวลาจบของตารางงาน' });
      return;
    }
    setState((current) => ({
      ...current,
      events: current.events.map((event) => event.id === eventId ? { ...event, startsAt: start.toISOString(), endsAt: end.toISOString() } : event),
    }));
    setNotice({ tone: 'success', message: 'อัปเดตตารางงานแล้ว' });
  };

  const updateMatchPairPhotoSource = (pairId: string, provider: PhotoProvider, url: string) => {
    const cleanedUrl = url.trim();
    if (cleanedUrl && !isSafePhotoSourceUrl(cleanedUrl)) {
      setNotice({ tone: 'info', message: 'ใช้ลิงก์ https จาก Google Drive หรือ Google Photos เท่านั้น' });
      return;
    }
    setState((current) => ({
      ...current,
      matchPairs: current.matchPairs.map((pair) => {
        if (pair.id !== pairId) return pair;
        const otherSources = (pair.photoSources ?? []).filter((source) => source.provider !== provider);
        const previewSource: PhotoSource = { provider, url: cleanedUrl };
        const directPreview = cleanedUrl ? directImageUrl(previewSource) : undefined;
        return {
          ...pair,
          photoSources: cleanedUrl ? [...otherSources, { provider, url: cleanedUrl, previewUrls: directPreview ? [directPreview] : undefined, syncMode: 'auto', syncStatus: directPreview ? 'ready' : 'pending' }] : otherSources,
        };
      }),
    }));
    setNotice({ tone: 'success', message: cleanedUrl ? 'บันทึกลิงก์รูปของคู่นี้แล้ว ระบบตั้งค่า sync อัตโนมัติไว้ให้' : 'ลบลิงก์รูปของคู่นี้แล้ว' });
  };

  const addPromoSlide = async (image: string, durationSeconds: number, aspectRatio: PromoAspectRatio) => {
    const cleanedImage = image.trim();
    if (!cleanedImage) {
      setNotice({ tone: 'info', message: 'กรุณาเลือกรูปหรือใส่ลิงก์รูปโปรโมทก่อนเพิ่มสไลด์' });
      return;
    }
    const slideId = `promo-slide-${Date.now()}`;
    let persistedImage = cleanedImage;
    if (firebaseUser && firebaseEnabled && cleanedImage.startsWith('data:')) {
      try {
        persistedImage = await persistImage(cleanedImage, `promo/${slideId}/image`);
      } catch (error: unknown) {
        setNotice({ tone: 'info', message: error instanceof Error ? error.message : 'อัปโหลดภาพโปรโมทไป Firebase ไม่สำเร็จ' });
        return;
      }
    }
    const slide: PromoSlide = {
      id: slideId,
      image: persistedImage,
      durationSeconds: normalizePromoDuration(durationSeconds),
      aspectRatio,
    };
    setState((current) => ({ ...current, promoSlides: [...(current.promoSlides ?? []), slide] }));
    setNotice({ tone: 'success', message: 'เพิ่มภาพโปรโมทลงสไลด์แล้ว' });
  };

  const updatePromoSlideDuration = (slideId: string, durationSeconds: number) => {
    setState((current) => ({
      ...current,
      promoSlides: current.promoSlides.map((slide) => slide.id === slideId ? { ...slide, durationSeconds: normalizePromoDuration(durationSeconds) } : slide),
    }));
  };

  const removePromoSlide = (slideId: string) => {
    setState((current) => ({ ...current, promoSlides: current.promoSlides.filter((slide) => slide.id !== slideId) }));
    setNotice({ tone: 'success', message: 'ลบภาพโปรโมทออกจากสไลด์แล้ว' });
  };

  const unlockAdmin = async (email: string, password: string) => {
    setAuthError('');
    if (!firebaseEnabled) {
      if (email.trim() && password.trim()) setAdminUnlocked(true);
      return;
    }
    try {
      await signInAdmin(email, password);
      setNotice({ tone: 'success', message: 'เข้าสู่ Firebase Admin แล้ว' });
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? 'อีเมลหรือรหัสผ่าน Firebase ไม่ถูกต้อง' : 'เข้าสู่ Firebase ไม่สำเร็จ');
    }
  };

  const lockAdmin = async () => {
    if (firebaseEnabled && auth) await signOutAdmin();
    setAdminUnlocked(false);
  };

  const publicEvents = sortEventsByStartTime(state.events.filter((event) => event.status !== 'draft'));

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container header-inner">
          <button className="brand" onClick={() => navigate('home')} aria-label="กลับหน้าหลัก PepsHub">
            <img className="brand-logo" src="/peps-hub-logo.png" alt="PEPS HUB" />
            <span className="brand-wordmark"><strong>Peps</strong><em>Hub</em></span>
          </button>
          <nav className={`main-nav ${mobileMenuOpen ? 'is-open' : ''}`} aria-label="เมนูหลัก">
            <button className={page === 'home' ? 'nav-link active' : 'nav-link'} onClick={() => navigate('home')}><Icon name="home" /> หน้าหลัก</button>
            <button className={page === 'photos' ? 'nav-link active' : 'nav-link'} onClick={() => openPhotoMatch()}><Icon name="camera" /> Photo Match</button>
            <button className={page === 'admin' ? 'nav-link active' : 'nav-link'} onClick={() => navigate('admin')}><Icon name="settings" /> หลังบ้าน</button>
          </nav>
          <div className="header-actions">
            <span className="mode-pill"><span className="mode-dot" /> {firebaseEnabled ? 'Firebase cloud' : 'Local mode'}</span>
            <button className="admin-shortcut" onClick={() => navigate('admin')}>จัดการงาน <Icon name="arrow" /></button>
            <button className="menu-toggle" onClick={() => setMobileMenuOpen((open) => !open)} aria-label="เปิดเมนู"><Icon name={mobileMenuOpen ? 'close' : 'menu'} /></button>
          </div>
        </div>
      </header>

      <main>
        {page === 'home' && <HomePage state={state} events={publicEvents} promoSlides={state.promoSlides} onOpenEvent={setSelectedEvent} onPhotoMatch={openPhotoMatch} />}
        {page === 'photos' && <PhotoMatchPage state={state} selectedPairId={selectedPairId} onSelectPair={setSelectedPairId} />}
        {page === 'admin' && <AdminPage state={state} unlocked={adminUnlocked} firebaseEnabled={firebaseEnabled} firebaseUser={firebaseUser} cloudStateReady={cloudStateReady} cloudError={cloudError} authError={authError} onUnlock={unlockAdmin} onSignOut={lockAdmin} onAddEvent={addEvent} onPublish={publishEvent} onUpdateMatchPairPhotoSource={updateMatchPairPhotoSource} onAddMatchPair={addMatchPair} onUpdateSchedule={updateEventSchedule} onAddPromoSlide={addPromoSlide} onUpdatePromoSlideDuration={updatePromoSlideDuration} onRemovePromoSlide={removePromoSlide} />}
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div><div className="footer-brand"><img className="footer-logo" src="/peps-hub-logo.png" alt="PEPS HUB" /><strong>PepsHub</strong></div><p>พื้นที่กลางสำหรับทุกการแข่งขัน ทุกภาพ และทุกโมเมนต์ของ PEPS LIVE</p></div>
          <div className="footer-meta"><span>Built for real event teams</span><span>Firebase cloud workspace</span></div>
        </div>
      </footer>

      {notice && <div className={`toast ${notice.tone}`} role="status"><span className="toast-icon"><Icon name={notice.tone === 'success' ? 'check' : 'spark'} /></span>{notice.message}</div>}
      {selectedEvent && <LiveModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </div>
  );
}

function HomePage({ state, events, promoSlides, onOpenEvent, onPhotoMatch }: { state: ReturnType<typeof loadState>; events: PepsEvent[]; promoSlides: PromoSlide[]; onOpenEvent: (event: PepsEvent) => void; onPhotoMatch: (teamSlug?: string) => void }) {
  const liveEvents = events.filter((event) => event.status === 'live' && !isPastEvent(event));
  const pastEvents = events.filter((event) => isPastEvent(event));
  const scheduleEvents = sortEventsByStartTime(events.filter((event) => event.status !== 'live' && event.kind === 'live' && !isPastEvent(event)));
  const photoEvent = events.find((event) => event.kind === 'photo');
  const linkedPreviewCount = new Set(state.matchPairs.flatMap((pair) => pairPreviewUrls(pair, state.teams, pair.photoEventId))).size;
  const availablePhotoCount = state.photos.length + linkedPreviewCount;

  return (
    <>
      <section className="hero-section">
        <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <img className="hero-logo" src="/peps-hub-logo.png" alt="PEPS HUB" />
            <div className="eyebrow"><span className="eyebrow-line" /> LIVE EXPERIENCE HUB</div>
            <h1>ทุกสนาม<br /><span>อยู่ในที่เดียว</span></h1>
            <p>ดูตารางการแข่งขัน กดดู Live และค้นหาภาพของทีมคุณได้ทันที — PepsHub ทำให้ทุกโมเมนต์หลังสนามไม่หลุดหาย</p>
            <div className="hero-actions"><button className="button primary" onClick={() => document.getElementById('schedule')?.scrollIntoView({ behavior: 'smooth' })}>ดูตารางงาน <Icon name="arrow" /></button><button className="button ghost" onClick={() => onPhotoMatch()}><Icon name="camera" /> ค้นหาภาพทีม</button></div>
            <div className="hero-proof"><div className="avatar-stack"><span>PU</span><span>NS</span><span>RC</span><span>+</span></div><span>ทีมกีฬาใช้ PepsHub<br /><strong>เพื่อเก็บทุกโมเมนต์</strong></span></div>
          </div>
          <div className="hero-visual"><PromoSlider slides={promoSlides} /></div>
        </div>
      </section>

      <section className="stats-strip"><div className="container stats-grid"><Stat label="รายการทั้งหมด" value={String(events.length)} suffix="งาน" icon="calendar" /><Stat label="กำลัง Live" value={String(liveEvents.length)} suffix="ตอนนี้" icon="live" accent /><Stat label="ทีมที่ค้นหาได้" value={String(state.teams.length)} suffix="ทีม" icon="users" /><Stat label="ภาพพร้อมส่งต่อ" value={compactCount(availablePhotoCount)} suffix="ภาพ" icon="camera" /></div></section>

      <section className="section container" id="schedule">
        <SectionHeading eyebrow="ON AIR NOW" title="กำลังเกิดขึ้น" description="เลือกดูการแข่งขันที่กำลังถ่ายทอดสดได้จากตรงนี้" action={liveEvents.length > 0 ? 'ดูทั้งหมด' : undefined} />
        {liveEvents.length > 0 ? <div className="event-grid live-grid">{liveEvents.map((event) => <EventCard key={event.id} event={event} onOpen={() => onOpenEvent(event)} onPhotoMatch={onPhotoMatch} featured /> )}</div> : <EmptyState title="ยังไม่มีรายการ Live ตอนนี้" description="แวะกลับมาใหม่เมื่อการแข่งขันเริ่มต้น" />}
      </section>

      <section className="section section-muted"><div className="container"><SectionHeading eyebrow="UP NEXT" title="ตารางงานถัดไป" description="วางแผนชมการแข่งขันครั้งต่อไปของคุณ" /><div className="schedule-list">{scheduleEvents.map((event) => <ScheduleRow key={event.id} event={event} onOpen={() => onOpenEvent(event)} />)}{scheduleEvents.length === 0 && <EmptyState title="ยังไม่มีงานถัดไป" description="ทีมงานกำลังอัปเดตตารางการแข่งขัน" />}</div></div></section>

      <section className="section past-events-section"><div className="container"><SectionHeading eyebrow="ARCHIVE" title="งานที่ผ่านไปแล้ว" description="ย้อนกลับมาดูรายละเอียดงานและช่วงเวลาที่ผ่านมาได้ทุกเมื่อ" /><div className="event-grid past-grid">{pastEvents.map((event) => <EventCard key={event.id} event={event} onOpen={() => onOpenEvent(event)} onPhotoMatch={onPhotoMatch} />)}{pastEvents.length === 0 && <EmptyState title="ยังไม่มีงานที่ผ่านมา" description="เมื่อมีงานที่จบแล้ว รายการจะปรากฏที่หน้านี้" />}</div></div></section>

      {photoEvent && <section className="photo-cta-section"><div className="container photo-cta"><div className="photo-cta-copy"><div className="eyebrow"><span className="eyebrow-line" /> FIND YOUR MOMENT</div><h2>ภาพของทีมคุณ<br /><span>อยู่ตรงนี้</span></h2><p>ไม่ต้องไล่ดูทีละภาพ แค่พิมพ์ชื่อทีม แล้วเจอโมเมนต์ของคุณในไม่กี่วินาที</p><button className="button light" onClick={() => onPhotoMatch()}><Icon name="search" /> เปิด Photo Match <Icon name="arrow" /></button></div><div className="photo-collage"><div className="collage-photo tall" style={{ backgroundImage: `url(${photoEvent.cover})` }} /><div className="collage-photo small-one" style={{ backgroundImage: `url(${photoEvent.cover})` }} /><div className="collage-note"><Icon name="spark" /><strong>{compactCount(availablePhotoCount)}</strong><span>ภาพที่พร้อมให้ค้นหา</span></div></div></div></section>}
    </>
  );
}

function PromoSlider({ slides }: { slides: PromoSlide[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length === 0) {
      setActiveIndex(0);
      return undefined;
    }
    if (activeIndex >= slides.length) setActiveIndex(0);
    if (slides.length <= 1) return undefined;
    const duration = normalizePromoDuration(slides[activeIndex]?.durationSeconds ?? 6) * 1000;
    const timer = window.setTimeout(() => setActiveIndex((current) => (current + 1) % slides.length), duration);
    return () => window.clearTimeout(timer);
  }, [activeIndex, slides]);

  if (slides.length === 0) return <div className="promo-slider promo-slider-empty" aria-label="ยังไม่มีภาพโปรโมท" />;

  const activeSlide = slides[activeIndex] ?? slides[0];
  const goTo = (index: number) => setActiveIndex((index + slides.length) % slides.length);

  return (
    <div className="promo-slider" aria-label="ภาพโปรโมท">
      <div className="promo-slider-frame" style={{ aspectRatio: promoRatioCss(activeSlide.aspectRatio) }}>
        {slides.map((slide, index) => <img className={'promo-slide ' + (index === activeIndex ? 'active' : '')} src={slide.image} alt="" aria-hidden={index !== activeIndex} key={slide.id} />)}
        {slides.length > 1 && <>
          <button className="promo-slider-arrow previous" type="button" onClick={() => goTo(activeIndex - 1)} aria-label="ภาพโปรโมทก่อนหน้า">‹</button>
          <button className="promo-slider-arrow next" type="button" onClick={() => goTo(activeIndex + 1)} aria-label="ภาพโปรโมทถัดไป">›</button>
        </>}
      </div>
      {slides.length > 1 && <div className="promo-slider-controls" aria-label="เลือกภาพโปรโมท">{slides.map((slide, index) => <button className={'promo-slider-dot ' + (index === activeIndex ? 'active' : '')} type="button" onClick={() => goTo(index)} aria-label={`เลือกภาพโปรโมทที่ ${index + 1}`} key={slide.id} />)}</div>}
    </div>
  );
}

function Stat({ label, value, suffix, icon, accent = false }: { label: string; value: string; suffix: string; icon: 'calendar' | 'camera' | 'live' | 'users'; accent?: boolean }) {
  return <div className={`stat-item ${accent ? 'accent' : ''}`}><span className="stat-icon"><Icon name={icon} /></span><div><span>{label}</span><strong>{value} <small>{suffix}</small></strong></div></div>;
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: string }) {
  return <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> {eyebrow}</div><h2>{title}</h2><p>{description}</p></div>{action && <button className="text-button">{action} <Icon name="arrow" /></button>}</div>;
}

function EventCard({ event, onOpen, onPhotoMatch, featured = false }: { event: PepsEvent; onOpen: () => void; onPhotoMatch: (teamSlug?: string) => void; featured?: boolean }) {
  const isPhoto = event.kind === 'photo';
  const isPast = isPastEvent(event);
  const isLiveNow = event.status === 'live' && !isPast;
  const statusLabel = isPast ? 'จบแล้ว' : eventStatusLabel(event.status);
  return <article className={`event-card ${featured ? 'featured' : ''}`}>
    <div className="event-cover" style={{ backgroundImage: `url(${event.cover})` }}><div className="cover-shade" /><div className="event-cover-top"><span className={`type-chip ${isLiveNow ? 'live' : ''}`}>{isLiveNow && <i />}{isPast ? 'PAST EVENT' : eventKindLabel(event.kind)}</span><span className="cover-menu">•••</span></div>{isLiveNow && <div className="equalizer"><i /><i /><i /><i /><i /></div>}</div>
    <div className="event-body"><div className="event-meta"><span><Icon name="calendar" /> {formatEventDate(event.startsAt)}</span><span><Icon name="settings" /> {statusLabel}</span></div><h3>{event.title}</h3><p>{event.subtitle}</p><div className="event-footer"><span className="venue">{event.venue}</span><button className="round-button" onClick={isPhoto ? () => onPhotoMatch() : onOpen} aria-label={isPhoto ? 'เปิด Photo Match' : isPast ? 'ดูรายละเอียดงานย้อนหลัง' : 'ดู Live'}>{isPhoto ? <Icon name="camera" /> : <Icon name="play" />}</button></div></div>
  </article>;
}

function ScheduleRow({ event, onOpen }: { event: PepsEvent; onOpen: () => void }) {
  const date = new Date(event.startsAt);
  return <article className="schedule-row"><div className="date-block"><strong>{new Intl.DateTimeFormat('th-TH', { day: '2-digit' }).format(date)}</strong><span>{new Intl.DateTimeFormat('th-TH', { month: 'short' }).format(date)}</span></div><div className="schedule-info"><div className="schedule-tags"><span className="soft-chip">{event.tags[0] || 'EVENT'}</span><span>{scheduleRange(event)}</span></div><h3>{event.title}</h3><p>{event.venue}</p></div><div className="schedule-action"><span className="status-dot" /> <span>{eventStatusLabel(event.status)}</span><button className="icon-button" onClick={onOpen} aria-label={`ดูรายละเอียด ${event.title}`}><Icon name="arrow" /></button></div></article>;
}

function PhotoMatchPage({ state, selectedPairId, onSelectPair }: { state: ReturnType<typeof loadState>; selectedPairId: string | null; onSelectPair: (id: string | null) => void }) {
  const [query, setQuery] = useState('');
  const [activePhoto, setActivePhoto] = useState<PhotoAsset | null>(null);
  const [selectedPhotoEventId, setSelectedPhotoEventId] = useState<string | null>(null);
  const photoEvent = state.photoEvents.find((event) => event.id === selectedPhotoEventId) ?? null;
  const eventPairs = useMemo(() => photoEvent ? state.matchPairs.filter((pair) => pair.photoEventId === photoEvent.id) : [], [photoEvent, state.matchPairs]);
  const pairRows = useMemo(() => eventPairs.map((pair) => {
    const sources = photoSourcesForPair(pair, state.teams, photoEvent?.id ?? '');
    const teamSlugs = new Set([pair.teamAId, pair.teamBId].map((teamId) => state.teams.find((team) => team.id === teamId)?.slug).filter((slug): slug is string => Boolean(slug)));
    const localPhotos = photoEvent
      ? state.photos.filter((photo) => photo.photoEventId === photoEvent.id && teamSlugs.has(photo.teamSlug))
      : [];
    return {
      pair,
      name: pairDisplayName(pair, state.teams),
      sources,
      previewUrls: pairPreviewUrls(pair, state.teams, photoEvent?.id ?? ''),
      localPhotos,
    };
  }), [eventPairs, photoEvent, state.photos, state.teams]);
  const selectedRow = pairRows.find((row) => row.pair.id === selectedPairId) ?? null;
  const matchedPairs = useMemo(() => {
    const term = normalizeText(query);
    if (!term) return pairRows;
    return pairRows.filter((row) => [row.name, row.pair.label].some((field) => normalizeText(field).includes(term)));
  }, [pairRows, query]);
  const displayEventStatus = photoEvent ? photoEventDisplayStatus(photoEvent, state) : 'empty';

  useEffect(() => {
    if (query && selectedPairId && !matchedPairs.some((row) => row.pair.id === selectedPairId)) onSelectPair(null);
  }, [matchedPairs, onSelectPair, query, selectedPairId]);

  if (!photoEvent) return <PhotoEventIndex state={state} onSelect={(eventId) => { setSelectedPhotoEventId(eventId); onSelectPair(null); setQuery(''); }} />;

  const visiblePreviewUrls = limitPhotoPreviews(selectedRow?.previewUrls ?? []);
  const visibleLocalPhotos = limitPhotoPreviews(selectedRow?.localPhotos ?? []);
  const hasPreview = visiblePreviewUrls.length > 0 || visibleLocalPhotos.length > 0;

  return (
    <section className="page-section photo-page">
      <div className="container">
        <div className="photo-workspace-head">
          <button className="back-link" onClick={() => { setSelectedPhotoEventId(null); onSelectPair(null); }}>← Photo Events ทั้งหมด</button>
          <div className="photo-workspace-title">
            <span className="soft-chip cyan">PHOTO EVENT</span>
            <h1>{photoEvent.title}</h1>
            <p><Icon name="calendar" /> {photoEvent.dateLabel} <span className="detail-divider" /> <Icon name="settings" /> {photoEvent.location}</p>
          </div>
          <div className={'photo-upload-status ' + photoUploadStatusTone(displayEventStatus)}>
            <span className="status-dot" />
            <strong>{photoUploadStatusLabel(displayEventStatus)}</strong>
            <small>{state.photos.filter((photo) => photo.photoEventId === photoEvent.id).length} ภาพในอีเว้นนี้ · {eventPairs.length} คู่แข่งขัน</small>
          </div>
        </div>
        <div className="photo-search-layout">
          <div className="team-search-panel">
            <div className="search-heading">
              <div><span className="eyebrow"><span className="eyebrow-line" /> SELECT YOUR MATCH</span><h2>ค้นหาคู่แข่งขัน</h2></div>
              <span className="result-count">{matchedPairs.length} คู่</span>
            </div>
            <label className="search-box">
              <Icon name="search" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="พิมพ์ชื่อทีมที่แข่งกัน เช่น PEPS UNITED VS RIVER CITY..." aria-label="ค้นหาคู่แข่งขัน" />
              {query && <button type="button" onClick={() => setQuery('')} aria-label="ล้างคำค้น"><Icon name="close" /></button>}
            </label>
            <div className="team-list">
              {matchedPairs.map((row) => {
                const pairNumber = eventPairs.findIndex((pair) => pair.id === row.pair.id) + 1;
                const previewCount = limitPhotoPreviews(row.previewUrls).length || limitPhotoPreviews(row.localPhotos).length;
                return (
                  <button className={'match-pair-public-row ' + (row.pair.id === selectedPairId ? 'selected' : '')} type="button" key={row.pair.id} onClick={() => onSelectPair(row.pair.id)}>
                    <span className="pair-order">{String(pairNumber).padStart(2, '0')}</span>
                    <span className="team-copy"><strong>{row.name}</strong><small>{previewCount > 0 ? previewCount + ' รูปตัวอย่าง' : row.sources.length > 0 ? 'รอ sync รูปตัวอย่าง' : 'ยังไม่มีแหล่งรูป'}</small></span>
                    <span className="team-count">{row.sources.length > 0 ? 'มีลิงก์' : '—'}</span>
                    <Icon name="arrow" />
                  </button>
                );
              })}
              {matchedPairs.length === 0 && <EmptyState title="ไม่พบคู่แข่งขันที่ค้นหา" description="ลองค้นด้วยชื่อทีมใดทีมหนึ่ง หรือกลับไปเลือก Photo Event อื่น" />}
            </div>
          </div>
          <div className="matched-panel">
            {selectedRow ? (
              <>
                <div className="matched-heading">
                  <button className="back-link" onClick={() => onSelectPair(null)}>← คู่แข่งขันทั้งหมด</button>
                  <span className={hasPreview ? 'soft-chip green' : 'soft-chip cyan'}>{hasPreview ? 'มีรูปตัวอย่างแล้ว' : 'รอรูปตัวอย่าง'}</span>
                  <h2>{selectedRow.name}</h2>
                  <p>{selectedRow.pair.label} · แสดงตัวอย่างไม่เกิน 6 รูป{selectedRow.localPhotos.length > 6 ? ' จากทั้งหมด ' + selectedRow.localPhotos.length + ' รูป' : ''}</p>
                  <PairSourceLinks sources={selectedRow.sources} />
                </div>
                {visiblePreviewUrls.length > 0 ? (
                  <div className="photo-preview-area">
                    <div className="photo-preview-meta">
                      <strong>รูปตัวอย่างของคู่นี้</strong>
                      <span>แสดง 6 รูปแรกจากแหล่งรูป · รูปเต็มเปิดจากลิงก์ข้างชื่อคู่</span>
                    </div>
                    <div className="photo-grid">
                      {visiblePreviewUrls.map((url, index) => <a className="photo-tile" href={url} target="_blank" rel="noreferrer" key={url}><img src={url} alt={selectedRow.name + ' รูปตัวอย่าง ' + (index + 1)} loading="lazy" /><span>{String(index + 1).padStart(2, '0')}</span></a>)}
                    </div>
                  </div>
                ) : visibleLocalPhotos.length > 0 ? (
                  <div className="photo-preview-area">
                    <div className="photo-preview-meta">
                      <strong>รูปตัวอย่างของคู่นี้</strong>
                      <span>แสดงไม่เกิน 6 รูปจากรูปที่อยู่ในระบบ</span>
                    </div>
                    <div className="photo-grid">
                      {visibleLocalPhotos.map((photo) => <button className="photo-tile" key={photo.id} onClick={() => setActivePhoto(photo)}><img src={photo.image} alt={selectedRow.name + ' ' + photo.label} /><span>{photo.capturedAt}</span></button>)}
                    </div>
                  </div>
                ) : (
                  <PairPhotoEmpty sources={selectedRow.sources} />
                )}
              </>
            ) : (
              <div className="match-empty">
                <div className="match-empty-icon"><Icon name="camera" /></div>
                <h2>เลือกคู่แข่งขันเพื่อดูรูป</h2>
                <p>เลือกคู่จากรายการด้านซ้าย แล้วระบบจะแสดงรูปตัวอย่างสูงสุด 6 รูป<br />พร้อมทางเข้าไปดูรูปเต็มจากแหล่งต้นทาง</p>
                <div className="mini-steps"><span><b>01</b> เลือก Photo Event</span><span><b>02</b> เลือกคู่แข่งขัน</span><span><b>03</b> ดูรูปตัวอย่าง</span></div>
              </div>
            )}
          </div>
        </div>
      </div>
      {activePhoto && <PairPhotoLightbox photo={activePhoto} title={selectedRow?.name} onClose={() => setActivePhoto(null)} />}
    </section>
  );
}

function PairSourceLinks({ sources }: { sources: PhotoSource[] }) {
  if (sources.length === 0) return <div className="matched-source muted"><span><Icon name="camera" /> ยังไม่มีลิงก์รูปของคู่นี้</span></div>;
  return <div className="matched-source prominent"><span className="matched-source-label"><Icon name="external" /> แหล่งรูปของคู่แข่งขัน</span><div className="matched-source-actions">{sources.map((source) => <PhotoSourceLink key={source.provider} source={source} label={sources.length > 1 ? `ดูรูปเต็มได้ที่นี่ · ${photoProviderLabel(source.provider)}` : 'ดูรูปเต็มได้ที่นี่'} className="photo-source-cta" />)}</div></div>;
}

function PairPhotoEmpty({ sources }: { sources: PhotoSource[] }) {
  return <div className="team-photo-empty"><div className="match-empty-icon"><Icon name="camera" /></div><h3>{sources.length > 0 ? 'มีลิงก์รูปแล้ว กำลังรอรูปตัวอย่าง' : 'ยังไม่มีรูปของคู่นี้ในอีเว้นนี้'}</h3><p>{sources.length > 0 ? 'ระบบจะแสดงรูปตัวอย่างอัตโนมัติไม่เกิน 6 รูปเมื่อการ sync เสร็จ รูปเต็มเปิดจากลิงก์ข้างชื่อคู่ได้เลย' : 'ทีมงานยังไม่ได้ผูกลิงก์รูปให้คู่นี้'}</p>{sources.map((source) => <PhotoSourceLink key={source.provider} source={source} label="ดูรูปเต็มได้ที่นี่" className="button ghost" />)}</div>;
}

function PairPhotoLightbox({ photo, title, onClose }: { photo: PhotoAsset; title?: string; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="ดูรูปการแข่งขัน"><button className="modal-close" onClick={onClose} aria-label="ปิด"><Icon name="close" /></button><img src={photo.image} alt={title ? title + ' ' + photo.label : photo.label} /><div className="lightbox-caption"><strong>{title}</strong><span>{photo.label} · {photo.capturedAt}</span></div></div></div>;
}

function photoEventDisplayStatus(event: PhotoEvent, state: ReturnType<typeof loadState>): PhotoUploadStatus {
  const baseStatus = photoUploadStatus(event, state.photos);
  if (baseStatus !== 'empty') return baseStatus;
  const pairSources = state.matchPairs
    .filter((pair) => pair.photoEventId === event.id)
    .flatMap((pair) => photoSourcesForPair(pair, state.teams, event.id));
  if (pairSources.some((source) => source.syncStatus === 'ready' || (source.previewUrls?.length ?? 0) > 0)) return 'ready';
  return pairSources.length > 0 ? 'partial' : 'empty';
}

function PhotoEventIndex({ state, onSelect }: { state: ReturnType<typeof loadState>; onSelect: (eventId: string) => void }) {
  const visiblePhotoEvents = state.photoEvents.filter((event) => event.status === 'published');
  const readyCount = visiblePhotoEvents.filter((event) => photoEventDisplayStatus(event, state) === 'ready').length;
  return <section className="page-section photo-page"><div className="container"><div className="page-hero photo-event-index-hero"><div className="eyebrow"><span className="eyebrow-line" /> PHOTO MATCH</div><h1>เลือกอีเว้นก่อน<br /><span>แล้วค่อยเจอภาพของคุณ</span></h1><p>ดูรายการ Photo Event ทั้งหมด พร้อมสถานะว่าลงรูปแล้วหรือยัง จากนั้นเลือกอีเว้นเพื่อค้นหาคู่แข่งขัน</p></div><div className="photo-event-stats"><div><strong>{visiblePhotoEvents.length}</strong><span>อีเว้นที่เปิดให้ค้นหา</span></div><div><strong>{readyCount}</strong><span>อีเว้นที่ลงรูปแล้ว</span></div><div><strong>{state.photos.length}</strong><span>ภาพในระบบตอนนี้</span></div></div><div className="photo-event-grid">{visiblePhotoEvents.map((event) => <PhotoEventCard key={event.id} event={event} state={state} onSelect={() => onSelect(event.id)} />)}{visiblePhotoEvents.length === 0 && <EmptyState title="ยังไม่มี Photo Event" description="ทีมงานยังไม่ได้เผยแพร่อีเว้นสำหรับค้นหารูป" />}</div></div></section>;
}

function PhotoEventCard({ event, state, onSelect }: { event: PhotoEvent; state: ReturnType<typeof loadState>; onSelect: () => void }) {
  const status = photoEventDisplayStatus(event, state);
  const linkedPairs = state.matchPairs.filter((pair) => pair.photoEventId === event.id && photoSourcesForPair(pair, state.teams, event.id).length > 0).length;
  const photoCount = state.photos.filter((photo) => photo.photoEventId === event.id).length;
  return <article className="photo-event-card"><div className="photo-event-card-cover" style={{ backgroundImage: `url(${event.cover})` }}><span className="soft-chip cyan">PHOTO EVENT</span><span className={`event-status-chip ${photoUploadStatusTone(status)}`}><i /> {photoUploadStatusLabel(status)}</span></div><div className="photo-event-card-body"><div className="photo-event-card-meta"><span><Icon name="calendar" /> {event.dateLabel}</span><span><Icon name="camera" /> {photoCount} ภาพ</span></div><h2>{event.title}</h2><p><Icon name="settings" /> {event.location}</p><div className="photo-event-card-footer"><span>{linkedPairs > 0 ? `${linkedPairs} คู่มีแหล่งรูป` : 'ค้นหาคู่แข่งขันจากอีเว้นนี้'}</span><button className="button primary" onClick={onSelect}>เลือกอีเว้น <Icon name="arrow" /></button></div></div></article>;
}

function PhotoSourceLink({ source, label = 'ดูรูปเต็มได้ที่นี่', className = 'photo-source-link' }: { source: PhotoSource; label?: string; className?: string }) {
  return <a className={className} href={source.url} target="_blank" rel="noreferrer" aria-label={`${label} (${photoProviderLabel(source.provider)})`}>{label} <Icon name="external" /></a>;
}


function AdminPage({ state, unlocked, firebaseEnabled, firebaseUser, cloudStateReady, cloudError, authError, onUnlock, onSignOut, onAddEvent, onPublish, onUpdateMatchPairPhotoSource, onAddMatchPair, onUpdateSchedule, onAddPromoSlide, onUpdatePromoSlideDuration, onRemovePromoSlide }: { state: ReturnType<typeof loadState>; unlocked: boolean; firebaseEnabled: boolean; firebaseUser: User | null; cloudStateReady: boolean; cloudError: string; authError: string; onUnlock: (email: string, password: string) => Promise<void>; onSignOut: () => Promise<void>; onAddEvent: (draft: EventDraft, cover: string) => Promise<void>; onPublish: (eventId: string) => void; onUpdateMatchPairPhotoSource: (pairId: string, provider: PhotoProvider, url: string) => void; onAddMatchPair: (photoEventId: string, teamAName: string, teamBName: string) => string | undefined; onUpdateSchedule: (eventId: string, startsAt: string, endsAt: string) => void; onAddPromoSlide: (image: string, durationSeconds: number, aspectRatio: PromoAspectRatio) => Promise<void>; onUpdatePromoSlideDuration: (slideId: string, durationSeconds: number) => void; onRemovePromoSlide: (slideId: string) => void }) {
  if (!unlocked) return <AdminGate firebaseEnabled={firebaseEnabled} error={authError} onUnlock={onUnlock} />;
  return <AdminDashboard state={state} firebaseUser={firebaseUser} cloudStateReady={cloudStateReady} cloudError={cloudError} onSignOut={onSignOut} onAddEvent={onAddEvent} onPublish={onPublish} onUpdateMatchPairPhotoSource={onUpdateMatchPairPhotoSource} onAddMatchPair={onAddMatchPair} onUpdateSchedule={onUpdateSchedule} onAddPromoSlide={onAddPromoSlide} onUpdatePromoSlideDuration={onUpdatePromoSlideDuration} onRemovePromoSlide={onRemovePromoSlide} />;
}

function AdminGate({ firebaseEnabled, error, onUnlock }: { firebaseEnabled: boolean; error: string; onUnlock: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!email.trim() || !password.trim()) return; setBusy(true); await onUnlock(email, password); setBusy(false); };
  return <section className="page-section admin-page"><div className="container narrow"><div className="admin-gate"><div className="gate-mark"><Icon name="settings" /></div><div className="eyebrow"><span className="eyebrow-line" /> ADMIN WORKSPACE</div><h1>จัดการงาน<br /><span>ของ PepsHub</span></h1><p>{firebaseEnabled ? 'เข้าสู่ระบบ Firebase เพื่อจัดการข้อมูลร่วมกันจากทุกเครื่อง' : 'เข้าสู่หลังบ้านเพื่อสร้างงาน อัปโหลด Cover และเผยแพร่ตารางให้ผู้ชม'}</p><form onSubmit={submit} className="login-form"><label>อีเมลผู้ดูแล<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" /></label><label>รหัสผ่าน<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={firebaseEnabled ? 'รหัสผ่าน Firebase Authentication' : 'ใส่รหัสสำหรับ Local Demo'} autoComplete="current-password" /></label>{error && <div className="form-error">{error}</div>}<button className="button primary wide" type="submit" disabled={busy}>{busy ? 'กำลังตรวจสอบ...' : firebaseEnabled ? 'เข้าสู่ Firebase Admin' : 'เข้าสู่ Local Demo'} <Icon name="arrow" /></button></form><div className="local-warning"><Icon name="spark" /><span>{firebaseEnabled ? 'ข้อมูลจะถูกบันทึกใน Firestore และรูปที่อัปโหลดจะเก็บใน Firebase Storage' : 'โหมดนี้ใช้ข้อมูลในเครื่องเท่านั้น สำหรับ production ให้ใส่ Firebase Web config ในไฟล์ .env.local'}</span></div></div></div></section>;
}

type AdminSection = 'overview' | 'events' | 'schedule' | 'matches' | 'promos';

function AdminDashboard({ state, firebaseUser, cloudStateReady, cloudError, onSignOut, onAddEvent, onPublish, onUpdateMatchPairPhotoSource, onAddMatchPair, onUpdateSchedule, onAddPromoSlide, onUpdatePromoSlideDuration, onRemovePromoSlide }: { state: ReturnType<typeof loadState>; firebaseUser: User | null; cloudStateReady: boolean; cloudError: string; onSignOut: () => Promise<void>; onAddEvent: (draft: EventDraft, cover: string) => Promise<void>; onPublish: (eventId: string) => void; onUpdateMatchPairPhotoSource: (pairId: string, provider: PhotoProvider, url: string) => void; onAddMatchPair: (photoEventId: string, teamAName: string, teamBName: string) => string | undefined; onUpdateSchedule: (eventId: string, startsAt: string, endsAt: string) => void; onAddPromoSlide: (image: string, durationSeconds: number, aspectRatio: PromoAspectRatio) => Promise<void>; onUpdatePromoSlideDuration: (slideId: string, durationSeconds: number) => void; onRemovePromoSlide: (slideId: string) => void }) {
  const [section, setSection] = useState<AdminSection>('overview');
  const sections: Array<{ id: AdminSection; label: string; icon: 'home' | 'calendar' | 'camera' | 'users' }> = [
    { id: 'overview', label: 'ภาพรวม', icon: 'home' },
    { id: 'events', label: 'งานและอีเว้น', icon: 'calendar' },
    { id: 'schedule', label: 'ตารางงาน', icon: 'calendar' },
    { id: 'matches', label: 'คู่แข่งขันและรูป', icon: 'users' },
    { id: 'promos', label: 'ภาพโปรโมท', icon: 'camera' },
  ];

  return (
    <section className="page-section admin-page">
      <div className="container">
        <div className="admin-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> ADMIN WORKSPACE</div>
            <h1>หลังบ้าน <span>PepsHub</span></h1>
            <p>แบ่งการทำงานเป็นหมวด เพื่อจัดการได้เร็วและไม่ต้องเลื่อนหาฟอร์มยาว ๆ</p>
          </div>
          <div className="admin-session"><span className="local-session"><span className="mode-dot" /> {firebaseUser ? firebaseUser.email : 'Local Demo session'}</span><button className="admin-signout" type="button" onClick={() => { void onSignOut(); }}>{firebaseUser ? 'ออกจากระบบ' : 'ออกจากโหมดจัดการ'}</button></div>
        </div>
        <div className={`cloud-status ${cloudError ? 'error' : cloudStateReady ? 'ready' : 'loading'}`}><span className="status-dot" /> {cloudError ? cloudError : cloudStateReady ? firebaseUser ? 'เชื่อมต่อ Firestore แล้ว · บันทึกข้ามเครื่อง' : 'ข้อมูลพร้อมใช้งาน' : 'กำลังเชื่อมต่อ Firebase...'}</div>
        <div className="admin-stats">
          <AdminStat label="งานทั้งหมด" value={String(state.events.length)} />
          <AdminStat label="เผยแพร่แล้ว" value={String(state.events.filter((event) => event.status === 'published' || event.status === 'live').length)} />
          <AdminStat label="แบบร่าง" value={String(state.events.filter((event) => event.status === 'draft').length)} />
          <AdminStat label="Photo Event" value={String(state.photoEvents.length)} />
        </div>
        <nav className="admin-tabs" aria-label="หมวดหลังบ้าน">
          {sections.map((item) => <button className={'admin-tab ' + (section === item.id ? 'active' : '')} type="button" key={item.id} onClick={() => setSection(item.id)}><Icon name={item.icon} /><span>{item.label}</span></button>)}
        </nav>
        <div className="admin-section-content">
          {section === 'overview' && <AdminOverview state={state} onNavigate={setSection} />}
          {section === 'events' && <div className="admin-grid"><CreateEventForm onAddEvent={onAddEvent} /><EventManager events={state.events} onPublish={onPublish} /></div>}
          {section === 'schedule' && <ScheduleManager events={state.events} onUpdateSchedule={onUpdateSchedule} />}
          {section === 'matches' && <MatchSourceManager teams={state.teams} photoEvents={state.photoEvents} matchPairs={state.matchPairs} onSavePairSource={onUpdateMatchPairPhotoSource} onAddPair={onAddMatchPair} />}
          {section === 'promos' && <PromoSlideManager slides={state.promoSlides} onAdd={onAddPromoSlide} onUpdateDuration={onUpdatePromoSlideDuration} onRemove={onRemovePromoSlide} />}
        </div>
      </div>
    </section>
  );
}

function AdminOverview({ state, onNavigate }: { state: ReturnType<typeof loadState>; onNavigate: (section: AdminSection) => void }) {
  const nextEvent = sortEventsByStartTime(state.events)[0];
  const publishedPhotoEvents = state.photoEvents.filter((event) => event.status === 'published');
  return <div className="admin-overview"><div className="admin-overview-banner"><div><span className="eyebrow"><span className="eyebrow-line" /> QUICK CONTROL</span><h2>วันนี้จะจัดการอะไร?</h2><p>เลือกหมวดที่ต้องการ แล้วทำงานเฉพาะส่วนได้ทันที</p></div><span className="admin-overview-badge"><Icon name="spark" /> {state.matchPairs.length} คู่แข่งขัน</span></div><div className="admin-quick-grid"><button className="admin-quick-card" type="button" onClick={() => onNavigate('events')}><span className="admin-quick-icon"><Icon name="calendar" /></span><span><strong>สร้างงานใหม่</strong><small>ใส่ Cover และเวลาเริ่ม–จบ</small></span><Icon name="arrow" /></button><button className="admin-quick-card" type="button" onClick={() => onNavigate('schedule')}><span className="admin-quick-icon cyan"><Icon name="calendar" /></span><span><strong>จัดตารางงาน</strong><small>แก้เวลาเริ่ม–จบในกระดานเดียว</small></span><Icon name="arrow" /></button><button className="admin-quick-card" type="button" onClick={() => onNavigate('matches')}><span className="admin-quick-icon purple"><Icon name="users" /></span><span><strong>เพิ่มคู่แข่งขัน</strong><small>ทีม A VS ทีม B และลิงก์รูปของคู่นี้</small></span><Icon name="arrow" /></button><button className="admin-quick-card" type="button" onClick={() => onNavigate('promos')}><span className="admin-quick-icon cyan"><Icon name="camera" /></span><span><strong>ภาพโปรโมท</strong><small>เพิ่มสไลด์ 16:9, 4:3 หรือ 1:1</small></span><Icon name="arrow" /></button></div><div className="admin-overview-grid"><div className="admin-summary-card"><span className="eyebrow"><span className="eyebrow-line" /> NEXT ON BOARD</span><h3>{nextEvent?.title ?? 'ยังไม่มีงานในระบบ'}</h3><p>{nextEvent ? `${scheduleRange(nextEvent)} · ${nextEvent.venue}` : 'ไปที่ งานและอีเว้น เพื่อสร้างรายการแรก'}</p></div><div className="admin-summary-card"><span className="eyebrow"><span className="eyebrow-line" /> PHOTO MATCH</span><h3>{publishedPhotoEvents.length} อีเว้นพร้อมให้ค้นหา</h3><p>{state.matchPairs.length > 0 ? 'คู่แข่งขันถูกแยกตามอีเว้นแล้ว ผู้ชมจะเลือกอีเว้นก่อนค้นหาคู่' : 'เพิ่มคู่แข่งขันเพื่อเริ่มจัดกลุ่มและผูกแหล่งรูป'}</p></div></div></div>;
}

function PromoSlideManager({ slides, onAdd, onUpdateDuration, onRemove }: { slides: PromoSlide[]; onAdd: (image: string, durationSeconds: number, aspectRatio: PromoAspectRatio) => Promise<void>; onUpdateDuration: (slideId: string, durationSeconds: number) => void; onRemove: (slideId: string) => void }) {
  const [imagePreview, setImagePreview] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [duration, setDuration] = useState('6');
  const [aspectRatio, setAspectRatio] = useState<PromoAspectRatio>('16:9');
  const [error, setError] = useState('');

  const uploadImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const nextError = validateImageUpload(file);
    setError(nextError ?? '');
    if (nextError) {
      setImagePreview('');
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setImagePreview(result);
      setImageUrl('');
      setError('');
      const image = new Image();
      image.onload = () => setAspectRatio(inferPromoAspectRatio(image.naturalWidth, image.naturalHeight));
      image.src = result;
    });
    reader.readAsDataURL(file);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const source = imagePreview || imageUrl.trim();
    const urlError = imagePreview ? null : validateImageUrl(imageUrl);
    if (!source) {
      setError('เลือกรูปหรือใส่ลิงก์รูปโปรโมทก่อน');
      return;
    }
    if (urlError) {
      setError(urlError);
      return;
    }
    await onAdd(source, Number(duration), aspectRatio);
    setImagePreview('');
    setImageUrl('');
    setDuration('6');
    setAspectRatio('16:9');
    setError('');
  };

  return (
    <section className="promo-manager">
      <div className="card-heading">
        <div><span className="eyebrow"><span className="eyebrow-line" /> PROMO SLIDER</span><h2>ภาพโปรโมทหน้าแรก</h2></div>
        <span className="source-security-chip">16:9 · 4:3 · 1:1 · {slides.length} สไลด์</span>
      </div>
      <p className="source-manager-intro">เพิ่มภาพโปรโมทได้ทั้งจากไฟล์ในเครื่องหรือลิงก์ภาพที่ฝากไว้ ระบบจะแสดงเฉพาะรูปบนหน้าแรก ไม่แสดงชื่อไฟล์หรือลิงก์ และจะเลื่อนอัตโนมัติตามเวลาที่ตั้งไว้</p>
      <div className="promo-manager-layout">
        <form className="promo-add-card" onSubmit={submit}>
          <label className={'promo-upload-box ' + (imagePreview ? 'has-preview' : '')} style={{ aspectRatio: promoRatioCss(aspectRatio), ...(imagePreview ? { backgroundImage: `url(${imagePreview})` } : {}) }}>
            <input type="file" accept="image/*" onChange={uploadImage} />
            {!imagePreview && <><span className="promo-upload-icon"><Icon name="camera" /></span><strong>อัปโหลดภาพโปรโมท</strong><small>รองรับ 16:9 · 4:3 · 1:1 · ไม่เกิน 5 MB</small></>}
            {imagePreview && <span className="promo-upload-change">เลือกรูปใหม่</span>}
          </label>
          <Field label="หรือลิงก์ภาพโปรโมท" error={error}><input type="url" value={imageUrl} onChange={(event) => { setImageUrl(event.target.value); setImagePreview(''); setError(''); }} placeholder="https://.../promo-image.jpg" /></Field>
          <Field label="อัตราส่วนภาพ"><select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as PromoAspectRatio)}>{PROMO_RATIOS.map((ratio) => <option key={ratio.value} value={ratio.value}>{ratio.label}</option>)}</select></Field>
          <div className="promo-duration-row"><Field label="เวลาค้างต่อภาพ (วินาที)"><input type="number" min={PROMO_DURATION_MIN} max={PROMO_DURATION_MAX} value={duration} onChange={(event) => setDuration(event.target.value)} /></Field><span className="promo-duration-hint">ตั้งได้ {PROMO_DURATION_MIN}–{PROMO_DURATION_MAX} วินาที</span></div>
          <button className="button primary wide" type="submit">เพิ่มลงสไลด์ <Icon name="check" /></button>
        </form>
        <div className="promo-slide-list">
          <div className="promo-list-heading"><strong>ลำดับภาพสไลด์</strong><span>ลากสายตาดูตัวอย่างได้จากภาพเท่านั้น</span></div>
          {slides.length > 0 ? slides.map((slide, index) => <div className="promo-slide-row" key={slide.id}>
            <div className="promo-slide-thumb" style={{ aspectRatio: promoRatioCss(slide.aspectRatio) }}><img src={slide.image} alt={`ตัวอย่างสไลด์ ${index + 1}`} /></div>
            <div className="promo-slide-info"><strong>สไลด์ {String(index + 1).padStart(2, '0')}</strong><small>{slide.aspectRatio} · ภาพจะแสดงบนหน้าแรก</small></div>
            <label className="promo-slide-duration"><span>ค้าง</span><input type="number" min={PROMO_DURATION_MIN} max={PROMO_DURATION_MAX} value={slide.durationSeconds} onChange={(event) => onUpdateDuration(slide.id, Number(event.target.value))} /><span>วิ</span></label>
            <button className="promo-remove" type="button" onClick={() => onRemove(slide.id)} aria-label={`ลบสไลด์ ${index + 1}`}><Icon name="close" /></button>
          </div>) : <div className="promo-empty"><Icon name="camera" /><span>ยังไม่มีภาพโปรโมท เพิ่มภาพแรกจากช่องด้านซ้าย</span></div>}
        </div>
      </div>
    </section>
  );
}

function MatchSourceManager({ teams, photoEvents, matchPairs, onSavePairSource, onAddPair }: { teams: Team[]; photoEvents: PhotoEvent[]; matchPairs: MatchPair[]; onSavePairSource: (pairId: string, provider: PhotoProvider, url: string) => void; onAddPair: (photoEventId: string, teamAName: string, teamBName: string) => string | undefined }) {
  const managedPhotoEvents = photoEvents;
  const [selectedEventId, setSelectedEventId] = useState(managedPhotoEvents[0]?.id ?? '');
  const [selectedPairId, setSelectedPairId] = useState(matchPairs.find((pair) => pair.photoEventId === managedPhotoEvents[0]?.id)?.id ?? '');
  const [teamAName, setTeamAName] = useState('');
  const [teamBName, setTeamBName] = useState('');
  const selectedEvent = managedPhotoEvents.find((event) => event.id === selectedEventId);
  const eventPairs = matchPairs.filter((pair) => pair.photoEventId === selectedEventId);
  const selectedPair = eventPairs.find((pair) => pair.id === selectedPairId) ?? eventPairs[0];

  const changeEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    setSelectedPairId(matchPairs.find((pair) => pair.photoEventId === eventId)?.id ?? '');
  };

  const submitPair = (event: FormEvent) => {
    event.preventDefault();
    const pairId = onAddPair(selectedEventId, teamAName, teamBName);
    if (!pairId) return;
    setSelectedPairId(pairId);
    setTeamAName('');
    setTeamBName('');
  };

  return (
    <div className="team-source-manager">
      <div className="card-heading">
        <div><span className="eyebrow"><span className="eyebrow-line" /> MATCH SOURCES</span><h2>คู่แข่งขันและแหล่งรูป</h2></div>
        <span className="source-security-chip">Google only</span>
      </div>
      <p className="source-manager-intro">เพิ่มชื่อทีม 2 ทีมเป็นคู่เดียว เช่น ทีม A VS ทีม C จากนั้นผูกลิงก์รูปของคู่นี้ได้ทั้ง Google Drive และ Google Photos</p>
      <div className="match-pair-create">
        <div className="card-heading">
          <div><span className="eyebrow"><span className="eyebrow-line" /> ADD MATCH PAIR</span><h3>เพิ่มคู่แข่งขัน</h3></div>
          <span className="result-count">{eventPairs.length} คู่ในอีเว้นนี้</span>
        </div>
        <form className="match-pair-form" onSubmit={submitPair}>
          <Field label="Photo Event"><select value={selectedEventId} onChange={(event) => changeEvent(event.target.value)}>{managedPhotoEvents.map((photoEvent) => <option key={photoEvent.id} value={photoEvent.id}>{photoEvent.title}{photoEvent.status === 'draft' ? ' · Draft' : ''}</option>)}</select></Field>
          <Field label="ทีม A"><input list="photo-match-team-names" value={teamAName} onChange={(event) => setTeamAName(event.target.value)} placeholder="เช่น PEPS UNITED" /></Field>
          <span className="match-pair-vs" aria-hidden="true">VS</span>
          <Field label="ทีม B"><input list="photo-match-team-names" value={teamBName} onChange={(event) => setTeamBName(event.target.value)} placeholder="เช่น RIVER CITY" /></Field>
          <button className="button primary" type="submit">เพิ่มคู่ <Icon name="users" /></button>
        </form>
        <small className="form-help">กรอกเฉพาะชื่อทีมที่แข่งกัน ระบบจะสร้างคู่ที่มีลำดับให้อัตโนมัติ</small>
        <datalist id="photo-match-team-names">{teams.map((team) => <option key={team.id} value={team.name} />)}</datalist>
      </div>
      <div className="match-pair-list">
        <div className="card-heading">
          <div><span className="eyebrow"><span className="eyebrow-line" /> MATCH LIST</span><h3>คู่ที่มีอยู่ในอีเว้น</h3></div>
          <span className="result-count">{eventPairs.length} คู่</span>
        </div>
        {eventPairs.length > 0 ? eventPairs.map((pair) => <button className={'match-pair-row ' + (selectedPair?.id === pair.id ? 'selected' : '')} type="button" key={pair.id} onClick={() => setSelectedPairId(pair.id)}>
          <span className="match-pair-label">{pair.label}</span>
          <strong>{pairDisplayName(pair, teams)}</strong>
          <span className="pair-source-count">{(pair.photoSources ?? []).length > 0 ? 'มีแหล่งรูป' : 'ยังไม่ผูกลิงก์'}</span>
          <Icon name="chevron" />
        </button>) : <EmptyState title="ยังไม่มีคู่แข่งขันในอีเว้นนี้" description="ใส่ชื่อทีม A และทีม B ด้านบนเพื่อเริ่มจับคู่" />}
      </div>
      {selectedEvent && selectedPair ? (
        <div className="pair-source-section">
          <div className="card-heading">
            <div><span className="eyebrow"><span className="eyebrow-line" /> PHOTO SOURCES</span><h3>{selectedPair.label}: {pairDisplayName(selectedPair, teams)}</h3></div>
            <span className="source-security-chip">ระดับคู่แข่งขัน</span>
          </div>
          <p className="source-manager-intro">วางลิงก์โฟลเดอร์หรืออัลบั้มของคู่นี้ ระบบจะแสดงตัวอย่างไม่เกิน 6 รูป และตั้งค่า sync อัตโนมัติไว้ให้</p>
          <div className="pair-source-grid">
            <PairSourceCard pair={selectedPair} provider="google-drive" source={(selectedPair.photoSources ?? []).find((item) => item.provider === 'google-drive')} onSave={onSavePairSource} />
            <PairSourceCard pair={selectedPair} provider="google-photos" source={(selectedPair.photoSources ?? []).find((item) => item.provider === 'google-photos')} onSave={onSavePairSource} />
          </div>
        </div>
      ) : <div className="pair-source-empty"><Icon name="camera" /><span>เลือกหรือเพิ่มคู่แข่งขัน เพื่อผูกลิงก์รูปของคู่นี้</span></div>}
    </div>
  );
}

function PairSourceCard({ pair, provider, source, onSave }: { pair: MatchPair; provider: PhotoProvider; source?: PhotoSource; onSave: (pairId: string, provider: PhotoProvider, url: string) => void }) {
  const [url, setUrl] = useState(source?.url ?? '');
  const [error, setError] = useState('');
  const providerLabel = photoProviderLabel(provider);
  useEffect(() => {
    setUrl(source?.url ?? '');
    setError('');
  }, [pair.id, provider, source?.url]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cleanedUrl = url.trim();
    if (cleanedUrl && !isSafePhotoSourceUrl(cleanedUrl)) {
      setError('ต้องเป็นลิงก์ https จาก Google Drive หรือ Google Photos');
      return;
    }
    onSave(pair.id, provider, cleanedUrl);
    setUrl(cleanedUrl);
    setError('');
  };
  const statusLabel = source?.syncStatus === 'ready' ? 'sync แล้ว' : source?.syncStatus === 'error' ? 'sync ไม่สำเร็จ' : source ? 'รอ sync อัตโนมัติ' : 'ยังไม่ผูกลิงก์';
  return (
    <form className="pair-source-card" onSubmit={submit}>
      <div className="pair-source-card-head">
        <span className="source-provider-mark">{provider === 'google-drive' ? 'GD' : 'GP'}</span>
        <div><strong>{providerLabel}</strong><small>{statusLabel} · แหล่งรูปของ {pair.label}</small></div>
      </div>
      <Field label="ลิงก์โฟลเดอร์ / อัลบั้ม" error={error}><input type="url" value={url} onChange={(event) => { setUrl(event.target.value); setError(''); }} placeholder={provider === 'google-drive' ? 'https://drive.google.com/drive/folders/...' : 'https://photos.app.goo.gl/...'} /></Field>
      {source && <div className="source-current"><span className="status-dot" /> {source.syncMode === 'auto' ? 'Auto sync' : 'Manual'}{source.previewUrls && source.previewUrls.length > 0 ? ' · ' + source.previewUrls.length + ' รูปตัวอย่าง' : ''}<a href={source.url} target="_blank" rel="noreferrer">เปิดต้นทาง <Icon name="external" /></a></div>}
      <button className="button ghost wide" type="submit">{source ? 'อัปเดตลิงก์ของคู่นี้' : 'บันทึกลิงก์ของคู่นี้'} <Icon name="check" /></button>
    </form>
  );
}

function toDateTimeInput(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function scheduleRange(event: PepsEvent): string {
  const start = formatEventDate(event.startsAt);
  if (!event.endsAt) return `${start} · ยังไม่กำหนดเวลาจบ`;
  const end = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' }).format(new Date(event.endsAt));
  return `${start}–${end}`;
}

function ScheduleManager({ events, onUpdateSchedule }: { events: PepsEvent[]; onUpdateSchedule: (eventId: string, startsAt: string, endsAt: string) => void }) {
  const scheduleEvents = sortEventsByStartTime(events);
  const [selectedEventId, setSelectedEventId] = useState(scheduleEvents[0]?.id ?? '');
  const selectedEvent = scheduleEvents.find((event) => event.id === selectedEventId) ?? scheduleEvents[0];
  const [startsAt, setStartsAt] = useState(toDateTimeInput(selectedEvent?.startsAt));
  const [endsAt, setEndsAt] = useState(toDateTimeInput(selectedEvent?.endsAt));
  const [error, setError] = useState('');

  const chooseEvent = (event: PepsEvent) => {
    setSelectedEventId(event.id);
    setStartsAt(toDateTimeInput(event.startsAt));
    setEndsAt(toDateTimeInput(event.endsAt));
    setError('');
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedEvent || !startsAt || !endsAt || new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      setError('เวลาจบต้องอยู่หลังเวลาเริ่ม');
      return;
    }
    onUpdateSchedule(selectedEvent.id, startsAt, endsAt);
    setError('');
  };

  return (
    <section className="schedule-manager">
      <div className="card-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> SCHEDULE BOARD</span><h2>ตารางงาน</h2></div><span className="result-count">{scheduleEvents.length} รายการ</span></div>
      <p className="source-manager-intro">เลือกงานจากรายการด้านซ้ายเพื่อดูรายละเอียด แล้วแก้ไขเวลาเริ่มและเวลาจบในแผงเดียว</p>
      <div className="schedule-layout">
        <div className="schedule-board-list">
          {scheduleEvents.map((event) => <button className={`schedule-board-row ${event.id === selectedEvent?.id ? 'selected' : ''}`} key={event.id} type="button" onClick={() => chooseEvent(event)}>
            <span className="schedule-board-date"><strong>{new Intl.DateTimeFormat('th-TH', { day: '2-digit' }).format(new Date(event.startsAt))}</strong><small>{new Intl.DateTimeFormat('th-TH', { month: 'short' }).format(new Date(event.startsAt))}</small></span>
            <span className="schedule-board-copy"><strong>{event.title}</strong><small>{scheduleRange(event)} · {event.venue}</small></span>
            <span className={`status-label ${event.status}`}>{eventStatusLabel(event.status)}</span>
          </button>)}
          {scheduleEvents.length === 0 && <EmptyState title="ยังไม่มีตารางงาน" description="สร้างงานใหม่เพื่อเพิ่มรายการลงตาราง" />}
        </div>
        {selectedEvent && <form className="schedule-editor" onSubmit={submit}>
          <span className="soft-chip cyan">แก้ไขช่วงเวลา</span>
          <div className="schedule-editor-event"><div className="schedule-editor-cover" style={{ backgroundImage: `url(${selectedEvent.cover})` }} /><div><span className={`status-label ${selectedEvent.status}`}>{eventStatusLabel(selectedEvent.status)}</span><h3>{selectedEvent.title}</h3><p>{selectedEvent.venue}</p></div></div>
          <div className="form-two-col"><Field label="เวลาเริ่ม"><input type="datetime-local" value={startsAt} onChange={(event) => { setStartsAt(event.target.value); setError(''); }} /></Field><Field label="เวลาจบ" error={error}><input type="datetime-local" value={endsAt} onChange={(event) => { setEndsAt(event.target.value); setError(''); }} /></Field></div>
          <button className="button primary wide" type="submit">บันทึกตารางงาน <Icon name="check" /></button>
        </form>}
      </div>
    </section>
  );
}

function AdminStat({ label, value }: { label: string; value: string }) { return <div className="admin-stat"><span>{label}</span><strong>{value}</strong></div>; }

function CreateEventForm({ onAddEvent }: { onAddEvent: (draft: EventDraft, cover: string) => Promise<void> | void }) {
  const [draft, setDraft] = useState<EventDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [cover, setCover] = useState('');
  const [coverError, setCoverError] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [coverUrlError, setCoverUrlError] = useState('');
  const update = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateEventDraft(draft);
    const nextCoverUrlError = validateImageUrl(coverUrl);
    setErrors(nextErrors);
    setCoverUrlError(nextCoverUrlError ?? '');
    if (Object.keys(nextErrors).length > 0 || nextCoverUrlError) return;
    await onAddEvent(draft, cover || coverUrl.trim());
    setDraft(EMPTY_DRAFT);
    setCover('');
    setCoverUrl('');
    setCoverError('');
    setCoverUrlError('');
    setErrors({});
  };
  const uploadCover = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const nextError = validateImageUpload(file); setCoverError(nextError ?? ''); if (nextError) { setCover(''); return; } const reader = new FileReader(); reader.addEventListener('load', () => { setCover(typeof reader.result === 'string' ? reader.result : ''); setCoverUrl(''); setCoverUrlError(''); }); reader.readAsDataURL(file); };
  const coverPreview = cover || coverUrl;
  return <form className="create-event-card" onSubmit={submit}><div className="card-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> NEW EVENT</span><h2>สร้างงานใหม่</h2></div><span className="draft-chip">เผยแพร่ทันที</span></div><label className="cover-upload" style={coverPreview ? { backgroundImage: `url(${coverPreview})` } : undefined}><input type="file" accept="image/*" onChange={uploadCover} /><span className="upload-overlay"><Icon name="camera" /><strong>{coverPreview ? 'เปลี่ยน Cover' : 'อัปโหลด Cover'}</strong><small>JPG, PNG ไม่เกิน 5MB</small>{coverError && <small className="upload-error">{coverError}</small>}</span></label><Field label="ลิงก์ Cover รูปภาพ" error={coverUrlError}><input type="url" value={coverUrl} onChange={(event) => { setCoverUrl(event.target.value); setCover(''); setCoverUrlError(''); }} placeholder="https://example.com/photo.jpg" /></Field><small className="form-help">วางลิงก์รูปโดยตรงจากเว็บไซต์หรือพื้นที่ฝากรูปได้ ใช้ https:// และควรเป็นลิงก์ที่เปิดเป็นรูปภาพโดยตรง</small><Field label="ชื่องาน" error={errors.title}><input value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder="เช่น PEPS LIVE CUP รอบชิง" /></Field><Field label="คำอธิบาย" error={errors.subtitle}><textarea value={draft.subtitle} onChange={(event) => update('subtitle', event.target.value)} placeholder="สรุปงานสั้น ๆ ให้ผู้ชมเข้าใจ" rows={2} /></Field><div className="form-two-col"><Field label="ประเภท"><select value={draft.kind} onChange={(event) => update('kind', event.target.value as EventDraft['kind'])}><option value="live">Live Broadcast</option><option value="photo">Photo Event</option></select></Field><Field label="สถานที่" error={errors.venue}><input value={draft.venue} onChange={(event) => update('venue', event.target.value)} placeholder="ชื่อสนาม / สถานที่" /></Field></div><div className="form-two-col"><Field label="เวลาเริ่ม" error={errors.startsAt}><input type="datetime-local" value={draft.startsAt} onChange={(event) => update('startsAt', event.target.value)} /></Field><Field label="เวลาจบ" error={errors.endsAt}><input type="datetime-local" value={draft.endsAt} onChange={(event) => update('endsAt', event.target.value)} /></Field></div><Field label="Tags"><input value={draft.tags} onChange={(event) => update('tags', event.target.value)} placeholder="LIVE, ฟุตบอล" /></Field>{draft.kind === 'live' && <Field label="ลิงก์ถ่ายทอดสด" error={errors.liveUrl}><input type="url" value={draft.liveUrl} onChange={(event) => update('liveUrl', event.target.value)} placeholder="https://..." /></Field>}<button className="button primary wide" type="submit">บันทึกและเผยแพร่ <Icon name="arrow" /></button></form>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className={`form-field ${error ? 'has-error' : ''}`}><span>{label}</span>{children}{error && <small>{error}</small>}</label>; }

function EventManager({ events, onPublish }: { events: PepsEvent[]; onPublish: (eventId: string) => void }) {
  const requestDelete = (event: PepsEvent) => {
    if (window.confirm(`ต้องการลบงาน “${event.title}” ใช่หรือไม่? ข้อมูล Photo Event และคู่แข่งที่ผูกไว้จะถูกลบด้วย`)) onPublish(`delete:${event.id}`);
  };
  return <div className="event-manager"><div className="card-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> EVENT MANAGER</span><h2>รายการงาน</h2></div><span className="result-count">{events.length} รายการ</span></div><div className="manager-list">{sortEventsByStartTime(events).map((event) => <div className="manager-row" key={event.id}><div className="manager-thumb" style={{ backgroundImage: `url(${event.cover})` }} /><div className="manager-copy"><strong>{event.title}</strong><span>{scheduleRange(event)} · {event.venue}</span></div><span className={`status-label ${event.status}`}>{eventStatusLabel(event.status)}</span><div className="manager-actions">{event.status === 'draft' ? <button className="small-button" type="button" onClick={() => onPublish(event.id)}>เผยแพร่</button> : <span className="verified"><Icon name="check" /></span>}<button className="small-button danger-button" type="button" onClick={() => requestDelete(event)} aria-label={`ลบงาน ${event.title}`}><Icon name="trash" /></button></div></div>)}</div></div>;
}

function EmptyState({ title, description }: { title: string; description: string }) { return <div className="empty-state"><span className="empty-icon"><Icon name="spark" /></span><h3>{title}</h3><p>{description}</p></div>; }

function LiveModal({ event, onClose }: { event: PepsEvent; onClose: () => void }) {
  const isPast = isPastEvent(event);
  const statusLabel = isPast ? 'จบแล้ว' : eventStatusLabel(event.status);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(mouseEvent) => mouseEvent.target === mouseEvent.currentTarget && onClose()}><div className="live-modal" role="dialog" aria-modal="true" aria-label={`ดู ${isPast ? 'รายละเอียดงานย้อนหลัง' : 'Live'} ${event.title}`}><div className="player-shell" style={{ backgroundImage: `url(${event.cover})` }}><div className="player-overlay" /><div className="player-top"><span className={`live-badge ${isPast ? 'archive-badge' : ''}`}>{isPast ? 'ARCHIVE' : <><i /> LIVE</>}</span><button className="modal-close light-close" onClick={onClose} aria-label="ปิด"><Icon name="close" /></button></div><div className="player-center"><span><Icon name={isPast ? 'calendar' : 'play'} /></span><strong>{isPast ? 'งานนี้จบแล้ว' : 'กำลังเตรียมสัญญาณถ่ายทอดสด'}</strong><small>{isPast ? 'รายละเอียดงานและช่วงเวลาย้อนหลังยังเปิดดูได้จากหน้านี้' : 'กดปุ่มด้านล่างเพื่อเปิดช่อง PEPS LIVE'}</small></div><div className="player-bottom"><span>{event.title}</span><span>{isPast ? 'PEPS HUB · ARCHIVE' : 'PEPS LIVE · HD'}</span></div></div><div className="modal-info"><div><span className="soft-chip green">{statusLabel}</span><h2>{event.title}</h2><p>{event.subtitle}</p></div>{event.liveUrl && !isPast && <a className="button primary" href={event.liveUrl} target="_blank" rel="noreferrer">เปิดช่องถ่ายทอดสด <Icon name="external" /></a>}</div></div></div>;
}

export default App;
