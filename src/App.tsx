import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
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
  searchTeams,
  slugify,
  teamPhotoCount,
  validateEventDraft,
  validateImageUpload,
  validateImageUrl,
  visibleEvents,
} from './lib/domain';
import { loadState, saveState } from './lib/storage';
import { isSafePhotoSourceUrl, photoProviderLabel, photoSourceForTeam } from './lib/photoSources';
import type { EventDraft, MatchPair, Page, PhotoAsset, PhotoEvent, PhotoProvider, PepsEvent, Team, ValidationErrors } from './types';
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

type Notice = { tone: 'success' | 'info'; message: string } | null;

function Icon({ name }: { name: 'arrow' | 'calendar' | 'camera' | 'check' | 'chevron' | 'close' | 'external' | 'home' | 'live' | 'menu' | 'play' | 'search' | 'settings' | 'spark' | 'users' }) {
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
    users: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20m6-9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm5-6.5a3.5 3.5 0 0 1 0 6.8m1 3.7h.5A3.5 3.5 0 0 1 20 18.5V20',
  };

  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function App() {
  const [state, setState] = useState(loadState);
  const [page, setPage] = useState<Page>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedTeamSlug, setSelectedTeamSlug] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<PepsEvent | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  useEffect(() => saveState(state), [state]);

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

  const openPhotoMatch = (teamSlug?: string) => {
    setSelectedTeamSlug(teamSlug ?? null);
    navigate('photos');
  };

  const publishEvent = (eventId: string) => {
    setState((current) => ({
      ...current,
      events: current.events.map((event) => event.id === eventId ? { ...event, status: 'published' } : event),
      photoEvents: current.photoEvents.map((photoEvent) => photoEvent.eventId === eventId ? { ...photoEvent, status: 'published' } : photoEvent),
    }));
    setNotice({ tone: 'success', message: 'เผยแพร่งานแล้ว — ผู้ชมจะเห็นงานนี้ในหน้าหลักทันที' });
  };

  const addEvent = (draft: EventDraft, cover: string) => {
    const event = createEventFromDraft(draft, state.events.length, cover || state.events[0]?.cover || '');
    const photoEventId = draft.kind === 'photo' ? `photo-${event.id}` : undefined;
    const nextEvent = photoEventId ? { ...event, photoEventId } : event;
    const photoEvent: PhotoEvent | null = photoEventId ? {
      id: photoEventId,
      eventId: event.id,
      title: event.title,
      status: 'draft',
      dateLabel: new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(event.startsAt)),
      location: event.venue,
      cover: event.cover,
      teamSlugs: state.teams.map((team) => team.slug),
      photoCount: 0,
    } : null;
    setState((current) => ({ ...current, events: [nextEvent, ...current.events], photoEvents: photoEvent ? [photoEvent, ...current.photoEvents] : current.photoEvents }));
    setNotice({ tone: 'success', message: 'บันทึกงานเป็นแบบร่างแล้ว ตรวจข้อมูลและกดเผยแพร่จากรายการงาน' });
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

  const updateTeamPhotoSource = (teamId: string, eventId: string, provider: PhotoProvider, url: string) => {
    const cleanedUrl = url.trim();
    if (cleanedUrl && !isSafePhotoSourceUrl(cleanedUrl)) {
      setNotice({ tone: 'info', message: 'ใช้ลิงก์ https จาก Google Drive หรือ Google Photos เท่านั้น' });
      return;
    }
    setState((current) => ({
      ...current,
      teams: current.teams.map((team) => {
        if (team.id !== teamId) return team;
        const otherSources = (team.photoSources ?? []).filter((source) => source.eventId !== eventId);
        return {
          ...team,
          photoSources: cleanedUrl ? [...otherSources, { eventId, provider, url: cleanedUrl, lastSyncedAt: undefined }] : otherSources,
        };
      }),
    }));
    setNotice({ tone: 'success', message: cleanedUrl ? 'บันทึกลิงก์ต้นทางของทีมแล้ว' : 'ลบลิงก์ต้นทางของทีมแล้ว' });
  };

  const publicEvents = visibleEvents(state.events);
  const liveCount = state.events.filter((event) => event.status === 'live').length;

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container header-inner">
          <button className="brand" onClick={() => navigate('home')} aria-label="กลับหน้าหลัก PepsHub">
            <span className="brand-mark"><span /></span>
            <span><strong>Peps</strong><em>Hub</em></span>
          </button>
          <nav className={`main-nav ${mobileMenuOpen ? 'is-open' : ''}`} aria-label="เมนูหลัก">
            <button className={page === 'home' ? 'nav-link active' : 'nav-link'} onClick={() => navigate('home')}><Icon name="home" /> หน้าหลัก</button>
            <button className={page === 'photos' ? 'nav-link active' : 'nav-link'} onClick={() => openPhotoMatch()}><Icon name="camera" /> Photo Match</button>
            <button className={page === 'admin' ? 'nav-link active' : 'nav-link'} onClick={() => navigate('admin')}><Icon name="settings" /> หลังบ้าน</button>
          </nav>
          <div className="header-actions">
            <span className="mode-pill"><span className="mode-dot" /> Local mode</span>
            <button className="admin-shortcut" onClick={() => navigate('admin')}>จัดการงาน <Icon name="arrow" /></button>
            <button className="menu-toggle" onClick={() => setMobileMenuOpen((open) => !open)} aria-label="เปิดเมนู"><Icon name={mobileMenuOpen ? 'close' : 'menu'} /></button>
          </div>
        </div>
      </header>

      <main>
        {page === 'home' && <HomePage events={publicEvents} liveCount={liveCount} onOpenEvent={setSelectedEvent} onPhotoMatch={openPhotoMatch} />}
        {page === 'photos' && <PhotoMatchPage state={state} selectedTeamSlug={selectedTeamSlug} onSelectTeam={setSelectedTeamSlug} />}
        {page === 'admin' && <AdminPage state={state} unlocked={adminUnlocked} onUnlock={() => setAdminUnlocked(true)} onAddEvent={addEvent} onPublish={publishEvent} onUpdateTeamPhotoSource={updateTeamPhotoSource} onAddMatchPair={addMatchPair} onUpdateSchedule={updateEventSchedule} />}
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div><div className="footer-brand"><span className="brand-mark small"><span /></span><strong>PepsHub</strong></div><p>พื้นที่กลางสำหรับทุกการแข่งขัน ทุกภาพ และทุกโมเมนต์ของ PEPS LIVE</p></div>
          <div className="footer-meta"><span>Built for real event teams</span><span>v0.1 local MVP</span></div>
        </div>
      </footer>

      {notice && <div className={`toast ${notice.tone}`} role="status"><span className="toast-icon"><Icon name={notice.tone === 'success' ? 'check' : 'spark'} /></span>{notice.message}</div>}
      {selectedEvent && <LiveModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </div>
  );
}

