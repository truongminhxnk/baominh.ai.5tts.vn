
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  TTSProvider, ReadingMode, VoiceConfig, GenerationState, UserProfile, ClonedVoice, PlanType, ManagedKey, AdCampaign, SystemConfig, UserRole
} from './types';
import { READING_MODES, PRESET_VOICES, GEMINI_VOICES, ADMIN_MODES } from './constants';
import { 
  generateContentFromDescription, generateAudioParallel, pcmToWav, pcmToMp3, mixWithBackgroundAudio, analyzeVoice, trimAudioTo20Seconds, validateApiKey
} from './services/gemini';
import { 
  Sparkles, Loader2, Download, Settings2, 
  X, Trash2, Waves,
  Menu, Edit3, LogOut, Zap,
  ChevronDown, FileText,
  MessageCircle, Sliders, Music,
  UserCheck, Terminal, Plus, FileUp, LayoutDashboard, 
  ShieldCheck,
  Key, UserPlus, ShieldX, QrCode, Lock, ClipboardPaste, 
  Users, Activity, MousePointerClick, ShieldAlert,
  Mic2, Volume2, Info, CheckCircle2, Upload, Fingerprint,
  User, Terminal as TerminalIcon,
  ChevronUp, AlertTriangle, FileJson, FileDown, Search,
  Settings, Database, RefreshCw, PlusCircle, MinusCircle,
  ExternalLink, Gift, Clock, AlertOctagon, Link,
  Megaphone, ImageIcon, Wand2, ArrowRight, ToggleLeft, ToggleRight,
  Calendar, Ban, CheckCircle, Save, Play, PlayCircle,
  Filter, UserCog, MoreVertical, Trash, Copy,
  UserSquare2, Mail, VolumeX, Ghost, Coins
} from 'lucide-react';

const AUTHOR_ZALO = "0986.234.983"; 
const ADMIN_ID = "truong2024.vn";
const ADMIN_PASS = "#Minh@123";
const API_BASE = "/api/data";

