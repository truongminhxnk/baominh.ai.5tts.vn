
import React from 'react';
import { 
  BookOpen, 
  Music, 
  FileText, 
  Heart, 
  Users, 
  Mic2, 
  Clapperboard,
  Waves,
  Download,
  Play,
  Settings,
  Type,
  Sparkles,
  Loader2,
  FileUp,
  Megaphone,
  Newspaper,
  LayoutDashboard
} from 'lucide-react';
import { ReadingMode, TTSProvider, VoicePreset } from './types';

export const READING_MODES = [
  { id: ReadingMode.NEWS, label: 'Đọc tin tức', icon: <Newspaper className="w-5 h-5" />, color: 'emerald', prompt: 'Viết một bản tin thời sự ngắn gọn, khách quan và chuyên nghiệp về: ' },
  { id: ReadingMode.STORY, label: 'Đọc truyện', icon: <BookOpen className="w-5 h-5" />, color: 'amber', prompt: 'Viết một câu chuyện ngắn truyền cảm hứng về chủ đề: ' },
  { id: ReadingMode.POETRY, label: 'Đọc thơ', icon: <Music className="w-5 h-5" />, color: 'pink', prompt: 'Sáng tác một bài thơ lục bát hoặc thơ tự do về chủ đề: ' },
  { id: ReadingMode.PROSE, label: 'Đọc văn', icon: <FileText className="w-5 h-5" />, color: 'blue', prompt: 'Viết một đoạn văn tản văn sâu sắc về chủ đề: ' },
  { id: ReadingMode.ADVERTISEMENT, label: 'Quảng cáo', icon: <Megaphone className="w-5 h-5" />, color: 'orange', prompt: 'Viết kịch bản quảng cáo thu hút, hào hứng, kêu gọi mua hàng cho: ' },
  { id: ReadingMode.CONDOLENCE, label: 'Bài chia buồn', icon: <Heart className="w-5 h-5" />, color: 'slate', prompt: 'Viết một lời chia buồn chân thành, trang trọng cho: ' },
  { id: ReadingMode.WEDDING, label: 'Thoại đám cưới', icon: <Users className="w-5 h-5" />, color: 'rose', prompt: 'Viết một bài phát biểu dẫn chương trình đám cưới lãng mạn cho: ' },
  { id: ReadingMode.SPEECH, label: 'Diễn thuyết', icon: <Mic2 className="w-5 h-5" />, color: 'indigo', prompt: 'Viết một bài diễn thuyết hùng hồn về chủ đề: ' },
  { id: ReadingMode.MOVIE_REVIEW, label: 'Review phim', icon: <Clapperboard className="w-5 h-5" />, color: 'violet', prompt: 'Viết một kịch bản review phim chuyên nghiệp cho: ' },
];

export const ADMIN_MODES = [
  { id: ReadingMode.ADMIN_PANEL, label: 'Quản lý người dùng', icon: <LayoutDashboard className="w-5 h-5" />, prompt: '' }
];

export const PROVIDERS = [
  { id: TTSProvider.GEMINI, label: 'Gemini Voice', sub: 'Native High Quality' }
];

export const GEMINI_VOICES = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'];

// Từ điển viết tắt tiếng Việt phổ biến
export const VIETNAMESE_ABBREVIATIONS: Record<string, string> = {
  "HĐND": "Hội đồng nhân dân",
  "UBND": "Ủy ban nhân dân",
  "UBMTTQ": "Ủy ban Mặt trận Tổ quốc",
  "UBMT": "Ủy ban Mặt trận", // Xử lý trường hợp UBMT đứng riêng
  "MTTQ": "Mặt trận Tổ quốc",
  "TW": "Trung ương",
  "TƯ": "Trung ương",
  "BCH": "Ban chấp hành",
  "TP.": "Thành phố",
  "TP": "Thành phố",
  "TT.": "Thị trấn",
  "Q.": "Quận",
  "H.": "Huyện",
  "X.": "Xã",
  "P.": "Phường",
  "VN": "Việt Nam",
  "VNĐ": "Việt Nam Đồng",
  "CSGT": "Cảnh sát giao thông",
  "BHXH": "Bảo hiểm xã hội",
  "BHYT": "Bảo hiểm y tế",
  "Đ/c": "Đồng chí",
  "TS.": "Tiến sĩ",
  "ThS.": "Thạc sĩ",
  "BS.": "Bác sĩ",
  "GS.": "Giáo sư",
  "NSND": "Nghệ sĩ nhân dân",
  "NSƯT": "Nghệ sĩ ưu tú",
  "THPT": "Trung học phổ thông",
  "THCS": "Trung học cơ sở",
  "ĐH": "Đại học",
  "CĐ": "Cao đẳng",
  "GTVT": "Giao thông vận tải",
  "TN&MT": "Tài nguyên và Môi trường",
  "KH&ĐT": "Kế hoạch và Đầu tư",
  "LĐTBXH": "Lao động thương binh và xã hội",
  "CNTT": "Công nghệ thông tin",
  "GDP": "Tổng sản phẩm nội địa",
  "WTO": "Tổ chức thương mại thế giới",
  "WHO": "Tổ chức y tế thế giới",
  "BTC": "Ban tổ chức",
  "BQL": "Ban quản lý",
  "HTX": "Hợp tác xã",
  "KCN": "Khu công nghiệp",
  "CCN": "Cụm công nghiệp",
  "BĐS": "Bất động sản",
  "GTGT": "Giá trị gia tăng",
  "VAT": "Thuế giá trị gia tăng"
};

