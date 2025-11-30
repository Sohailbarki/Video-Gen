

export enum ProjectStatus {
  DRAFT_INTAKE = 'DRAFT_INTAKE',
  PROMPT_DRAFTED = 'PROMPT_DRAFTED',
  GENERATING_ASSETS = 'GENERATING_ASSETS',
  THUMBNAIL_SELECTION = 'THUMBNAIL_SELECTION',
  PREVIEW_READY = 'PREVIEW_READY',
  PUBLISHING = 'PUBLISHING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED'
}

export enum Platform {
  YOUTUBE = 'YouTube Shorts',
  TIKTOK = 'TikTok',
  INSTAGRAM = 'Instagram Reels',
  X = 'X'
}

export enum AIProvider {
  GOOGLE = 'GOOGLE', // Gemini, Veo, Google TTS
  OPENAI = 'OPENAI', // GPT-4, Sora, OpenAI TTS
  ELEVENLABS = 'ELEVENLABS', // Voice only
  NATIVE = 'NATIVE'
}

export interface ScriptBeat {
  timestamp: string;
  visual: string;
  audio: string;
}

export interface ViralScript {
  hook: string;
  beats: ScriptBeat[];
  script: string; // Full voiceover text
  onScreenText: string;
  captionFile: string; // Simulation of SRT content
  hashtags: string[];
  cta: string;
  title: string;
  description: string;
}

export interface ProjectAssets {
  videoUrl?: string;
  thumbnailUrl?: string;
  audioUrl?: string;
  thumbnailCandidates?: string[];
}

export interface Revision {
  id: string;
  projectId: string;
  timestamp: string;
  scriptData: ViralScript;
  reason?: string; // e.g. "Autosave", "Manual Save", "Restore"
}

export interface ActivityLogItem {
  id: string;
  projectId: string;
  timestamp: string;
  action: string; // e.g., "Draft Updated", "Generated Assets"
  actor: string; // "User" or "System"
  details?: string;
}

export interface VisualSettings {
  mode: 'AI_GENERATED' | 'UPLOADED' | 'NONE';
  referenceImageId?: string; // asset:// link to the blob
  imagePrompt?: string; // If AI generated
}

export interface VoiceSettings {
  mode: 'AI_PRESET' | 'USER_RECORDING';
  aiVoiceName?: string; // 'Kore', 'Puck', 'Fenrir', 'Charon'
  recordingId?: string; // asset:// link to the user's recorded blob
}

export interface VideoSource {
  url: string;
  type: 'YOUTUBE' | 'TIKTOK' | 'OTHER';
  instructions?: string; // e.g. "Extract highlights", "React to this"
}

export interface PlatformMetadata {
  title?: string;
  description?: string;
  tags?: string[];
}

export interface Project {
  id: string;
  title: string;
  topic: string;
  tone: string;
  targetAudience?: string;
  platforms: Platform[];
  status: ProjectStatus;
  scriptData?: ViralScript;
  visualSettings?: VisualSettings;
  voiceSettings?: VoiceSettings;
  videoSource?: VideoSource; // New field for Remix/Repurpose
  assets?: ProjectAssets;
  platformMetadata?: Record<string, PlatformMetadata>;
  publishedUrls?: Record<string, string>;
  error?: string; // Captures failure reason
  createdAt: string;
  updatedAt: string;
}

export interface UserConnection {
  platform: Platform;
  connected: boolean;
  username?: string;
  credentials?: {
    clientId?: string;
    accessToken?: string; // Encrypted in real app
  };
}

export interface AppSettings {
  textProvider: AIProvider;
  videoProvider: AIProvider;
  ttsProvider: AIProvider;
  apiKeys: {
    google: string;
    openai: string;
    elevenlabs: string;
  };
}