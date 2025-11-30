
import { INITIAL_PROJECTS, INITIAL_CONNECTIONS } from '../constants';
import { Project, ProjectStatus, UserConnection, ViralScript, AppSettings, AIProvider, Platform, Revision, ActivityLogItem } from '../types';
import { socialService } from './socialService';
import { generateViralVideo, generateViralVoiceover, generateViralImage } from './geminiService';
import { generateOpenAIVideo, generateOpenAITTS } from './openaiService';
import { generateElevenLabsTTS } from './elevenLabsService';
import { nativeVideoGenerator } from './nativeVideoGenerator';
import { assetStorage } from './assetStorage';

const LS_KEYS = { PROJECTS: 'viral_video_projects', CONNECTIONS: 'viral_video_connections', SETTINGS: 'viral_video_settings', REVISIONS: 'viral_video_revisions', ACTIVITY: 'viral_video_activity' };
const DEFAULT_SETTINGS: AppSettings = { textProvider: AIProvider.GOOGLE, videoProvider: AIProvider.NATIVE, ttsProvider: AIProvider.GOOGLE, apiKeys: { google: '', openai: '', elevenlabs: '' } };
const loadFromLS = <T>(key: string, def: T): T => { try { const i = localStorage.getItem(key); return i ? JSON.parse(i) : def; } catch { return def; } };
const saveToLS = (key: string, val: any) => localStorage.setItem(key, JSON.stringify(val));

let projects: Project[] = loadFromLS(LS_KEYS.PROJECTS, []);
let connections: any[] = loadFromLS(LS_KEYS.CONNECTIONS, []);
let settings: AppSettings = loadFromLS(LS_KEYS.SETTINGS, DEFAULT_SETTINGS);
let revisions: any[] = loadFromLS(LS_KEYS.REVISIONS, []);
let activityLogs: any[] = loadFromLS(LS_KEYS.ACTIVITY, []);

// --- VISUAL STYLE MAP ---
const VISUAL_STYLE_MAP: Record<string, string> = {
  'Realistic / Cinematic': 'Cinematic 4k, photorealistic, anamorphic lens flare, shallow depth of field, dramatic lighting, shot on ARRI Alexa',
  'Anime / Animation': 'Japanese anime style, Studio Ghibli inspired, vibrant colors, 2D cel shaded, detailed backgrounds, emotive',
  '3D Render / Pixar Style': '3D rendered, Pixar style animation, soft volumetric lighting, cute character design, 4k, octane render, smooth textures',
  'Funny & Relatable': 'Bright high-key lighting, vibrant colors, TikTok influencer style, sharp focus, relatable atmosphere, face-forward',
  'Professional & Educational': 'Clean studio lighting, minimalist background, professional, sharp focus, high definition, corporate memphis',
  'High Energy / Hype': 'Dynamic camera angles, fast motion, bright saturated colors, high contrast, action-packed, motion blur',
  'Mysterious & Intriguing': 'Low key lighting, deep shadows, noir style, mist, cinematic atmosphere, moody',
  'Minimalist & Calm': 'Soft natural lighting, pastel colors, minimalist composition, slow smooth motion, zen, clean lines'
};

const PACING_MAP: Record<string, string> = {
  'High Energy / Hype': 'Fast-paced cuts, whip pans, dynamic zoom, energetic movement',
  'Funny & Relatable': 'Handheld camera feel, breaking the fourth wall, expressive',
  'Mysterious & Intriguing': 'Slow push-in, steadycam, suspenseful pacing',
  'Minimalist & Calm': 'Static shots, slow pans, smooth gimbal movement',
  'default': 'Cinematic smooth motion, establishing shots'
};

