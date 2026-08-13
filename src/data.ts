import type { AppState, MatchPair, PhotoAsset, PhotoEvent, PhotoSource, PepsEvent, Team } from './types';

function svgDataUrl(label: string, from: string, to: string, accent = '#a6ff5b'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="38"/></filter></defs><rect width="900" height="600" fill="url(#g)"/><circle cx="720" cy="100" r="170" fill="${accent}" opacity=".18" filter="url(#blur)"/><circle cx="130" cy="520" r="230" fill="#ffffff" opacity=".07"/><path d="M0 450C220 350 290 580 510 430s270-50 390 20v150H0Z" fill="#06101d" opacity=".42"/><text x="54" y="105" fill="#fff" font-family="Arial,sans-serif" font-size="28" font-weight="700" letter-spacing="5">PEPS LIVE</text><text x="54" y="500" fill="#fff" font-family="Arial,sans-serif" font-size="58" font-weight="800">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function photoDataUrl(label: string, from: string, to: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="800" height="1000" fill="url(#g)"/><circle cx="640" cy="240" r="170" fill="${accent}" opacity=".25"/><circle cx="90" cy="780" r="240" fill="#06101d" opacity=".24"/><path d="M0 710c160-120 260 80 410-40s260-90 390 15v315H0Z" fill="#06101d" opacity=".5"/><path d="M270 590c60-150 190-150 255 0l35 95H230Z" fill="#fff" opacity=".8"/><circle cx="397" cy="445" r="75" fill="#fff" opacity=".86"/><text x="44" y="78" fill="#fff" font-family="Arial,sans-serif" font-size="22" font-weight="700" letter-spacing="4">PEPS PHOTO</text><text x="44" y="932" fill="#fff" font-family="Arial,sans-serif" font-size="40" font-weight="800">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const teams: Team[] = [
  {
    id: 'team-peps-united',
    slug: 'peps-united',
    name: 'PEPS UNITED',
    shortName: 'PU',
    city: 'กรุงเทพฯ',
    category: 'รุ่นประชาชน',
    color: '#a6ff5b',
    logo: svgDataUrl('PU', '#193e32', '#0b1721', '#a6ff5b'),
    photoCount: 4,
    photoSources: [],
  },
  {
    id: 'team-north-star',
    slug: 'north-star',
    name: 'NORTH STAR FC',
    shortName: 'NS',
    city: 'เชียงใหม่',
    category: 'รุ่นประชาชน',
    color: '#76b7ff',
    logo: svgDataUrl('NS', '#173565', '#0b1721', '#76b7ff'),
    photoCount: 3,
    photoSources: [],
  },
  {
    id: 'team-river-city',
    slug: 'river-city',
    name: 'RIVER CITY',
    shortName: 'RC',
    city: 'นนทบุรี',
    category: 'รุ่นเยาวชน',
    color: '#ffbe70',
    logo: svgDataUrl('RC', '#673c25', '#1e1520', '#ffbe70'),
    photoCount: 2,
    photoSources: [],
  },
  {
    id: 'team-eastside',
    slug: 'eastside-athletic',
    name: 'EASTSIDE ATHLETIC',
    shortName: 'EA',
    city: 'ชลบุรี',
    category: 'รุ่นเยาวชน',
    color: '#f68dff',
    logo: svgDataUrl('EA', '#542760', '#171126', '#f68dff'),
    photoCount: 2,
    photoSources: [],
  },
];

const events: PepsEvent[] = [
  {
    id: 'event-peps-live-cup-final',
    slug: 'peps-live-cup-final',
    title: 'PEPS LIVE CUP · รอบชิงชนะเลิศ',
    subtitle: 'ถ่ายทอดสดจากสนามกลาง พร้อมทีมบรรยาย PEPS LIVE',
    kind: 'live',
    status: 'live',
    venue: 'สนามกีฬาเฉลิมพระเกียรติฯ',
    startsAt: '2026-08-13T18:30:00+07:00',
    endsAt: '2026-08-13T21:00:00+07:00',
    cover: svgDataUrl('LIVE CUP', '#142c46', '#09101d', '#a6ff5b'),
    accent: '#a6ff5b',
    liveUrl: 'https://www.youtube.com/@PEPSLIVE',
    tags: ['LIVE NOW', 'ฟุตบอล', 'รอบชิง'],
  },
  {
    id: 'event-city-night-league',
    slug: 'city-night-league-2026',
    title: 'CITY NIGHT LEAGUE 2026',
    subtitle: 'เกมค่ำคืนที่รวมคนรักกีฬาไว้ด้วยกัน',
    kind: 'live',
    status: 'published',
    venue: 'สนาม PEPS ARENA',
    startsAt: '2026-08-14T19:00:00+07:00',
    endsAt: '2026-08-14T22:00:00+07:00',
    cover: svgDataUrl('NIGHT LEAGUE', '#34205d', '#111328', '#f68dff'),
    accent: '#f68dff',
    liveUrl: 'https://www.youtube.com/@PEPSLIVE',
    tags: ['พรุ่งนี้', 'LIVE', 'ฟุตบอล'],
  },
  {
    id: 'event-rising-stars-photo',
    slug: 'rising-stars-photo-day',
    title: 'RISING STARS · PHOTO DAY',
    subtitle: 'ค้นหาภาพการแข่งขันของทีมคุณได้ในไม่กี่วินาที',
    kind: 'photo',
    status: 'published',
    venue: 'สนามกีฬาเทศบาลเมืองนนท์',
    startsAt: '2026-08-10T09:00:00+07:00',
    endsAt: '2026-08-10T17:00:00+07:00',
    cover: svgDataUrl('PHOTO DAY', '#11444e', '#0a1c2b', '#76d7ff'),
    accent: '#76d7ff',
    photoEventId: 'photo-event-rising-stars',
    tags: ['PHOTO EVENT', 'ภาพการแข่งขัน', 'ค้นหาทีม'],
  },
  {
    id: 'event-draft-demo',
    slug: 'new-event-draft',
    title: 'งานใหม่ที่ยังไม่เผยแพร่',
    subtitle: 'ตัวอย่างรายการ Draft สำหรับหลังบ้าน',
    kind: 'live',
    status: 'draft',
    venue: 'ยังไม่ระบุสนาม',
    startsAt: '2026-08-16T10:00:00+07:00',
    cover: svgDataUrl('DRAFT', '#283242', '#111827', '#94a3b8'),
    accent: '#94a3b8',
    tags: ['DRAFT'],
  },
];

const photoEvents: PhotoEvent[] = [
  {
    id: 'photo-event-rising-stars',
    eventId: 'event-rising-stars-photo',
    title: 'RISING STARS · PHOTO DAY',
    status: 'published',
    dateLabel: '10 ส.ค. 2026',
    location: 'สนามกีฬาเทศบาลเมืองนนท์',
    cover: svgDataUrl('PHOTO MATCH', '#0b5963', '#11213e', '#76d7ff'),
    teamSlugs: teams.map((team) => team.slug),
    photoCount: 11,
  },
  {
    id: 'photo-event-city-night',
    eventId: 'event-city-night-league',
    title: 'CITY NIGHT LEAGUE · PHOTO ARCHIVE',
    status: 'published',
    dateLabel: '14 ส.ค. 2026',
    location: 'สนาม PEPS ARENA',
    cover: svgDataUrl('NIGHT PHOTO', '#3b2362', '#10172d', '#f68dff'),
    teamSlugs: teams.map((team) => team.slug),
    photoCount: 0,
  },
];

const photos: PhotoAsset[] = [
  { id: 'photo-pu-01', photoEventId: 'photo-event-rising-stars', teamSlug: 'peps-united', image: photoDataUrl('PU · 01', '#234d39', '#101c2d', '#a6ff5b'), label: 'Action frame 01', capturedAt: '10:12' },
  { id: 'photo-pu-02', photoEventId: 'photo-event-rising-stars', teamSlug: 'peps-united', image: photoDataUrl('PU · 02', '#405a26', '#17223a', '#e0ff96'), label: 'Action frame 02', capturedAt: '10:28' },
  { id: 'photo-pu-03', photoEventId: 'photo-event-rising-stars', teamSlug: 'peps-united', image: photoDataUrl('PU · 03', '#644922', '#1b213a', '#ffbe70'), label: 'Action frame 03', capturedAt: '10:46' },
  { id: 'photo-pu-04', photoEventId: 'photo-event-rising-stars', teamSlug: 'peps-united', image: photoDataUrl('PU · 04', '#1c5361', '#111b2d', '#76d7ff'), label: 'Action frame 04', capturedAt: '11:04' },
  { id: 'photo-ns-01', photoEventId: 'photo-event-rising-stars', teamSlug: 'north-star', image: photoDataUrl('NS · 01', '#1e4d7a', '#11162c', '#76b7ff'), label: 'Action frame 01', capturedAt: '12:12' },
  { id: 'photo-ns-02', photoEventId: 'photo-event-rising-stars', teamSlug: 'north-star', image: photoDataUrl('NS · 02', '#343a8e', '#171832', '#aab4ff'), label: 'Action frame 02', capturedAt: '12:26' },
  { id: 'photo-ns-03', photoEventId: 'photo-event-rising-stars', teamSlug: 'north-star', image: photoDataUrl('NS · 03', '#163d54', '#211a3b', '#76d7ff'), label: 'Action frame 03', capturedAt: '12:44' },
  { id: 'photo-rc-01', photoEventId: 'photo-event-rising-stars', teamSlug: 'river-city', image: photoDataUrl('RC · 01', '#7a4829', '#23162b', '#ffbe70'), label: 'Action frame 01', capturedAt: '14:08' },
  { id: 'photo-rc-02', photoEventId: 'photo-event-rising-stars', teamSlug: 'river-city', image: photoDataUrl('RC · 02', '#5f3438', '#17233a', '#ff9aa7'), label: 'Action frame 02', capturedAt: '14:24' },
  { id: 'photo-ea-01', photoEventId: 'photo-event-rising-stars', teamSlug: 'eastside-athletic', image: photoDataUrl('EA · 01', '#672c6d', '#18162e', '#f68dff'), label: 'Action frame 01', capturedAt: '15:12' },
  { id: 'photo-ea-02', photoEventId: 'photo-event-rising-stars', teamSlug: 'eastside-athletic', image: photoDataUrl('EA · 02', '#3b2769', '#111d34', '#b6a0ff'), label: 'Action frame 02', capturedAt: '15:38' },
];

const drivePreviewUrls = [
  'https://lh3.googleusercontent.com/d/1ABPibzVzSEmQx2cN1IpuQk4XCgW0W5RP=w1200',
  'https://lh3.googleusercontent.com/d/1ofOqChDEZmZwsVkwAOUi8iDYc5b_VO3K=w1200',
  'https://lh3.googleusercontent.com/d/1vJXN6uJ0OFLj2l_aiuZIpuMWx0b4kduu=w1200',
  'https://lh3.googleusercontent.com/d/1weuRSyqlnmC9J5Iw8LwPyO4Xc9VHdqr1=w1200',
  'https://lh3.googleusercontent.com/d/1qmQnutqpMrD4GpMME-qkJFzeb6vaq-Ax=w1200',
  'https://lh3.googleusercontent.com/d/1GG4oNKeE4UmLX5TMrnM8rkePptqrAPK-=w1200',
];

const demoMatchSources: PhotoSource[] = [
  {
    provider: 'google-drive',
    url: 'https://drive.google.com/drive/folders/1gm-U2DBvJouPh8DW-ZQVNYF7_T89iGm7?usp=drive_link',
    label: 'โฟลเดอร์ Google Drive สำหรับทดสอบ',
    previewUrls: drivePreviewUrls,
    syncMode: 'auto',
    syncStatus: 'ready',
  },
  {
    provider: 'google-photos',
    url: 'https://photos.app.goo.gl/pZirhMbcr96sfz9k9',
    label: 'อัลบั้ม Google Photos สำหรับทดสอบ',
    syncMode: 'auto',
    syncStatus: 'pending',
  },
];

const matchPairs: MatchPair[] = [
  { id: 'match-pair-rising-stars-1', photoEventId: 'photo-event-rising-stars', teamAId: 'team-peps-united', teamBId: 'team-north-star', label: 'คู่ที่ 1' },
  { id: 'match-pair-rising-stars-2', photoEventId: 'photo-event-rising-stars', teamAId: 'team-river-city', teamBId: 'team-eastside', label: 'คู่ที่ 2' },
  { id: 'match-pair-city-night-1', photoEventId: 'photo-event-city-night', teamAId: 'team-peps-united', teamBId: 'team-river-city', label: 'คู่ที่ 1' },
];

const seededMatchPairs = matchPairs.map((pair, index) => index === 0 ? { ...pair, photoSources: demoMatchSources } : pair);

export const seedState: AppState = { events, teams, photoEvents, photos, matchPairs: seededMatchPairs };

export { events, teams, photoEvents, photos, seededMatchPairs as matchPairs };
