
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Edit2, CheckCircle, Play, Pause, Share2, FileText, Video, Mic, RefreshCw, AlertCircle, Download, ShieldCheck, Loader2, Volume2, VolumeX, Maximize2, Settings, Zap, Check, Key, Link as LinkIcon, History, RotateCcw, Save, Image as ImageIcon, Upload, Wand2, Trash2, X, Info, Grid, ChevronUp, ChevronDown, Plus, MinusCircle, Repeat, Filter, User } from 'lucide-react';
import { mockBackend } from '../services/mockBackend';
import { Project, ProjectStatus, ViralScript, AppSettings, Platform, PlatformMetadata, UserConnection } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { assetStorage, StoredAsset } from '../services/assetStorage';
import { generateViralImage, generateViralVoiceover } from '../services/geminiService';
import { VOICE_PRESETS } from '../constants';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => { const handler = setTimeout(() => setDebouncedValue(value), delay); return () => clearTimeout(handler); }, [value, delay]);
  return debouncedValue;
}

const CreativeAssetsPanel = React.memo<{ project: Project; onUpdate: (updates: Partial<Project>) => void; }>(({ project, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'visuals' | 'audio'>('visuals');
  const [imagePrompt, setImagePrompt] = useState(project.visualSettings?.imagePrompt || `Viral thumbnail for ${project.topic}`);
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [refImageUrl, setRefImageUrl] = useState<string | null>(null);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<StoredAsset[]>([]);
  const [voiceMode, setVoiceMode] = useState<'AI' | 'RECORDING'>(project.voiceSettings?.mode === 'USER_RECORDING' ? 'RECORDING' : 'AI');
  const [selectedVoice, setSelectedVoice] = useState(project.voiceSettings?.aiVoiceName || 'Kore');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Voice Filtering State
  const [filterGender, setFilterGender] = useState<string>('All');
  const [filterTone, setFilterTone] = useState<string>('All');
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);

  useEffect(() => {
    const loadAssets = async () => {
      if (project.visualSettings?.referenceImageId) { const blob = await assetStorage.getAsset(project.visualSettings.referenceImageId); if (blob) setRefImageUrl(URL.createObjectURL(blob)); }
      if (project.voiceSettings?.recordingId) { const blob = await assetStorage.getAsset(project.voiceSettings.recordingId); if (blob) setRecordedAudioUrl(URL.createObjectURL(blob)); }
    };
    loadAssets();
  }, [project.id, project.visualSettings?.referenceImageId, project.voiceSettings?.recordingId]);

  useEffect(() => { if (showLibraryModal) assetStorage.listAssets().then(assets => setLibraryAssets(assets.filter(a => a.type === 'image'))); }, [showLibraryModal]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const assetId = await assetStorage.saveAsset('image', file, file.name); 
      setRefImageUrl(URL.createObjectURL(file));
      onUpdate({ visualSettings: { mode: 'UPLOADED', referenceImageId: assetId } });
    }
  };
  const handleSelectFromLibrary = async (asset: StoredAsset) => {
    setRefImageUrl(URL.createObjectURL(asset.blob));
    onUpdate({ visualSettings: { mode: 'UPLOADED', referenceImageId: asset.id } });
    setShowLibraryModal(false);
  };
  const handleGenerateImage = async () => {
    setIsGeneratingImg(true);
    try {
      const settings = await mockBackend.getSettings();
      const apiKey = settings.apiKeys.google || process.env.API_KEY;
      let refBlob = null;
      if (project.visualSettings?.referenceImageId) refBlob = await assetStorage.getAsset(project.visualSettings.referenceImageId) || null;
      const blob = await generateViralImage(imagePrompt, refBlob, apiKey);
      const assetId = await assetStorage.saveAsset('image', blob, imagePrompt.substring(0, 20)); 
      setRefImageUrl(URL.createObjectURL(blob));
      onUpdate({ visualSettings: { mode: 'AI_GENERATED', referenceImageId: assetId, imagePrompt: imagePrompt } });
    } catch (e: any) { alert(e.message); } finally { setIsGeneratingImg(false); }
  };
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const assetId = await assetStorage.saveAsset('audio', blob, `Voice ${Date.now()}`);
        setRecordedAudioUrl(URL.createObjectURL(blob));
        onUpdate({ voiceSettings: { mode: 'USER_RECORDING', recordingId: assetId } });
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e: any) { alert(e.message); }
  };
  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };

  const handleVoicePreview = async (voiceName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingPreview === voiceName) return;
    setPlayingPreview(voiceName);
    try {
      const settings = await mockBackend.getSettings();
      const apiKey = settings.apiKeys.google || process.env.API_KEY;
      const blob = await generateViralVoiceover("Hello, this is my voice.", voiceName, apiKey);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { setPlayingPreview(null); URL.revokeObjectURL(url); };
      audio.play();
    } catch (err) {
      console.error(err);
      setPlayingPreview(null);
    }
  };

  const filteredVoices = VOICE_PRESETS.filter(v => {
    if (filterGender !== 'All' && v.gender !== filterGender) return false;
    if (filterTone !== 'All' && v.tone !== filterTone) return false;
    return true;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-full flex flex-col">
       <div className="p-4 border-b border-slate-800 bg-slate-900"><h3 className="font-bold text-white flex items-center gap-2"><Wand2 size={18} className="text-brand-400" /> Creative Studio</h3></div>
       <div className="flex border-b border-slate-800">
         <button onClick={() => setActiveTab('visuals')} className={`flex-1 p-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'visuals' ? 'text-brand-400 border-b-2 border-brand-500' : 'text-slate-500'}`}><ImageIcon size={14} className="inline mr-2"/>Visuals</button>
         <button onClick={() => setActiveTab('audio')} className={`flex-1 p-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'audio' ? 'text-brand-400 border-b-2 border-brand-500' : 'text-slate-500'}`}><Mic size={14} className="inline mr-2"/>Voice</button>
       </div>
       <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
         {activeTab === 'visuals' && (
           <div className="space-y-4">
             {refImageUrl ? <div className="relative rounded-lg overflow-hidden border border-slate-700"><img src={refImageUrl} className="w-full aspect-[9/16] object-cover"/><button onClick={() => { setRefImageUrl(null); onUpdate({ visualSettings: undefined }); }} className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full"><Trash2 size={14}/></button></div> : <div className="aspect-[9/16] bg-slate-950 border-2 border-dashed border-slate-800 rounded-lg flex items-center justify-center text-slate-600"><ImageIcon size={24}/></div>}
             <div className="flex gap-2"><button onClick={() => setShowLibraryModal(true)} className="flex-1 py-2 border border-slate-700 rounded bg-slate-800 text-xs font-bold hover:bg-slate-700">Library</button><label className="flex-1 py-2 border border-slate-700 rounded bg-slate-800 text-xs font-bold hover:bg-slate-700 text-center cursor-pointer">Upload<input type="file" hidden onChange={handleImageUpload}/></label></div>
             <div className="pt-4 border-t border-slate-800 space-y-2"><textarea className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs" value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} placeholder="Image prompt..."/><button onClick={handleGenerateImage} disabled={isGeneratingImg} className="w-full bg-brand-900/50 border border-brand-800 py-2 rounded text-xs font-bold text-brand-200">{isGeneratingImg ? <Loader2 className="animate-spin inline mr-2"/> : <Wand2 className="inline mr-2"/>} Generate</button></div>
           </div>
         )}
         {activeTab === 'audio' && (
           <div className="space-y-4">
              <div className="flex gap-2 p-1 bg-slate-950 rounded-lg border border-slate-800">
                <button onClick={() => { setVoiceMode('AI'); onUpdate({ voiceSettings: { mode: 'AI_PRESET', aiVoiceName: selectedVoice } }); }} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${voiceMode === 'AI' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>AI Voice</button>
                <button onClick={() => setVoiceMode('RECORDING')} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${voiceMode === 'RECORDING' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>My Recording</button>
              </div>

              {voiceMode === 'AI' ? (
                <div className="space-y-3 animate-in fade-in">
                  {/* Filters */}
                  <div className="flex gap-2">
                     <select 
                       value={filterGender} 
                       onChange={(e) => setFilterGender(e.target.value)}
                       className="bg-slate-950 border border-slate-700 text-xs text-white rounded p-1.5 flex-1 focus:ring-1 focus:ring-brand-500 outline-none"
                     >
                        <option value="All">All Genders</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                     </select>
                     <select 
                       value={filterTone} 
                       onChange={(e) => setFilterTone(e.target.value)}
                       className="bg-slate-950 border border-slate-700 text-xs text-white rounded p-1.5 flex-1 focus:ring-1 focus:ring-brand-500 outline-none"
                     >
                        <option value="All">All Tones</option>
                        <option value="Calm">Calm</option>
                        <option value="Energetic">Energetic</option>
                        <option value="Authoritative">Authoritative</option>
                        <option value="Deep">Deep</option>
                        <option value="Gentle">Gentle</option>
                     </select>
                  </div>

                  {/* Voice List */}
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {filteredVoices.map(v => (
                      <div 
                        key={v.id} 
                        onClick={() => { setSelectedVoice(v.id); onUpdate({ voiceSettings: { mode: 'AI_PRESET', aiVoiceName: v.id } }); }} 
                        className={`p-3 rounded-lg border cursor-pointer transition-all hover:border-slate-600 ${selectedVoice === v.id ? 'bg-brand-900/20 border-brand-500 ring-1 ring-brand-500/50' : 'bg-slate-950 border-slate-800'}`}
                      >
                         <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                               <div className={`w-2 h-2 rounded-full ${selectedVoice === v.id ? 'bg-brand-500' : 'bg-slate-700'}`}></div>
                               <span className="font-bold text-sm text-white">{v.name}</span>
                            </div>
                            <button 
                              onClick={(e) => handleVoicePreview(v.id, e)}
                              className="p-1.5 rounded-full hover:bg-slate-800 text-brand-400 transition-colors"
                              title="Preview Voice"
                            >
                               {playingPreview === v.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
                            </button>
                         </div>
                         <p className="text-[10px] text-slate-400 line-clamp-2 mb-2">{v.description}</p>
                         <div className="flex flex-wrap gap-1">
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">{v.gender}</span>
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">{v.age}</span>
                            <span className="text-[10px] bg-slate-800 text-brand-400/80 px-1.5 py-0.5 rounded border border-slate-700">{v.tone}</span>
                         </div>
                      </div>
                    ))}
                    {filteredVoices.length === 0 && <div className="text-center text-xs text-slate-500 py-4">No voices match your filters.</div>}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 bg-slate-950 rounded-xl border border-slate-800 border-dashed animate-in fade-in">
                  {recordedAudioUrl ? (
                    <div className="px-4">
                      <audio src={recordedAudioUrl} controls className="w-full mb-3 h-8"/>
                      <button onClick={() => { setRecordedAudioUrl(null); onUpdate({ voiceSettings: { mode: 'USER_RECORDING' } }); }} className="text-xs text-red-400 hover:text-red-300 flex items-center justify-center gap-1 mx-auto"><Trash2 size={12}/> Delete & Record New</button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                       <button onClick={isRecording ? stopRecording : startRecording} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${isRecording ? 'bg-red-500 animate-pulse ring-4 ring-red-500/30' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
                          {isRecording ? <div className="w-5 h-5 bg-white rounded-sm"></div> : <Mic size={24}/>}
                       </button>
                       <p className="text-xs text-slate-500">{isRecording ? "Recording... Tap to stop" : "Tap to record your voice"}</p>
                    </div>
                  )}
                </div>
              )}
           </div>
         )}
       </div>
       {showLibraryModal && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-slate-900 w-full max-w-lg rounded-xl p-4"><div className="flex justify-between mb-4"><h3 className="font-bold">Library</h3><button onClick={() => setShowLibraryModal(false)}><X/></button></div><div className="grid grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto">{libraryAssets.map(a => <div key={a.id} className="aspect-square relative"><img src={URL.createObjectURL(a.blob)} onClick={() => { onUpdate({ visualSettings: { mode: 'UPLOADED', referenceImageId: a.id } }); setShowLibraryModal(false); }} className="w-full h-full object-cover rounded cursor-pointer hover:opacity-80"/></div>)}</div></div></div>}
    </div>
  );
});

const DraftView = React.memo<{ 
  project: Project; 
  onSave: (updates: Partial<Project>, reason: string) => Promise<void>; 
  onApprove: () => void 
}>(({ project, onSave, onApprove }) => {
  const [script, setScript] = useState<ViralScript>(project.scriptData!);
  const debouncedScript = useDebounce(script, 2000);
  
  useEffect(() => { 
    if (JSON.stringify(debouncedScript) !== JSON.stringify(project.scriptData)) {
      onSave({ scriptData: debouncedScript }, "Autosave");
    }
  }, [debouncedScript]);

  const handleBeatChange = (index: number, field: 'visual' | 'audio', value: string) => {
    const newBeats = [...script.beats];
    newBeats[index] = { ...newBeats[index], [field]: value };
    setScript({ ...script, beats: newBeats });
  };

  const addBeat = () => {
    const newBeats = [...script.beats, { timestamp: "0:xx", visual: "New Scene", audio: "" }];
    setScript({ ...script, beats: newBeats });
  };

  const removeBeat = (index: number) => {
    if (script.beats.length <= 1) return;
    const newBeats = script.beats.filter((_, i) => i !== index);
    setScript({ ...script, beats: newBeats });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
       <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><FileText className="text-brand-400"/> Concept Draft & Scene Editor</h2>
          
          <div className="space-y-6">
             {/* Hook */}
             <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800/50">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">The Hook (0-3s)</label>
                <textarea 
                  className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:border-brand-500 text-sm" 
                  value={script.hook} 
                  onChange={e => setScript({ ...script, hook: e.target.value })} 
                />
             </div>

             {/* SCENE EDITOR (VISUAL TIMELINE) */}
             <div>
                <div className="flex justify-between items-center mb-3">
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Scene Breakdown (Beats)</label>
                   <button onClick={addBeat} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 font-bold"><Plus size={14}/> Add Scene</button>
                </div>
                
                <div className="space-y-4">
                  {script.beats.map((b, i) => (
                    <div key={i} className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex gap-4 items-start hover:border-slate-700 transition-colors group">
                       <div className="flex flex-col items-center min-w-[50px] pt-2">
                          <div className="bg-slate-800 rounded px-2 py-1 text-xs font-mono text-brand-400 mb-2">{b.timestamp}</div>
                          <button onClick={() => removeBeat(i)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><MinusCircle size={16}/></button>
                       </div>
                       <div className="flex-1 space-y-3">
                          <div>
                             <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Visual Description (Camera/Action/Lighting)</label>
                             <textarea 
                                className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm text-slate-300 focus:border-brand-500 min-h-[96px] resize-y"
                                value={b.visual}
                                onChange={e => handleBeatChange(i, 'visual', e.target.value)}
                                placeholder="Describe camera angle, lighting, and action..."
                             />
                          </div>
                          <div>
                             <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Audio / Voiceover</label>
                             <input 
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-400 focus:border-brand-500 italic"
                                value={b.audio}
                                onChange={e => handleBeatChange(i, 'audio', e.target.value)}
                                placeholder="Spoken text or SFX..."
                             />
                          </div>
                       </div>
                       <div className="text-xs font-bold text-slate-700 pt-2">#{i + 1}</div>
                    </div>
                  ))}
                </div>
             </div>

             {/* Script */}
             <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Full Voice Script (Generated)</label>
                <textarea className="w-full bg-slate-950 border border-slate-700 rounded p-3 h-32 text-slate-300 leading-relaxed" value={script.script} onChange={e => setScript({ ...script, script: e.target.value })} />
             </div>
          </div>
       </div>

       <div className="flex flex-col gap-4">
         <CreativeAssetsPanel project={project} onUpdate={(u) => onSave(u, "Update")} />
         <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
            <h4 className="font-bold text-white mb-2">Ready to Generate?</h4>
            <p className="text-xs text-slate-400 mb-4">The "Visual Description" fields above will be used to generate your video scenes. Make sure they are detailed!</p>
            <button onClick={onApprove} className="w-full bg-green-600 hover:bg-green-500 py-3 rounded-lg font-bold text-white flex justify-center gap-2 transition-all hover:scale-105 active:scale-95">
               <CheckCircle size={18}/> Approve & Generate
            </button>
         </div>
       </div>
    </div>
  );
});

const GeneratingView: React.FC = () => <div className="py-20 text-center"><Loader2 className="animate-spin inline mr-2"/> Generating...</div>;
const FailedView: React.FC<{error?: string, onRetry: () => void}> = ({error, onRetry}) => <div className="py-20 text-center text-red-400">{error} <button onClick={onRetry} className="underline ml-2">Retry</button></div>;

const ThumbnailSelectionView: React.FC<{project: Project, onSelect: (u: string)=>void}> = ({ project, onSelect }) => {
  const [thumbnails, setThumbnails] = useState<{id: string, url: string}[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!project.assets?.thumbnailCandidates) return;
      const loaded = await Promise.all(project.assets.thumbnailCandidates.map(async (id) => {
         const blob = await assetStorage.getAsset(id);
         return blob ? { id, url: URL.createObjectURL(blob) } : null;
      }));
      setThumbnails(loaded.filter(Boolean) as any);
    };
    load();
    return () => thumbnails.forEach(t => URL.revokeObjectURL(t.url));
  }, [project.assets?.thumbnailCandidates]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in">
       <div className="text-center mb-8">
         <h2 className="text-2xl font-bold text-white mb-2">Select a Thumbnail</h2>
         <p className="text-slate-400">Choose the best cover image for your video to proceed.</p>
       </div>
       
       {thumbnails.length === 0 ? (
          <div className="flex flex-col items-center gap-4">
             <Loader2 className="animate-spin text-brand-500" size={32} />
             <p className="text-slate-500">Loading assets...</p>
          </div>
       ) : (
         <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl w-full px-4">
            {thumbnails.map((t) => (
              <div 
                key={t.id} 
                className="group relative aspect-[9/16] bg-slate-800 rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-brand-500 hover:shadow-lg hover:shadow-brand-500/20 transition-all transform hover:-translate-y-1"
                onClick={() => onSelect(t.id)}
              >
                 <img src={t.url} alt="Thumbnail candidate" className="w-full h-full object-cover" />
                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-brand-600 text-white px-6 py-2 rounded-full font-bold shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                       Select
                    </div>
                 </div>
              </div>
            ))}
         </div>
       )}
    </div>
  );
};

const PreviewView = React.memo<{ 
  project: Project; 
  onPublish: (platforms: Platform[]) => void;
  onRegenerate: () => void;
  onUpdate: (updates: Partial<Project>) => void;
}>(({ project, onPublish, onRegenerate, onUpdate }) => {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(project.platforms);
  const [metadata, setMetadata] = useState<Record<Platform, PlatformMetadata>>({} as any);
  const [blobV, setBlobV] = useState('');
  const [blobA, setBlobA] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false); 
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     let vUrl = '', aUrl = '';
     const h = async () => {
        if (project.assets?.videoUrl) { const b = await assetStorage.getAsset(project.assets.videoUrl); if (b) { vUrl = URL.createObjectURL(b); setBlobV(vUrl); } }
        if (project.assets?.audioUrl) { const b = await assetStorage.getAsset(project.assets.audioUrl); if (b) { aUrl = URL.createObjectURL(b); setBlobA(aUrl); } }
     };
     h();
     const m = { ...project.platformMetadata };
     Object.values(Platform).forEach(p => { if (!m[p]) m[p] = { title: project.title, description: project.scriptData?.description || '', tags: project.scriptData?.hashtags || [] }; });
     setMetadata(m as any);
     return () => { if (vUrl) URL.revokeObjectURL(vUrl); if (aUrl) URL.revokeObjectURL(aUrl); };
  }, [project.assets]);

  const togglePlay = () => {
    if (videoRef.current?.paused) { videoRef.current.play(); audioRef.current?.play(); setIsPlaying(true); } 
    else { videoRef.current?.pause(); audioRef.current?.pause(); setIsPlaying(false); }
  };
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
     const t = (Number(e.target.value) / 100) * (videoRef.current?.duration || 1);
     if (videoRef.current) videoRef.current.currentTime = t;
     if (audioRef.current) audioRef.current.currentTime = t;
     setProgress(Number(e.target.value));
  };

  const toggleLoop = () => {
    setIsLooping(!isLooping);
    if (videoRef.current) videoRef.current.loop = !isLooping;
    if (audioRef.current) audioRef.current.loop = !isLooping;
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (videoRef.current) videoRef.current.muted = newMuted;
    if (audioRef.current) audioRef.current.muted = newMuted;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { containerRef.current?.requestFullscreen(); } else { document.exitFullscreen(); }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (isLooping) {
       togglePlay(); 
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
       <div>
          <div ref={containerRef} className="bg-black rounded-xl aspect-[9/16] flex items-center justify-center overflow-hidden relative group" onMouseEnter={() => setShowControls(true)} onMouseLeave={() => isPlaying && setShowControls(false)}>
             {blobV ? (
               <video 
                 ref={videoRef} 
                 src={blobV} 
                 className="w-full h-full object-contain" 
                 loop={isLooping} 
                 muted={isMuted} 
                 playsInline 
                 onClick={togglePlay} 
                 onEnded={handleEnded} 
                 onTimeUpdate={(e: any) => setProgress((e.target.currentTime / e.target.duration) * 100)} 
               />
             ) : <div className="text-slate-500">No Video</div>}
             {blobA && <audio ref={audioRef} src={blobA} loop={isLooping} />}
             
             <div className={`absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
               <input type="range" min="0" max="100" value={progress} onChange={handleSeek} className="w-full h-1 mb-3 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-brand-500" />
               <div className="flex justify-between items-center text-white">
                 <div className="flex items-center gap-4">
                   <button onClick={togglePlay} className="hover:text-brand-400 transition-colors">{isPlaying ? <Pause size={24} fill="currentColor"/> : <Play size={24} fill="currentColor"/>}</button>
                   <div className="flex items-center gap-2 group/vol">
                     <button onClick={toggleMute} className="hover:text-brand-400">{isMuted || volume === 0 ? <VolumeX size={20}/> : <Volume2 size={20}/>}</button>
                   </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <button onClick={toggleLoop} className={`hover:text-brand-400 transition-colors ${isLooping ? 'text-brand-500' : 'text-white'}`} title={isLooping ? "Loop On" : "Loop Off"}><Repeat size={20}/></button>
                    <button onClick={toggleFullscreen} className="hover:text-brand-400"><Maximize2 size={20}/></button>
                 </div>
               </div>
             </div>
             
             {!isPlaying && blobV && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20"><Play size={32} fill="white" className="text-white ml-1" /></div></div>}
          </div>
          <div className="flex gap-2 mt-4 justify-center"><button onClick={onRegenerate} className="px-4 py-2 bg-slate-800 rounded text-sm text-white hover:bg-slate-700 transition-colors">Regenerate</button></div>
       </div>
       <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col h-full overflow-hidden">
          <h3 className="font-bold mb-4 text-white">Publish Metadata</h3>
          <button onClick={() => onPublish(selectedPlatforms)} className="w-full bg-brand-600 hover:bg-brand-500 mt-4 py-3 rounded font-bold text-white shadow-lg transition-all">Publish All</button>
       </div>
    </div>
  );
});

export const ProjectWorkflow: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
     mockBackend.getProject(id!).then(p => { if (p) setProject(p); else navigate('/'); });
     const i = setInterval(async () => {
        if (project?.status === ProjectStatus.GENERATING_ASSETS) {
           const u = await mockBackend.getProject(id!);
           if (u && u.status !== project.status) setProject(u);
        }
     }, 2000);
     return () => clearInterval(i);
  }, [id, project?.status]);

  const update = async (u: Partial<Project>, r = "Update") => { if (project) setProject(await mockBackend.updateProject(project.id, u, r)); };
  
  if (!project) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-slate-500"/></div>;

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto space-y-6">
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-4"><Link to="/" className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"><ChevronLeft size={24} /></Link><h1 className="text-2xl font-bold flex items-center gap-3">{project.title} <StatusBadge status={project.status} /></h1></div>
       </div>
       <div className="flex-1 min-h-0">
          {(project.status === ProjectStatus.DRAFT_INTAKE || project.status === ProjectStatus.PROMPT_DRAFTED) && <DraftView project={project} onSave={update} onApprove={() => { setProject({...project, status: ProjectStatus.GENERATING_ASSETS}); mockBackend.startGenerationJob(project.id).catch(e => setProject({...project, status: ProjectStatus.FAILED, error: e.message})); }} />}
          {project.status === ProjectStatus.GENERATING_ASSETS && <GeneratingView />}
          {project.status === ProjectStatus.THUMBNAIL_SELECTION && <ThumbnailSelectionView project={project} onSelect={url => update({ status: ProjectStatus.PREVIEW_READY, assets: { ...project.assets, thumbnailUrl: url } })} />}
          {project.status === ProjectStatus.FAILED && <FailedView error={project.error} onRetry={() => { setProject({...project, status: ProjectStatus.GENERATING_ASSETS}); mockBackend.startGenerationJob(project.id); }} />}
          {(project.status === ProjectStatus.PREVIEW_READY || project.status === ProjectStatus.PUBLISHED) && <PreviewView project={project} onPublish={pl => mockBackend.publishProject(project.id, pl).then(() => update({ status: ProjectStatus.PUBLISHED }))} onRegenerate={() => { setProject({...project, status: ProjectStatus.GENERATING_ASSETS}); mockBackend.startGenerationJob(project.id); }} onUpdate={update} />}
       </div>
    </div>
  );
};
