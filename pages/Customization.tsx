
import React, { useState, useEffect, useRef } from 'react';
import { ImageIcon, Mic, Upload, Trash2, Wand2, Loader2, Play, Pause, AlertCircle, CheckCircle, X, Download, Save, RefreshCw, ArrowRight } from 'lucide-react';
import { assetStorage, StoredAsset } from '../services/assetStorage';
import { generateViralImage, generateViralVoiceover } from '../services/geminiService';
import { mockBackend } from '../services/mockBackend';

export const Customization: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'visuals' | 'audio'>('visuals');
  const [assets, setAssets] = useState<StoredAsset[]>([]);
  const [loading, setLoading] = useState(true);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Generation State
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Staging / Modification State
  const [stagingAsset, setStagingAsset] = useState<{ blob: Blob; name: string } | null>(null);
  const [modificationPrompt, setModificationPrompt] = useState('');
  const [isModifying, setIsModifying] = useState(false);
  const [modifiedBlob, setModifiedBlob] = useState<Blob | null>(null);

  // Playback State
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const [playingPreviewVoice, setPlayingPreviewVoice] = useState<string | null>(null);

  // Lightbox State
  const [lightboxAsset, setLightboxAsset] = useState<StoredAsset | null>(null);

  useEffect(() => {
    loadAssets();
  }, [activeTab]);

  const loadAssets = async () => {
    setLoading(true);
    const all = await assetStorage.listAssets();
    const filtered = all.filter(a => activeTab === 'visuals' ? a.type === 'image' : a.type === 'audio');
    setAssets(filtered);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this asset?")) {
      await assetStorage.deleteAsset(id);
      if (lightboxAsset?.id === id) setLightboxAsset(null);
      loadAssets();
    }
  };

  // 1. Intercept Upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (activeTab === 'audio') {
        // Audio saves immediately (no modification needed usually)
        await assetStorage.saveAsset('audio', file, file.name);
        loadAssets();
      } else {
        // Images go to Staging
        setStagingAsset({ blob: file, name: file.name });
        setModifiedBlob(null);
        setModificationPrompt('');
      }
      // Reset input
      e.target.value = '';
    }
  };

  // 2. Modify Logic (Image-to-Image)
  const handleModifyStagedAsset = async () => {
    if (!stagingAsset || !modificationPrompt) return;
    setIsModifying(true);
    try {
      const settings = await mockBackend.getSettings();
      const apiKey = settings.apiKeys.google || process.env.API_KEY;
      
      // Use the staging blob as reference
      const resultBlob = await generateViralImage(modificationPrompt, stagingAsset.blob, apiKey);
      setModifiedBlob(resultBlob);
    } catch (e: any) {
      console.error(e);
      alert(`Modification failed: ${e.message}`);
    } finally {
      setIsModifying(false);
    }
  };

  // 3. Save Final Result
  const handleSaveStaged = async (useModified: boolean) => {
    if (!stagingAsset) return;
    
    const blobToSave = useModified && modifiedBlob ? modifiedBlob : stagingAsset.blob;
    const namePrefix = useModified ? 'Modified: ' : '';
    const name = `${namePrefix}${stagingAsset.name}`;

    await assetStorage.saveAsset('image', blobToSave, name);
    
    // Cleanup
    setStagingAsset(null);
    setModifiedBlob(null);
    loadAssets();
  };

  const handleDownload = (asset: StoredAsset) => {
    const url = URL.createObjectURL(asset.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = asset.name || `download.${asset.blob.type.split('/')[1]}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Voice Recorder ---
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone access is not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mimeType = '';
      const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          break;
        }
      }

      let recorder;
      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      } catch (err) {
        recorder = new MediaRecorder(stream);
        mimeType = '';
      }
      
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const type = mimeType || recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        await assetStorage.saveAsset('audio', blob, `Recording ${new Date().toLocaleTimeString()}`);
        loadAssets();
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start(1000);
      setIsRecording(true);
    } catch (e: any) {
      console.error(e);
      alert(`Microphone access failed: ${e.message}.`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // --- Standard Generate (Text-to-Image) ---
  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const settings = await mockBackend.getSettings();
      const apiKey = settings.apiKeys.google || process.env.API_KEY;
      const blob = await generateViralImage(prompt, null, apiKey); // No ref image here
      
      const name = prompt.length > 30 ? prompt.substring(0, 30) + '...' : prompt;
      await assetStorage.saveAsset('image', blob, name);
      setPrompt('');
      loadAssets();
    } catch (e: any) {
      console.error(e);
      alert(`Generation failed: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // --- AI Voice Preview ---
  const handlePreviewVoice = async (voiceName: string) => {
    if (playingPreviewVoice === voiceName) return; 
    setPlayingPreviewVoice(voiceName);
    try {
      const settings = await mockBackend.getSettings();
      const apiKey = settings.apiKeys.google || process.env.API_KEY;
      const text = "This is a preview of the viral voice generator.";
      const blob = await generateViralVoiceover(text, voiceName, apiKey);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        setPlayingPreviewVoice(null);
        URL.revokeObjectURL(url);
      };
      audio.play();
    } catch (e) {
      setPlayingPreviewVoice(null);
      alert("Voice preview failed.");
    }
  };

  const togglePlay = (id: string, blob: Blob) => {
    if (playingId === id) {
      audioRefs.current[id]?.pause();
      setPlayingId(null);
    } else {
      if (playingId && audioRefs.current[playingId]) audioRefs.current[playingId].pause();
      if (!audioRefs.current[id]) {
        const url = URL.createObjectURL(blob);
        audioRefs.current[id] = new Audio(url);
        audioRefs.current[id].onended = () => setPlayingId(null);
      }
      audioRefs.current[id].play();
      setPlayingId(id);
    }
  };

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col relative">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Creative Library</h1>
        <p className="text-slate-400">Manage and customize your assets for consistent character consistency.</p>
      </div>

      <div className="flex gap-4 border-b border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab('visuals')}
          className={`pb-3 px-4 font-bold transition-colors relative flex items-center gap-2 ${
            activeTab === 'visuals' ? 'text-brand-500' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ImageIcon size={18} /> Visuals
          {activeTab === 'visuals' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />}
        </button>
        <button
          onClick={() => setActiveTab('audio')}
          className={`pb-3 px-4 font-bold transition-colors relative flex items-center gap-2 ${
            activeTab === 'audio' ? 'text-brand-500' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Mic size={18} /> Voiceovers
          {activeTab === 'audio' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Actions Bar */}
        <div className="mb-6 bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap gap-4 items-center justify-between shadow-lg">
           {activeTab === 'visuals' ? (
             <div className="flex-1 flex gap-4 items-center">
               <div className="flex-1 flex gap-2 items-center">
                 <input 
                   type="text" 
                   value={prompt}
                   onChange={e => setPrompt(e.target.value)}
                   placeholder="Describe a new image to generate..."
                   className="flex-1 bg-slate-950 border border-slate-700 rounded px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-brand-500 shadow-inner"
                 />
                 <button 
                   onClick={handleGenerate}
                   disabled={isGenerating || !prompt}
                   className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-brand-900/20"
                 >
                   {isGenerating ? <Loader2 className="animate-spin" size={16}/> : <Wand2 size={16}/>}
                   Generate
                 </button>
               </div>
               <div className="w-px h-8 bg-slate-800 mx-2"></div>
               <label className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border border-slate-700 hover:border-slate-500">
                  <Upload size={16} /> Upload & Modify
                  <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
               </label>
             </div>
           ) : (
             <div className="flex-1 flex gap-4 items-center justify-between">
               <div className="flex items-center gap-4">
                  <button 
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold transition-all shadow-lg ${
                      isRecording 
                        ? 'bg-red-500 text-white animate-pulse shadow-red-500/30' 
                        : 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-900/20'
                    }`}
                  >
                    <Mic size={18} /> {isRecording ? "Stop Recording" : "Record Voice"}
                  </button>
                  {isRecording && <span className="text-red-400 text-sm font-mono font-bold animate-pulse">Recording...</span>}
               </div>
               
               <label className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border border-slate-700">
                  <Upload size={16} /> Upload Audio
                  <input type="file" className="hidden" accept="audio/*" onChange={handleUpload} />
               </label>
             </div>
           )}
        </div>

        {/* AI Voice Previews */}
        {activeTab === 'audio' && (
          <div className="mb-8">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">AI Voice Presets</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {['Kore', 'Puck', 'Fenrir', 'Charon'].map(voice => (
                 <div key={voice} className="bg-slate-900 border border-slate-800 p-4 rounded-lg hover:border-brand-500/50 transition-colors">
                    <div className="font-bold text-white mb-1">{voice}</div>
                    <button 
                      onClick={() => handlePreviewVoice(voice)}
                      disabled={playingPreviewVoice === voice}
                      className="mt-2 w-full bg-slate-800 hover:bg-slate-700 text-xs py-2 rounded flex items-center justify-center gap-2 text-brand-400 transition-colors border border-slate-700"
                    >
                      {playingPreviewVoice === voice ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
                      Sample
                    </button>
                 </div>
              ))}
            </div>
          </div>
        )}

        {/* Gallery */}
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Library</h3>
        {loading ? (
          <div className="text-center py-20 text-slate-500"><Loader2 className="animate-spin inline mr-2"/> Loading...</div>
        ) : assets.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/30">
             <p className="text-slate-500">No assets found. Upload or generate items to build your library.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-10">
             {assets.map(asset => (
               <div key={asset.id} className="group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-600 transition-all shadow-sm hover:shadow-lg">
                  <div className="aspect-square bg-slate-950 relative overflow-hidden">
                     {activeTab === 'visuals' ? (
                       <img 
                          src={URL.createObjectURL(asset.blob)} 
                          className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-500" 
                          onClick={() => setLightboxAsset(asset)}
                       />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center text-slate-700 bg-slate-900/50">
                          <Mic size={48} />
                       </div>
                     )}
                     
                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                       {activeTab === 'audio' && (
                         <button 
                           onClick={() => togglePlay(asset.id, asset.blob)}
                           className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform shadow-lg"
                         >
                           {playingId === asset.id ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" />}
                         </button>
                       )}
                       {activeTab === 'visuals' && (
                         <button 
                           onClick={() => handleDownload(asset)}
                           className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform shadow-lg"
                           title="Download"
                         >
                           <Download size={20} />
                         </button>
                       )}
                       <button 
                         onClick={() => handleDelete(asset.id)}
                         className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                       >
                         <Trash2 size={20} />
                       </button>
                     </div>
                  </div>
                  <div className="p-3 border-t border-slate-800">
                    <div className="text-xs font-bold text-slate-300 truncate mb-0.5">{asset.name || 'Untitled'}</div>
                    <div className="text-[10px] text-slate-500">{asset.createdAt.toLocaleDateString()}</div>
                  </div>
               </div>
             ))}
          </div>
        )}
      </div>

      {/* STAGING MODAL (For Upload Modification) */}
      {stagingAsset && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 animate-in fade-in duration-200 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex overflow-hidden shadow-2xl">
            
            {/* Left: Preview */}
            <div className="w-1/2 bg-black flex items-center justify-center p-6 border-r border-slate-800 relative">
               <div className="relative max-w-full max-h-full">
                  <p className="absolute -top-8 left-0 text-xs text-slate-500 font-bold uppercase">Original Upload</p>
                  <img src={URL.createObjectURL(stagingAsset.blob)} className="max-w-full max-h-[400px] object-contain rounded border border-slate-800" />
               </div>
               
               {/* Arrow if modified */}
               {modifiedBlob && (
                 <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 animate-in fade-in">
                    <div className="relative w-full h-full p-6 flex flex-col items-center justify-center">
                        <p className="absolute top-4 left-6 text-xs text-brand-400 font-bold uppercase">AI Modified Result</p>
                        <img src={URL.createObjectURL(modifiedBlob)} className="max-w-full max-h-full object-contain rounded border border-brand-500 shadow-[0_0_30px_rgba(14,165,233,0.3)]" />
                        <button onClick={() => setModifiedBlob(null)} className="absolute top-4 right-6 text-slate-400 hover:text-white">
                           <RefreshCw size={16} /> Retry
                        </button>
                    </div>
                 </div>
               )}
            </div>

            {/* Right: Controls */}
            <div className="w-1/2 p-8 flex flex-col">
               <div className="flex justify-between items-start mb-6">
                 <div>
                   <h2 className="text-2xl font-bold text-white">Import Image</h2>
                   <p className="text-slate-400 text-sm mt-1">Add to your library or modify with AI first.</p>
                 </div>
                 <button onClick={() => setStagingAsset(null)} className="text-slate-500 hover:text-white"><X size={24}/></button>
               </div>

               <div className="flex-1 space-y-6">
                 {!modifiedBlob && (
                   <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <label className="text-sm font-bold text-white flex items-center gap-2">
                        <Wand2 size={16} className="text-brand-400"/> Modify with AI (Optional)
                      </label>
                      <textarea 
                        value={modificationPrompt}
                        onChange={e => setModificationPrompt(e.target.value)}
                        placeholder="e.g. Turn this into a cyberpunk character, make it oil painting style..."
                        className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-brand-500"
                      />
                      <button 
                        onClick={handleModifyStagedAsset}
                        disabled={isModifying || !modificationPrompt}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-brand-400 border border-slate-700 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                      >
                        {isModifying ? <Loader2 className="animate-spin" size={16}/> : <Wand2 size={16}/>}
                        Generate Modified Version
                      </button>
                   </div>
                 )}

                 {modifiedBlob && (
                    <div className="bg-green-900/10 border border-green-900/30 p-4 rounded-xl flex items-start gap-3">
                       <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={18} />
                       <div>
                          <h4 className="font-bold text-green-400 text-sm">Modification Complete</h4>
                          <p className="text-green-400/70 text-xs mt-1">Your image has been restyled by AI. You can now save it.</p>
                       </div>
                    </div>
                 )}
               </div>

               <div className="mt-auto pt-6 border-t border-slate-800 flex flex-col gap-3">
                  {modifiedBlob ? (
                    <button 
                      onClick={() => handleSaveStaged(true)}
                      className="w-full bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg"
                    >
                      <Save size={18} /> Save Modified Image
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleSaveStaged(false)}
                      className="w-full bg-white text-black hover:bg-slate-200 py-3 rounded-lg font-bold flex items-center justify-center gap-2"
                    >
                      <Save size={18} /> Save Original
                    </button>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxAsset && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col animate-in fade-in duration-200">
           <div className="flex items-center justify-between p-4 bg-black/50 border-b border-white/10 backdrop-blur-md absolute top-0 left-0 right-0">
             <div className="text-white font-medium truncate ml-4">{lightboxAsset.name}</div>
             <div className="flex gap-3 mr-4">
                <button 
                  onClick={() => handleDownload(lightboxAsset)}
                  className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold backdrop-blur-md transition-colors"
                >
                  <Download size={16} /> Download High-Res
                </button>
                <button 
                  onClick={() => setLightboxAsset(null)} 
                  className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
             </div>
           </div>
           
           <div className="flex-1 flex items-center justify-center p-10 h-full" onClick={() => setLightboxAsset(null)}>
             <img 
               src={URL.createObjectURL(lightboxAsset.blob)} 
               className="max-w-full max-h-full object-contain rounded shadow-2xl" 
               onClick={(e) => e.stopPropagation()} 
             />
           </div>
        </div>
      )}
    </div>
  );
};