const App: React.FC = () => {
  // --- STATE ---
  const [logs, setLogs] = useState<{timestamp: number, message: string, type: string}[]>([]);
  const [activeMode, setActiveMode] = useState<ReadingMode>(ReadingMode.NEWS);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [managedKeys, setManagedKeys] = useState<ManagedKey[]>([]);
  const [adminTab, setAdminTab] = useState<'users' | 'keys' | 'logs'>('users');
  
  // Custom Voice & Background Audio State
  const [customVoices, setCustomVoices] = useState<ClonedVoice[]>([]);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [bgAudio, setBgAudio] = useState<{ name: string, buffer: ArrayBuffer } | null>(null);
  const [bgVolume, setBgVolume] = useState(0.25);

  // Key Contribution State
  const [isContributeModalOpen, setIsContributeModalOpen] = useState(false);
  const [contributedKey, setContributedKey] = useState('');
  const [isValidatingKey, setIsValidatingKey] = useState(false);

  // Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAIPromptOpen, setIsAIPromptOpen] = useState(false);
  const [isVoicePanelOpen, setIsVoicePanelOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [newKey, setNewKey] = useState<Partial<ManagedKey>>({ name: '', key: '', isTrialKey: false, allowedUserIds: [] });

  // Add User Form State
  const [newUserForm, setNewUserForm] = useState({
    displayName: '',
    email: '',
    role: 'USER' as UserRole,
    loginId: '',
    password: ''
  });

  // Filter & Search
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'ALL' | 'ACTIVE' | 'BLOCKED'>('ALL');

  // Editor State
  const [description, setDescription] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [progress, setProgress] = useState(0);
  const [loginCreds, setLoginCreds] = useState({ id: '', pass: '' });
  const [loginError, setLoginError] = useState<string | null>(null);

  const [config, setConfig] = useState<VoiceConfig>({
    provider: TTSProvider.GEMINI, 
    speed: 1.0, 
    pitch: 1.0, 
    emotion: 'NEUTRAL', 
    voiceName: 'Kore',
    activePresetId: 'thu-thao-vtv'
  });

  const [state, setState] = useState<GenerationState & { mp3Url: string | null }>({
    isGeneratingText: false, isGeneratingAudio: false, error: null, text: '', audioUrl: null, mp3Url: null, audioBuffer: null
  });

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const voiceSampleInputRef = useRef<HTMLInputElement>(null);

  // --- LOGIC ---
  const addLog = (message: string, type: string = 'info') => {
    setLogs(prev => [...prev, { timestamp: Date.now(), message, type }].slice(-50));
  };

  // Persist & Sync
  useEffect(() => {
    const savedSession = localStorage.getItem('bm_user_session');
    if (savedSession) {
      setCurrentUser(JSON.parse(savedSession));
    } else {
      setIsAuthModalOpen(true);
    }
    // Tải dữ liệu ban đầu
    fetchAllCommonData();
  }, []);

  const fetchAllCommonData = async () => {
    try {
      const keysResponse = await fetch(`${API_BASE}/keys`);
      const usersResponse = await fetch(`${API_BASE}/users`);
      if (keysResponse.ok) {
        const keysData = await keysResponse.json();
        if (keysData) setManagedKeys(keysData);
      }
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        if (usersData) setAllUsers(usersData);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (currentUser) {
      fetchCustomVoices();
    }
  }, [currentUser]);

  const fetchCustomVoices = async () => {
    if (!currentUser) return;
    try {
      const response = await fetch(`${API_BASE}/custom-voices-${currentUser.uid}`);
      if (response.ok) {
        const data = await response.json();
        if (data) setCustomVoices(data);
      }
    } catch (e) {}
  };

  const saveCustomVoices = async (voices: ClonedVoice[]) => {
    if (!currentUser) return;
    try {
      await fetch(`${API_BASE}/custom-voices-${currentUser.uid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voices)
      });
    } catch (e) {
      addLog("Lỗi lưu trữ giọng mẫu lên máy chủ", "error");
    }
  };

  const saveAdminData = async (type: 'users' | 'keys', data: any) => {
    try {
      await fetch(`${API_BASE}/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (currentUser?.role === 'ADMIN') addLog(`Hệ thống: Đã cập nhật dữ liệu ${type} lên máy chủ`, "success");
    } catch (e) {
      addLog(`Lỗi đồng bộ dữ liệu ${type}`, "error");
    }
  };

  const handleVoiceSampleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (customVoices.length >= 2) {
      addLog("Giới hạn: Bạn chỉ được phép lưu tối đa 2 giọng mẫu tùy chỉnh.", "error");
      return;
    }
    setIsUploadingVoice(true);
    addLog(`Đang chuẩn bị file mẫu: ${file.name}...`, "info");
    try {
      const buffer = await file.arrayBuffer();
      const { base64 } = await trimAudioTo20Seconds(buffer);
      const bestKey = selectBestApiKey();
      const analysis = await analyzeVoice(base64, addLog, bestKey);
      const newVoice: ClonedVoice = {
        id: `voice-${Date.now()}`,
        name: analysis.suggestedName || file.name.split('.')[0],
        gender: (analysis.gender || 'Bắc') as any,
        region: (analysis.region || 'Bắc') as any,
        description: analysis.description || 'Chưa có mô tả',
        toneSummary: analysis.toneSummary || 'Tự nhiên',
        createdAt: Date.now(),
        audioBase64: base64
      };
      const updated = [...customVoices, newVoice];
      setCustomVoices(updated);
      await saveCustomVoices(updated);
      addLog(`Đã phân tích và lưu giọng mẫu "${newVoice.name}" thành công!`, "success");
    } catch (e: any) {
      addLog(`Lỗi xử lý file mẫu: ${e.message}`, "error");
    } finally {
      setIsUploadingVoice(false);
      if (voiceSampleInputRef.current) voiceSampleInputRef.current.value = '';
    }
  };

  const deleteCustomVoice = async (id: string) => {
    const updated = customVoices.filter(v => v.id !== id);
    setCustomVoices(updated);
    await saveCustomVoices(updated);
    addLog("Đã xóa giọng mẫu tùy chỉnh", "info");
  };

  // --- KEY REWARD LOGIC ---
  const handleContributeKey = async () => {
    if (!contributedKey.trim()) return addLog("Vui lòng nhập API Key", "error");
    if (!currentUser) return;

    const todayStr = new Date().toLocaleDateString('vi-VN');
    
    // Kiểm tra giới hạn 1 key/ngày cho 1 user
    if (currentUser.lastKeyDate === todayStr) {
      return addLog("Mỗi ngày bạn chỉ được đóng góp 1 Key để nhận thưởng. Hãy quay lại vào ngày mai nhé!", "error");
    }

    // Kiểm tra giới hạn 6 key thưởng/ngày của hệ thống
    const contributedTodayKeys = managedKeys.filter(k => k.id.includes(`gift-${todayStr}`));
    if (contributedTodayKeys.length >= 6) {
       return addLog("Hệ thống đã nhận đủ 6 Key thưởng hôm nay. Hãy thử lại vào ngày mai!", "error");
    }

    setIsValidatingKey(true);
    addLog("Đang xác thực API Key...", "info");

    try {
      const isValid = await validateApiKey(contributedKey.trim());
      if (!isValid) throw new Error("API Key không hợp lệ hoặc đã hết hạn mức (Quota).");

      const isDuplicate = managedKeys.some(k => k.key === contributedKey.trim());
      if (isDuplicate) throw new Error("API Key này đã tồn tại trong kho hệ thống.");

      // Thêm Key vào kho
      const newKeyEntry: ManagedKey = {
        id: `gift-${todayStr}-${Date.now()}`,
        name: `User Gift: ${currentUser.displayName}`,
        key: contributedKey.trim(),
        status: 'VALID',
        usageCount: 0,
        isTrialKey: false,
        allowedUserIds: [] // Dùng chung
      };

      const updatedKeys = [...managedKeys, newKeyEntry];
      await saveAdminData('keys', updatedKeys);
      setManagedKeys(updatedKeys);

      // Cập nhật Profile User
      const updatedUser: UserProfile = {
        ...currentUser,
        credits: currentUser.credits + 10000,
        lastKeyDate: todayStr
      };
      setCurrentUser(updatedUser);
      localStorage.setItem('bm_user_session', JSON.stringify(updatedUser));
      
      // Đồng bộ user lên DB nếu là user thật
      if (updatedUser.role !== 'GUEST') {
        const updatedAllUsers = allUsers.map(u => u.uid === updatedUser.uid ? updatedUser : u);
        setAllUsers(updatedAllUsers);
        await saveAdminData('users', updatedAllUsers);
      }

      setIsContributeModalOpen(false);
      setContributedKey('');
      addLog("Xác thực thành công! Bạn nhận được 10.000 KT thưởng.", "success");
    } catch (e: any) {
      addLog(e.message, "error");
    } finally {
      setIsValidatingKey(false);
    }
  };

  /**
   * Fix: Added handleAIDraft to handle text generation via AI assistant.
   * This function selects the best API key, constructs the prompt using reading mode data,
   * and updates the editor with the generated text.
   */
  const handleAIDraft = async () => {
    if (!description.trim()) return;
    
    setState(s => ({ ...s, isGeneratingText: true }));
    addLog("Đang khởi tạo soạn thảo bằng AI...", "info");
    
    try {
      const modeData = READING_MODES.find(m => m.id === activeMode);
      const modePrompt = modeData?.prompt || "";
      const bestKey = selectBestApiKey();
      
      const result = await generateContentFromDescription(
        description.trim(), 
        modePrompt, 
        (msg, type) => addLog(msg, type),
        bestKey
      );
      
      if (result) {
        setGeneratedText(result);
        setIsAIPromptOpen(false);
        setDescription('');
        addLog("Đã soạn thảo nội dung thành công!", "success");
      }
    } catch (e: any) {
      // Error handling is managed inside generateContentFromDescription or handleAiError
    } finally {
      setState(s => ({ ...s, isGeneratingText: false }));
    }
  };

  const handleLogin = () => {
    setLoginError(null);
    if (loginCreds.id === ADMIN_ID && loginCreds.pass === ADMIN_PASS) {
      const adminUser: UserProfile = {
        uid: 'admin-root', displayName: 'Administrator', email: 'admin@baominh.ai',
        photoURL: `https://ui-avatars.com/api/?name=Admin&background=000&color=fff`,
        role: 'ADMIN', credits: 99999999, lastActive: new Date().toISOString(), isBlocked: false,
        planType: 'YEARLY', expiryDate: Date.now() + 3650 * 24 * 60 * 60 * 1000, characterLimit: 2000000,
        loginId: ADMIN_ID, password: ADMIN_PASS
      };
      setCurrentUser(adminUser);
      localStorage.setItem('bm_user_session', JSON.stringify(adminUser));
      setIsAuthModalOpen(false);
      addLog("Đăng nhập Admin thành công", "success");
    } else {
      const user = allUsers.find(u => u.loginId === loginCreds.id && u.password === loginCreds.pass);
      if (user) {
        if (user.isBlocked) return setLoginError("Tài khoản này đã bị khóa.");
        setCurrentUser(user);
        localStorage.setItem('bm_user_session', JSON.stringify(user));
        setIsAuthModalOpen(false);
        addLog(`Chào mừng trở lại, ${user.displayName}!`, "success");
      } else {
        setLoginError("Sai thông tin đăng nhập.");
      }
    }
  };

  const handleGuestLogin = () => {
    const guestUser: UserProfile = {
      uid: `guest-${Date.now()}`,
      displayName: 'Khách hàng',
      email: 'guest@baominh.ai',
      photoURL: `https://ui-avatars.com/api/?name=Guest&background=slate&color=fff`,
      role: 'GUEST',
      credits: 500,
      lastActive: new Date().toISOString(),
      isBlocked: false,
      planType: 'NONE',
      expiryDate: Date.now() + 24 * 60 * 60 * 1000,
      characterLimit: 10000,
      loginId: 'guest',
    };
    setCurrentUser(guestUser);
    localStorage.setItem('bm_user_session', JSON.stringify(guestUser));
    setIsAuthModalOpen(false);
    addLog("Bạn đang sử dụng chế độ Khách (Tặng 500 KT)", "info");
  };

  const handleLogout = () => {
    localStorage.removeItem('bm_user_session');
    setCurrentUser(null);
    setIsAuthModalOpen(true);
    setActiveMode(ReadingMode.NEWS);
  };

  // --- ADMIN ACTIONS ---
  const deleteUser = (uid: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa người dùng này? Thao tác không thể hoàn tác.")) return;
    const updated = allUsers.filter(u => u.uid !== uid);
    setAllUsers(updated);
    saveAdminData('users', updated);
    addLog(`Admin: Đã xóa người dùng ID ${uid}`, "info");
  };

  const toggleBlockUser = (uid: string) => {
    const updated = allUsers.map(u => u.uid === uid ? { ...u, isBlocked: !u.isBlocked } : u);
    setAllUsers(updated);
    saveAdminData('users', updated);
  };

  const saveEditedUser = () => {
    if (!editingUser) return;
    const updated = allUsers.map(u => u.uid === editingUser.uid ? editingUser : u);
    setAllUsers(updated);
    saveAdminData('users', updated);
    setEditingUser(null);
    addLog(`Admin: Cập nhật User ${editingUser.displayName} thành công`, "success");
  };

  const handleAddUser = () => {
    if (!newUserForm.displayName || !newUserForm.loginId || !newUserForm.password) return addLog("Vui lòng điền đủ thông tin", "error");
    const newUser: UserProfile = {
      uid: `user-${Date.now()}`,
      displayName: newUserForm.displayName,
      email: newUserForm.email || `${newUserForm.loginId}@baominh.ai`,
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(newUserForm.displayName)}&background=random`,
      role: newUserForm.role,
      credits: newUserForm.role === 'ADMIN' ? 99999999 : 50000,
      lastActive: new Date().toISOString(),
      isBlocked: false,
      planType: 'NONE',
      expiryDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
      characterLimit: 100000,
      loginId: newUserForm.loginId,
      password: newUserForm.password
    };
    const updated = [...allUsers, newUser];
    setAllUsers(updated);
    saveAdminData('users', updated);
    setIsAddUserModalOpen(false);
    setNewUserForm({ displayName: '', email: '', role: 'USER', loginId: '', password: '' });
    addLog(`Admin: Đã tạo User "${newUser.displayName}"`, "success");
  };

  const deleteKey = (id: string) => {
    if (!window.confirm("Xóa API Key này khỏi kho?")) return;
    const updated = managedKeys.filter(k => k.id !== id);
    setManagedKeys(updated);
    saveAdminData('keys', updated);
  };

  const addKey = () => {
    if (!newKey.key || !newKey.name) return addLog("Vui lòng điền đủ thông tin Key", "error");
    const keyToPush: ManagedKey = {
      id: `key-${Date.now()}`,
      name: newKey.name || '',
      key: newKey.key || '',
      status: 'UNTESTED',
      usageCount: 0,
      isTrialKey: !!newKey.isTrialKey,
      allowedUserIds: newKey.allowedUserIds || []
    };
    const updated = [...managedKeys, keyToPush];
    setManagedKeys(updated);
    saveAdminData('keys', updated);
    setIsKeyModalOpen(false);
    setNewKey({ name: '', key: '', isTrialKey: false, allowedUserIds: [] });
    addLog(`Admin: Đã thêm Key "${keyToPush.name}"`, "success");
  };

  const exportKeys = () => {
    const blob = new Blob([JSON.stringify(managedKeys, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baominh-key-vault-${new Date().toLocaleDateString()}.json`;
    a.click();
    addLog("Admin: Đã xuất tệp JSON danh sách Key", "info");
  };

  // --- TTS LOGIC ---
  const selectBestApiKey = () => {
    if (!currentUser) return process.env.API_KEY || "";
    const dedicatedKey = managedKeys.find(k => k.allowedUserIds.includes(currentUser.uid) && k.status !== 'INVALID');
    if (dedicatedKey) return dedicatedKey.key;
    const sharedKeys = managedKeys.filter(k => k.allowedUserIds.length === 0 && k.status !== 'INVALID');
    if (sharedKeys.length > 0) {
      const randomKey = sharedKeys[Math.floor(Math.random() * sharedKeys.length)];
      return randomKey.key;
    }
    return process.env.API_KEY || "";
  };

  const handleCreateAudio = async () => {
    const textToProcess = generatedText.trim();
    if (!textToProcess) return addLog("Vui lòng nhập văn bản", "error");
    if (currentUser && currentUser.credits < textToProcess.length) return addLog("Bạn không đủ ký tự. Hãy đóng góp Key để nhận thêm!", "error");
    
    setState(s => ({ ...s, isGeneratingAudio: true }));
    setProgress(0);
    try {
      const bestKey = selectBestApiKey();
      let buffer = await generateAudioParallel(textToProcess, config, setProgress, addLog, bestKey);
      if (bgAudio) {
        addLog("Đang trộn nhạc nền...", "info");
        buffer = await mixWithBackgroundAudio(buffer, bgAudio.buffer, bgVolume);
      }
      const wavUrl = URL.createObjectURL(pcmToWav(buffer));
      const mp3Url = URL.createObjectURL(pcmToMp3(buffer));
      
      if (currentUser && currentUser.role !== 'ADMIN') {
        const updatedUser = { ...currentUser, credits: currentUser.credits - textToProcess.length };
        setCurrentUser(updatedUser);
        localStorage.setItem('bm_user_session', JSON.stringify(updatedUser));
        if (updatedUser.role !== 'GUEST') {
           saveAdminData('users', allUsers.map(u => u.uid === updatedUser.uid ? updatedUser : u));
        }
      }
      setState(s => ({ ...s, audioUrl: wavUrl, mp3Url, isGeneratingAudio: false }));
      addLog("Thành công! Chuyển đổi hoàn tất.", "success");
    } catch (e: any) {
      addLog(e.message, "error");
      setState(s => ({ ...s, isGeneratingAudio: false }));
    }
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    addLog(`Đang tải nhạc nền: ${file.name}`, "info");
    const buffer = await file.arrayBuffer();
    setBgAudio({ name: file.name, buffer });
    addLog(`Đã nạp nhạc nền "${file.name}"`, "success");
  };

  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => {
      const matchSearch = u.displayName.toLowerCase().includes(userSearch.toLowerCase()) || 
                          u.uid.toLowerCase().includes(userSearch.toLowerCase());
      const matchFilter = userFilter === 'ALL' ? true :
                          userFilter === 'ACTIVE' ? !u.isBlocked : u.isBlocked;
      return matchSearch && matchFilter;
    });
  }, [allUsers, userSearch, userFilter]);

  const activePreset = useMemo(() => PRESET_VOICES.find(p => p.id === config.activePresetId), [config.activePresetId]);

  return (
    <div className="h-screen flex flex-col bg-[#F8FAFC] overflow-hidden font-sans">
      <header className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm z-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg cursor-pointer" onClick={() => setActiveMode(ReadingMode.NEWS)}>
            <Sparkles className="w-6 h-6"/>
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black italic bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent leading-none">BaoMinh AI</h1>
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-1">Creative AI Studio</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {currentUser && (
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border rounded-full">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black text-slate-800 uppercase leading-none">{currentUser.displayName}</p>
                <p className="text-[9px] font-bold text-indigo-600 mt-0.5">{currentUser.credits.toLocaleString()} KT</p>
              </div>
              <img src={currentUser.photoURL} className="w-7 h-7 rounded-full border-2 border-white shadow-sm"/>
            </div>
          )}
          <button onClick={handleLogout} className="p-2.5 text-slate-400 hover:text-red-500 transition-colors">
            <LogOut className="w-5 h-5"/>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 bg-white border-r flex flex-col p-4 hidden md:flex">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-3">Chế độ sáng tạo</div>
          <div className="space-y-1 overflow-y-auto flex-1 pr-1">
            {READING_MODES.map(mode => (
              <button key={mode.id} onClick={() => setActiveMode(mode.id)} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[11px] font-bold transition-all ${activeMode === mode.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                {mode.icon} {mode.label}
              </button>
            ))}
          </div>
          {currentUser?.role === 'ADMIN' && (
            <div className="pt-4 mt-4 border-t space-y-1">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-3">Quản trị viên</div>
              {ADMIN_MODES.map(mode => (
                <button key={mode.id} onClick={() => setActiveMode(mode.id)} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[11px] font-bold transition-all ${activeMode === mode.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                  {mode.icon} {mode.label}
                </button>
              ))}
            </div>
          )}
        </aside>

        {activeMode === ReadingMode.ADMIN_PANEL ? (
          <main className="flex-1 flex flex-col bg-slate-50 p-8 gap-8 overflow-hidden">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black text-slate-900">Bảng điều khiển Admin</h2>
              <div className="flex gap-2 p-1 bg-white rounded-2xl border shadow-sm">
                <button onClick={() => setAdminTab('users')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase ${adminTab === 'users' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>Người dùng</button>
                <button onClick={() => setAdminTab('keys')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase ${adminTab === 'keys' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>Kho Key</button>
                <button onClick={() => setAdminTab('logs')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase ${adminTab === 'logs' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>Lịch sử</button>
              </div>
            </div>

            <div className="flex-1 bg-white rounded-[2.5rem] border shadow-xl overflow-hidden flex flex-col">
              {adminTab === 'users' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-6 border-b flex items-center gap-4 bg-slate-50/50">
                    <input type="text" placeholder="Tìm kiếm user..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="flex-1 pl-6 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500 shadow-sm"/>
                    <button onClick={() => setIsAddUserModalOpen(true)} className="px-5 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg"><UserPlus className="w-4 h-4"/> Thêm mới</button>
                  </div>
                  <div className="flex-1 overflow-y-auto scrollbar-hide">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-white shadow-sm z-10">
                        <tr>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Người dùng</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">KT Còn lại</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Trạng thái</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map(user => (
                          <tr key={user.uid} className="border-b hover:bg-slate-50 transition-all">
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-3">
                                <img src={user.photoURL} className="w-10 h-10 rounded-2xl border shadow-sm"/>
                                <div>
                                  <p className="text-sm font-black text-slate-800">{user.displayName}</p>
                                  <p className="text-[10px] font-bold text-slate-400">{user.role} | {user.loginId}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6 text-sm font-bold text-slate-600">{user.credits.toLocaleString()}</td>
                            <td className="px-8 py-6 text-[10px] font-black uppercase">
                              <span className={user.isBlocked ? 'text-red-500' : 'text-emerald-500'}>{user.isBlocked ? 'Bị chặn' : 'Hoạt động'}</span>
                            </td>
                            <td className="px-8 py-6 text-right space-x-2">
                              <button onClick={() => setEditingUser(user)} className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><UserCog className="w-5 h-5"/></button>
                              <button onClick={() => toggleBlockUser(user.uid)} className={`p-2.5 rounded-xl transition-all ${user.isBlocked ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-500 hover:bg-amber-50'}`}>{user.isBlocked ? <CheckCircle className="w-5 h-5"/> : <Ban className="w-5 h-5"/>}</button>
                              <button onClick={() => deleteUser(user.uid)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-5 h-5"/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {adminTab === 'keys' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-6 border-b flex items-center justify-between bg-slate-50/50">
                    <h4 className="text-sm font-black text-slate-800 uppercase">Kho Key Hệ Thống ({managedKeys.length})</h4>
                    <div className="flex gap-2">
                      <button onClick={exportKeys} className="px-5 py-2.5 bg-white border text-slate-600 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><FileJson className="w-4 h-4"/> Xuất tệp</button>
                      <button onClick={() => setIsKeyModalOpen(true)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg"><PlusCircle className="w-4 h-4"/> Thêm mới</button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 scrollbar-hide">
                    {managedKeys.map(k => (
                      <div key={k.id} className="bg-slate-50 border border-slate-200 rounded-[2rem] p-6 flex flex-col gap-4 hover:border-indigo-500 transition-all group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 shadow-sm"><Key className="w-5 h-5"/></div>
                            <div>
                              <p className="text-sm font-black text-slate-800 truncate max-w-[200px]">{k.name}</p>
                              <p className="text-[8px] font-black uppercase text-indigo-600">{k.id.includes('gift') ? 'User Contributed' : 'System Managed'}</p>
                            </div>
                          </div>
                          <button onClick={() => deleteKey(k.id)} className="p-2 text-slate-300 hover:text-red-500 transition-all"><Trash className="w-5 h-5"/></button>
                        </div>
                        <input type="password" value={k.key} readOnly className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-500 outline-none"/>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminTab === 'logs' && (
                <div className="flex-1 overflow-y-auto p-8 font-mono bg-slate-900 text-emerald-400 scrollbar-hide">
                  <div className="space-y-2">
                    {logs.slice().reverse().map((log, i) => (
                      <div key={i} className={`text-[11px] py-1 border-b border-white/5 last:border-0 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : 'text-slate-400'}`}>
                        <span className="opacity-40">[{new Date(log.timestamp).toLocaleTimeString()}]</span> {log.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </main>
        ) : (
          <main className="flex-1 flex flex-col bg-slate-50 p-6 gap-6 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-[2rem] p-6 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-orange-100">
               <div className="flex items-center gap-4 text-center md:text-left">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                    <Gift className="w-8 h-8"/>
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase">Chương trình: Key hôm nay - KT vĩnh viễn</h3>
                    <p className="text-xs font-bold text-white/80">Tặng ngay 10.000 KT cho mỗi API Key hợp lệ. Giới hạn 6 Key/Hệ thống mỗi ngày.</p>
                  </div>
               </div>
               <button onClick={() => setIsContributeModalOpen(true)} className="px-8 py-3.5 bg-white text-orange-600 rounded-2xl text-[12px] font-black uppercase shadow-lg hover:scale-105 transition-all flex items-center gap-2">Đóng góp ngay <ArrowRight className="w-4 h-4"/></button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
              <div className="flex-1 flex flex-col bg-white rounded-[2.5rem] border shadow-xl overflow-hidden relative">
                <div className="px-8 py-6 border-b flex items-center justify-between bg-white sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Edit3 className="w-5 h-5"/></div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase">Nội dung văn bản</h3>
                      <p className="text-[10px] font-bold text-slate-400">{generatedText.length.toLocaleString()} ký tự</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setIsAIPromptOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase shadow-lg hover:scale-105 transition-all active:scale-95"><Sparkles className="w-4 h-4"/> Viết bằng AI</button>
                    <button onClick={() => setGeneratedText('')} className="p-2.5 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"><Trash2 className="w-5 h-5"/></button>
                  </div>
                </div>
                <textarea ref={editorRef} value={generatedText} onChange={(e) => setGeneratedText(e.target.value)} placeholder="Nhập nội dung của bạn..." className="flex-1 w-full p-8 text-sm leading-relaxed text-slate-700 bg-transparent outline-none resize-none placeholder:text-slate-300 font-medium"/>
                {state.isGeneratingAudio && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-12 text-center animate-in fade-in">
                    <div className="w-20 h-20 bg-indigo-600 rounded-3xl shadow-2xl flex items-center justify-center mb-6 animate-bounce"><Loader2 className="w-10 h-10 text-white animate-spin"/></div>
                    <h4 className="text-xl font-black text-slate-800 mb-2">Đang chuyển đổi giọng nói...</h4>
                    <div className="w-full max-sm h-3 bg-slate-100 rounded-full overflow-hidden mb-4 border-2 border-white shadow-inner">
                      <div className="h-full bg-indigo-600 transition-all duration-500" style={{width: `${progress}%`}}/>
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{progress}% Hoàn tất</p>
                  </div>
                )}
              </div>

              <div className="w-full md:w-80 flex flex-col gap-6 overflow-y-auto pr-1">
                <div className="bg-white rounded-[2rem] border shadow-lg p-6 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 rounded-xl text-amber-600"><Mic2 className="w-5 h-5"/></div>
                    <h4 className="text-[11px] font-black text-slate-800 uppercase">Giọng đọc ưu tiên</h4>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-black text-slate-800 mb-1">{activePreset?.label}</p>
                    <button onClick={() => setIsVoicePanelOpen(true)} className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-50 transition-all">Đổi giọng đọc</button>
                  </div>
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between"><span className="text-[10px] font-black text-slate-400 uppercase">Tốc độ ({config.speed}x)</span><input type="range" min="0.5" max="2.0" step="0.1" value={config.speed} onChange={(e) => setConfig({...config, speed: parseFloat(e.target.value)})} className="w-32 accent-indigo-600 h-1.5 rounded-full bg-slate-100 cursor-pointer"/></div>
                  </div>
                </div>

                <div className="bg-white rounded-[2rem] border shadow-lg p-6 flex flex-col gap-4">
                  <div className="flex items-center gap-3"><div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Music className="w-5 h-5"/></div><h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Nhạc nền & Hiệu ứng</h4></div>
                  {bgAudio ? (
                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-3">
                       <div className="flex items-center justify-between overflow-hidden"><span className="text-[10px] font-black uppercase text-indigo-800 truncate shrink-0">{bgAudio.name}</span><button onClick={() => setBgAudio(null)} className="p-1 hover:bg-white rounded-lg text-red-500"><X className="w-4 h-4"/></button></div>
                       <input type="range" min="0" max="1" step="0.01" value={bgVolume} onChange={(e) => setBgVolume(parseFloat(e.target.value))} className="w-full accent-indigo-600 h-1 rounded-full bg-indigo-200 cursor-pointer"/>
                    </div>
                  ) : (
                    <button onClick={() => bgInputRef.current?.click()} className="w-full py-6 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center gap-2 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-slate-400 hover:text-indigo-600">
                      <Upload className="w-6 h-6 opacity-50"/><span className="text-[10px] font-black uppercase">Tải nhạc nền</span>
                      <input type="file" ref={bgInputRef} onChange={handleBgUpload} accept="audio/*" className="hidden"/>
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <button onClick={handleCreateAudio} disabled={state.isGeneratingAudio || !generatedText} className="w-full py-5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-[1.8rem] text-sm font-black uppercase shadow-xl hover:shadow-indigo-200 hover:-translate-y-1 transition-all active:translate-y-0 flex items-center justify-center gap-3 disabled:opacity-50 disabled:translate-y-0">{state.isGeneratingAudio ? <Loader2 className="w-5 h-5 animate-spin"/> : <PlayCircle className="w-5 h-5"/>}Chuyển giọng nói</button>
                  {state.audioUrl && (
                    <div className="bg-indigo-900 rounded-[1.8rem] p-4 flex flex-col gap-3 animate-in slide-in-from-bottom-2">
                      <audio key={state.audioUrl} src={state.audioUrl} controls className="w-full h-8"/>
                      <a href={state.mp3Url || '#'} download={`baominh-ai-${Date.now()}.mp3`} className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase transition-all"><Download className="w-4 h-4"/> Tải MP3</a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="h-24 bg-slate-900 rounded-3xl border border-slate-800 p-4 overflow-hidden relative group">
              <div className="flex items-center gap-2 mb-2"><TerminalIcon className="w-3 h-3 text-emerald-400"/><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Hệ thống Logs</span></div>
              <div className="space-y-1 overflow-y-auto h-12 scrollbar-hide">
                {logs.slice().reverse().map((log, i) => (
                  <div key={i} className={`text-[10px] font-mono flex items-center gap-2 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : 'text-slate-400'}`}><span className="opacity-30">[{new Date(log.timestamp).toLocaleTimeString()}]</span><span>{log.message}</span></div>
                ))}
              </div>
            </div>
          </main>
        )}
      </div>

      {/* --- MODALS --- */}

      {/* Contribute Modal */}
      {isContributeModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
             <div className="px-8 py-6 border-b flex items-center justify-between bg-amber-500 text-white">
              <div className="flex items-center gap-3"><div className="p-2 bg-white/10 rounded-xl"><Key className="w-5 h-5"/></div><h3 className="text-lg font-black uppercase">Đóng góp & Nhận thưởng</h3></div>
              <button onClick={() => setIsContributeModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white/50"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-8 space-y-6">
               <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-[11px] font-bold text-amber-800 leading-relaxed">
                  🚀 Tặng ngay <b>10.000 KT</b> vào tài khoản khi đóng góp 01 Key Gemini.<br/>
                  • Giới hạn 01 Key/Người/Ngày.<br/>
                  • Hệ thống chỉ nhận 06 Key đầu tiên mỗi ngày.<br/>
                  • Hướng dẫn: Tạo Key tại <a href="https://aistudio.google.com/app/apikey" target="_blank" className="underline font-black">AI Studio</a>.
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nhập API Key (AIza...)</label>
                 <input type="text" value={contributedKey} onChange={(e) => setContributedKey(e.target.value)} placeholder="Dán mã Key của bạn" className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black outline-none focus:border-amber-500 transition-all"/>
               </div>
               <button onClick={handleContributeKey} disabled={isValidatingKey || !contributedKey.trim()} className="w-full py-4 bg-amber-500 text-white rounded-2xl text-sm font-black uppercase shadow-lg hover:bg-amber-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50">{isValidatingKey ? <Loader2 className="w-5 h-5 animate-spin"/> : <Coins className="w-5 h-5"/>} Xác thực & Nhận thưởng</button>
            </div>
          </div>
        </div>
      )}

      {/* User Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="px-8 py-6 border-b flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-3"><div className="p-2 bg-indigo-600 rounded-xl text-white"><UserCog className="w-5 h-5"/></div><h3 className="text-lg font-black text-slate-800 uppercase">Chỉnh sửa người dùng</h3></div>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tên hiển thị</label>
                  <input type="text" value={editingUser.displayName} onChange={(e) => setEditingUser({...editingUser, displayName: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black outline-none focus:border-indigo-500 transition-all"/>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">KT Còn lại</label>
                  <input type="number" value={editingUser.credits} onChange={(e) => setEditingUser({...editingUser, credits: parseInt(e.target.value) || 0})} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black outline-none focus:border-indigo-500 transition-all"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ID Đăng nhập</label>
                  <input type="text" value={editingUser.loginId} onChange={(e) => setEditingUser({...editingUser, loginId: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black outline-none focus:border-indigo-500 transition-all"/>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Mật khẩu</label>
                  <input type="text" value={editingUser.password} onChange={(e) => setEditingUser({...editingUser, password: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black outline-none focus:border-indigo-500 transition-all"/>
                </div>
              </div>
              <button onClick={saveEditedUser} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase shadow-lg hover:shadow-indigo-100 flex items-center justify-center gap-2"><Save className="w-5 h-5"/> Lưu thay đổi</button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Panel Modal */}
      {isVoicePanelOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-4xl h-[85vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white"><Mic2 className="w-6 h-6"/></div>
                <h3 className="text-xl font-black text-slate-800">Thư viện giọng đọc</h3>
              </div>
              <button onClick={() => setIsVoicePanelOpen(false)} className="p-2.5 hover:bg-slate-100 rounded-full transition-all text-slate-400"><X className="w-6 h-6"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
              <div className="mb-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3"><Ghost className="w-5 h-5 text-indigo-600"/><h4 className="text-sm font-black text-slate-800 uppercase">Giọng nói của tôi (Lưu tối đa 2 mẫu)</h4></div>
                  {customVoices.length < 2 && (
                    <button onClick={() => voiceSampleInputRef.current?.click()} disabled={isUploadingVoice} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:scale-105 transition-all shadow-md">{isUploadingVoice ? <Loader2 className="w-4 h-4 animate-spin"/> : <PlusCircle className="w-4 h-4"/>}{isUploadingVoice ? "Đang phân tích..." : "Tải lên giọng mẫu"}</button>
                  )}
                  <input type="file" ref={voiceSampleInputRef} onChange={handleVoiceSampleUpload} accept="audio/*" className="hidden"/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {customVoices.map(voice => (
                      <div key={voice.id} className="flex flex-col p-6 rounded-[2rem] border-2 transition-all relative overflow-hidden bg-slate-50 border-slate-200 group hover:border-indigo-400">
                        <div className="flex items-center gap-4 mb-3">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-md bg-indigo-500">{voice.name.charAt(0)}</div>
                          <div className="text-left flex-1 overflow-hidden"><p className="text-sm font-black text-slate-800 truncate">{voice.name}</p><div className="flex gap-1"><span className="text-[8px] font-black uppercase text-indigo-600">{voice.gender}</span><span className="text-[8px] font-black uppercase text-slate-400">•</span><span className="text-[8px] font-black uppercase text-slate-400">{voice.region}</span></div></div>
                          <button onClick={() => deleteCustomVoice(voice.id)} className="p-2 text-slate-300 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4"/></button>
                        </div>
                        <button onClick={() => { setConfig({...config, activePresetId: voice.id, voiceName: voice.gender === 'Nữ' ? 'Kore' : 'Fenrir'}); setIsVoicePanelOpen(false); }} className="w-full py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all shadow-sm">Sử dụng giọng mẫu</button>
                      </div>
                    ))}
                    {customVoices.length === 0 && <div className="h-32 border-2 border-dashed border-slate-100 rounded-[2.5rem] flex items-center justify-center text-slate-300 col-span-full font-black uppercase tracking-widest text-[10px]">Chưa có giọng mẫu</div>}
                </div>
              </div>
              <div className="w-full h-px bg-slate-100 mb-10"/>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {PRESET_VOICES.map(voice => (
                    <button key={voice.id} onClick={() => { setConfig({...config, activePresetId: voice.id, voiceName: voice.baseVoice}); setIsVoicePanelOpen(false); }} className={`flex flex-col p-6 rounded-[2rem] border-2 transition-all group relative overflow-hidden ${config.activePresetId === voice.id ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50'}`}>
                      <div className="flex items-center gap-4 mb-3"><div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-md ${voice.gender === 'Nam' ? 'bg-blue-500' : 'bg-pink-500'}`}>{voice.label.charAt(0)}</div><div className="text-left"><p className="text-sm font-black text-slate-800">{voice.label}</p></div></div>
                      <p className="text-[10px] text-slate-500 text-left line-clamp-2 leading-relaxed">{voice.description}</p>
                      {config.activePresetId === voice.id && <div className="absolute top-4 right-4 text-indigo-600"><CheckCircle2 className="w-6 h-6"/></div>}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-white animate-in fade-in duration-500">
          <div className="w-full max-w-sm flex flex-col items-center">
            <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl mb-8 animate-bounce"><Sparkles className="w-10 h-10"/></div>
            <h2 className="text-2xl font-black text-slate-900 mb-2 italic">Bảo Minh AI Studio</h2>
            <p className="text-sm font-bold text-slate-400 mb-8 uppercase tracking-[0.2em]">Chào mừng trở lại</p>
            <div className="w-full space-y-4">
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tên đăng nhập</label><input type="text" value={loginCreds.id} onChange={(e) => setLoginCreds({...loginCreds, id: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 transition-all"/></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Mật khẩu</label><input type="password" value={loginCreds.pass} onChange={(e) => setLoginCreds({...loginCreds, pass: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 transition-all"/></div>
              {loginError && <p className="text-xs font-black text-red-500 text-center">{loginError}</p>}
              <button onClick={handleLogin} className="w-full py-5 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-indigo-600 transition-all active:scale-95 mt-2">Xác nhận đăng nhập</button>
              <div className="relative py-4 flex items-center justify-center"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div><span className="relative px-4 bg-white text-[10px] font-black text-slate-300 uppercase">Hoặc</span></div>
              <button onClick={handleGuestLogin} className="w-full py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-[11px] font-black uppercase hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm"><UserSquare2 className="w-4 h-4"/> Sử dụng chế độ Khách (Tặng 500 KT)</button>
            </div>
            <div className="mt-12 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest"><p className="mb-2">Bản quyền thuộc về Bảo Minh AI</p><div className="flex items-center gap-2 justify-center"><span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span><span className="text-slate-800">Hệ thống đang hoạt động</span></div></div>
          </div>
        </div>
      )}

      {/* Other Admin Modals (Add User, Key) */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
             <div className="px-8 py-6 border-b flex items-center justify-between bg-indigo-600 text-white"><h3 className="text-lg font-black uppercase">Tạo người dùng mới</h3><button onClick={() => setIsAddUserModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X className="w-5 h-5"/></button></div>
             <div className="p-8 space-y-5">
              <input type="text" value={newUserForm.displayName} onChange={(e) => setNewUserForm({...newUserForm, displayName: e.target.value})} placeholder="Họ và tên" className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black outline-none focus:border-indigo-500 transition-all"/>
              <input type="text" value={newUserForm.loginId} onChange={(e) => setNewUserForm({...newUserForm, loginId: e.target.value})} placeholder="Login ID" className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black outline-none focus:border-indigo-500 transition-all"/>
              <input type="text" value={newUserForm.password} onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})} placeholder="Mật khẩu" className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black outline-none focus:border-indigo-500 transition-all"/>
              <button onClick={handleAddUser} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-sm font-black uppercase shadow-xl hover:bg-indigo-600 transition-all">Khởi tạo người dùng</button>
             </div>
          </div>
        </div>
      )}

      {isKeyModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
             <div className="px-8 py-6 border-b flex items-center justify-between bg-slate-900 text-white"><h3 className="text-lg font-black uppercase">Thêm API Key mới</h3><button onClick={() => setIsKeyModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X className="w-5 h-5"/></button></div>
             <div className="p-8 space-y-5">
              <input type="text" value={newKey.name} onChange={(e) => setNewKey({...newKey, name: e.target.value})} placeholder="Tên gợi nhớ (VD: Key VIP 01)" className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black outline-none focus:border-indigo-500 transition-all"/>
              <input type="text" value={newKey.key} onChange={(e) => setNewKey({...newKey, key: e.target.value})} placeholder="Mã API (AIza...)" className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black outline-none focus:border-indigo-500 transition-all"/>
              <button onClick={addKey} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-sm font-black uppercase shadow-lg hover:bg-indigo-600 transition-all">Xác nhận thêm Key</button>
             </div>
          </div>
        </div>
      )}

      {isAIPromptOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="px-8 py-6 border-b flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-3"><div className="p-2 bg-indigo-600 rounded-xl text-white"><Sparkles className="w-5 h-5"/></div><h3 className="text-lg font-black text-slate-800">Trợ lý sáng tạo</h3></div>
              <button onClick={() => setIsAIPromptOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-8 space-y-6">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả nội dung bạn cần..." className="w-full h-32 p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-medium outline-none focus:border-indigo-500 transition-all resize-none"/>
              <button onClick={() => { handleAIDraft(); }} disabled={state.isGeneratingText || !description.trim()} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase shadow-lg hover:shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50">{state.isGeneratingText ? <Loader2 className="w-5 h-5 animate-spin"/> : <Wand2 className="w-5 h-5"/>} Bắt đầu soạn thảo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
