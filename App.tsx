import React, { useState, useEffect, useRef } from 'react';
import { 
  Waves, Download, X, Play, Pause, Loader2, 
  FileText, Wand2, Eraser, LogOut, LayoutDashboard,
  UserPlus, Key, Shield, MessageCircle, ExternalLink,
  Trash2, Edit, Calendar, CreditCard, Save, Users,
  Gift, Upload, FileJson, Mic, FileUp, Rewind, FastForward, Music
} from 'lucide-react';
import { READING_MODES, PRESET_VOICES, ICONS } from './constants';
import { GenerationState, VoiceConfig, TTSProvider, ReadingMode, UserProfile, ManagedKey, UserRole, PlanType, ClonedVoice } from './types';
import { generateContentFromDescription, generateAudioParallel, pcmToMp3, pcmToWav, analyzeVoice, mixAudio } from './services/gemini';

// --- CONFIGURATION ---
const DAILY_LIMITS: Record<PlanType, number> = {
    'TRIAL': 2000,
    'NONE': 0,
    'MONTHLY': 50000,
    '3MONTHS': 50000,
    '6MONTHS': 50000,
    'YEARLY': 50000
};

const KEY_REWARD_CREDITS = 10000;
const MAX_KEYS_PER_DAY = 6;
const MAX_CUSTOM_VOICES = 2;

// --- MOCK DATABASE ---
const INITIAL_USERS: UserProfile[] = [
  { uid: 'admin-01', loginId: 'truong2024.vn', password: '#Minh@123', displayName: 'Quản trị viên', email: 'admin@baominh.ai', photoURL: '', role: 'ADMIN', credits: 999999, lastActive: '', isBlocked: false, planType: 'YEARLY', expiryDate: 4102444800000, characterLimit: 1000000, dailyKeyCount: 0, customVoices: [] },
  { uid: 'user-01', loginId: 'user', password: '123', displayName: 'Khách hàng VIP', email: 'user@gmail.com', photoURL: '', role: 'USER', credits: 50000, lastActive: '', isBlocked: false, planType: 'MONTHLY', expiryDate: Date.now() + 2592000000, characterLimit: 50000, dailyKeyCount: 0, customVoices: [] },
];

const INITIAL_KEYS: ManagedKey[] = [
  { 
      id: 'key-system-default', 
      name: 'Key Hệ thống (Mặc định)', 
      key: process.env.API_KEY || '', 
      status: 'VALID', 
      usageCount: 0, 
      isTrialKey: false, 
      allowedUserIds: [] 
  }
];