// PRESET VOICES - GIỌNG TUYỂN CHỌN (9 GIỌNG)
export const PRESET_VOICES: VoicePreset[] = [
  {
    id: 'thu-thao-vtv',
    label: 'Thu Thảo (VTV)',
    gender: 'Nữ',
    baseVoice: 'Kore',
    tags: ['Bắc', 'Phát thanh'],
    description: `STRICT NORTHERN VIETNAMESE. Elite broadcast professional. Perfectly articulated news anchor voice. Serious, authoritative, yet incredibly smooth and clear. High-fidelity television reporting cadence.`
  },
  {
    id: 'kim-cuc-vov',
    label: 'Kim Cúc (VOV)',
    gender: 'Nữ',
    baseVoice: 'Kore',
    tags: ['Bắc', 'Truyện'],
    description: `STRICT NORTHERN VIETNAMESE. Deep, Warm, Resonant, Slow-paced, Emotional. Late night storytelling style.`
  },
  {
    id: 'minh-chuan-vtv',
    label: 'Minh Chuẩn (VTV)',
    gender: 'Nam',
    baseVoice: 'Fenrir',
    tags: ['Bắc', 'Thời sự'],
    description: `STRICT NORTHERN VIETNAMESE. Authoritative, Clear, Serious, Powerful Baritone. News anchor style.`
  },
  {
    id: 'ngoc-lan-mn',
    label: 'Ngọc Lan (Miền Nam)',
    gender: 'Nữ',
    baseVoice: 'Kore',
    tags: ['Nam', 'Dịu dàng'],
    description: `STRICT SOUTHERN VIETNAMESE (SAIGON). Soft, sweet, melodic, and very friendly. Natural daily conversation style.`
  },
  {
    id: 'hoang-nam-mb',
    label: 'Hoàng Nam (Miền Bắc)',
    gender: 'Nam',
    baseVoice: 'Fenrir',
    tags: ['Bắc', 'Trẻ trung'],
    description: `STRICT NORTHERN VIETNAMESE. Young, energetic, clear, and modern. Suitable for podcasts and youth content.`
  },
  {
    id: 'thuy-chi-vov',
    label: 'Thùy Chi (Miền Bắc)',
    gender: 'Nữ',
    baseVoice: 'Kore',
    tags: ['Bắc', 'Trong trẻo'],
    description: `STRICT NORTHERN VIETNAMESE. High-pitched, crystal clear, gentle, and polite. Ideal for announcements.`
  },
  {
    id: 'trung-kien-mn',
    label: 'Trung Kiên (Miền Nam)',
    gender: 'Nam',
    baseVoice: 'Fenrir',
    tags: ['Nam', 'Trầm ấm'],
    description: `STRICT SOUTHERN VIETNAMESE. Warm, deep, confident, and persuasive. Commercial and documentary style.`
  },
  {
    id: 'thu-trang-mt',
    label: 'Thu Trang (Miền Trung)',
    gender: 'Nữ',
    baseVoice: 'Kore',
    tags: ['Trung', 'Dịu dàng'],
    description: `STRICT CENTRAL VIETNAMESE (HUE/DANANG). Soft, poetic, rhythmic, and traditional. Storytelling style.`
  },
  {
    id: 'anh-tuan-vtv',
    label: 'Anh Tuấn (Miền Bắc)',
    gender: 'Nam',
    baseVoice: 'Fenrir',
    tags: ['Bắc', 'Hào hứng'],
    description: `STRICT NORTHERN VIETNAMESE. Energetic, fast-paced, exciting, and professional. Host/MC style.`
  }
];

export const ICONS = {
  Waves,
  Download,
  Play,
  Settings,
  Type,
  Sparkles,
  Loader2,
  FileUp,
  Megaphone,
  Newspaper,
  LayoutDashboard
};