function HomePage({ events, liveCount, onOpenEvent, onPhotoMatch }: { events: PepsEvent[]; liveCount: number; onOpenEvent: (event: PepsEvent) => void; onPhotoMatch: (teamSlug?: string) => void }) {
  const liveEvents = events.filter((event) => event.status === 'live');
  const scheduleEvents = events.filter((event) => event.status !== 'live' && event.kind === 'live');
  const photoEvent = events.find((event) => event.kind === 'photo');

  return (
    <>
      <section className="hero-section">
        <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> LIVE EXPERIENCE HUB</div>
            <h1>ทุกสนาม<br /><span>อยู่ในที่เดียว</span></h1>
            <p>ดูตารางการแข่งขัน กดดู Live และค้นหาภาพของทีมคุณได้ทันที — PepsHub ทำให้ทุกโมเมนต์หลังสนามไม่หลุดหาย</p>
            <div className="hero-actions"><button className="button primary" onClick={() => document.getElementById('schedule')?.scrollIntoView({ behavior: 'smooth' })}>ดูตารางงาน <Icon name="arrow" /></button><button className="button ghost" onClick={() => onPhotoMatch()}><Icon name="camera" /> ค้นหาภาพทีม</button></div>
            <div className="hero-proof"><div className="avatar-stack"><span>PU</span><span>NS</span><span>RC</span><span>+</span></div><span>ทีมกีฬาใช้ PepsHub<br /><strong>เพื่อเก็บทุกโมเมนต์</strong></span></div>
          </div>
          <div className="hero-visual">
            <div className="visual-backdrop" />
            <div className="hero-card-main">
              <div className="hero-card-top"><span className="live-badge"><i /> LIVE NOW</span><span>PEPS LIVE CUP</span></div>
              <div className="hero-score"><div><strong>PEPS</strong><span>UNITED</span></div><b>2 <small>—</small> 1</b><div className="align-right"><strong>NORTH</strong><span>STAR FC</span></div></div>
              <div className="hero-card-footer"><span>รอบชิงชนะเลิศ · 72:14</span><button onClick={() => liveEvents[0] && onOpenEvent(liveEvents[0])}><Icon name="play" /></button></div>
            </div>
            <div className="float-card float-photo"><span className="float-icon"><Icon name="camera" /></span><div><strong>Photo Match</strong><small>ค้นหาภาพด้วยชื่อทีม</small></div><Icon name="arrow" /></div>
            <div className="float-card float-live"><span className="pulse-bars"><i /><i /><i /><i /></span><div><strong>{liveCount || 0} รายการ</strong><small>กำลังถ่ายทอดสด</small></div></div>
          </div>
        </div>
      </section>

      <section className="stats-strip"><div className="container stats-grid"><Stat label="รายการทั้งหมด" value="12" suffix="งาน" icon="calendar" /><Stat label="กำลัง Live" value={String(liveCount).padStart(2, '0')} suffix="ตอนนี้" icon="live" accent /><Stat label="ทีมที่ค้นหาได้" value="48" suffix="ทีม" icon="users" /><Stat label="ภาพพร้อมส่งต่อ" value="2.4k" suffix="ภาพ" icon="camera" /></div></section>

      <section className="section container" id="schedule">
        <SectionHeading eyebrow="ON AIR NOW" title="กำลังเกิดขึ้น" description="เลือกดูการแข่งขันที่กำลังถ่ายทอดสดได้จากตรงนี้" action={liveEvents.length > 0 ? 'ดูทั้งหมด' : undefined} />
        {liveEvents.length > 0 ? <div className="event-grid live-grid">{liveEvents.map((event) => <EventCard key={event.id} event={event} onOpen={() => onOpenEvent(event)} onPhotoMatch={onPhotoMatch} featured /> )}</div> : <EmptyState title="ยังไม่มีรายการ Live ตอนนี้" description="แวะกลับมาใหม่เมื่อการแข่งขันเริ่มต้น" />}
      </section>

      <section className="section section-muted"><div className="container"><SectionHeading eyebrow="UP NEXT" title="ตารางงานถัดไป" description="วางแผนชมการแข่งขันครั้งต่อไปของคุณ" /><div className="schedule-list">{scheduleEvents.map((event) => <ScheduleRow key={event.id} event={event} onOpen={() => onOpenEvent(event)} />)}{scheduleEvents.length === 0 && <EmptyState title="ยังไม่มีงานถัดไป" description="ทีมงานกำลังอัปเดตตารางการแข่งขัน" />}</div></div></section>

      {photoEvent && <section className="photo-cta-section"><div className="container photo-cta"><div className="photo-cta-copy"><div className="eyebrow"><span className="eyebrow-line" /> FIND YOUR MOMENT</div><h2>ภาพของทีมคุณ<br /><span>อยู่ตรงนี้</span></h2><p>ไม่ต้องไล่ดูทีละภาพ แค่พิมพ์ชื่อทีม แล้วเจอโมเมนต์ของคุณในไม่กี่วินาที</p><button className="button light" onClick={() => onPhotoMatch()}><Icon name="search" /> เปิด Photo Match <Icon name="arrow" /></button></div><div className="photo-collage"><div className="collage-photo tall" style={{ backgroundImage: `url(${photoEvent.cover})` }} /><div className="collage-photo small-one" style={{ backgroundImage: `url(${photoEvent.cover})` }} /><div className="collage-note"><Icon name="spark" /><strong>2.4k+</strong><span>ภาพที่พร้อมให้ค้นหา</span></div></div></div></section>}
    </>
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
  return <article className={`event-card ${featured ? 'featured' : ''}`}>
    <div className="event-cover" style={{ backgroundImage: `url(${event.cover})` }}><div className="cover-shade" /><div className="event-cover-top"><span className={`type-chip ${event.status === 'live' ? 'live' : ''}`}>{event.status === 'live' && <i />}{eventKindLabel(event.kind)}</span><span className="cover-menu">•••</span></div>{event.status === 'live' && <div className="equalizer"><i /><i /><i /><i /><i /></div>}</div>
    <div className="event-body"><div className="event-meta"><span><Icon name="calendar" /> {formatEventDate(event.startsAt)}</span><span><Icon name="settings" /> {eventStatusLabel(event.status)}</span></div><h3>{event.title}</h3><p>{event.subtitle}</p><div className="event-footer"><span className="venue">{event.venue}</span><button className="round-button" onClick={isPhoto ? () => onPhotoMatch() : onOpen} aria-label={isPhoto ? 'เปิด Photo Match' : 'ดู Live'}>{isPhoto ? <Icon name="camera" /> : <Icon name="play" />}</button></div></div>
  </article>;
}

function ScheduleRow({ event, onOpen }: { event: PepsEvent; onOpen: () => void }) {
  const date = new Date(event.startsAt);
  return <article className="schedule-row"><div className="date-block"><strong>{new Intl.DateTimeFormat('th-TH', { day: '2-digit' }).format(date)}</strong><span>{new Intl.DateTimeFormat('th-TH', { month: 'short' }).format(date)}</span></div><div className="schedule-info"><div className="schedule-tags"><span className="soft-chip">{event.tags[0] || 'EVENT'}</span><span>{scheduleRange(event)}</span></div><h3>{event.title}</h3><p>{event.venue}</p></div><div className="schedule-action"><span className="status-dot" /> <span>{eventStatusLabel(event.status)}</span><button className="icon-button" onClick={onOpen} aria-label={`ดูรายละเอียด ${event.title}`}><Icon name="arrow" /></button></div></article>;
}

function PhotoMatchPage({ state, selectedTeamSlug, onSelectTeam }: { state: ReturnType<typeof loadState>; selectedTeamSlug: string | null; onSelectTeam: (slug: string | null) => void }) {
  const [query, setQuery] = useState('');
  const [activePhoto, setActivePhoto] = useState<PhotoAsset | null>(null);
  const [selectedPhotoEventId, setSelectedPhotoEventId] = useState<string | null>(null);
  const photoEvent = state.photoEvents.find((event) => event.id === selectedPhotoEventId) ?? null;
  const eventPairs = useMemo(() => photoEvent ? state.matchPairs.filter((pair) => pair.photoEventId === photoEvent.id) : [], [photoEvent, state.matchPairs]);
  const eventTeamIds = useMemo(() => new Set(eventPairs.flatMap((pair) => [pair.teamAId, pair.teamBId])), [eventPairs]);
  const eventTeams = useMemo(() => photoEvent ? state.teams.filter((team) => eventPairs.length > 0 ? eventTeamIds.has(team.id) : photoEvent.teamSlugs.includes(team.slug)).map((team) => ({ ...team, photoCount: teamPhotoCount(state.photos, photoEvent.id, team.slug) })) : [], [eventPairs.length, eventTeamIds, photoEvent, state.photos, state.teams]);
  const selectedTeam = eventTeams.find((team) => team.slug === selectedTeamSlug) ?? null;
  const matchedTeams = useMemo(() => searchTeams(eventTeams, query), [eventTeams, query]);
  const teamPhotos = selectedTeam && photoEvent ? state.photos.filter((photo) => photo.photoEventId === photoEvent.id && photo.teamSlug === selectedTeam.slug) : [];

  useEffect(() => {
    if (query && selectedTeamSlug && !matchedTeams.some((team) => team.slug === selectedTeamSlug)) onSelectTeam(null);
  }, [matchedTeams, onSelectTeam, query, selectedTeamSlug]);

  if (!photoEvent) return <PhotoEventIndex state={state} onSelect={(eventId) => { setSelectedPhotoEventId(eventId); onSelectTeam(null); setQuery(''); }} />;

  const teamSource = photoSourceForTeam(selectedTeam?.photoSources, photoEvent.id);
  const eventStatus = photoUploadStatus(photoEvent, state.photos);

  return <section className="page-section photo-page"><div className="container"><div className="photo-workspace-head"><button className="back-link" onClick={() => { setSelectedPhotoEventId(null); onSelectTeam(null); }}>← Photo Events ทั้งหมด</button><div className="photo-workspace-title"><span className="soft-chip cyan">PHOTO EVENT</span><h1>{photoEvent.title}</h1><p><Icon name="calendar" /> {photoEvent.dateLabel} <span className="detail-divider" /> <Icon name="settings" /> {photoEvent.location}</p>{eventPairs.length > 0 && <div className="photo-pair-strip">{eventPairs.map((pair) => { const teamA = state.teams.find((team) => team.id === pair.teamAId); const teamB = state.teams.find((team) => team.id === pair.teamBId); return <span key={pair.id}>{pair.label}: {teamA?.name ?? 'ทีม A'} VS {teamB?.name ?? 'ทีม B'}</span>; })}</div>}</div><div className={`photo-upload-status ${photoUploadStatusTone(eventStatus)}`}><span className="status-dot" /><strong>{photoUploadStatusLabel(eventStatus)}</strong><small>{state.photos.filter((photo) => photo.photoEventId === photoEvent.id).length} ภาพในอีเว้นนี้</small></div></div><div className="photo-search-layout"><div className="team-search-panel"><div className="search-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> SELECT YOUR TEAM</span><h2>ค้นหาทีม</h2></div><span className="result-count">{matchedTeams.length} ทีม</span></div><label className="search-box"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="พิมพ์ชื่อทีม หรือจังหวัด..." aria-label="ค้นหาทีม" />{query && <button type="button" onClick={() => setQuery('')} aria-label="ล้างคำค้น"><Icon name="close" /></button>}</label><div className="team-list">{matchedTeams.map((team) => <TeamRow key={team.id} team={team} selected={team.slug === selectedTeamSlug} onClick={() => onSelectTeam(team.slug)} />)}{matchedTeams.length === 0 && <EmptyState title="ไม่พบทีมที่ค้นหา" description="ลองค้นด้วยชื่อย่อ จังหวัด หรือรุ่นการแข่งขัน" />}</div></div><div className="matched-panel">{selectedTeam ? <><div className="matched-heading"><button className="back-link" onClick={() => onSelectTeam(null)}>← ทีมทั้งหมด</button><span className={`soft-chip ${teamPhotos.length > 0 ? 'green' : 'cyan'}`}>{teamPhotos.length > 0 ? 'พบภาพแล้ว' : 'รอตรวจรูป'}</span><h2>{selectedTeam.name}</h2><p>{selectedTeam.city} · {selectedTeam.category} · {teamPhotos.length} ภาพ</p>{teamSource ? <div className="matched-source"><span><Icon name="external" /> {photoProviderLabel(teamSource.provider)}</span><a href={teamSource.url} target="_blank" rel="noreferrer">เปิดต้นทาง <Icon name="arrow" /></a></div> : <div className="matched-source muted"><span><Icon name="camera" /> ยังไม่ได้ตั้ง Google source ของทีมนี้</span></div>}</div>{teamPhotos.length > 0 ? <div className="photo-grid">{teamPhotos.map((photo) => <button className="photo-tile" key={photo.id} onClick={() => setActivePhoto(photo)}><img src={photo.image} alt={`${selectedTeam.name} ${photo.label}`} /><span>{photo.capturedAt}</span></button>)}</div> : <TeamPhotoEmpty source={teamSource} />}</> : <div className="match-empty"><div className="match-empty-icon"><Icon name="camera" /></div><h2>เลือกทีมเพื่อดูภาพ</h2><p>ภาพการแข่งขันจะปรากฏตรงนี้ทันที<br />เมื่อคุณเลือกทีมจากรายการด้านซ้าย</p><div className="mini-steps"><span><b>01</b> ค้นหาทีม</span><span><b>02</b> เลือกทีม</span><span><b>03</b> ดูภาพ</span></div></div>}</div></div></div>{activePhoto && <PhotoLightbox photo={activePhoto} team={selectedTeam} onClose={() => setActivePhoto(null)} />}</section>;
}

function PhotoEventIndex({ state, onSelect }: { state: ReturnType<typeof loadState>; onSelect: (eventId: string) => void }) {
  const visiblePhotoEvents = state.photoEvents.filter((event) => event.status === 'published');
  const readyCount = visiblePhotoEvents.filter((event) => photoUploadStatus(event, state.photos) === 'ready').length;
  return <section className="page-section photo-page"><div className="container"><div className="page-hero photo-event-index-hero"><div className="eyebrow"><span className="eyebrow-line" /> PHOTO MATCH</div><h1>เลือกอีเว้นก่อน<br /><span>แล้วค่อยเจอภาพของคุณ</span></h1><p>ดูรายการ Photo Event ทั้งหมด พร้อมสถานะว่าลงรูปแล้วหรือยัง จากนั้นเลือกอีเว้นเพื่อค้นหาทีมแบบละเอียด</p></div><div className="photo-event-stats"><div><strong>{visiblePhotoEvents.length}</strong><span>อีเว้นที่เปิดให้ค้นหา</span></div><div><strong>{readyCount}</strong><span>อีเว้นที่ลงรูปแล้ว</span></div><div><strong>{state.photos.length}</strong><span>ภาพในระบบตอนนี้</span></div></div><div className="photo-event-grid">{visiblePhotoEvents.map((event) => <PhotoEventCard key={event.id} event={event} state={state} onSelect={() => onSelect(event.id)} />)}{visiblePhotoEvents.length === 0 && <EmptyState title="ยังไม่มี Photo Event" description="ทีมงานยังไม่ได้เผยแพร่อีเว้นสำหรับค้นหารูป" />}</div></div></section>;
}

function PhotoEventCard({ event, state, onSelect }: { event: PhotoEvent; state: ReturnType<typeof loadState>; onSelect: () => void }) {
  const status = photoUploadStatus(event, state.photos);
  const photoCount = state.photos.filter((photo) => photo.photoEventId === event.id).length;
  const linkedTeams = state.teams.filter((team) => event.teamSlugs.includes(team.slug) && photoSourceForTeam(team.photoSources, event.id)).length;
  return <article className="photo-event-card"><div className="photo-event-card-cover" style={{ backgroundImage: `url(${event.cover})` }}><span className="soft-chip cyan">PHOTO EVENT</span><span className={`event-status-chip ${photoUploadStatusTone(status)}`}><i /> {photoUploadStatusLabel(status)}</span></div><div className="photo-event-card-body"><div className="photo-event-card-meta"><span><Icon name="calendar" /> {event.dateLabel}</span><span><Icon name="camera" /> {photoCount} ภาพ</span></div><h2>{event.title}</h2><p><Icon name="settings" /> {event.location}</p><div className="photo-event-card-footer"><span>{linkedTeams > 0 ? `${linkedTeams} ทีมมี Google source` : 'ค้นหาทีมจากอีเว้นนี้'}</span><button className="button primary" onClick={onSelect}>เลือกอีเว้น <Icon name="arrow" /></button></div></div></article>;
}

function TeamPhotoEmpty({ source }: { source?: ReturnType<typeof photoSourceForTeam> }) {
  return <div className="team-photo-empty"><div className="match-empty-icon"><Icon name="camera" /></div><h3>{source ? 'มี Google source แล้ว แต่ยังไม่มีรูปที่ sync' : 'ยังไม่มีรูปของทีมนี้ในอีเว้นนี้'}</h3><p>{source ? 'เมื่อเชื่อม Google Drive/Photos adapter แล้ว รูปจะมาแสดงในพื้นที่นี้' : 'ลองเลือกทีมอื่น หรือกลับไปเลือก Photo Event ที่ลงรูปแล้ว'}</p>{source && <a className="button ghost" href={source.url} target="_blank" rel="noreferrer">เปิด {photoProviderLabel(source.provider)} <Icon name="external" /></a>}</div>;
}

function TeamRow({ team, selected, onClick }: { team: Team; selected: boolean; onClick: () => void }) {
  return <button className={`team-row ${selected ? 'selected' : ''}`} onClick={onClick}><img src={team.logo} alt="" /><span className="team-initials" style={{ color: team.color, borderColor: `${team.color}55` }}>{team.shortName}</span><span className="team-copy"><strong>{team.name}</strong><small>{team.city} · {team.category}</small></span><span className="team-count">{team.photoCount} ภาพ</span><Icon name="arrow" /></button>;
}

function PhotoLightbox({ photo, team, onClose }: { photo: PhotoAsset; team: Team | null; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="ดูภาพการแข่งขัน"><button className="modal-close" onClick={onClose} aria-label="ปิด"><Icon name="close" /></button><img src={photo.image} alt={team ? `${team.name} ${photo.label}` : photo.label} /><div className="lightbox-caption"><strong>{team?.name}</strong><span>{photo.label} · {photo.capturedAt}</span></div></div></div>;
}

function AdminPage({ state, unlocked, onUnlock, onAddEvent, onPublish, onUpdateTeamPhotoSource, onAddMatchPair, onUpdateSchedule }: { state: ReturnType<typeof loadState>; unlocked: boolean; onUnlock: () => void; onAddEvent: (draft: EventDraft, cover: string) => void; onPublish: (eventId: string) => void; onUpdateTeamPhotoSource: (teamId: string, eventId: string, provider: PhotoProvider, url: string) => void; onAddMatchPair: (photoEventId: string, teamAName: string, teamBName: string) => string | undefined; onUpdateSchedule: (eventId: string, startsAt: string, endsAt: string) => void }) {
  if (!unlocked) return <AdminGate onUnlock={onUnlock} />;
  return <AdminDashboard state={state} onAddEvent={onAddEvent} onPublish={onPublish} onUpdateTeamPhotoSource={onUpdateTeamPhotoSource} onAddMatchPair={onAddMatchPair} onUpdateSchedule={onUpdateSchedule} />;
}

function AdminGate({ onUnlock }: { onUnlock: () => void }) {
  const [email, setEmail] = useState('admin@pepshub.local');
  const [password, setPassword] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); if (email.trim() && password.trim()) onUnlock(); };
  return <section className="page-section admin-page"><div className="container narrow"><div className="admin-gate"><div className="gate-mark"><Icon name="settings" /></div><div className="eyebrow"><span className="eyebrow-line" /> ADMIN WORKSPACE</div><h1>จัดการงาน<br /><span>ของ PepsHub</span></h1><p>เข้าสู่หลังบ้านเพื่อสร้างงาน อัปโหลด Cover และเผยแพร่ตารางให้ผู้ชม</p><form onSubmit={submit} className="login-form"><label>อีเมลผู้ดูแล<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" /></label><label>รหัสผ่าน<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="ใส่รหัสสำหรับ Local Demo" autoComplete="current-password" /></label><button className="button primary wide" type="submit">เข้าสู่ Local Demo <Icon name="arrow" /></button></form><div className="local-warning"><Icon name="spark" /><span>โหมดนี้ใช้ข้อมูลในเครื่องเท่านั้น สำหรับ production ต้องเชื่อม Firebase Authentication และกำหนดสิทธิ์ผู้ดูแล</span></div></div></div></section>;
}

