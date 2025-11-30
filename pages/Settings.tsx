
import React, { useEffect, useState } from 'react';
import { UserConnection, AppSettings, AIProvider, Platform } from '../types';
import { mockBackend } from '../services/mockBackend';
import { RefreshCw, Check, AlertTriangle, Link as LinkIcon, Key, Cpu, Save, Trash2, X, Loader2, ChevronLeft, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ai' | 'social'>('ai');
  
  // AI Settings State
  const [settings, setSettings] = useState<AppSettings>({
    textProvider: AIProvider.GOOGLE,
    videoProvider: AIProvider.GOOGLE,
    ttsProvider: AIProvider.GOOGLE,
    apiKeys: { google: '', openai: '', elevenlabs: '' }
  });
  const [isSaving, setIsSaving] = useState(false);

  // Social State
  const [connections, setConnections] = useState<UserConnection[]>([]);
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null);
  const [connectForm, setConnectForm] = useState({ username: '', token: '' });
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const [s, c] = await Promise.all([
        mockBackend.getSettings(),
        mockBackend.getConnections()
      ]);
      setSettings(s);
      setConnections(c);
    };
    loadData();
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    await mockBackend.saveSettings(settings);
    setTimeout(() => setIsSaving(false), 800);
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectingPlatform) return;
    
    setIsConnecting(true);
    await mockBackend.connectPlatform(connectingPlatform, connectForm.username, { accessToken: connectForm.token });
    const updated = await mockBackend.getConnections();
    setConnections(updated);
    setIsConnecting(false);
    setConnectingPlatform(null);
    setConnectForm({ username: '', token: '' });
  };

  const handleDisconnect = async (platform: string) => {
    await mockBackend.disconnectPlatform(platform);
    setConnections(await mockBackend.getConnections());
  };

  // Helper to get portal links
  const getPortalLink = (platform: Platform) => {
    switch (platform) {
      case Platform.YOUTUBE: return "https://console.cloud.google.com/apis/credentials";
      case Platform.TIKTOK: return "https://developers.tiktok.com/";
      case Platform.X: return "https://developer.twitter.com/en/portal/dashboard";
      case Platform.INSTAGRAM: return "https://developers.facebook.com/docs/instagram-basic-display-api/";
      default: return "#";
    }
  };

  // Get all available platforms from the Enum
  const allPlatforms = Object.values(Platform);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <Link to="/" className="text-slate-400 hover:text-white text-sm flex items-center gap-1">
          <ChevronLeft size={16} /> Dashboard
        </Link>
      </div>
      <p className="text-slate-400 mb-8">Configure your AI agents and manage social publishing destinations.</p>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-800 mb-8">
        <button
          onClick={() => setActiveTab('ai')}
          className={`pb-3 px-1 font-medium transition-colors relative ${
            activeTab === 'ai' ? 'text-brand-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2"><Cpu size={18} /> AI Providers & Keys</div>
          {activeTab === 'ai' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />}
        </button>
        <button
          onClick={() => setActiveTab('social')}
          className={`pb-3 px-1 font-medium transition-colors relative ${
            activeTab === 'social' ? 'text-brand-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2"><LinkIcon size={18} /> Social Accounts</div>
          {activeTab === 'social' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />}
        </button>
      </div>

      {/* AI Settings Content */}
      {activeTab === 'ai' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
          
          {/* Provider Selection */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Cpu size={20} className="text-brand-400" /> Default Models
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">Script Generation</label>
                <select 
                  value={settings.textProvider}
                  onChange={(e) => setSettings({...settings, textProvider: e.target.value as AIProvider})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500"
                >
                  <option value={AIProvider.GOOGLE}>Google Gemini (Recommended)</option>
                  <option value={AIProvider.OPENAI}>OpenAI GPT-4</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">Video Generation</label>
                <select 
                  value={settings.videoProvider}
                  onChange={(e) => setSettings({...settings, videoProvider: e.target.value as AIProvider})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500"
                >
                  <option value={AIProvider.GOOGLE}>Google Veo (Default)</option>
                  <option value={AIProvider.OPENAI}>OpenAI Sora (Simulated)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">Voice / TTS</label>
                <select 
                  value={settings.ttsProvider}
                  onChange={(e) => setSettings({...settings, ttsProvider: e.target.value as AIProvider})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500"
                >
                  <option value={AIProvider.GOOGLE}>Google Cloud TTS (Default)</option>
                  <option value={AIProvider.OPENAI}>OpenAI Voice</option>
                  <option value={AIProvider.ELEVENLABS}>ElevenLabs</option>
                </select>
              </div>
            </div>
          </div>

          {/* API Keys */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Key size={20} className="text-brand-400" /> API Keys
            </h2>
            <p className="text-sm text-slate-500 mb-6">Keys are stored locally or proxied securely. Default keys from environment variables are used if left blank.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Google AI Studio Key</label>
                <input 
                  type="password" 
                  placeholder="sk-..."
                  value={settings.apiKeys.google}
                  onChange={(e) => setSettings({...settings, apiKeys: {...settings.apiKeys, google: e.target.value}})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:border-brand-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">OpenAI Key</label>
                <input 
                  type="password" 
                  placeholder="sk-..."
                  value={settings.apiKeys.openai}
                  onChange={(e) => setSettings({...settings, apiKeys: {...settings.apiKeys, openai: e.target.value}})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:border-brand-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">ElevenLabs Key</label>
                <input 
                  type="password" 
                  placeholder="xi-..."
                  value={settings.apiKeys.elevenlabs}
                  onChange={(e) => setSettings({...settings, apiKeys: {...settings.apiKeys, elevenlabs: e.target.value}})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:border-brand-500 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button 
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-brand-900/20 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {/* Social Settings Content */}
      {activeTab === 'social' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          {allPlatforms.map((platform) => {
            const conn = connections.find(c => c.platform === platform);
            const isConnected = conn?.connected || false;
            const username = conn?.username || '';

            return (
              <div key={platform} className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isConnected ? 'bg-brand-900/30 text-brand-500' : 'bg-slate-800 text-slate-500'}`}>
                     <LinkIcon size={20} />
                   </div>
                   <div>
                     <h3 className="font-bold text-lg text-white">{platform}</h3>
                     {isConnected ? (
                       <p className="text-sm text-green-400 flex items-center gap-1">
                         <Check size={14} /> Connected as <span className="font-semibold text-slate-200">{username}</span>
                       </p>
                     ) : (
                       <p className="text-sm text-slate-500">Not connected</p>
                     )}
                   </div>
                </div>

                <div>
                  {isConnected ? (
                    <button
                      onClick={() => handleDisconnect(platform)}
                      className="text-red-400 hover:text-red-300 px-4 py-2 font-medium flex items-center gap-2 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} /> Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => setConnectingPlatform(platform)}
                      className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium border border-slate-700 transition-colors"
                    >
                      Connect Account
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Connection Modal Overlay */}
          {connectingPlatform && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                  <h3 className="text-lg font-bold text-white">Connect {connectingPlatform}</h3>
                  <button onClick={() => setConnectingPlatform(null)} className="text-slate-400 hover:text-white">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleConnectSubmit} className="p-6 space-y-4">
                  <p className="text-sm text-slate-400 bg-blue-900/20 p-3 rounded border border-blue-900/50">
                     Enter your API credentials or Access Token. 
                     <a 
                       href={getPortalLink(connectingPlatform)} 
                       target="_blank" 
                       rel="noreferrer"
                       className="block mt-2 text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1"
                     >
                       Get Token from Developer Portal <ExternalLink size={12}/>
                     </a>
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Account Handle / Username</label>
                    <input 
                      required
                      type="text" 
                      placeholder="@username"
                      value={connectForm.username}
                      onChange={e => setConnectForm({...connectForm, username: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">API Key / Access Token</label>
                    <input 
                      required
                      type="password" 
                      placeholder="Token..."
                      value={connectForm.token}
                      onChange={e => setConnectForm({...connectForm, token: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-brand-500"
                    />
                  </div>
                  <div className="pt-4 flex justify-end gap-3">
                    <button type="button" onClick={() => setConnectingPlatform(null)} className="text-slate-400 hover:text-white px-4 py-2">Cancel</button>
                    <button 
                      type="submit" 
                      disabled={isConnecting}
                      className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                    >
                      {isConnecting && <Loader2 className="animate-spin" size={16} />}
                      Connect
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 p-4 bg-yellow-900/10 border border-yellow-900/30 rounded-lg flex items-start gap-3">
        <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={20} />
        <div>
          <h4 className="font-bold text-yellow-500 text-sm">Security Note</h4>
          <p className="text-yellow-500/80 text-sm mt-1">
            Access tokens provided here are stored in local memory for this demo session. 
            In production, use server-side OAuth callback handling.
          </p>
        </div>
      </div>
    </div>
  );
};