export const mockBackend = {
  getProjects: async () => [...projects],
  getProject: async (id: string) => projects.find(p => p.id === id),
  createProject: async (p: Project) => { projects.unshift(p); saveToLS(LS_KEYS.PROJECTS, projects); return p; },
  updateProject: async (id: string, updates: Partial<Project>, reason?: string) => {
    const idx = projects.findIndex(p => p.id === id);
    if (idx === -1) throw new Error("Not found");
    projects[idx] = { ...projects[idx], ...updates, updatedAt: new Date().toISOString() };
    saveToLS(LS_KEYS.PROJECTS, projects);
    return projects[idx];
  },
  getRevisions: async (id: string) => revisions.filter(r => r.projectId === id),
  createRevision: async (id: string, data: any, reason: string) => { revisions.unshift({ id: Date.now().toString(), projectId: id, timestamp: new Date().toISOString(), scriptData: data, reason }); saveToLS(LS_KEYS.REVISIONS, revisions); },
  getLogs: async (id: string) => activityLogs.filter(l => l.projectId === id),
  getSettings: async () => settings,
  getConnections: async () => connections,
  saveSettings: async (s: AppSettings) => { settings = s; saveToLS(LS_KEYS.SETTINGS, settings); },
  connectPlatform: async (p: string, u: string, c: any) => { connections.push({ platform: p, connected: true, username: u, credentials: c }); saveToLS(LS_KEYS.CONNECTIONS, connections); },
  disconnectPlatform: async (p: string) => { connections = connections.filter(c => c.platform !== p); saveToLS(LS_KEYS.CONNECTIONS, connections); },

  startGenerationJob: async (projectId: string) => {
    const currentSettings = loadFromLS(LS_KEYS.SETTINGS, DEFAULT_SETTINGS);
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    
    await mockBackend.updateProject(projectId, { status: ProjectStatus.GENERATING_ASSETS, error: undefined });
    const { videoProvider, ttsProvider, apiKeys } = currentSettings;
    const googleKey = apiKeys.google || process.env.API_KEY || '';
    const openaiKey = apiKeys.openai || '';
    const elevenlabsKey = apiKeys.elevenlabs || '';

    try {
      let videoUrl = '';
      let audioUrl = '';

      // 1. Audio Generation
      const ttsText = proj.scriptData?.script || "No script provided.";
      let audioBlob: Blob | null = null;

      if (proj.voiceSettings?.mode === 'USER_RECORDING' && proj.voiceSettings.recordingId) {
         audioUrl = proj.voiceSettings.recordingId;
         audioBlob = await assetStorage.getAsset(audioUrl) || null;
      } else if (ttsProvider === AIProvider.ELEVENLABS) {
         if (!elevenlabsKey) throw new Error("Missing ElevenLabs API Key.");
         audioBlob = await generateElevenLabsTTS(ttsText, elevenlabsKey);
         audioUrl = await assetStorage.saveAsset('audio', audioBlob, `ElevenLabs Audio`);
      } else if (ttsProvider === AIProvider.OPENAI) {
         if (!openaiKey) throw new Error("Missing OpenAI API Key.");
         audioBlob = await generateOpenAITTS(ttsText, 'alloy', openaiKey);
         audioUrl = await assetStorage.saveAsset('audio', audioBlob, `OpenAI TTS`);
      } else {
         if (!googleKey) throw new Error("Missing Google Key.");
         audioBlob = await generateViralVoiceover(ttsText, proj.voiceSettings?.aiVoiceName || 'Kore', googleKey);
         audioUrl = await assetStorage.saveAsset('audio', audioBlob, `Google TTS`);
      }

      if (!audioBlob) throw new Error("Failed to generate audio.");

      // 2. Video Generation
      const visualStyle = VISUAL_STYLE_MAP[proj.tone] || VISUAL_STYLE_MAP['Funny & Relatable'];
      const pacing = PACING_MAP[proj.tone] || PACING_MAP['default'];
      // JOIN ALL BEATS for narrative continuity
      const narrativeSequence = proj.scriptData?.beats?.map(b => b.visual).join(" -> ") || `Video about ${proj.topic}`;

      if (videoProvider === AIProvider.NATIVE) {
         console.log(`[Job] Native Engine selected.`);
         const beats = proj.scriptData?.beats || [];
         const imageBlobs: Blob[] = [];
         
         // Iterate through beats and generate specific images
         for (let i = 0; i < beats.length; i++) {
            const prompt = `Vertical 9:16 image. Scene Description: ${beats[i].visual}. Style: ${visualStyle}. Atmosphere: ${proj.tone}. High quality.`;
            if (googleKey) {
               try { 
                  const b = await generateViralImage(prompt, null, googleKey);
                  imageBlobs.push(b);
               } catch { 
                  imageBlobs.push(await fetch(`https://picsum.photos/seed/${projectId}_${i}/1080/1920`).then(r => r.blob())); 
               }
            } else {
               imageBlobs.push(await fetch(`https://picsum.photos/seed/${projectId}_${i}/1080/1920`).then(r => r.blob()));
            }
         }
         if (imageBlobs.length === 0) imageBlobs.push(await fetch(`https://picsum.photos/seed/${projectId}/1080/1920`).then(r => r.blob()));
         
         const videoBlob = await nativeVideoGenerator.renderVideo(imageBlobs, audioBlob, beats);
         videoUrl = await assetStorage.saveAsset('video', videoBlob, `Native Generated Video`);

      } else if (videoProvider === AIProvider.OPENAI) {
         if (!openaiKey) throw new Error("Missing OpenAI API Key.");
         const soraPrompt = `Vertical Video (9:16). Style: ${visualStyle}. Narrative Sequence: ${narrativeSequence}. Pacing: ${pacing}. High Quality.`;
         const videoBlob = await generateOpenAIVideo(soraPrompt, openaiKey);
         videoUrl = await assetStorage.saveAsset('video', videoBlob, `Sora Video`);

      } else {
         // DEFAULT: Google Veo
         if (!googleKey) throw new Error("Missing Google API Key.");
         const veoPrompt = `
            Vertical 9:16 video. 
            Narrative Sequence: ${narrativeSequence}.
            Style: ${visualStyle}. 
            Pacing: ${pacing}.
            Cinematic 4k resolution, seamless motion.
         `.trim();
         
         let refBlob = null;
         if (proj.visualSettings?.referenceImageId) {
            refBlob = await assetStorage.getAsset(proj.visualSettings.referenceImageId);
         }
         
         const videoBlob = await generateViralVideo(veoPrompt, refBlob || null, googleKey);
         videoUrl = await assetStorage.saveAsset('video', videoBlob, `Veo Video`);
      }

      // 3. Thumbnails
      const thumbs: string[] = [];
      if (proj.visualSettings?.referenceImageId) thumbs.push(proj.visualSettings.referenceImageId);
      if (googleKey && videoProvider !== AIProvider.NATIVE) {
         try {
            const b = await generateViralImage(`YouTube Thumbnail. Topic: ${proj.topic}. Text: "${proj.title}". High saturation, viral style.`, null, googleKey);
            thumbs.push(await assetStorage.saveAsset('image', b, 'AI Thumb 1'));
         } catch (e) { console.error("Thumb gen error", e); }
      }
      if (thumbs.length === 0) thumbs.push(await assetStorage.saveAsset('image', new Blob(), 'Placeholder'));

      await mockBackend.updateProject(projectId, {
        status: ProjectStatus.THUMBNAIL_SELECTION,
        assets: { videoUrl, audioUrl, thumbnailCandidates: thumbs, thumbnailUrl: thumbs[0] }
      }, "Generation Complete");

    } catch (e: any) {
      let msg = e.message;
      if (msg.includes('{')) { try { msg = JSON.parse(msg.substring(msg.indexOf('{'))).error.message; } catch {} }
      await mockBackend.updateProject(projectId, { status: ProjectStatus.FAILED, error: msg }, "Generation Failed");
    }
  },

  publishProject: async (id: string, platforms?: string[]) => {
    await mockBackend.updateProject(id, { status: ProjectStatus.PUBLISHING });
    const proj = projects.find(p => p.id === id);
    if (!proj) return;
    const conns = connections.filter(c => c.connected);
    const targets = platforms || proj.platforms;
    try {
      await Promise.all(targets.map(async p => {
         const c = conns.find(c => c.platform === p);
         if (!c) return;
         await socialService.publishVideo(p as Platform, c, {
            videoUrl: proj.assets?.videoUrl || '',
            title: proj.title, description: proj.title
         });
      }));
      await mockBackend.updateProject(id, { status: ProjectStatus.PUBLISHED });
    } catch {
      await mockBackend.updateProject(id, { status: ProjectStatus.PUBLISHED });
    }
  }
};