type AdminSection = 'overview' | 'events' | 'schedule' | 'matches';

function AdminDashboard({ state, onAddEvent, onPublish, onUpdateTeamPhotoSource, onAddMatchPair, onUpdateSchedule }: { state: ReturnType<typeof loadState>; onAddEvent: (draft: EventDraft, cover: string) => void; onPublish: (eventId: string) => void; onUpdateTeamPhotoSource: (teamId: string, eventId: string, provider: PhotoProvider, url: string) => void; onAddMatchPair: (photoEventId: string, teamAName: string, teamBName: string) => string | undefined; onUpdateSchedule: (eventId: string, startsAt: string, endsAt: string) => void }) {
  const [section, setSection] = useState<AdminSection>('overview');
  const sections: Array<{ id: AdminSection; label: string; icon: 'home' | 'calendar' | 'users' }> = [
    { id: 'overview', label: 'ภาพรวม', icon: 'home' },
    { id: 'events', label: 'งานและอีเว้น', icon: 'calendar' },
    { id: 'schedule', label: 'ตารางงาน', icon: 'calendar' },
    { id: 'matches', label: 'คู่แข่งขันและรูป', icon: 'users' },
  ];

  return <section className="page-section admin-page"><div className="container"><div className="admin-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> ADMIN WORKSPACE</div><h1>หลังบ้าน <span>PepsHub</span></h1><p>แบ่งการทำงานเป็นหมวด เพื่อจัดการได้เร็วและไม่ต้องเลื่อนหาฟอร์มยาว ๆ</p></div><span className="local-session"><span className="mode-dot" /> Local Demo session</span></div><div className="admin-stats"><AdminStat label="งานทั้งหมด" value={String(state.events.length)} /><AdminStat label="เผยแพร่แล้ว" value={String(state.events.filter((event) => event.status === 'published' || event.status === 'live').length)} /><AdminStat label="แบบร่าง" value={String(state.events.filter((event) => event.status === 'draft').length)} /><AdminStat label="Photo Event" value={String(state.photoEvents.length)} /></div><nav className="admin-tabs" aria-label="หมวดหลังบ้าน">{sections.map((item) => <button className={`admin-tab ${section === item.id ? 'active' : ''}`} type="button" key={item.id} onClick={() => setSection(item.id)}><Icon name={item.icon} /><span>{item.label}</span></button>)}</nav><div className="admin-section-content">{section === 'overview' && <AdminOverview state={state} onNavigate={setSection} />}{section === 'events' && <div className="admin-grid"><CreateEventForm onAddEvent={onAddEvent} /><EventManager events={state.events} onPublish={onPublish} /></div>}{section === 'schedule' && <ScheduleManager events={state.events} onUpdateSchedule={onUpdateSchedule} />}{section === 'matches' && <MatchSourceManager teams={state.teams} photoEvents={state.photoEvents} matchPairs={state.matchPairs} onSave={onUpdateTeamPhotoSource} onAddPair={onAddMatchPair} />}</div></div></section>;
}

