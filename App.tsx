import React, { useState, useEffect, useRef } from 'react';
import { 
  Waves, Download, X, Play, Pause, Loader2, 
  FileText, Wand2, Eraser, LogOut, LayoutDashboard,
  UserPlus, Key, Shield, MessageCircle, ExternalLink,
  Trash2, Edit, Calendar, CreditCard, Save, Users,
  Gift, Upload, FileJson, Mic, FileUp, Rewind, FastForward, Music,
  ChevronDown, ClipboardPaste, CalendarClock, Zap, BookOpen, Plus
} from 'lucide-react';
import { READING_MODES, PRESET_VOICES, ICONS } from './constants';
import { GenerationState, VoiceConfig, TTSProvider, ReadingMode, UserProfile, ManagedKey, UserRole, PlanType, ClonedVoice, Abbreviation } from './types';
import { generateContentFromDescription, generateAudioParallel, pcmToMp3, pcmToWav, analyzeVoice, mixAudio, testApiKey, extractAbbreviations } from './services/gemini';

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
      key: (typeof process !== 'undefined' && process.env?.API_KEY) || '', 
      status: 'VALID', 
      usageCount: 0, 
      isTrialKey: false, 
      allowedUserIds: [] 
  }
];

// --- API HELPER ---
const saveDataToApi = async (table: string, data: any) => {
    try {
        // Abbreviations có endpoint riêng
        const url = table === 'abbreviations' ? '/api/data/abbreviations' : `/api/data/${table}`;
        await fetch(url, {
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

// --- COMPONENT: DICTIONARY MANAGER ---
const DictionaryManager = ({ abbreviations, onUpdate, onAdd, onDelete, onEdit, isVisible, onClose }: any) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAbbr, setEditAbbr] = useState('');
  const [editFullText, setEditFullText] = useState('');
  const [newAbbr, setNewAbbr] = useState('');
  const [newFullText, setNewFullText] = useState('');

  const handleStartEdit = (item: Abbreviation) => {
    setEditingId(item.id);
    setEditAbbr(item.abbreviation);
    setEditFullText(item.fullText);
  };

  const handleSaveEdit = () => {
    if (editingId && editAbbr.trim() && editFullText.trim()) {
      onEdit(editingId, editAbbr.trim(), editFullText.trim());
      setEditingId(null);
      setEditAbbr('');
      setEditFullText('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditAbbr('');
    setEditFullText('');
  };

  const handleAddNew = () => {
    if (newAbbr.trim() && newFullText.trim()) {
      onAdd(newAbbr.trim(), newFullText.trim());
      setNewAbbr('');
      setNewFullText('');
    }
  };

  if (!isVisible) return null;

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4 animate-in slide-in-from-bottom">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-xl">
            <BookOpen className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Từ điển từ viết tắt</h3>
            <p className="text-xs text-slate-400">Quản lý các từ viết tắt đã phát hiện</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Add New Row */}
      <div className="bg-slate-950 border border-slate-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Plus className="w-4 h-4" />
          Thêm từ viết tắt mới
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Từ viết tắt (VD: HĐND)"
            value={newAbbr}
            onChange={(e) => setNewAbbr(e.target.value)}
            className="md:col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
          <input
            type="text"
            placeholder="Câu đầy đủ (VD: Hội đồng nhân dân)"
            value={newFullText}
            onChange={(e) => setNewFullText(e.target.value)}
            className="md:col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
          <button
            onClick={handleAddNew}
            disabled={!newAbbr.trim() || !newFullText.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Thêm
          </button>
        </div>
      </div>

      {/* Dictionary Table */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-300 uppercase font-bold text-xs">
              <tr>
                <th className="p-4">Từ viết tắt</th>
                <th className="p-4">Câu đầy đủ</th>
                <th className="p-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {abbreviations.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-slate-500">
                    Chưa có từ viết tắt nào. Hãy thêm mới hoặc để AI phát hiện từ văn bản.
                  </td>
                </tr>
              ) : (
                abbreviations.map((item: Abbreviation) => (
                  <tr key={item.id} className="hover:bg-slate-800/50">
                    {editingId === item.id ? (
                      <>
                        <td className="p-4">
                          <input
                            type="text"
                            value={editAbbr}
                            onChange={(e) => setEditAbbr(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          />
                        </td>
                        <td className="p-4">
                          <input
                            type="text"
                            value={editFullText}
                            onChange={(e) => setEditFullText(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          />
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={handleSaveEdit}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-white"
                              title="Lưu"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                              title="Hủy"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-4 font-mono text-indigo-400 font-semibold">{item.abbreviation}</td>
                        <td className="p-4 text-slate-300">{item.fullText}</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleStartEdit(item)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-400 transition-colors"
                              title="Sửa"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDelete(item.id)}
                              className="p-1.5 bg-slate-800 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400 transition-colors"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
  
  // Dictionary States
  const [abbreviations, setAbbreviations] = useState<Abbreviation[]>([]);
  const [showDictionary, setShowDictionary] = useState(false);
  const [isExtractingAbbr, setIsExtractingAbbr] = useState(false);
  
  // Notification State
  const [notification, setNotification] = useState<{
    open: boolean; title: string; message: string; type: 'error' | 'warning' | 'success' | 'info'; actionLabel?: string; onAction?: () => void;
  } | null>(null);

  // Payment States
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{ label: string; plan: string; price: number; months: number } | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [paymentCheckInterval, setPaymentCheckInterval] = useState<NodeJS.Timeout | null>(null);
  const [lastCheckedExpiry, setLastCheckedExpiry] = useState<number>(0);
  const [lastCheckedPlanType, setLastCheckedPlanType] = useState<string>("");

  // File Handling States
  const [isReadingFile, setIsReadingFile] = useState(false);
  const fileTextInputRef = useRef<HTMLInputElement>(null);
  
  // User Profile Menu State
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
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

  // Notification System
  const showNotification = (title: string, message: string, type: 'error' | 'warning' | 'success' | 'info' = 'info', actionLabel?: string, onAction?: () => void, autoClose: boolean = true) => {
    setNotification({ open: true, title, message, type, actionLabel, onAction });
    
    // Tự động đóng sau 5 giây (chỉ khi autoClose = true và không có action button)
    if (autoClose && !actionLabel) {
      setTimeout(() => {
        setNotification(null);
      }, 5000);
    }
  };

  // Helper format time
  const formatTime = (time: number) => {
    if(isNaN(time)) return "00:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
  };

  // Extract Title and Body from Text
  const extractTitleAndBodyFromText = (raw: string): string => {
    const lines = raw.split(/\r?\n/).map(l => l.trim());
    const contentLines: string[] = [];

    for (const line of lines) {
      if (!line) continue;
      const upper = line.toUpperCase();
      // Bỏ các dòng khai báo giọng đọc hoặc meta đầu file
      if (upper.startsWith("GIỌNG ") || upper.startsWith("GIONG ") || upper.startsWith("VOICE ")) continue;
      // Bỏ các dòng scan tool
      if (upper.includes("SCANNED WITH") || upper.includes("Camscanner".toUpperCase())) continue;
      contentLines.push(line);
    }

    if (contentLines.length === 0) return raw.trim();

    // TRƯỜNG HỢP VĂN BẢN HÀNH CHÍNH CÓ "THÔNG BÁO"
    const thongBaoIndex = contentLines.findIndex(l => l.toUpperCase().includes("THÔNG BÁO"));
    if (thongBaoIndex !== -1) {
      const titleLine = "THÔNG BÁO";
      const subtitleLine = (contentLines[thongBaoIndex + 1] || "").trim();

      // Phần thân: từ sau subtitle đến trước "Nơi nhận"
      const bodySource = contentLines.slice(thongBaoIndex + 2);
      const bodyLines: string[] = [];
      for (const l of bodySource) {
        const upper = l.toUpperCase();
        if (upper.startsWith("NƠI NHẬN") || upper.startsWith("NOI NHAN")) break;
        if (upper.includes("SCANNED WITH") || upper.includes("CAMSCANNER")) break;
        bodyLines.push(l);
      }

      const cleanTitle = subtitleLine ? `${titleLine}\n${subtitleLine}` : titleLine;
      const body = bodyLines.join("\n").trim();
      if (!body) return cleanTitle;
      return `${cleanTitle}\n\n${body}`;
    }

    // Mặc định: Dòng đầu tiên là tiêu đề, phần còn lại là nội dung
    const title = contentLines[0];
    const body = contentLines.slice(1).join("\n").trim();

    if (!body) return title;
    return `${title}\n\n${body}`;
  };

  // File Handling with OCR Support
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsReadingFile(true);
    try {
      let text = "";
      const fileType = file.name.split('.').pop()?.toLowerCase();

      if (fileType === 'txt') {
         text = await file.text();
      } else if (fileType === 'pdf') {
         if ((window as any).pdfjsLib) {
           (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
           const arrayBuffer = await file.arrayBuffer();
           const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
           for (let i = 1; i <= pdf.numPages; i++) {
             const page = await pdf.getPage(i);
             const content = await page.getTextContent();
             text += content.items.map((item: any) => item.str).join(' ') + '\n\n';
           }
           // Nếu sau khi đọc mà vẫn không có text, nhiều khả năng PDF là dạng scan/hình ảnh
           if (!text.trim()) {
             const Tesseract = (window as any).Tesseract;
             if (!Tesseract) {
               throw new Error("PDF là file scan/hình ảnh và không chứa lớp văn bản. Vui lòng bật OCR (Tesseract.js) hoặc dùng file .docx/.txt được gõ sẵn.");
             }

             // Fallback: dùng OCR để đọc tối đa 3 trang đầu tiên cho nhẹ
             showNotification("Đang xử lý OCR", "PDF là file scan, hệ thống sẽ nhận dạng chữ từ hình ảnh...", "info");
             let ocrText = "";
             const maxOcrPages = Math.min(pdf.numPages, 3);
             for (let i = 1; i <= maxOcrPages; i++) {
               const page = await pdf.getPage(i);
               const viewport = page.getViewport({ scale: 2 });
               const canvas = document.createElement('canvas');
               const context = canvas.getContext('2d');
               if (!context) continue;
               canvas.width = viewport.width;
               canvas.height = viewport.height;
               await page.render({ canvasContext: context, viewport }).promise;
               const dataUrl = canvas.toDataURL('image/png');
               const result = await Tesseract.recognize(dataUrl, 'vie', {});
               ocrText += (result?.data?.text || "") + "\n\n";
             }

             if (!ocrText.trim()) {
               throw new Error("Không thể nhận dạng chữ từ PDF scan. Vui lòng dùng file .docx hoặc .txt được gõ sẵn.");
             }
             text = ocrText;
           }
         } else {
             throw new Error("Thư viện PDF chưa tải xong. Vui lòng thử lại.");
         }
      } else if (fileType === 'docx') {
         if ((window as any).mammoth) {
            const arrayBuffer = await file.arrayBuffer();
            const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
            text = result.value;
         } else {
            throw new Error("Thư viện Word chưa tải xong. Vui lòng thử lại.");
         }
      } else if (fileType === 'jpg' || fileType === 'jpeg' || fileType === 'png' || fileType === 'webp') {
         // Ảnh chứa văn bản -> dùng OCR (Tesseract.js) nếu có
         const Tesseract = (window as any).Tesseract;
         if (!Tesseract) {
           throw new Error("Ảnh chứa văn bản (JPG/PNG), vui lòng bật OCR (Tesseract.js) để nhận dạng chữ, hoặc chuyển thành file .docx/.txt.");
         }
         showNotification("Đang xử lý OCR", "Hệ thống đang nhận dạng chữ từ ảnh, vui lòng chờ...", "info");
         const dataUrl = await new Promise<string>((resolve, reject) => {
           const reader = new FileReader();
           reader.onload = () => resolve(reader.result as string);
           reader.onerror = () => reject(new Error("Không thể đọc dữ liệu ảnh."));
           reader.readAsDataURL(file);
         });
         const result = await Tesseract.recognize(dataUrl, 'vie', {});
         text = (result?.data?.text || "");
      } else if (fileType === 'doc') {
         // Không thể đọc trực tiếp .doc trong trình duyệt, hướng dẫn người dùng chuyển sang .docx
         throw new Error("File .doc (Word cũ) chưa được hỗ trợ. Vui lòng lưu lại thành .docx rồi tải lên.");
      } else {
          throw new Error("Chỉ hỗ trợ file .txt, .pdf, .docx, .jpg, .png, .webp");
      }

      if (text.trim()) {
         const cleaned = extractTitleAndBodyFromText(text);
         setState(prev => ({ ...prev, text: prev.text + (prev.text ? '\n\n' : '') + cleaned }));
         showNotification("Thành công", `Đã trích xuất văn bản từ ${file.name}. Bạn có thể dùng nút "Từ điển" để phát hiện từ viết tắt.`, "success");
      } else {
         showNotification("Lỗi", "File trống hoặc không đọc được nội dung text.", "error");
      }
    } catch (err: any) {
      showNotification("Lỗi đọc file", err.message || "Không thể đọc file", "error");
    } finally {
      setIsReadingFile(false);
      if (fileTextInputRef.current) fileTextInputRef.current.value = '';
    }
  };

  // Smart Paste
  const handleSmartPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setState(prev => ({ ...prev, text: prev.text ? prev.text + '\n' + text.trim() : text.trim() }));
        showNotification("Thành công", "Đã dán văn bản. Bạn có thể dùng nút 'Từ điển' để phát hiện từ viết tắt.", "success");
      }
    } catch (e) {
      showNotification("Lỗi Clipboard", "Hãy dùng Ctrl+V.", "warning");
    }
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
        const [usersRes, keysRes, abbrRes] = await Promise.all([
          fetch('/api/data/users'),
          fetch('/api/data/keys'),
          fetch('/api/data/abbreviations')
        ]);
        
        if (!usersRes.ok || !keysRes.ok) {
            throw new Error(`Server returned status: ${usersRes.status} / ${keysRes.status}`);
        }

        const usersJson = await usersRes.json();
        const keysJson = await keysRes.json();
        const abbrJson = abbrRes.ok ? await abbrRes.json() : [];
        
        const loadedUsers = usersJson?.data || usersJson;
        const loadedKeys = keysJson?.data || keysJson;
        // API /api/data/abbreviations trả về mảng trực tiếp, không có wrapper
        const loadedAbbr = Array.isArray(abbrJson) ? abbrJson : (abbrJson?.data || []);

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

        setAbbreviations(loadedAbbr);

        setIsDataLoaded(true);
      } catch (e) {
        console.error("Failed to load data, using local defaults. Error:", e);
        setUsers(INITIAL_USERS);
        setKeys(INITIAL_KEYS);
        setAbbreviations([]);
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

  useEffect(() => {
    if (isDataLoaded) {
        // Lưu từ điển (kể cả khi rỗng để đảm bảo sync)
        saveDataToApi('abbreviations', abbreviations);
    }
  }, [abbreviations, isDataLoaded]);

  // Payment Functions
  const getSepayQRUrl = (amount: number): string => {
    if (!currentUser) return "";
    const code = `VT-${currentUser.loginId || currentUser.uid}`;
    const base = "https://qr.sepay.vn/img";
    const params = new URLSearchParams({
      acc: "VQRQAGPFR0030",
      bank: "MBBank",
      amount: String(amount),
      des: code
    });
    return `${base}?${params.toString()}`;
  };

  const handleSelectPlan = (plan: { label: string; plan: string; price: number; months: number }) => {
    setSelectedPlan(plan);
    showNotification("Đã chọn gói", `${plan.label} - ${plan.price.toLocaleString()}đ. Vui lòng quét QR để thanh toán.`, "info");
    // Reset lastChecked để bắt đầu kiểm tra mới
    if (currentUser) {
      setLastCheckedExpiry(currentUser.expiryDate || 0);
      setLastCheckedPlanType(currentUser.planType || "");
    }
    // Bắt đầu polling kiểm tra thanh toán mỗi 5 giây
    startPaymentPolling();
  };

  const checkPaymentStatus = async (showLog = true) => {
    if (!currentUser) return false;

    try {
      const loginId = currentUser.loginId || currentUser.uid;
      if (showLog) console.log(`Đang kiểm tra thanh toán cho ${loginId}...`);
      
      const res = await fetch(`/api/check_payment/${loginId}`);
      const data = await res.json();
      
      if (!data.found || !data.user) {
        if (showLog) console.log(`Chưa tìm thấy thông tin thanh toán.`);
        return false;
      }

      // So sánh với giá trị đã kiểm tra lần trước (tránh lặp vô hạn)
      const oldExpiry = lastCheckedExpiry || currentUser.expiryDate || 0;
      const oldPlanType = lastCheckedPlanType || currentUser.planType || "";
      const newExpiry = data.user.expiryDate || 0;
      const newPlanType = data.user.planType || "";

      // Phát hiện thay đổi: expiryDate tăng đáng kể HOẶC planType thay đổi
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      const expiryChanged = newExpiry > 0 && (
        oldExpiry === 0 || // Chưa có gói trước đó
        (newExpiry - oldExpiry) > ONE_DAY_MS // Tăng ít nhất 1 ngày
      );
      const planTypeChanged = newPlanType && newPlanType !== oldPlanType && newPlanType !== "";
      
      if (expiryChanged || planTypeChanged) {
        // Thanh toán thành công! Cập nhật user
        console.log(`Phát hiện thay đổi gói! Đang cập nhật thông tin...`);
        
        // Cập nhật lastChecked ngay để tránh lặp
        setLastCheckedExpiry(newExpiry);
        setLastCheckedPlanType(newPlanType);
        
        // Dùng trực tiếp data.user từ API (đã được cập nhật từ webhook)
        const updatedUser: UserProfile = {
          ...currentUser,
          ...data.user,
          expiryDate: newExpiry,
          planType: newPlanType as PlanType,
          uid: currentUser.uid,
          loginId: currentUser.loginId || data.user.loginId || loginId,
          displayName: currentUser.displayName || data.user.displayName || currentUser.loginId || loginId,
        };
        
        // Cập nhật state và localStorage
        setCurrentUser(updatedUser);
        localStorage.setItem('bm_user_session', JSON.stringify(updatedUser));
        
        // Cập nhật trong users array
        const updatedUsers = users.map(u => u.uid === currentUser.uid ? updatedUser : u);
        setUsers(updatedUsers);
        saveDataToApi('users', updatedUsers);
        
        // Format ngày tháng chính xác
        const expiryDate = new Date(newExpiry);
        const expiryDateStr = expiryDate.toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        // Lấy thông tin gói để hiển thị
        const planInfo = [
          { plan: "MONTHLY", label: "1 tháng", months: 1 },
          { plan: "3MONTHS", label: "3 tháng", months: 3 },
          { plan: "6MONTHS", label: "6 tháng", months: 6 },
          { plan: "YEARLY", label: "12 tháng", months: 12 }
        ].find(p => p.plan === newPlanType);
        
        const planLabel = planInfo ? planInfo.label : newPlanType;
        
        // Hiển thị thông báo với thông tin chi tiết (không tự động đóng)
        showNotification(
          "🎉 Thanh toán thành công!", 
          `Gói ${planLabel} đã được kích hoạt thành công!\nHạn dùng đến: ${expiryDateStr}\nSố ký tự/ngày: 50.000`, 
          "success",
          undefined,
          undefined,
          false // Không tự động đóng, để người dùng tự đóng
        );
        
        // Không tự động đóng modal, để người dùng tự đóng sau khi xem thông báo
        setSelectedPlan(null);
        stopPaymentPolling();
        return true;
      } else {
        // Cập nhật lastChecked ngay cả khi chưa có thay đổi (để tránh false positive)
        if (newExpiry > 0) setLastCheckedExpiry(newExpiry);
        if (newPlanType) setLastCheckedPlanType(newPlanType);
        
        if (showLog) console.log(`Chưa có thay đổi. Tiếp tục theo dõi...`);
      }
      
      return false;
    } catch (err: any) {
      console.error("Lỗi kiểm tra thanh toán:", err);
      return false;
    }
  };

  const startPaymentPolling = () => {
    // Dừng polling cũ nếu có
    if (paymentCheckInterval) {
      clearInterval(paymentCheckInterval);
    }

    setIsCheckingPayment(true);
    console.log("Bắt đầu kiểm tra thanh toán tự động (mỗi 5 giây)...");
    
    // Kiểm tra ngay lập tức
    checkPaymentStatus(false);
    
    const interval = setInterval(async () => {
      if (!currentUser) {
        clearInterval(interval);
        setIsCheckingPayment(false);
        return;
      }

      const success = await checkPaymentStatus(false);
      if (success) {
        clearInterval(interval);
        setIsCheckingPayment(false);
        setPaymentCheckInterval(null);
      }
    }, 5000); // Kiểm tra mỗi 5 giây

    setPaymentCheckInterval(interval);
    
    // Tự động dừng sau 10 phút
    setTimeout(() => {
      if (paymentCheckInterval === interval) {
        clearInterval(interval);
        setIsCheckingPayment(false);
        setPaymentCheckInterval(null);
        showNotification("Thông báo", "Đã dừng kiểm tra tự động sau 10 phút. Vui lòng bấm 'Kiểm tra thủ công' nếu đã thanh toán.", "warning");
      }
    }, 600000);
  };

  const stopPaymentPolling = () => {
    if (paymentCheckInterval) {
      clearInterval(paymentCheckInterval);
      setPaymentCheckInterval(null);
    }
    setIsCheckingPayment(false);
  };

  // Cleanup polling khi đóng modal hoặc unmount
  useEffect(() => {
    return () => {
      if (paymentCheckInterval) {
        clearInterval(paymentCheckInterval);
      }
    };
  }, [paymentCheckInterval]);

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

  const handleGuest = async () => {
      // Logic khôi phục key nếu hệ thống không có key nào (do lỡ xóa)
      const hasSystemKey = keys.some(k => k.allowedUserIds.length === 0);
      if (!hasSystemKey) {
          const defaultKey: ManagedKey = { 
            id: 'key-system-default-restored', 
            name: 'Key Hệ thống (Khôi phục)', 
            key: (typeof process !== 'undefined' && process.env?.API_KEY) || '', 
            status: 'VALID', 
            usageCount: 0, 
            isTrialKey: false, 
            allowedUserIds: [] 
          };
          setKeys(prev => [...prev, defaultKey]);
      }

      const guestUser: UserProfile = { 
        uid: 'guest', 
        displayName: 'Khách', 
        role: 'GUEST', 
        credits: 1000, 
        planType: 'TRIAL', 
        loginId: 'guest', 
        email: '', 
        photoURL: '', 
        lastActive: '', 
        isBlocked: false, 
        expiryDate: 0, 
        characterLimit: 1000, 
        dailyKeyCount: 0, 
        customVoices: [] 
      };
      
      setCurrentUser(guestUser);
      
      // Lưu user "guest" vào DB để webhook có thể tìm thấy
      const existingUser = users.find(u => u.loginId === 'guest' || u.uid === 'guest');
      if (!existingUser) {
        const updatedUsers = [...users, guestUser];
        setUsers(updatedUsers);
        await saveDataToApi('users', updatedUsers);
      }
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

  // Logic TTS - Select Best Key với retry và rotation
  const selectBestKey = (excluded: string[] = []) => {
    const validKeysInDb = keys.filter(k => k.status !== 'INVALID' && !excluded.includes(k.key));
    
    // 1. Ưu tiên Key riêng của user
    if (currentUser) {
        const privateKeys = validKeysInDb.filter(k => k.allowedUserIds.includes(currentUser.uid));
        if (privateKeys.length > 0) return privateKeys[0].key;
    }
    
    // 2. Ưu tiên Key chung trong DB & Xoay tua (Load Balancing)
    const sharedKeys = validKeysInDb.filter(k => k.allowedUserIds.length === 0);
    if (sharedKeys.length > 0) {
        // Thực hiện xoay tua ngẫu nhiên nếu có >= 2 key để chia tải
        const randomIndex = Math.floor(Math.random() * sharedKeys.length);
        return sharedKeys[randomIndex].key;
    }
    
    // 3. Cuối cùng mới lấy Key mặc định từ Env (nếu nó chưa bị loại trừ)
    const envKey = (typeof process !== 'undefined' && process.env?.API_KEY) || '';
    if (envKey && !excluded.includes(envKey)) {
        return envKey;
    }

    return '';
  };

  const getApiKeyForUser = () => {
      return selectBestKey();
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

    setState(prev => ({ ...prev, isGeneratingText: true, error: null }));
    
    const attempt = async (retries = 3, excluded: string[] = []) => {
      const key = selectBestKey(excluded);
      if (!key) {
          showNotification("Hết Key", "Vui lòng thêm API Key mới.", "error");
          setState(prev => ({...prev, isGeneratingText: false}));
          return;
      }
      try {
        const text = await generateContentFromDescription(input, activeMode.prompt, undefined, key);
        setState(prev => ({ ...prev, text, isGeneratingText: false }));
        // Gợi ý extract abbreviations sau khi tạo nội dung
        if (text.length > 100) {
          showNotification("Thông tin", "Nội dung đã được tạo. Bạn có thể dùng nút 'Từ điển' để phát hiện từ viết tắt nếu cần.", "info");
        }
      } catch (e: any) {
        const err = e.message.toLowerCase();
        const isRateLimit = err.includes("429") || err.includes("quota") || err.includes("hạn mức") || err.includes("resource exhausted");
        const isAuthError = err.includes("api key") || err.includes("403") || err.includes("unauthenticated");

        if (isRateLimit || isAuthError || err.includes("server") || err.includes("fetch")) {
             if (isAuthError && !isRateLimit && keys.some(k => k.key === key)) {
                setKeys(prev => prev.map(k => k.key === key ? {...k, status: 'INVALID'} : k));
             }
            
            if (retries > 0) {
                 console.log(`Gặp lỗi (${e.message}). Đổi Key khác... (${retries})`);
                 await attempt(retries - 1, [...excluded, key]);
            } else {
                 setState(prev => ({...prev, isGeneratingText: false}));
                 showNotification("Thất bại", "Không thể tạo nội dung lúc này. Vui lòng thử lại sau.", "error");
            }
        } else {
            showNotification("Lỗi", e.message, "error");
            setState(prev => ({ ...prev, error: e.message, isGeneratingText: false }));
        }
      }
    };
    await attempt();
  };

  // Dictionary Functions
  const handleExtractAbbreviations = async () => {
    if (!state.text.trim()) return;
    
    const key = getApiKeyForUser();
    if (!key) {
      showNotification("Lỗi", "Cần có API Key để trích xuất từ viết tắt.", "error");
      return;
    }

    setIsExtractingAbbr(true);
    try {
      const extracted = await extractAbbreviations(state.text, key, (msg, type) => {
        if (type === 'info') showNotification("Thông tin", msg, "info");
      });

      if (extracted.length > 0) {
        // Merge với abbreviations hiện có (tránh trùng lặp) - sử dụng functional update
        setAbbreviations(prev => {
          const existingAbbrs = new Set(prev.map(a => a.abbreviation.toUpperCase()));
          const newAbbrs: Abbreviation[] = extracted
            .filter(item => !existingAbbrs.has(item.abbreviation.toUpperCase()))
            .map(item => ({
              id: `abbr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              abbreviation: item.abbreviation,
              fullText: item.fullText,
              createdAt: Date.now(),
              updatedAt: Date.now()
            }));

          if (newAbbrs.length > 0) {
            setShowDictionary(true);
            showNotification("Thành công", `Đã phát hiện ${newAbbrs.length} từ viết tắt mới.`, "success");
            return [...prev, ...newAbbrs];
          } else {
            showNotification("Thông tin", "Tất cả từ viết tắt đã có trong từ điển.", "info");
            return prev;
          }
        });
      } else {
        showNotification("Thông tin", "Không phát hiện từ viết tắt nào trong văn bản.", "info");
      }
    } catch (e: any) {
      showNotification("Lỗi", `Không thể trích xuất từ viết tắt: ${e.message}`, "error");
    } finally {
      setIsExtractingAbbr(false);
    }
  };

  const handleAddAbbreviation = (abbr: string, fullText: string) => {
    const newAbbr: Abbreviation = {
      id: `abbr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      abbreviation: abbr,
      fullText: fullText,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setAbbreviations(prev => [...prev, newAbbr]);
  };

  const handleEditAbbreviation = (id: string, abbr: string, fullText: string) => {
    setAbbreviations(prev => prev.map(item => 
      item.id === id 
        ? { ...item, abbreviation: abbr, fullText: fullText, updatedAt: Date.now() }
        : item
    ));
  };

  const handleDeleteAbbreviation = (id: string) => {
    if (confirm('Bạn có chắc muốn xóa từ viết tắt này?')) {
      setAbbreviations(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleGenerateAudio = async () => {
    if (!state.text.trim()) return;
    if (currentUser && currentUser.credits < state.text.length) {
        return setState(prev => ({...prev, error: `Không đủ ký tự! (Cần: ${state.text.length}, Còn: ${currentUser.credits}). Hãy đóng góp Key để nhận thêm.`}));
    }

    setState(prev => ({ ...prev, isGeneratingAudio: true, error: null, audioUrl: null }));

    const attempt = async (retries = 3, excluded: string[] = []) => {
      const key = selectBestKey(excluded);
      if (!key) {
          showNotification("Hết Key", "Vui lòng thêm API Key mới.", "error");
          setState(prev => ({...prev, isGeneratingAudio: false}));
          return;
      }
      try {
        // 1. Generate Speech (truyền từ điển từ database và callback để tự động extract abbreviations)
        let buffer = await generateAudioParallel(
          state.text, 
          voiceConfig, 
          (p) => console.log(p), 
          undefined, 
          key, 
          abbreviations,
          // Callback tự động extract và thêm abbreviations mới vào từ điển
          (extractedAbbrs) => {
            if (extractedAbbrs.length > 0) {
              // Sử dụng functional update để đảm bảo lấy state mới nhất
              setAbbreviations(prev => {
                const existingAbbrs = new Set(prev.map(a => a.abbreviation.toUpperCase()));
                const newAbbrs: Abbreviation[] = extractedAbbrs
                  .filter(item => !existingAbbrs.has(item.abbreviation.toUpperCase()))
                  .map(item => ({
                    id: `abbr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    abbreviation: item.abbreviation,
                    fullText: item.fullText,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                  }));

                if (newAbbrs.length > 0) {
                  // Tự động hiển thị từ điển nếu có từ viết tắt mới
                  setShowDictionary(true);
                  showNotification("Thông tin", `Đã tự động phát hiện ${newAbbrs.length} từ viết tắt mới trong văn bản.`, "info");
                  return [...prev, ...newAbbrs];
                }
                return prev;
              });
            }
          }
        );
        
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
        const err = e.message.toLowerCase();
        const isRateLimit = err.includes("429") || err.includes("quota") || err.includes("hạn mức") || err.includes("resource exhausted");
        // Strict check: Chỉ lỗi auth mới tính là Invalid Key
        const isAuthError = err.includes("api key") || err.includes("403") || err.includes("unauthenticated");

        if (isRateLimit || isAuthError || err.includes("server") || err.includes("fetch")) {
             // Chỉ đánh dấu Invalid nếu chắc chắn là lỗi Auth
             if (isAuthError && !isRateLimit && keys.some(k => k.key === key)) {
                setKeys(prev => prev.map(k => k.key === key ? {...k, status: 'INVALID'} : k));
             }
            
            if (retries > 0) {
                 console.log(isRateLimit ? `Key bị giới hạn (429). Đổi Key khác... (${retries})` : `Gặp lỗi (${e.message}). Đổi Key khác... (${retries})`);
                 await attempt(retries - 1, [...excluded, key]);
            } else {
                 setState(prev => ({...prev, isGeneratingAudio: false}));
                 showNotification("Thất bại", "Hệ thống đang bận hoặc hết Key. Vui lòng thử lại sau.", "error");
            }
        } else {
            showNotification("Lỗi", e.message, "error");
            setState(prev => ({ ...prev, error: e.message, isGeneratingAudio: false }));
        }
      }
    };
    await attempt();
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
      <input 
        type="file" 
        ref={fileTextInputRef} 
        onChange={handleFileSelect} 
        accept=".txt,.pdf,.docx,.doc,.jpg,.jpeg,.png,.webp" 
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
                {currentUser ? (
                  <div className="relative">
                    <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="flex items-center gap-3 p-1.5 pr-4 bg-slate-800 border border-slate-700 rounded-full hover:shadow-md transition-all">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                        {currentUser.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left hidden sm:block">
                        <p className="text-[11px] font-black text-slate-200 uppercase leading-none">{currentUser.displayName}</p>
                        <p className="text-[10px] font-bold text-indigo-400 mt-0.5">{currentUser.credits.toLocaleString()} KT</p>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-400"/>
                    </button>
                    {showProfileMenu && (
                      <div className="absolute right-0 mt-3 w-72 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-3 z-[70] animate-in fade-in">
                        {/* Thông tin gói cước và ngày hết hạn */}
                        <div className="space-y-2 mb-3 pb-3 border-b border-slate-800">
                          {/* Gói cước */}
                          <div className="flex items-center justify-between p-2 bg-gradient-to-r from-indigo-900/50 to-blue-900/50 rounded-xl">
                            <div className="flex items-center gap-2">
                              <Zap className="w-4 h-4 text-amber-500"/>
                              <span className="text-[10px] font-black text-slate-300 uppercase">Gói:</span>
                              <span className="text-[11px] font-black text-indigo-400">
                                {currentUser.planType === 'MONTHLY' ? '1 tháng' :
                                 currentUser.planType === '3MONTHS' ? '3 tháng' :
                                 currentUser.planType === '6MONTHS' ? '6 tháng' :
                                 currentUser.planType === 'YEARLY' ? '12 tháng' :
                                 currentUser.planType === 'TRIAL' ? 'Dùng thử' :
                                 currentUser.planType}
                              </span>
                            </div>
                          </div>
                          
                          {/* Ngày hết hạn */}
                          {currentUser.expiryDate && currentUser.expiryDate > 0 ? (
                            <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded-xl">
                              <div className="flex items-center gap-2">
                                <CalendarClock className="w-4 h-4 text-slate-400"/>
                                <span className="text-[10px] font-bold text-slate-300">Hết hạn:</span>
                              </div>
                              <span className="text-[10px] font-black text-slate-200">
                                {new Date(currentUser.expiryDate).toLocaleDateString('vi-VN', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between p-2 bg-amber-900/20 rounded-xl">
                              <div className="flex items-center gap-2">
                                <CalendarClock className="w-4 h-4 text-amber-500"/>
                                <span className="text-[10px] font-bold text-amber-400">Chưa có gói</span>
                              </div>
                            </div>
                          )}
                          
                          {/* Tài nguyên API Key */}
                          {(() => {
                            const totalKeys = keys.length;
                            const validKeys = keys.filter(k => k.status === 'VALID').length;
                            const keyPercentage = totalKeys > 0 ? Math.round((validKeys / totalKeys) * 100) : 0;
                            const keyColorClass = keyPercentage >= 70 ? 'text-emerald-500' : keyPercentage >= 40 ? 'text-amber-500' : 'text-red-500';
                            const keyBgClass = keyPercentage >= 70 ? 'bg-emerald-500' : keyPercentage >= 40 ? 'bg-amber-500' : 'bg-red-500';
                            const keyTextClass = keyPercentage >= 70 ? 'text-emerald-400' : keyPercentage >= 40 ? 'text-amber-400' : 'text-red-400';
                            
                            return (
                              <button
                                onClick={() => {
                                  setShowProfileMenu(false);
                                  if (currentUser?.role === 'ADMIN') {
                                    setShowAdmin(true);
                                  } else {
                                    showNotification("Thông tin", `API Keys: ${validKeys}/${totalKeys} hoạt động (${keyPercentage}%)`, "info");
                                  }
                                }}
                                className="w-full flex items-center justify-between p-2 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-all group"
                              >
                                <div className="flex items-center gap-2">
                                  <Key className={`w-4 h-4 ${keyColorClass}`}/>
                                  <span className="text-[10px] font-bold text-slate-300">API Keys:</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 w-20 bg-slate-700 rounded-full h-2 overflow-hidden">
                                    <div 
                                      className={`h-full ${keyBgClass} transition-all`}
                                      style={{ width: `${keyPercentage}%` }}
                                    />
                                  </div>
                                  <span className={`text-[10px] font-black ${keyTextClass} min-w-[35px] text-right`}>
                                    {keyPercentage}%
                                  </span>
                                </div>
                              </button>
                            );
                          })()}
                        </div>
                        
                        {/* Các nút chức năng */}
                        <button
                          onClick={() => { setIsPricingModalOpen(true); setShowProfileMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold text-slate-300 hover:bg-emerald-900/20 rounded-xl"
                        >
                          <CalendarClock className="w-4 h-4 text-emerald-400" />
                          Gói cước & Thanh toán
                        </button>
                        {currentUser.role === 'ADMIN' && (
                          <button onClick={() => { setShowAdmin(true); setShowProfileMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold text-slate-300 hover:bg-indigo-900/20 rounded-xl">
                            <LayoutDashboard className="w-4 h-4"/> Admin Panel
                          </button>
                        )}
                        <button onClick={() => { setCurrentUser(null); localStorage.removeItem('bm_user_session'); }} className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold text-red-400 hover:bg-red-900/20 rounded-xl mt-1">
                          <LogOut className="w-4 h-4"/> Đăng xuất
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
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
                                    <button 
                                      onClick={handleExtractAbbreviations}
                                      disabled={isExtractingAbbr || !state.text.trim()}
                                      className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 disabled:opacity-50 flex items-center gap-1" 
                                      title="Phát hiện từ viết tắt từ văn bản"
                                    >
                                      {isExtractingAbbr ? <Loader2 className="w-4 h-4 animate-spin"/> : <BookOpen className="w-4 h-4"/>}
                                      <span className="text-xs hidden sm:inline">Phát hiện</span>
                                    </button>
                                    <button 
                                      onClick={() => setShowDictionary(!showDictionary)}
                                      className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 flex items-center gap-1" 
                                      title="Mở/Đóng từ điển"
                                    >
                                      <BookOpen className="w-4 h-4"/>
                                      <span className="text-xs hidden sm:inline">Từ điển</span>
                                      {abbreviations.length > 0 && (
                                        <span className="ml-1 px-1.5 py-0.5 bg-indigo-500 text-white text-[10px] rounded-full">
                                          {abbreviations.length}
                                        </span>
                                      )}
                                    </button>
                                    <button 
                                      onClick={() => fileTextInputRef.current?.click()} 
                                      disabled={isReadingFile}
                                      className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 disabled:opacity-50" 
                                      title="Nhập file văn bản"
                                    >
                                      {isReadingFile ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileUp className="w-4 h-4"/>}
                                    </button>
                                    <button onClick={handleSmartPaste} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400" title="Dán từ clipboard">
                                      <ClipboardPaste className="w-4 h-4"/>
                                    </button>
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

                {/* Dictionary Manager */}
                {showDictionary && (
                  <DictionaryManager
                    abbreviations={abbreviations}
                    onUpdate={setAbbreviations}
                    onAdd={handleAddAbbreviation}
                    onEdit={handleEditAbbreviation}
                    onDelete={handleDeleteAbbreviation}
                    isVisible={showDictionary}
                    onClose={() => setShowDictionary(false)}
                  />
                )}

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

        {/* Notification Toast */}
        {notification && notification.open && (
          <div className="fixed top-6 right-6 z-[300] animate-in slide-in-from-top-2 fade-in duration-300">
            <div className={`min-w-[320px] max-w-md rounded-2xl shadow-2xl border-2 p-6 backdrop-blur-xl ${
              notification.type === 'success' ? 'bg-emerald-900/90 border-emerald-500' :
              notification.type === 'error' ? 'bg-red-900/90 border-red-500' :
              notification.type === 'warning' ? 'bg-amber-900/90 border-amber-500' :
              'bg-blue-900/90 border-blue-500'
            }`}>
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  notification.type === 'success' ? 'bg-emerald-600 text-white' :
                  notification.type === 'error' ? 'bg-red-600 text-white' :
                  notification.type === 'warning' ? 'bg-amber-600 text-white' :
                  'bg-blue-600 text-white'
                }`}>
                  {notification.type === 'success' ? '✓' :
                   notification.type === 'error' ? '✕' :
                   notification.type === 'warning' ? '⚠' : 'ℹ'}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-white mb-1 text-sm">{notification.title}</h4>
                  <p className="text-xs text-slate-200 whitespace-pre-line">{notification.message}</p>
                  {notification.actionLabel && notification.onAction && (
                    <button
                      onClick={() => {
                        notification.onAction?.();
                        setNotification(null);
                      }}
                      className="mt-3 px-4 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase hover:bg-slate-700 transition-all"
                    >
                      {notification.actionLabel}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setNotification(null)}
                  className="flex-shrink-0 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {isPricingModalOpen && (
          <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Gói cước & Thanh toán</h2>
                <button 
                  onClick={() => { 
                    setIsPricingModalOpen(false); 
                    setSelectedPlan(null); 
                    stopPaymentPolling(); 
                  }} 
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                {isCheckingPayment && (
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin"/>
                    <p className="text-sm text-blue-300">Đang kiểm tra thanh toán tự động...</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: "1 tháng", plan: "MONTHLY", price: 150000, months: 1 },
                    { label: "3 tháng", plan: "3MONTHS", price: 450000, months: 3 },
                    { label: "6 tháng", plan: "6MONTHS", price: 900000, months: 6 },
                    { label: "12 tháng", plan: "YEARLY", price: 1800000, months: 12 }
                  ].map((plan) => (
                    <button
                      key={plan.plan}
                      onClick={() => handleSelectPlan(plan)}
                      className={`p-6 rounded-xl border-2 transition-all text-left ${
                        selectedPlan?.plan === plan.plan
                          ? 'border-indigo-500 bg-indigo-900/20'
                          : 'border-slate-800 hover:border-slate-700 bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-white">{plan.label}</h3>
                        <span className="text-2xl font-black text-indigo-400">{plan.price.toLocaleString()}đ</span>
                      </div>
                      <p className="text-xs text-slate-400">50.000 ký tự/ngày</p>
                    </button>
                  ))}
                </div>

                {selectedPlan && (
                  <div className="mt-6 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                    <h3 className="text-lg font-bold text-white mb-4">Quét QR để thanh toán</h3>
                    <div className="flex flex-col items-center gap-4">
                      <img 
                        src={getSepayQRUrl(selectedPlan.price)} 
                        alt="QR Code" 
                        className="w-64 h-64 border-4 border-white rounded-xl"
                      />
                      <div className="text-center space-y-2">
                        <p className="text-sm text-slate-300">Số tiền: <span className="font-bold text-white">{selectedPlan.price.toLocaleString()}đ</span></p>
                        <p className="text-xs text-slate-400">Mã thanh toán: <span className="font-mono text-indigo-400">VT-{currentUser?.loginId || currentUser?.uid}</span></p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}