
import { Platform, Project, ProjectStatus, UserConnection } from './types';

export const VOICE_PRESETS = [
  { id: 'Kore', name: 'Kore', gender: 'Female', age: 'Young Adult', tone: 'Calm', description: 'Soothing, clear, and relaxed.', ethnicity: 'American' },
  { id: 'Puck', name: 'Puck', gender: 'Male', age: 'Young Adult', tone: 'Energetic', description: 'Playful, upbeat, and fun.', ethnicity: 'American' },
  { id: 'Charon', name: 'Charon', gender: 'Male', age: 'Middle Aged', tone: 'Authoritative', description: 'Deep, professional, news-anchor style.', ethnicity: 'American' },
  { id: 'Fenrir', name: 'Fenrir', gender: 'Male', age: 'Adult', tone: 'Intense', description: 'Gravelly, dramatic, and cinematic.', ethnicity: 'American' },
  { id: 'Zephyr', name: 'Zephyr', gender: 'Female', age: 'Adult', tone: 'Gentle', description: 'Warm, empathetic, and narrative.', ethnicity: 'American' },
  { id: 'Aoede', name: 'Aoede', gender: 'Female', age: 'Young', tone: 'Bright', description: 'High-pitched, cheerful, and crisp.', ethnicity: 'American' },
  { id: 'Leda', name: 'Leda', gender: 'Female', age: 'Senior', tone: 'Sophisticated', description: 'Knowledgeable, warm, and classic.', ethnicity: 'British' },
  { id: 'Orpheus', name: 'Orpheus', gender: 'Male', age: 'Adult', tone: 'Confident', description: 'Assured, narrative, and steady.', ethnicity: 'American' },
  { id: 'Pegasus', name: 'Pegasus', gender: 'Male', age: 'Senior', tone: 'Deep', description: 'Wise, storytelling, and engaging.', ethnicity: 'American' }
];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj_1',
    title: 'AI Coffee Revolution',
    topic: 'How AI is changing coffee brewing',
    tone: 'Exciting',
    platforms: [Platform.YOUTUBE, Platform.TIKTOK],
    status: ProjectStatus.PUBLISHED,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    publishedUrls: {
      [Platform.YOUTUBE]: 'https://youtube.com/shorts/example',
      [Platform.TIKTOK]: 'https://tiktok.com/@example/video/123'
    }
  },
  {
    id: 'proj_2',
    title: 'Top 5 Coding Tricks',
    topic: 'React performance hacks',
    tone: 'Educational',
    platforms: [Platform.X, Platform.INSTAGRAM],
    status: ProjectStatus.PREVIEW_READY,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now()).toISOString(),
    scriptData: {
      hook: "Stop destroying your React app's performance!",
      beats: [
        { timestamp: "0:00", visual: "Screen recording of slow app", audio: "Is your app lagging?" },
        { timestamp: "0:05", visual: "Code snippet highlighting useMemo", audio: "Use useMemo to cache expensive calculations." }
      ],
      script: "Is your app lagging? Stop destroying your React app's performance! Use useMemo to cache expensive calculations...",
      onScreenText: "React Hack #1: useMemo",
      captionFile: "1\n00:00:00,000 --> 00:00:05,000\nIs your app lagging?",
      hashtags: ["#reactjs", "#coding", "#webdev"],
      cta: "Follow for more tips",
      title: "React Performance Hacks",
      description: "Simple tips to speed up your app."
    },
    assets: {
      videoUrl: "https://picsum.photos/seed/video/1080/1920", // Mock video placeholder
      thumbnailUrl: "https://picsum.photos/seed/thumb/1080/1920"
    }
  }
];

export const INITIAL_CONNECTIONS: UserConnection[] = [
  { platform: Platform.YOUTUBE, connected: true, username: '@ViralCreator' },
  { platform: Platform.TIKTOK, connected: false },
  { platform: Platform.INSTAGRAM, connected: true, username: 'viral_studios' },
  { platform: Platform.X, connected: false }
];