function AdminOverview({ state, onNavigate }: { state: ReturnType<typeof loadState>; onNavigate: (section: AdminSection) => void }) {
  const nextEvent = [...state.events].sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const publishedPhotoEvents = state.photoEvents.filter((event) => event.status === 'published');
  return <div className="admin-overview"><div className="admin-overview-banner"><div><span className="eyebrow"><span className="eyebrow-line" /> QUICK CONTROL</span><h2>วันนี้จะจัดการอะไร?</h2><p>เลือกหมวดที่ต้องการ แล้วทำงานเฉพาะส่วนได้ทันที</p></div><span className="admin-overview-badge"><Icon name="spark" /> {state.matchPairs.length} คู่แข่งขัน</span></div><div className="admin-quick-grid"><button className="admin-quick-card" type="button" onClick={() => onNavigate('events')}><span className="admin-quick-icon"><Icon name="calendar" /></span><span><strong>สร้างงานใหม่</strong><small>ใส่ Cover และเวลาเริ่ม–จบ</small></span><Icon name="arrow" /></button><button className="admin-quick-card" type="button" onClick={() => onNavigate('schedule')}><span className="admin-quick-icon cyan"><Icon name="calendar" /></span><span><strong>จัดตารางงาน</strong><small>แก้เวลาเริ่ม–จบในกระดานเดียว</small></span><Icon name="arrow" /></button><button className="admin-quick-card" type="button" onClick={() => onNavigate('matches')}><span className="admin-quick-icon purple"><Icon name="users" /></span><span><strong>เพิ่มคู่แข่งขัน</strong><small>ทีม A VS ทีม B และลิงก์รูปของแต่ละทีม</small></span><Icon name="arrow" /></button></div><div className="admin-overview-grid"><div className="admin-summary-card"><span className="eyebrow"><span className="eyebrow-line" /> NEXT ON BOARD</span><h3>{nextEvent?.title ?? 'ยังไม่มีงานในระบบ'}</h3><p>{nextEvent ? `${scheduleRange(nextEvent)} · ${nextEvent.venue}` : 'ไปที่ งานและอีเว้น เพื่อสร้างรายการแรก'}</p></div><div className="admin-summary-card"><span className="eyebrow"><span className="eyebrow-line" /> PHOTO MATCH</span><h3>{publishedPhotoEvents.length} อีเว้นพร้อมให้ค้นหา</h3><p>{state.matchPairs.length > 0 ? 'คู่แข่งขันถูกแยกตามอีเว้นแล้ว ผู้ชมจะเลือกอีเว้นก่อนค้นหาทีม' : 'เพิ่มคู่แข่งขันเพื่อเริ่มจัดกลุ่มทีมและรูป'}</p></div></div></div>;
}