// --- API HELPER ---
const saveDataToApi = async (table: string, data: any) => {
    try {
        await fetch(`/api/data/${table}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e) {
        console.error(`Lỗi lưu dữ liệu ${table}:`, e);
    }
};

// --- COMPONENT: LOGIN SCREEN ---
const LoginScreen = ({ onLogin, onGuest, onContact, onCreateKey, isLoading }: any) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLogin(username, password, (err: string) => setError(err));
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto"/>
                    <p className="text-slate-400">Đang đồng bộ dữ liệu từ máy chủ...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-300">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        BẢO MINH AI
                    </h1>
                    <p className="text-slate-400">Đăng nhập để trải nghiệm công nghệ TTS đỉnh cao</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Tài khoản</label>
                            <input 
                                type="text" 
                                value={username} 
                                onChange={e => setUsername(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                placeholder="Nhập tên đăng nhập"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Mật khẩu</label>
                            <input 
                                type="password" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                placeholder="••••••••"
                            />
                        </div>
                        {error && <p className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded">{error}</p>}
                        
                        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-900/20">
                            Đăng nhập
                        </button>
                    </form>

                    <div className="mt-6 flex flex-col gap-3">
                         <div className="grid grid-cols-2 gap-3">
                            <button type="button" onClick={onGuest} className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 rounded-xl text-sm font-medium transition-colors">
                                <UserPlus className="w-4 h-4" /> Dùng thử
                            </button>
                            <button type="button" onClick={onContact} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                                <MessageCircle className="w-4 h-4" /> Liên hệ Zalo
                            </button>
                         </div>
                         <button type="button" onClick={onCreateKey} className="flex items-center justify-center gap-2 border border-slate-700 hover:bg-slate-800 text-slate-400 py-2.5 rounded-xl text-sm transition-colors">
                             <ExternalLink className="w-4 h-4" /> Tạo Key (Google AI Studio)
                         </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: REWARD MODAL ---
const KeyRewardSection = ({ currentUser, onSubmitKey, dailyCount }: any) => {
    const [keyInput, setKeyInput] = useState('');
    
    return (
        <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 rounded-2xl p-6 mb-6 animate-in slide-in-from-top">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400">
                        <Gift className="w-8 h-8 animate-bounce" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Nhận thêm 10.000 ký tự miễn phí!</h3>
                        <p className="text-sm text-slate-300">Đóng góp API Key Gemini để nhận thưởng. (Hôm nay: {dailyCount}/{MAX_KEYS_PER_DAY})</p>
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline flex items-center gap-1 mt-1">
                            Lấy Key tại đây <ExternalLink className="w-3 h-3"/>
                        </a>
                    </div>
                </div>
                
                <div className="flex gap-2 w-full md:w-auto">
                    <input 
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        placeholder="Dán API Key của bạn vào đây..."
                        className="flex-1 md:w-64 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button 
                        onClick={() => {
                            if(keyInput.trim()) {
                                onSubmitKey(keyInput.trim());
                                setKeyInput('');
                            }
                        }}
                        disabled={dailyCount >= MAX_KEYS_PER_DAY}
                        className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-colors"
                    >
                        Nhận thưởng
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: ADMIN DASHBOARD ---
const AdminDashboard = ({ users, keys, setUsers, setKeys }: any) => {
    const [view, setView] = useState<'USERS' | 'KEYS'>('USERS');
    const [newUser, setNewUser] = useState({ loginId: '', password: '', displayName: '', role: 'USER', planType: 'MONTHLY' });
    const [newKey, setNewKey] = useState({ name: '', key: '', assignedUid: '' });

    // User Functions
    const handleAddUser = () => {
        if (!newUser.loginId || !newUser.password) return alert('Thiếu thông tin user');
        
        let days = 30;
        if (newUser.planType === '3MONTHS') days = 90;
        if (newUser.planType === '6MONTHS') days = 180;
        if (newUser.planType === 'YEARLY') days = 365;

        const user: UserProfile = {
            uid: `user-${Date.now()}`,
            loginId: newUser.loginId,
            password: newUser.password,
            displayName: newUser.displayName || 'New User',
            email: `${newUser.loginId}@local`,
            photoURL: '',
            role: newUser.role as UserRole,
            credits: DAILY_LIMITS[newUser.planType as PlanType] || 2000,
            lastActive: '',
            isBlocked: false,
            planType: newUser.planType as PlanType,
            expiryDate: Date.now() + (days * 86400000),
            characterLimit: DAILY_LIMITS[newUser.planType as PlanType] || 2000,
            dailyKeyCount: 0,
            customVoices: []
        };
        setUsers([...users, user]);
        setNewUser({ loginId: '', password: '', displayName: '', role: 'USER', planType: 'MONTHLY' });
    };

    const handleDeleteUser = (uid: string) => {
        if (confirm('Bạn có chắc muốn xóa user này?')) {
            setUsers(users.filter((u: any) => u.uid !== uid));
        }
    };

    const handleUpdateUserPlan = (uid: string, plan: PlanType) => {
         let days = 30;
         if (plan === '3MONTHS') days = 90;
         if (plan === '6MONTHS') days = 180;
         if (plan === 'YEARLY') days = 365;
         if (plan === 'TRIAL') days = 3;

         setUsers(users.map((u: any) => {
             if (u.uid === uid) {
                 return {
                     ...u,
                     planType: plan,
                     expiryDate: Date.now() + (days * 86400000),
                     characterLimit: DAILY_LIMITS[plan] || 2000,
                     credits: DAILY_LIMITS[plan] || 2000 // Reset credits ngay khi đổi gói
                 };
             }
             return u;
         }));
    };

    // Key Functions
    const handleAddKey = () => {
        if (!newKey.key) return alert('Vui lòng nhập Key');
        const k: ManagedKey = {
            id: `key-${Date.now()}`,
            name: newKey.name || 'Admin Added',
            key: newKey.key,
            status: 'UNTESTED',
            usageCount: 0,
            isTrialKey: false,
            allowedUserIds: newKey.assignedUid ? [newKey.assignedUid] : []
        };
        setKeys([...keys, k]);
        setNewKey({ name: '', key: '', assignedUid: '' });
    };

    const handleDeleteKey = (id: string) => {
        setKeys(keys.filter((k: any) => k.id !== id));
    };

    // Export Keys
    const downloadKeys = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(keys, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", "gemini_keys.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    // Import Keys from File
    const handleFileUpload = (event: any) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            // Giả định mỗi dòng là 1 key
            const lines = content.split(/\r?\n/).filter(line => line.trim().length > 10);
            
            const newKeys: ManagedKey[] = lines.map((line, index) => ({
                id: `imported-${Date.now()}-${index}`,
                name: `Imported Key ${index + 1}`,
                key: line.trim(),
                status: 'UNTESTED',
                usageCount: 0,
                isTrialKey: false,
                allowedUserIds: []
            }));

            // Lọc trùng
            const uniqueNewKeys = newKeys.filter(nk => !keys.some((ek: any) => ek.key === nk.key));
            setKeys([...keys, ...uniqueNewKeys]);
            alert(`Đã nhập ${uniqueNewKeys.length} key mới thành công!`);
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-4 border-b border-slate-800 pb-4">
                <button onClick={() => setView('USERS')} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${view === 'USERS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900'}`}>
                    <Users className="w-4 h-4" /> Quản lý User
                </button>
                <button onClick={() => setView('KEYS')} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${view === 'KEYS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900'}`}>
                    <Key className="w-4 h-4" /> Quản lý API Key
                </button>
            </div>

            {view === 'USERS' && (
                <div className="space-y-6 animate-in slide-in-from-right">
                    {/* Add User Form */}
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 grid grid-cols-1 md:grid-cols-5 gap-3">
                        <input placeholder="Tên đăng nhập" className="bg-slate-950 border border-slate-800 p-2 rounded text-sm text-white" value={newUser.loginId} onChange={e => setNewUser({...newUser, loginId: e.target.value})} />
                        <input placeholder="Mật khẩu" className="bg-slate-950 border border-slate-800 p-2 rounded text-sm text-white" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                        <input placeholder="Tên hiển thị" className="bg-slate-950 border border-slate-800 p-2 rounded text-sm text-white" value={newUser.displayName} onChange={e => setNewUser({...newUser, displayName: e.target.value})} />
                        <select className="bg-slate-950 border border-slate-800 p-2 rounded text-sm text-white" value={newUser.planType} onChange={e => setNewUser({...newUser, planType: e.target.value})}>
                            <option value="TRIAL">Dùng thử</option>
                            <option value="MONTHLY">1 Tháng</option>
                            <option value="3MONTHS">3 Tháng</option>
                            <option value="6MONTHS">6 Tháng</option>
                            <option value="YEARLY">1 Năm</option>
                        </select>
                        <button onClick={handleAddUser} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-sm">Thêm User</button>
                    </div>

                    {/* User List */}
                    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-slate-950 text-slate-200 uppercase font-bold text-xs">
                                <tr>
                                    <th className="p-4">User Info</th>
                                    <th className="p-4">Hạn mức</th>
                                    <th className="p-4">Gói cước</th>
                                    <th className="p-4">Hết hạn</th>
                                    <th className="p-4 text-right">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {users.map((u: UserProfile) => (
                                    <tr key={u.uid} className="hover:bg-slate-800/50">
                                        <td className="p-4">
                                            <div className="font-bold text-white">{u.displayName}</div>
                                            <div className="text-xs">@{u.loginId}</div>
                                        </td>
                                        <td className="p-4 text-emerald-400 font-mono">
                                            {u.credits.toLocaleString()} / {u.characterLimit.toLocaleString()}
                                        </td>
                                        <td className="p-4">
                                            <select 
                                                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                                                value={u.planType}
                                                onChange={(e) => handleUpdateUserPlan(u.uid, e.target.value as PlanType)}
                                            >
                                                <option value="TRIAL">Dùng thử</option>
                                                <option value="MONTHLY">1 Tháng</option>
                                                <option value="3MONTHS">3 Tháng</option>
                                                <option value="6MONTHS">6 Tháng</option>
                                                <option value="YEARLY">1 Năm</option>
                                            </select>
                                        </td>
                                        <td className="p-4 font-mono text-xs">{new Date(u.expiryDate).toLocaleDateString('vi-VN')}</td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            <button onClick={() => handleDeleteUser(u.uid)} className="p-2 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 rounded transition-colors"><Trash2 className="w-4 h-4"/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {view === 'KEYS' && (
                <div className="space-y-6 animate-in slide-in-from-right">
                    {/* Add Key Form */}
                    <div className="flex gap-2">
                         <div className="relative">
                            <input type="file" id="key-upload" className="hidden" accept=".txt" onChange={handleFileUpload} />
                            <label htmlFor="key-upload" className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg cursor-pointer text-sm font-medium transition-colors">
                                <Upload className="w-4 h-4"/> Nhập từ File (.txt)
                            </label>
                         </div>
                         <button onClick={downloadKeys} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                             <Download className="w-4 h-4"/> Tải xuống JSON
                         </button>
                    </div>

                     <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-3">
                        <input placeholder="Tên Key (VD: Key VIP 1)" className="bg-slate-950 border border-slate-800 p-2 rounded text-sm text-white" value={newKey.name} onChange={e => setNewKey({...newKey, name: e.target.value})} />
                        <input placeholder="Gemini API Key..." className="bg-slate-950 border border-slate-800 p-2 rounded text-sm text-white font-mono" value={newKey.key} onChange={e => setNewKey({...newKey, key: e.target.value})} />
                        <select className="bg-slate-950 border border-slate-800 p-2 rounded text-sm text-white" value={newKey.assignedUid} onChange={e => setNewKey({...newKey, assignedUid: e.target.value})}>
                            <option value="">-- Dùng chung --</option>
                            {users.map((u: any) => <option key={u.uid} value={u.uid}>{u.displayName} (@{u.loginId})</option>)}
                        </select>
                        <button onClick={handleAddKey} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-sm">Thêm Key</button>
                    </div>

                    <div className="grid gap-3">
                        <div className="text-sm text-slate-500">Tổng số key: {keys.length}</div>
                        {keys.map((k: ManagedKey) => (
                            <div key={k.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><Key className="w-5 h-5"/></div>
                                    <div>
                                        <h3 className="font-bold text-slate-200">{k.name}</h3>
                                        <p className="text-xs font-mono text-slate-500">{k.key.substring(0, 10)}... • {k.allowedUserIds.length ? `Gán cho: ${users.find((u:any) => u.uid === k.allowedUserIds[0])?.displayName}` : 'Dùng chung'}</p>
                                    </div>
                                </div>
                                <button onClick={() => handleDeleteKey(k.id)} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-5 h-5"/></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [keys, setKeys] = useState<ManagedKey[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  // App States
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // TTS States
  const [input, setInput] = useState('');
  const [selectedMode, setSelectedMode] = useState<ReadingMode>(ReadingMode.STORY);
  const [state, setState] = useState<GenerationState & { mp3Url?: string | null }>({
    isGeneratingText: false, isGeneratingAudio: false, error: null, text: '', audioUrl: null, audioBuffer: null, mp3Url: null
  });
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>({
     provider: TTSProvider.GEMINI, voiceName: 'Kore', speed: 1, pitch: 0, emotion: 'NEUTRAL', activePresetId: PRESET_VOICES[0].id
  });

  // Background Music States
  const [bgMusic, setBgMusic] = useState<{buffer: ArrayBuffer, name: string} | null>(null);
  const [bgVolume, setBgVolume] = useState(0.2);
  const bgMusicInputRef = useRef<HTMLInputElement>(null);

  // Audio Player States
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const activeMode = READING_MODES.find(m => m.id === selectedMode) || READING_MODES[0];

  // Helper format time
  const formatTime = (time: number) => {
    if(isNaN(time)) return "00:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
  };

  // Toggle Play/Pause
  const togglePlayback = () => {
    if (audioRef.current) {
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
    }
  };

  // Seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      if (audioRef.current) {
          audioRef.current.currentTime = time;
          setCurrentTime(time);
      }
  };

  // Handle Skip 15s
  const handleSkip = (seconds: number) => {
      if (audioRef.current) {
          const newTime = Math.max(0, Math.min(audioRef.current.currentTime + seconds, duration));
          audioRef.current.currentTime = newTime;
          setCurrentTime(newTime);
      }
  };

  // --- DATA SYNCING ---
  // Load initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, keysRes] = await Promise.all([
          fetch('/api/data/users'),
          fetch('/api/data/keys')
        ]);
        
        if (!usersRes.ok || !keysRes.ok) {
            throw new Error(`Server returned status: ${usersRes.status} / ${keysRes.status}`);
        }

        const usersJson = await usersRes.json();
        const keysJson = await keysRes.json();
        
        const loadedUsers = usersJson.data;
        const loadedKeys = keysJson.data;

        if (Array.isArray(loadedUsers) && loadedUsers.length > 0) {
            setUsers(loadedUsers);
        } else {
            setUsers(INITIAL_USERS);
            saveDataToApi('users', INITIAL_USERS);
        }

        if (Array.isArray(loadedKeys) && loadedKeys.length > 0) {
            setKeys(loadedKeys);
        } else {
            setKeys(INITIAL_KEYS);
            saveDataToApi('keys', INITIAL_KEYS);
        }

        setIsDataLoaded(true);
      } catch (e) {
        console.error("Failed to load data, using local defaults. Error:", e);
        setUsers(INITIAL_USERS);
        setKeys(INITIAL_KEYS);
        setIsDataLoaded(true);
      }
    };
    fetchData();
  }, []);

  // Auto-save changes
  useEffect(() => {
    if (isDataLoaded && users.length > 0) {
        saveDataToApi('users', users);
    }
  }, [users, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded && keys.length > 0) {
        saveDataToApi('keys', keys);
    }
  }, [keys, isDataLoaded]);

  // Handle Logic Login Check & Reset Daily Limit
  const handleLogin = (u: string, p: string, onError: any) => {
      const cleanUser = u.trim();
      const cleanPass = p.trim();
      
      const userIndex = users.findIndex(x => x.loginId === cleanUser && x.password === cleanPass);
      
      if (userIndex !== -1) {
          const user = { ...users[userIndex] };
          if(!user.customVoices) user.customVoices = [];
          
          const today = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY

          // Reset daily limits if new day
          if (user.lastActive !== today) {
              user.lastActive = today;
              user.dailyKeyCount = 0;
              user.credits = DAILY_LIMITS[user.planType];
              // Update back to state
              const newUsers = [...users];
              newUsers[userIndex] = user;
              setUsers(newUsers); // This triggers auto-save via useEffect
          }

          setCurrentUser(user);
          if(user.role === 'ADMIN') setShowAdmin(true);
      } else {
          onError('Sai tên đăng nhập hoặc mật khẩu!');
      }
  };

  const handleGuest = () => {
      // Logic khôi phục key nếu hệ thống không có key nào (do lỡ xóa)
      const hasSystemKey = keys.some(k => k.allowedUserIds.length === 0);
      if (!hasSystemKey) {
          const defaultKey: ManagedKey = { 
            id: 'key-system-default-restored', 
            name: 'Key Hệ thống (Khôi phục)', 
            key: process.env.API_KEY || '', 
            status: 'VALID', 
            usageCount: 0, 
            isTrialKey: false, 
            allowedUserIds: [] 
          };
          setKeys(prev => [...prev, defaultKey]);
      }

      setCurrentUser({ uid: 'guest', displayName: 'Khách', role: 'GUEST', credits: 1000, planType: 'TRIAL', loginId: 'guest', email: '', photoURL: '', lastActive: '', isBlocked: false, expiryDate: 0, characterLimit: 1000, dailyKeyCount: 0, customVoices: [] });
  };

  // Handle Key Submission
  const handleSubmitKey = (keyString: string) => {
      if(!currentUser) return;
      if(currentUser.role === 'GUEST') return alert("Vui lòng đăng nhập để nhận thưởng!");
      if(currentUser.dailyKeyCount >= MAX_KEYS_PER_DAY) return alert(`Bạn đã đạt giới hạn đóng góp ${MAX_KEYS_PER_DAY} key hôm nay.`);
      
      // Check duplicate
      const exists = keys.some(k => k.key === keyString);
      if(exists) return alert("Key này đã tồn tại trong hệ thống. Vui lòng nhập key khác.");

      // Add key
      const newKey: ManagedKey = {
          id: `reward-${Date.now()}`,
          name: `Đóng góp bởi ${currentUser.displayName}`,
          key: keyString,
          status: 'UNTESTED',
          usageCount: 0,
          isTrialKey: false,
          allowedUserIds: [], // Shared key
          addedBy: currentUser.uid
      };

      setKeys([...keys, newKey]);

      // Add credits to user
      const updatedUser = {
          ...currentUser,
          credits: currentUser.credits + KEY_REWARD_CREDITS,
          dailyKeyCount: currentUser.dailyKeyCount + 1
      };
      
      setCurrentUser(updatedUser);
      setUsers(users.map(u => u.uid === currentUser.uid ? updatedUser : u));

      alert(`🎉 Chúc mừng! Bạn đã nhận thêm ${KEY_REWARD_CREDITS.toLocaleString()} ký tự.`);
  };

  // Logic TTS
  const getApiKeyForUser = () => {
      const privateKey = keys.find(k => k.allowedUserIds.includes(currentUser?.uid || ''));
      if (privateKey && privateKey.key && privateKey.key !== 'AIzaSyExampleKey') return privateKey.key;
      const sharedKey = keys.find(k => k.allowedUserIds.length === 0);
      if (sharedKey && sharedKey.key && sharedKey.key !== 'AIzaSyExampleKey') return sharedKey.key;
      
      // Fallback mạnh nhất: Trả về env key nếu danh sách quản lý bị trống
      return process.env.API_KEY || '';
  };

  // Handle Background Music Upload
  const handleUploadBgMusic = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
          const buffer = await file.arrayBuffer();
          setBgMusic({ buffer, name: file.name });
      } catch (e) {
          alert("Lỗi tải nhạc nền: " + e);
      } finally {
          if (bgMusicInputRef.current) bgMusicInputRef.current.value = '';
      }
  };

  const handleUploadVoice = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;

    if (currentUser.customVoices.length >= MAX_CUSTOM_VOICES) {
        alert("Bạn chỉ được phép lưu tối đa 2 giọng mẫu. Vui lòng xóa bớt để thêm mới.");
        return;
    }

    const key = getApiKeyForUser();
    if(!key) return setState(prev => ({...prev, error: "Cần có API Key để phân tích giọng nói."}));

    setIsAnalyzing(true);
    try {
        const arrayBuffer = await file.arrayBuffer();
        
        // Analyze: Services handles trimming 20s and delaying 3s internally
        const analysis = await analyzeVoice(arrayBuffer, (msg) => console.log(msg), key);

        const newVoice: ClonedVoice = {
            id: `custom-${Date.now()}`,
            name: analysis.suggestedName || file.name.replace(/\.[^/.]+$/, ""),
            gender: analysis.gender,
            region: analysis.region,
            description: analysis.description,
            toneSummary: analysis.toneSummary,
            createdAt: Date.now()
        };

        const updatedUser = {
            ...currentUser,
            customVoices: [...currentUser.customVoices, newVoice]
        };

        setCurrentUser(updatedUser);
        setUsers(users.map(u => u.uid === currentUser.uid ? updatedUser : u));

        // Auto Select new voice
        // Mapping analyzed gender/region to closest Gemini voice for playback (simulation)
        let mappedVoice = 'Kore'; // Default Female
        if (newVoice.gender === 'Nam') mappedVoice = 'Fenrir'; // Default Male
        
        setVoiceConfig(prev => ({
            ...prev,
            useClonedVoice: true,
            activeClonedVoiceId: newVoice.id,
            voiceName: mappedVoice,
            activePresetId: undefined
        }));

        alert(`✅ Đã phân tích thành công giọng: ${newVoice.name}`);

    } catch (e: any) {
        setState(prev => ({ ...prev, error: "Lỗi phân tích giọng: " + e.message }));
    } finally {
        setIsAnalyzing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGenerateText = async () => {
    if (!input.trim()) return;
    const key = getApiKeyForUser();
    if(!key) return setState(prev => ({...prev, error: "Hệ thống chưa có API Key khả dụng. Vui lòng liên hệ Admin hoặc đóng góp Key."}));

    setState(prev => ({ ...prev, isGeneratingText: true, error: null }));
    try {
        const text = await generateContentFromDescription(input, activeMode.prompt, undefined, key);
        setState(prev => ({ ...prev, text, isGeneratingText: false }));
    } catch (e: any) {
        setState(prev => ({ ...prev, error: e.message, isGeneratingText: false }));
    }
  };

  const handleGenerateAudio = async () => {
    if (!state.text.trim()) return;
    if (currentUser && currentUser.credits < state.text.length) {
        return setState(prev => ({...prev, error: `Không đủ ký tự! (Cần: ${state.text.length}, Còn: ${currentUser.credits}). Hãy đóng góp Key để nhận thêm.`}));
    }

    const key = getApiKeyForUser();
    if(!key) return setState(prev => ({...prev, error: "Hệ thống chưa có API Key khả dụng."}));

    setState(prev => ({ ...prev, isGeneratingAudio: true, error: null, audioUrl: null }));
    try {
        // 1. Generate Speech
        let buffer = await generateAudioParallel(state.text, voiceConfig, (p) => console.log(p), undefined, key);
        
        // 2. Mix Background Music if present
        if (bgMusic) {
             try {
                buffer = await mixAudio(buffer, bgMusic.buffer, bgVolume);
             } catch (mixErr) {
                 console.error("Mixing error:", mixErr);
                 // Fallback to speech only if mixing fails
             }
        }

        const wavBlob = pcmToWav(buffer);
        const mp3Blob = pcmToMp3(buffer);
        
        // Deduct credits
        if (currentUser && currentUser.role !== 'ADMIN') {
             const updatedUser = { ...currentUser, credits: currentUser.credits - state.text.length };
             setCurrentUser(updatedUser);
             setUsers(users.map(u => u.uid === currentUser.uid ? updatedUser : u));
        }

        setState(prev => ({ 
            ...prev, isGeneratingAudio: false, audioUrl: URL.createObjectURL(wavBlob), mp3Url: URL.createObjectURL(mp3Blob), audioBuffer: buffer 
        }));
    } catch (e: any) {
        setState(prev => ({ ...prev, error: e.message, isGeneratingAudio: false }));
    }
  };

  // Reset player time and Auto Play when new audio generated
  useEffect(() => {
    if(state.audioUrl && audioRef.current) {
        setCurrentTime(0);
        // Explicitly load and play to ensure autoplay works and updates UI state
        audioRef.current.load();
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => setIsPlaying(true))
                .catch(err => {
                    console.warn("Autoplay blocked by browser:", err);
                    setIsPlaying(false);
                });
        }
    }
  }, [state.audioUrl]);

  // RENDER
  if (!currentUser) {
      return <LoginScreen 
        onLogin={handleLogin} 
        onGuest={handleGuest} 
        onContact={() => window.open('https://zalo.me/0904567890', '_blank')}
        onCreateKey={() => window.open('https://aistudio.google.com/app/apikey', '_blank')}
        isLoading={!isDataLoaded}
      />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 md:p-8">
      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleUploadVoice} 
        accept="audio/*" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={bgMusicInputRef} 
        onChange={handleUploadBgMusic} 
        accept="audio/*" 
        className="hidden" 
      />

      {/* Analyzing Overlay */}
      {isAnalyzing && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center backdrop-blur-sm">
            <div className="text-center space-y-4">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <h3 className="text-xl font-bold text-white">Đang phân tích giọng mẫu...</h3>
                <p className="text-slate-400 max-w-xs mx-auto">Hệ thống đang cắt 20s đầu và phân tích đặc điểm. Vui lòng chờ 3-5 giây.</p>
            </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Logged In */}
        <header className="flex items-center justify-between">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Gemini Voice AI
            </h1>
            <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                    <span className="font-bold text-white">{currentUser.displayName}</span>
                    <span className="text-xs text-slate-400 bg-slate-900 px-2 rounded border border-slate-800 flex items-center gap-1">
                        {currentUser.planType} • {currentUser.credits.toLocaleString()} ký tự
                    </span>
                </div>
                {currentUser.role === 'ADMIN' && (
                    <button onClick={() => setShowAdmin(!showAdmin)} className={`p-2 rounded-lg transition-colors ${showAdmin ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        <Shield className="w-5 h-5" />
                    </button>
                )}
                <button onClick={() => setCurrentUser(null)} className="p-2 bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 rounded-lg transition-colors">
                    <LogOut className="w-5 h-5" />
                </button>
            </div>
        </header>

        {/* View Switcher: Admin or App */}
        {showAdmin && currentUser.role === 'ADMIN' ? (
            <AdminDashboard users={users} keys={keys} setUsers={setUsers} setKeys={setKeys} />
        ) : (
            <div className="space-y-6 animate-in fade-in">
                {/* Reward Banner - Always Visible */}
                <KeyRewardSection 
                    currentUser={currentUser} 
                    onSubmitKey={handleSubmitKey} 
                    dailyCount={currentUser.dailyKeyCount} 
                />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left: Mode & Input */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                            <h2 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">Chế độ đọc</h2>
                            <div className="grid grid-cols-2 gap-2">
                                {READING_MODES.map(mode => (
                                    <button 
                                        key={mode.id}
                                        onClick={() => setSelectedMode(mode.id as ReadingMode)}
                                        className={`p-3 rounded-xl text-left text-sm transition-all flex items-center gap-2 ${selectedMode === mode.id ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'hover:bg-slate-800 text-slate-400'}`}
                                    >
                                        {mode.icon}
                                        <span className="truncate">{mode.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 space-y-4">
                            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Nội dung đầu vào</h2>
                            <textarea 
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={`Nhập chủ đề cho "${activeMode.label}"...`}
                                className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none text-slate-300"
                            />
                            <button 
                                type="button" 
                                onClick={handleGenerateText}
                                disabled={state.isGeneratingText || !input.trim()}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all"
                            >
                                {state.isGeneratingText ? <Loader2 className="animate-spin w-4 h-4"/> : <Wand2 className="w-4 h-4"/>}
                                {state.isGeneratingText ? 'Đang viết...' : 'Tạo nội dung'}
                            </button>
                        </div>
                    </div>

                    {/* Right: Output & Voice Settings */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex flex-col h-[650px]">
                            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 backdrop-blur-sm z-10">
                                <h2 className="font-semibold flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-indigo-400"/>
                                    Văn bản cần đọc
                                </h2>
                                <div className="flex gap-2">
                                     <button onClick={() => setState(prev => ({...prev, text: ''}))} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><Eraser className="w-4 h-4"/></button>
                                </div>
                            </div>
                            <textarea 
                                value={state.text}
                                onChange={(e) => setState(prev => ({...prev, text: e.target.value}))}
                                placeholder="Văn bản được tạo sẽ xuất hiện ở đây. Bạn cũng có thể nhập trực tiếp..."
                                className="flex-1 w-full bg-slate-950 p-6 text-lg leading-relaxed focus:outline-none resize-none font-medium text-slate-300"
                            />
                            
                            <div className="p-4 border-t border-slate-800 bg-slate-900/50 space-y-4">
                                <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar items-center">
                                    {/* Upload Voice Sample Button */}
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="shrink-0 px-4 py-2 rounded-full text-xs font-bold border border-indigo-500 text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 transition-all flex items-center gap-2"
                                    >
                                        <FileUp className="w-3 h-3" /> Tải giọng mẫu ({currentUser.customVoices.length}/2)
                                    </button>

                                    {/* Custom Voices List */}
                                    {currentUser.customVoices?.map(voice => (
                                        <button
                                            key={voice.id}
                                            onClick={() => setVoiceConfig(prev => ({
                                                ...prev, 
                                                useClonedVoice: true,
                                                activeClonedVoiceId: voice.id,
                                                voiceName: voice.gender === 'Nam' ? 'Fenrir' : 'Kore',
                                                activePresetId: undefined 
                                            }))}
                                            className={`shrink-0 px-4 py-2 rounded-full text-xs font-medium border transition-all flex items-center gap-1 ${voiceConfig.activeClonedVoiceId === voice.id ? 'bg-purple-500/10 border-purple-500 text-purple-400' : 'border-slate-700 hover:border-slate-500 text-slate-400'}`}
                                        >
                                           <Mic className="w-3 h-3"/> {voice.name}
                                        </button>
                                    ))}

                                    <div className="w-px h-6 bg-slate-700 mx-2"></div>

                                    {/* Preset Voices */}
                                     {PRESET_VOICES.map(preset => (
                                         <button
                                            key={preset.id}
                                            onClick={() => setVoiceConfig(prev => ({
                                                ...prev, 
                                                activePresetId: preset.id, 
                                                activeClonedVoiceId: undefined,
                                                useClonedVoice: false,
                                                voiceName: preset.baseVoice
                                            }))}
                                            className={`shrink-0 px-4 py-2 rounded-full text-xs font-medium border transition-all ${voiceConfig.activePresetId === preset.id ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'border-slate-700 hover:border-slate-500 text-slate-400'}`}
                                         >
                                            {preset.label}
                                         </button>
                                     ))}
                                </div>
                                
                                {/* Background Music Control */}
                                <div className="flex items-center gap-4 bg-slate-800/50 p-2 rounded-xl">
                                    <div className="flex items-center gap-2 flex-1">
                                        <Music className="w-4 h-4 text-slate-400" />
                                        <div className="flex-1 min-w-0">
                                            {bgMusic ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-indigo-300 truncate max-w-[150px]">{bgMusic.name}</span>
                                                    <button onClick={() => setBgMusic(null)} className="text-slate-500 hover:text-red-400"><X className="w-3 h-3"/></button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-500 italic">Chưa có nhạc nền</span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {bgMusic ? (
                                        <div className="flex items-center gap-2 w-32">
                                            <span className="text-[10px] text-slate-500">Vol</span>
                                            <input 
                                                type="range" min="0" max="1" step="0.05" 
                                                value={bgVolume} 
                                                onChange={(e) => setBgVolume(parseFloat(e.target.value))}
                                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                            />
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => bgMusicInputRef.current?.click()}
                                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-200 transition-colors flex items-center gap-1"
                                        >
                                            <Upload className="w-3 h-3" /> Chọn nhạc nền
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center justify-between">
                                     <div className="text-xs text-slate-500">
                                         {state.text.length} ký tự • {currentUser.credits.toLocaleString()} còn lại
                                     </div>
                                     <button 
                                        type="button" 
                                        onClick={handleGenerateAudio}
                                        disabled={state.isGeneratingAudio || !state.text.trim()}
                                        className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl text-white font-bold shadow-lg shadow-emerald-900/20 flex items-center gap-2 transition-all"
                                     >
                                         {state.isGeneratingAudio ? <Loader2 className="animate-spin w-5 h-5"/> : <Play className="w-5 h-5 fill-current"/>}
                                         {state.isGeneratingAudio ? 'Đang xử lý...' : 'Đọc ngay'}
                                     </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Floating Custom Player */}
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-50">
                    {state.audioUrl && (
                        <div className="bg-slate-900 text-white rounded-[2rem] p-6 shadow-2xl flex flex-col md:flex-row items-center gap-6 animate-in slide-in-from-bottom-8 border border-slate-800">
                            {/* Hidden Audio Element */}
                            <audio 
                                key={state.audioUrl} // CRITICAL FIX: Forces re-mount when URL changes
                                ref={audioRef}
                                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                                onEnded={() => setIsPlaying(false)}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                onError={(e) => console.error("Audio error:", e)}
                                autoPlay
                                hidden
                            >
                                <source src={state.audioUrl!} type="audio/wav" />
                            </audio>

                            {/* Icon Visual */}
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${isPlaying ? 'bg-indigo-600 animate-pulse' : 'bg-slate-800'}`}>
                                <Waves className="w-7 h-7"/>
                            </div>

                            {/* Custom Controls */}
                            <div className="flex-1 w-full min-w-0 flex flex-col gap-2">
                                 <div className="flex items-center gap-4">
                                     {/* Rewind 15s */}
                                     <button 
                                        onClick={() => handleSkip(-15)} 
                                        className="text-slate-400 hover:text-white transition-colors flex flex-col items-center gap-1 group"
                                        title="Lùi 15 giây"
                                     >
                                        <Rewind className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        <span className="text-[9px] font-mono">-15s</span>
                                     </button>

                                     <button 
                                        onClick={togglePlayback}
                                        className="w-12 h-12 bg-white text-slate-900 rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-white/10"
                                     >
                                         {isPlaying ? <Pause className="w-6 h-6 fill-current"/> : <Play className="w-6 h-6 fill-current ml-1"/>}
                                     </button>

                                     {/* Forward 15s */}
                                     <button 
                                        onClick={() => handleSkip(15)} 
                                        className="text-slate-400 hover:text-white transition-colors flex flex-col items-center gap-1 group"
                                        title="Tua 15 giây"
                                     >
                                        <FastForward className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        <span className="text-[9px] font-mono">+15s</span>
                                     </button>

                                     <input 
                                        type="range" 
                                        min="0" 
                                        max={duration || 0} 
                                        value={currentTime} 
                                        onChange={handleSeek}
                                        className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                     />
                                     <div className="text-xs font-mono text-slate-400 whitespace-nowrap min-w-[80px] text-right">
                                         {formatTime(currentTime)} / {formatTime(duration)}
                                     </div>
                                 </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 shrink-0">
                                <a href={state.audioUrl} download="baominh_audio.wav" className="px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-2">
                                    <Download className="w-4 h-4"/> WAV
                                </a>
                                <a href={state.mp3Url || '#'} download="baominh_audio.mp3" className="px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-2">
                                    <Download className="w-4 h-4"/> MP3
                                </a>
                                <button onClick={() => {
                                    setState(prev => ({...prev, audioUrl: null}));
                                    setIsPlaying(false);
                                }} className="p-3 hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-white" title="Thoát kết quả">
                                    <X className="w-5 h-5"/>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Error Notification */}
        {state.error && (
            <div className="fixed top-4 right-4 bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-xl shadow-2xl max-w-md animate-in slide-in-from-right z-50">
                <p className="text-sm">{state.error}</p>
                <button onClick={() => setState(prev => ({...prev, error: null}))} className="absolute top-2 right-2 p-1 hover:bg-red-500/20 rounded-full"><X className="w-3 h-3"/></button>
            </div>
        )}
      </div>
    </div>
  );
}