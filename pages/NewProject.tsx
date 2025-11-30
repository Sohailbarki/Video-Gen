
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Loader2, Target, Type, Clock, AlertCircle, Link as LinkIcon, Youtube, Users } from 'lucide-react';
import { Platform, Project, ProjectStatus } from '../types';
import { mockBackend } from '../services/mockBackend';
import { generateViralDraft, analyzeVideoSource } from '../services/geminiService';

export const NewProject: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'scratch' | 'remix'>('scratch');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');

  useEffect(() => {
    mockBackend.getSettings().then(settings => {
      setApiKey(settings.apiKeys.google);
    });
  }, []);
  
  // Form State
  const [formData, setFormData] = useState({
    topic: '',
    targetAudience: '',
    tone: 'Funny & Relatable',
    duration: '60 Seconds',
    platforms: [Platform.YOUTUBE] as Platform[],
    
    // Remix Fields
    sourceUrl: '',
    remixInstruction: 'Extract Highlights'
  });

  const handlePlatformToggle = (p: Platform) => {
    setFormData(prev => ({
      ...prev,
      platforms: prev.platforms.includes(p) 
        ? prev.platforms.filter(x => x !== p)
        : [...prev.platforms, p]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Validation
    if (activeTab === 'scratch' && !formData.topic.trim()) {
      setError("Please describe your video topic.");
      return;
    }
    if (activeTab === 'remix' && !formData.sourceUrl.trim()) {
      setError("Please provide a valid video URL.");
      return;
    }
    if (formData.platforms.length === 0) {
      setError("Please select at least one target platform.");
      return;
    }

    // 2. API Key Check
    const hasEnvKey = !!process.env.API_KEY;
    if (!apiKey && !hasEnvKey) {
      const win = window as any;
      if (win.aistudio) {
        try {
          const hasSelected = await win.aistudio.hasSelectedApiKey();
          if (!hasSelected) await win.aistudio.openSelectKey();
        } catch (err) {
          setError("Failed to select API Key via AI Studio.");
          return;
        }
      } else {
        setError("Missing Google API Key. Please configure it in Settings.");
        return;
      }
    }

    setIsGenerating(true);

    try {
      // 3. Generation Logic
      let scriptData;
      const cleanTopic = formData.topic.trim() || `Remix of ${formData.sourceUrl}`;
      const cleanAudience = formData.targetAudience.trim() || 'General Audience';
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Request timed out. The AI agent is taking too long.")), 90000)
      );

      if (activeTab === 'scratch') {
        const genPromise = generateViralDraft(
          cleanTopic,
          formData.tone,
          formData.duration,
          formData.platforms.join(', '),
          cleanAudience,
          apiKey
        );
        scriptData = await Promise.race([genPromise, timeoutPromise]) as any;
      } else {
        // REMIX MODE
        const analysisPromise = analyzeVideoSource(
          formData.sourceUrl,
          formData.remixInstruction,
          formData.platforms.join(', '),
          apiKey
        );
        scriptData = await Promise.race([analysisPromise, timeoutPromise]) as any;
      }

      // 4. Create Project
      const newProject: Project = {
        id: `proj_${Date.now()}`,
        title: scriptData.title || cleanTopic,
        topic: cleanTopic,
        targetAudience: cleanAudience,
        tone: formData.tone,
        platforms: formData.platforms,
        status: ProjectStatus.PROMPT_DRAFTED,
        scriptData: scriptData,
        // Save Source info if Remix
        videoSource: activeTab === 'remix' ? {
          url: formData.sourceUrl,
          type: formData.sourceUrl.includes('tiktok') ? 'TIKTOK' : 'YOUTUBE',
          instructions: formData.remixInstruction
        } : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await mockBackend.createProject(newProject);
      navigate(`/project/${newProject.id}`);
      
    } catch (error: any) {
      console.error("Failed to create project", error);
      setError(error.message || "An unexpected error occurred.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Create New Campaign</h1>
        <p className="text-slate-400">Tell us what you want to create, and our Agent will draft the perfect viral video concept.</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-start gap-3 animate-in fade-in">
          <AlertCircle className="shrink-0 mt-0.5 text-red-500" size={18} />
          <div>
            <h3 className="font-bold text-sm text-red-400">Error</h3>
            <p className="text-sm mt-1 opacity-90">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-800">
           <button 
             onClick={() => setActiveTab('scratch')}
             className={`flex-1 py-4 text-center font-bold text-sm transition-colors ${activeTab === 'scratch' ? 'bg-slate-800 text-brand-400 border-b-2 border-brand-500' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
           >
             <Sparkles size={16} className="inline mr-2" /> Concept from Scratch
           </button>
           <button 
             onClick={() => setActiveTab('remix')}
             className={`flex-1 py-4 text-center font-bold text-sm transition-colors ${activeTab === 'remix' ? 'bg-slate-800 text-brand-400 border-b-2 border-brand-500' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
           >
             <LinkIcon size={16} className="inline mr-2" /> Repurpose Content
           </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          
          {/* Scratch Input */}
          {activeTab === 'scratch' && (
            <div className="space-y-6 animate-in fade-in">
               <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-300">
                  What is the video about?
                </label>
                <textarea
                  value={formData.topic}
                  onChange={e => setFormData({...formData, topic: e.target.value})}
                  placeholder="e.g. A review of the new iPhone 16 focusing on camera features..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-4 text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent min-h-[120px]"
                  maxLength={500}
                />
                <div className="flex justify-end text-xs text-slate-600">{formData.topic.length}/500</div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <Users size={16} /> Target Audience
                </label>
                <input
                  type="text"
                  value={formData.targetAudience}
                  onChange={e => setFormData({...formData, targetAudience: e.target.value})}
                  placeholder="e.g. Gen Z Gamers, Tech Enthusiasts..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          )}

          {/* Remix Input */}
          {activeTab === 'remix' && (
            <div className="space-y-6 animate-in fade-in">
               <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-300">
                     Video Source URL
                  </label>
                  <div className="relative">
                    <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input
                      type="url"
                      value={formData.sourceUrl}
                      onChange={e => setFormData({...formData, sourceUrl: e.target.value})}
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-12 pr-4 py-4 text-white focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <p className="text-xs text-slate-500">Supported: YouTube, TikTok, Instagram Reels</p>
               </div>

               <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-300">
                     Goal
                  </label>
                  <select
                    value={formData.remixInstruction}
                    onChange={e => setFormData({...formData, remixInstruction: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-brand-500"
                  >
                    <option>Extract Highlights</option>
                    <option>Create Summary Short</option>
                    <option>Reaction / Commentary</option>
                    <option>Transform to Blog Post Script</option>
                  </select>
               </div>
            </div>
          )}

          {/* Shared Configs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Type size={16} /> Tone & Style
              </label>
              <select
                value={formData.tone}
                onChange={e => setFormData({...formData, tone: e.target.value})}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-brand-500"
              >
                <optgroup label="Content Style">
                  <option>Funny & Relatable</option>
                  <option>Professional & Educational</option>
                  <option>High Energy / Hype</option>
                  <option>Mysterious & Intriguing</option>
                  <option>Minimalist & Calm</option>
                </optgroup>
                <optgroup label="Visual Style">
                  <option>Realistic / Cinematic</option>
                  <option>Anime / Animation</option>
                  <option>3D Render / Pixar Style</option>
                  <option>Cyberpunk / Sci-Fi</option>
                  <option>Vintage / Retro 90s</option>
                  <option>Oil Painting / Artistic</option>
                </optgroup>
              </select>
            </div>

            <div className="space-y-3">
               <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Clock size={16} /> Duration
              </label>
              <select
                value={formData.duration}
                onChange={e => setFormData({...formData, duration: e.target.value})}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-brand-500"
              >
                <option>15 Seconds</option>
                <option>30 Seconds</option>
                <option>60 Seconds</option>
                <option>90 Seconds</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Target size={16} /> Platforms
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.values(Platform).map((platform) => (
                <button
                  type="button"
                  key={platform}
                  onClick={() => handlePlatformToggle(platform)}
                  className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                    formData.platforms.includes(platform)
                      ? 'bg-brand-600/20 border-brand-500 text-brand-400'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {platform}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={isGenerating || (activeTab === 'scratch' && !formData.topic) || (activeTab === 'remix' && !formData.sourceUrl) || formData.platforms.length === 0}
              className="w-full bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white p-4 rounded-xl font-bold text-lg shadow-lg shadow-brand-900/40 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" /> {activeTab === 'scratch' ? 'Drafting...' : 'Analyzing Source...'}
                </>
              ) : (
                <>
                  <Sparkles size={20} /> {activeTab === 'scratch' ? 'Generate Concept Draft' : 'Analyze & Remix'}
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