function MatchSourceManager({ teams, photoEvents, matchPairs, onSave, onAddPair }: { teams: Team[]; photoEvents: PhotoEvent[]; matchPairs: MatchPair[]; onSave: (teamId: string, eventId: string, provider: PhotoProvider, url: string) => void; onAddPair: (photoEventId: string, teamAName: string, teamBName: string) => string | undefined }) {
  const managedPhotoEvents = photoEvents;
  const [selectedEventId, setSelectedEventId] = useState(managedPhotoEvents[0]?.id ?? '');
  const [selectedPairId, setSelectedPairId] = useState(matchPairs.find((pair) => pair.photoEventId === managedPhotoEvents[0]?.id)?.id ?? '');
  const [teamAName, setTeamAName] = useState('');
  const [teamBName, setTeamBName] = useState('');
  const selectedEvent = managedPhotoEvents.find((event) => event.id === selectedEventId);
  const eventPairs = matchPairs.filter((pair) => pair.photoEventId === selectedEventId);
  const selectedPair = eventPairs.find((pair) => pair.id === selectedPairId) ?? eventPairs[0];
  const pairTeamA = selectedPair ? teams.find((team) => team.id === selectedPair.teamAId) : undefined;
  const pairTeamB = selectedPair ? teams.find((team) => team.id === selectedPair.teamBId) : undefined;

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

  return <div className="team-source-manager"><div className="card-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> MATCH SOURCES</span><h2>คู่แข่งขันและแหล่งรูป</h2></div><span className="source-security-chip">Google only</span></div><p className="source-manager-intro">เพิ่มคู่ละ 2 ทีม เช่น ทีม A VS ทีม C แล้วค่อยผูก Google Drive หรือ Google Photos ให้แต่ละทีมในคู่นั้น</p><div className="match-pair-create"><div className="card-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> ADD MATCH PAIR</span><h3>เพิ่มคู่แข่งขัน</h3></div><span className="result-count">{eventPairs.length} คู่ในอีเว้นนี้</span></div><form className="match-pair-form" onSubmit={submitPair}><Field label="Photo Event"><select value={selectedEventId} onChange={(event) => changeEvent(event.target.value)}>{managedPhotoEvents.map((photoEvent) => <option key={photoEvent.id} value={photoEvent.id}>{photoEvent.title}{photoEvent.status === 'draft' ? ' · Draft' : ''}</option>)}</select></Field><Field label="ทีม A"><input list="photo-match-team-names" value={teamAName} onChange={(event) => setTeamAName(event.target.value)} placeholder="เช่น PEPS UNITED" /></Field><span className="match-pair-vs" aria-hidden="true">VS</span><Field label="ทีม B"><input list="photo-match-team-names" value={teamBName} onChange={(event) => setTeamBName(event.target.value)} placeholder="เช่น NORTH STAR FC" /></Field><button className="button primary" type="submit">เพิ่มคู่ <Icon name="users" /></button></form><small className="form-help">พิมพ์ชื่อทีมใหม่ได้เลย ระบบจะสร้างข้อมูลทีมแบบย่อเฉพาะที่ใช้ในคู่นี้ ไม่ต้องกรอกจังหวัดหรือรุ่นซ้ำ</small><datalist id="photo-match-team-names">{teams.map((team) => <option key={team.id} value={team.name} />)}</datalist></div><div className="match-pair-list"><div className="card-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> MATCH LIST</span><h3>คู่ที่มีอยู่ในอีเว้น</h3></div><span className="result-count">{eventPairs.length} คู่</span></div>{eventPairs.length > 0 ? eventPairs.map((pair) => { const teamA = teams.find((team) => team.id === pair.teamAId); const teamB = teams.find((team) => team.id === pair.teamBId); return <button className={`match-pair-row ${selectedPair?.id === pair.id ? 'selected' : ''}`} type="button" key={pair.id} onClick={() => setSelectedPairId(pair.id)}><span className="match-pair-label">{pair.label}</span><strong>{teamA?.name ?? 'ทีม A'}</strong><span className="match-pair-vs">VS</span><strong>{teamB?.name ?? 'ทีม B'}</strong><Icon name="chevron" /></button>; }) : <EmptyState title="ยังไม่มีคู่แข่งขันในอีเว้นนี้" description="ใส่ชื่อทีม A และทีม B ด้านบนเพื่อเริ่มจับคู่" />}</div>{selectedEvent && selectedPair && pairTeamA && pairTeamB ? <div className="pair-source-section"><div className="card-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> PHOTO SOURCES</span><h3>{selectedPair.label}: {pairTeamA.name} VS {pairTeamB.name}</h3></div><span className="source-security-chip">2 ทีม</span></div><p className="source-manager-intro">ใส่ลิงก์รูปของแต่ละทีมแยกกัน รูปจะถูกเรียกตาม Photo Event ที่เลือก</p><div className="pair-source-grid"><PairSourceCard team={pairTeamA} photoEvent={selectedEvent} onSave={onSave} /><PairSourceCard team={pairTeamB} photoEvent={selectedEvent} onSave={onSave} /></div></div> : <div className="pair-source-empty"><Icon name="camera" /><span>เลือกหรือเพิ่มคู่แข่งขัน เพื่อผูกแหล่งรูปของทีม A และทีม B</span></div>}</div>;
}

function PairSourceCard({ team, photoEvent, onSave }: { team: Team; photoEvent: PhotoEvent; onSave: (teamId: string, eventId: string, provider: PhotoProvider, url: string) => void }) {
  const currentSource = photoSourceForTeam(team.photoSources, photoEvent.id);
  const [provider, setProvider] = useState<PhotoProvider>(currentSource?.provider ?? 'google-drive');
  const [url, setUrl] = useState(currentSource?.url ?? '');
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cleanedUrl = url.trim();
    if (cleanedUrl && !isSafePhotoSourceUrl(cleanedUrl)) {
      setError('ต้องเป็นลิงก์ https จาก Google Drive หรือ Google Photos');
      return;
    }
    onSave(team.id, photoEvent.id, provider, cleanedUrl);
    setUrl(cleanedUrl);
    setError('');
  };
  return <form className="pair-source-card" onSubmit={submit}><div className="pair-source-card-head"><span className="team-initials" style={{ color: team.color, borderColor: `${team.color}55` }}>{team.shortName}</span><div><strong>{team.name}</strong><small>{team.city} · {team.category}</small></div></div><div className="form-two-col"><Field label="แหล่งรูป"><select value={provider} onChange={(event) => setProvider(event.target.value as PhotoProvider)}><option value="google-drive">Google Drive</option><option value="google-photos">Google Photos</option></select></Field><Field label="ลิงก์โฟลเดอร์ / อัลบั้ม" error={error}><input type="url" value={url} onChange={(event) => { setUrl(event.target.value); setError(''); }} placeholder="https://drive.google.com/..." /></Field></div>{currentSource && <div className="source-current"><span className="status-dot" /> ตั้งค่าแล้ว: {photoProviderLabel(currentSource.provider)}<a href={currentSource.url} target="_blank" rel="noreferrer">เปิดต้นทาง <Icon name="external" /></a></div>}<button className="button ghost wide" type="submit">บันทึกลิงก์ของ {team.shortName} <Icon name="check" /></button></form>;
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
  const scheduleEvents = [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
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

  return <section className="schedule-manager"><div className="card-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> SCHEDULE BOARD</span><h2>ตารางงาน</h2></div><span className="result-count">{scheduleEvents.length} รายการ</span></div><p className="source-manager-intro">ดูและแก้ไขช่วงเวลาของงานที่จะแสดงบนตารางหน้าเว็บได้จากจุดเดียว</p><div className="schedule-layout"><div className="schedule-board-list">{scheduleEvents.map((event) => <button className={`schedule-board-row ${event.id === selectedEvent?.id ? 'selected' : ''}`} key={event.id} onClick={() => chooseEvent(event)}><span className="schedule-board-date"><strong>{new Intl.DateTimeFormat('th-TH', { day: '2-digit' }).format(new Date(event.startsAt))}</strong><small>{new Intl.DateTimeFormat('th-TH', { month: 'short' }).format(new Date(event.startsAt))}</small></span><span className="schedule-board-copy"><strong>{event.title}</strong><small>{scheduleRange(event)} · {event.venue}</small></span><span className={`status-label ${event.status}`}>{eventStatusLabel(event.status)}</span></button>)}{scheduleEvents.length === 0 && <EmptyState title="ยังไม่มีตารางงาน" description="สร้างงานใหม่เพื่อเพิ่มรายการลงตาราง" />}</div>{selectedEvent && <form className="schedule-editor" onSubmit={submit}><span className="soft-chip cyan">แก้ไขช่วงเวลา</span><h3>{selectedEvent.title}</h3><p>{selectedEvent.venue}</p><div className="form-two-col"><Field label="เวลาเริ่ม"><input type="datetime-local" value={startsAt} onChange={(event) => { setStartsAt(event.target.value); setError(''); }} /></Field><Field label="เวลาจบ" error={error}><input type="datetime-local" value={endsAt} onChange={(event) => { setEndsAt(event.target.value); setError(''); }} /></Field></div><button className="button primary wide" type="submit">บันทึกตารางงาน <Icon name="check" /></button></form>}</div></section>;
}

function AdminStat({ label, value }: { label: string; value: string }) { return <div className="admin-stat"><span>{label}</span><strong>{value}</strong></div>; }

function CreateEventForm({ onAddEvent }: { onAddEvent: (draft: EventDraft, cover: string) => void }) {
  const [draft, setDraft] = useState<EventDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [cover, setCover] = useState('');
  const [coverError, setCoverError] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [coverUrlError, setCoverUrlError] = useState('');
  const update = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateEventDraft(draft);
    const nextCoverUrlError = validateImageUrl(coverUrl);
    setErrors(nextErrors);
    setCoverUrlError(nextCoverUrlError ?? '');
    if (Object.keys(nextErrors).length > 0 || nextCoverUrlError) return;
    onAddEvent(draft, cover || coverUrl.trim());
    setDraft(EMPTY_DRAFT);
    setCover('');
    setCoverUrl('');
    setCoverError('');
    setCoverUrlError('');
    setErrors({});
  };
  const uploadCover = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const nextError = validateImageUpload(file); setCoverError(nextError ?? ''); if (nextError) { setCover(''); return; } const reader = new FileReader(); reader.addEventListener('load', () => { setCover(typeof reader.result === 'string' ? reader.result : ''); setCoverUrl(''); setCoverUrlError(''); }); reader.readAsDataURL(file); };
  const coverPreview = cover || coverUrl;
  return <form className="create-event-card" onSubmit={submit}><div className="card-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> NEW EVENT</span><h2>สร้างงานใหม่</h2></div><span className="draft-chip">บันทึกเป็น Draft</span></div><label className="cover-upload" style={coverPreview ? { backgroundImage: `url(${coverPreview})` } : undefined}><input type="file" accept="image/*" onChange={uploadCover} /><span className="upload-overlay"><Icon name="camera" /><strong>{coverPreview ? 'เปลี่ยน Cover' : 'อัปโหลด Cover'}</strong><small>JPG, PNG ไม่เกิน 5MB</small>{coverError && <small className="upload-error">{coverError}</small>}</span></label><Field label="ลิงก์ Cover รูปภาพ" error={coverUrlError}><input type="url" value={coverUrl} onChange={(event) => { setCoverUrl(event.target.value); setCover(''); setCoverUrlError(''); }} placeholder="https://example.com/photo.jpg" /></Field><small className="form-help">วางลิงก์รูปโดยตรงจากเว็บไซต์หรือพื้นที่ฝากรูปได้ ใช้ https:// และควรเป็นลิงก์ที่เปิดเป็นรูปภาพโดยตรง</small><Field label="ชื่องาน" error={errors.title}><input value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder="เช่น PEPS LIVE CUP รอบชิง" /></Field><Field label="คำอธิบาย" error={errors.subtitle}><textarea value={draft.subtitle} onChange={(event) => update('subtitle', event.target.value)} placeholder="สรุปงานสั้น ๆ ให้ผู้ชมเข้าใจ" rows={2} /></Field><div className="form-two-col"><Field label="ประเภท"><select value={draft.kind} onChange={(event) => update('kind', event.target.value as EventDraft['kind'])}><option value="live">Live Broadcast</option><option value="photo">Photo Event</option></select></Field><Field label="สถานที่" error={errors.venue}><input value={draft.venue} onChange={(event) => update('venue', event.target.value)} placeholder="ชื่อสนาม / สถานที่" /></Field></div><div className="form-two-col"><Field label="เวลาเริ่ม" error={errors.startsAt}><input type="datetime-local" value={draft.startsAt} onChange={(event) => update('startsAt', event.target.value)} /></Field><Field label="เวลาจบ" error={errors.endsAt}><input type="datetime-local" value={draft.endsAt} onChange={(event) => update('endsAt', event.target.value)} /></Field></div><Field label="Tags"><input value={draft.tags} onChange={(event) => update('tags', event.target.value)} placeholder="LIVE, ฟุตบอล" /></Field>{draft.kind === 'live' && <Field label="ลิงก์ถ่ายทอดสด" error={errors.liveUrl}><input type="url" value={draft.liveUrl} onChange={(event) => update('liveUrl', event.target.value)} placeholder="https://..." /></Field>}<button className="button primary wide" type="submit">บันทึกเป็น Draft <Icon name="arrow" /></button></form>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className={`form-field ${error ? 'has-error' : ''}`}><span>{label}</span>{children}{error && <small>{error}</small>}</label>; }

function EventManager({ events, onPublish }: { events: PepsEvent[]; onPublish: (eventId: string) => void }) {
  return <div className="event-manager"><div className="card-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> EVENT MANAGER</span><h2>รายการงาน</h2></div><span className="result-count">{events.length} รายการ</span></div><div className="manager-list">{events.map((event) => <div className="manager-row" key={event.id}><div className="manager-thumb" style={{ backgroundImage: `url(${event.cover})` }} /><div className="manager-copy"><strong>{event.title}</strong><span>{scheduleRange(event)} · {event.venue}</span></div><span className={`status-label ${event.status}`}>{eventStatusLabel(event.status)}</span>{event.status === 'draft' ? <button className="small-button" onClick={() => onPublish(event.id)}>เผยแพร่</button> : <span className="verified"><Icon name="check" /></span>}</div>)}</div></div>;
}

function EmptyState({ title, description }: { title: string; description: string }) { return <div className="empty-state"><span className="empty-icon"><Icon name="spark" /></span><h3>{title}</h3><p>{description}</p></div>; }

function LiveModal({ event, onClose }: { event: PepsEvent; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(mouseEvent) => mouseEvent.target === mouseEvent.currentTarget && onClose()}><div className="live-modal" role="dialog" aria-modal="true" aria-label={`ดู Live ${event.title}`}><div className="player-shell" style={{ backgroundImage: `url(${event.cover})` }}><div className="player-overlay" /><div className="player-top"><span className="live-badge"><i /> LIVE</span><button className="modal-close light-close" onClick={onClose} aria-label="ปิด"><Icon name="close" /></button></div><div className="player-center"><span><Icon name="play" /></span><strong>กำลังเตรียมสัญญาณถ่ายทอดสด</strong><small>กดปุ่มด้านล่างเพื่อเปิดช่อง PEPS LIVE</small></div><div className="player-bottom"><span>{event.title}</span><span>PEPS LIVE · HD</span></div></div><div className="modal-info"><div><span className="soft-chip green">{eventStatusLabel(event.status)}</span><h2>{event.title}</h2><p>{event.subtitle}</p></div>{event.liveUrl && <a className="button primary" href={event.liveUrl} target="_blank" rel="noreferrer">เปิดช่องถ่ายทอดสด <Icon name="external" /></a>}</div></div></div>;
}

export default App;
