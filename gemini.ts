import { GoogleGenAI, Modality, Type } from "@google/genai";
import { ReadingMode, VoiceEmotion, AdvancedVoiceSettings } from "../types";
import { VIETNAMESE_ABBREVIATIONS } from "../constants";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Kiểm tra API Key có thực sự hoạt động hay không bằng một request tối giản
 */
export const testApiKey = async (apiKey: string): Promise<{ valid: boolean, message: string }> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    // Thử gọi một lệnh generateContent siêu ngắn để check key
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Ping",
      config: { maxOutputTokens: 1 }
    });
    if (response) return { valid: true, message: "API Key hoạt động tốt." };
    return { valid: false, message: "Không nhận được phản hồi từ AI." };
  } catch (error: any) {
    const info = handleAiError(error);
    return { valid: false, message: info.message };
  }
};

/**
 * Xử lý lỗi Gemini API chi tiết
 * Hỗ trợ đầy đủ: rate limit (429), quota exhausted, overload (503), và các lỗi khác
 */
export const handleAiError = (error: any): { message: string, isRateLimit: boolean, shouldWait: boolean, isOverload: boolean } => {
  const rawMessage = error?.message ? String(error.message) : String(error);
  const lowerMessage = rawMessage.toLowerCase();
  
  // Kiểm tra rate limit và quota exhausted
  const isRateLimit = lowerMessage.includes("429") || 
                      lowerMessage.includes("resource exhausted") || 
                      lowerMessage.includes("quota") ||
                      lowerMessage.includes("quota exhausted") ||
                      lowerMessage.includes("rate limit") ||
                      lowerMessage.includes("too many requests");
  
  // Kiểm tra overload và server errors
  const isOverload = lowerMessage.includes("503") ||
                     lowerMessage.includes("service unavailable") ||
                     lowerMessage.includes("overload") ||
                     lowerMessage.includes("over capacity") ||
                     lowerMessage.includes("model is overloaded") ||
                     lowerMessage.includes("server overload") ||
                     lowerMessage.includes("engine over capacity");
  
  // Kiểm tra invalid key
  const isInvalidKey = lowerMessage.includes("400") || 
                       lowerMessage.includes("401") || 
                       lowerMessage.includes("403") || 
                       lowerMessage.includes("api key") || 
                       lowerMessage.includes("invalid argument") || 
                       lowerMessage.includes("not found") ||
                       lowerMessage.includes("unauthenticated");
  
  // Kiểm tra safety block
  const isSafetyBlock = lowerMessage.includes("safety") || 
                        lowerMessage.includes("blocked");

  // Rate limit và quota exhausted - cần retry với delay
  if (isRateLimit) {
    return { 
      message: "❌ Hết hạn mức (429/Quota exhausted).", 
      isRateLimit: true, 
      shouldWait: true,
      isOverload: false
    };
  }
  
  // Overload - cần retry với delay lớn hơn
  if (isOverload) {
    return { 
      message: "⚠️ Server quá tải (503/Overload).", 
      isRateLimit: true, // Xử lý như rate limit để có retry
      shouldWait: true,
      isOverload: true
    };
  }
  
  // Invalid key - không retry
  if (isInvalidKey) {
    return { 
      message: "🚫 Key không hợp lệ hoặc đã bị vô hiệu hóa.", 
      isRateLimit: false, 
      shouldWait: false,
      isOverload: false
    };
  }
  
  // Safety block - không retry
  if (isSafetyBlock) {
    return { 
      message: "🛡️ Nội dung bị chặn do chính sách an toàn.", 
      isRateLimit: false, 
      shouldWait: false,
      isOverload: false
    };
  }
  
  // Lỗi khác
  return { 
    message: `❗ Lỗi: ${rawMessage.substring(0, 100)}`, 
    isRateLimit: false, 
    shouldWait: false,
    isOverload: false
  };
};

/**
 * BỘ 1: CHUẨN HÓA CƠ BẢN BẰNG QUY TẮC
 * - Xử lý ký hiệu, đơn vị, ngày tháng, từ viết tắt phổ biến
 * - Không thay đổi nội dung, chỉ làm cho dễ đọc to hơn
 */
export const normalizeTextForSpeech = (text: string): string => {
  if (!text) return "";

  // 1. Chuẩn hóa Unicode (NFC) để xử lý lỗi font và dấu tiếng Việt
  let processed = text.normalize("NFC");
  processed = processed.replace(/[\u200B-\u200D\uFEFF]/g, " ");

  // 2. Xử lý ký hiệu toán học và so sánh (Tránh đọc sai ký hiệu)
  processed = processed.replace(/(\d+)\s*%\b/g, "$1 phần trăm");
  processed = processed.replace(/\b\+\b/g, " cộng ");
  processed = processed.replace(/\s=\s/g, " bằng ");
  processed = processed.replace(/\s>\s/g, " lớn hơn ");
  processed = processed.replace(/\s<\s/g, " nhỏ hơn ");
  processed = processed.replace(/\b(\d+)\s*\*\s*(\d+)\b/g, "$1 nhân $2");
  
  // 3. Xử lý ngày tháng chuyên sâu
  // dd/mm/yyyy -> ngày dd tháng mm năm yyyy
  processed = processed.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, "ngày $1 tháng $2 năm $3");
  // dd/mm -> ngày dd tháng mm
  processed = processed.replace(/\b(\d{1,2})\/(\d{1,2})\b/g, "ngày $1 tháng $2");

  // 4. Xử lý đơn vị tiền tệ và đo lường (Chỉ khi đứng sau số)
  const units: Record<string, string> = {
    "kg": "ki lô gam", "km": "ki lô mét", "cm": "xăng ti mét", "mm": "mi li mét",
    "m2": "mét vuông", "m3": "mét khối", "ml": "mi li lít", "l": "lít", "g": "gam",
    "đ": "đồng", "vnd": "việt nam đồng", "usd": "đô la mỹ", "tr": "triệu", "tỷ": "tỷ"
  };
  
  for (const [unit, reading] of Object.entries(units)) {
      const regex = new RegExp(`(\\d)\\s*${unit}\\b`, 'gi');
      processed = processed.replace(regex, `$1 ${reading}`);
  }

  // 4.1. Xử lý riêng một số cụm viết tắt hành chính hay gặp nhưng có khoảng trắng bên trong
  // Ví dụ: "UB MTTQ Việt Nam" -> "UBMTTQ Việt Nam" để từ điển mở rộng đúng
  processed = processed.replace(/\bUB\s+MTTQ\b/gi, "UBMTTQ");

  // 4.2. Sửa các lỗi chính tả phổ biến trong văn bản hành chính
  // "uỷ" -> "ủy" (dấu hỏi thay vì dấu ngã)
  processed = processed.replace(/\buỷ\b/gi, "ủy");
  processed = processed.replace(/\bĐảng\s+uỷ\b/gi, "Đảng ủy");
  processed = processed.replace(/\bđảng\s+uỷ\b/gi, "đảng ủy");
  // "Hội đồng nhân và" -> "Hội đồng nhân dân" (sửa lỗi thiếu chữ)
  processed = processed.replace(/\bhội đồng nhân và\b/gi, "Hội đồng nhân dân");
  processed = processed.replace(/\bHội đồng nhân và\b/g, "Hội đồng nhân dân");

  // 5. Mở rộng từ viết tắt (Theo danh sách chuẩn từ constants)
  const sortedAbbrs = Object.keys(VIETNAMESE_ABBREVIATIONS).sort((a, b) => b.length - a.length);
  for (const abbr of sortedAbbrs) {
      const fullText = VIETNAMESE_ABBREVIATIONS[abbr];
      const escapedAbbr = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Nếu có dấu chấm ở cuối (TP.), match nguyên văn, nếu không dùng word boundary.
      // Dùng 'gi' để không phân biệt hoa/thường, giúp đọc đúng trong mọi kiểu văn bản.
      const regex = abbr.endsWith('.') ? new RegExp(escapedAbbr, 'gi') : new RegExp(`\\b${escapedAbbr}\\b`, 'gi');
      processed = processed.replace(regex, fullText + " ");
  }

  // 6. Chuẩn hóa dấu câu để AI ngắt nghỉ đúng (Dấu câu dính liền)
  processed = processed.replace(/([,.!:;?])(?=[^\s\d])/g, '$1 '); // "chào,bạn" -> "chào, bạn"
  processed = processed.replace(/\s+([,.!:;?])/g, '$1'); // "chào , bạn" -> "chào, bạn"
  
  // 7. Xử lý gạch đầu dòng và phân đoạn (Tránh đọc là "trừ")
  processed = processed.replace(/(^|\n)\s*-\s+/g, "$1, "); 

  // 8. Dọn dẹp khoảng trắng thừa
  return processed.replace(/\s+/g, ' ').trim();
};

/**
 * BỘ 2: HIỆU ĐÍNH THÔNG MINH BẰNG AI
 * Dùng Gemini để:
 *  - Mở rộng các từ viết tắt hiếm gặp
 *  - Sửa lỗi chính tả, dấu câu
 *  - Giữ nguyên nội dung, không tóm tắt, không thêm ý mới
 * Phù hợp cho văn bản hành chính, văn bản dài và phong phú.
 */
export const refineTextForReading = async (rawText: string, apiKey: string = "", onLog?: (m: string, t: 'info' | 'error') => void): Promise<string> => {
  const text = rawText || "";
  if (!text.trim()) return "";

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
Bạn là chuyên gia ngôn ngữ tiếng Việt chuyên nghiệp, đọc bản tin thời sự trên truyền hình VTV.

NHIỆM VỤ QUAN TRỌNG:
1. SỬA LỖI CHÍNH TẢ: Đảm bảo mọi từ đều đúng chính tả tiếng Việt chuẩn. Ví dụ:
   - "uỷ" -> "ủy" (dấu hỏi, không phải dấu ngã)
   - "Hội đồng nhân và" -> "Hội đồng nhân dân" (sửa lỗi thiếu chữ)
   - Kiểm tra và sửa mọi lỗi chính tả khác trong văn bản

2. MỞ RỘNG TỪ VIẾT TẮT: Mở rộng TẤT CẢ các từ viết tắt, kể cả:
   - HĐND -> Hội đồng nhân dân
   - UBND -> Ủy ban nhân dân
   - UBMTTQ, UB MTTQ -> Ủy ban Mặt trận Tổ quốc
   - BCH -> Ban chấp hành
   - Và mọi từ viết tắt khác

3. CHUẨN HÓA DẤU CÂU: Thêm dấu chấm, phẩy đúng chỗ để dễ đọc, ngắt nghỉ tự nhiên.

4. GIỮ NGUYÊN NỘI DUNG: 
   - KHÔNG được tóm tắt
   - KHÔNG được lược bỏ ý
   - KHÔNG thêm bình luận hay ý kiến cá nhân
   - Giữ nguyên tên người, tên địa danh, số liệu

5. PHONG CÁCH: Viết lại theo phong cách đọc bản tin thời sự: rõ ràng, mạch lạc, văn phong hành chính/trang trọng, GIỌNG ĐỀU, không lên xuống cảm xúc quá mức.

Văn bản gốc cần hiệu đính:
"""${text}"""

Hãy trả về CHỈ văn bản đã được sửa chính tả, mở rộng viết tắt, và chuẩn hóa dấu câu. KHÔNG kèm giải thích hay bình luận.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });

    const refined = (response as any)?.text || text;
    if (onLog) onLog("AI đã hiệu đính văn bản để đọc to chính xác hơn.", "info");
    return refined.trim();
  } catch (error: any) {
    const info = handleAiError(error);
    if (onLog) onLog(`Không thể hiệu đính bằng AI, dùng nguyên văn bản gốc. (${info.message})`, "warning" as any);
    // Nếu AI lỗi, fallback: chỉ dùng normalizeTextForSpeech thông thường
    return text;
  }
};

export const generateContentFromDescription = async (prompt: string, modePrompt: string, onLog?: any, apiKey: string = "") => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `${modePrompt}\n\n${prompt}\n\nYêu cầu: Viết tiếng Việt chuẩn, tuyệt đối không viết tắt, không dùng tiếng lóng.`,
    });
    return response.text || '';
  } catch (error: any) { throw new Error(handleAiError(error).message); }
};

export const generateAudioSegment = async (text: string, config: any, onLog?: any, apiKey: string = ""): Promise<ArrayBuffer> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    // Đảm bảo voiceName luôn được truyền đúng và nhất quán
    const voiceName = config?.voiceName || 'Kore'; // Fallback nếu không có
    
    // Log để debug nếu cần
    if (onLog && text.length > 100) {
      onLog(`Tạo audio với giọng: ${voiceName}, độ dài: ${text.length} ký tự`, "info");
    }
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { 
          voiceConfig: { 
            prebuiltVoiceConfig: { 
              voiceName: voiceName // Đảm bảo dùng cùng voiceName cho mọi đoạn
            } 
          } 
        },
      },
    });
    const base64 = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
    if (!base64) throw new Error("TTS Failure");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  } catch (error: any) { throw new Error(handleAiError(error).message); }
};

export const generateAudioParallel = async (text: string, config: any, onProgress: any, onLog?: any, apiKey: string = ""): Promise<ArrayBuffer> => {
  const raw = text || "";

  // NGUYÊN TẮC TIẾT KIỆM QUOTA VÀ ĐẢM BẢO CHÍNH TẢ:
  // - Văn bản >= 500 ký tự: luôn gọi AI hiệu đính để sửa chính tả, mở rộng viết tắt
  // - Văn bản < 500 ký tự: vẫn gọi AI nếu có từ viết tắt hành chính (HĐND, UBND, UBMTTQ...)
  // - Điều này đảm bảo mọi văn bản hành chính đều được sửa chính tả đúng
  const LONG_TEXT_THRESHOLD = 500;
  const hasAdministrativeAbbr = /\b(HĐND|UBND|UB\s*MTTQ|BCH|Đảng\s*uỷ|đảng\s*uỷ)\b/gi.test(raw);
  let preprocessedText = raw;

  if (raw.length >= LONG_TEXT_THRESHOLD || hasAdministrativeAbbr) {
    if (onLog) onLog("Đang nhờ AI hiệu đính để sửa chính tả và mở rộng viết tắt...", "info");
    preprocessedText = await refineTextForReading(raw, apiKey, onLog);
  }

  // BƯỚC 2: Chuẩn hóa kỹ thuật (ký hiệu, đơn vị, khoảng trắng...) để đọc TTS mượt.
  const normalizedText = normalizeTextForSpeech(preprocessedText);

  // TỐI ƯU GIỮ TÔNG GIỌNG THỐNG NHẤT:
  // Ưu tiên đọc liền một đoạn để tránh đổi tông giọng (nam/nữ) giữa các đoạn.
  // Ngưỡng cao hơn (4000 ký tự) vì văn bản sau khi AI mở rộng viết tắt sẽ dài hơn nhiều.
  // Chỉ chia đoạn khi thật sự cần thiết (văn bản siêu dài > 4000 ký tự).
  const SINGLE_SEGMENT_THRESHOLD = 4000; // ký tự - tăng cao để ưu tiên đọc liền một đoạn
  if (normalizedText.length <= SINGLE_SEGMENT_THRESHOLD) {
    if (onLog) onLog(`Đọc liền một đoạn (${normalizedText.length} ký tự) để giữ tông giọng thống nhất.`, "info");
    const buffer = await generateAudioSegment(normalizedText, config, onLog, apiKey);
    onProgress(100);
    return buffer;
  }
  
  // Chỉ chia đoạn khi văn bản thật sự rất dài (> 4000 ký tự)
  if (onLog) onLog(`Văn bản rất dài (${normalizedText.length} ký tự), chia thành nhiều đoạn nhưng vẫn giữ cùng giọng đọc.`, "info");
  
  const rawChunks = normalizedText.match(/[^.!?\n]+[.!?\n]*|[^.!?\n]+/g) || [normalizedText];
  const combinedChunks: string[] = [];
  let current = "";
  const LIMIT = 600; 

  for (const c of rawChunks) {
    if ((current + c).length < LIMIT) current += c;
    else { if (current) combinedChunks.push(current.trim()); current = c; }
  }
  if (current) combinedChunks.push(current.trim());

  const results: ArrayBuffer[] = [];
  // Độ trễ động giữa các đoạn để tránh quá tải / hết quota
  // Văn bản càng dài -> delay càng lớn một chút.
  const baseDelayMs = normalizedText.length > 3000 ? 2200 : normalizedText.length > 1500 ? 1600 : 1200;

  for (let i = 0; i < combinedChunks.length; i++) {
    if (i > 0) await delay(baseDelayMs); // Tránh spam rate limit / quota
    const segment = await generateAudioSegment(combinedChunks[i], config, onLog, apiKey);
    results.push(segment);
    onProgress(Math.round(((i + 1) / combinedChunks.length) * 100));
  }

  const totalLength = results.reduce((acc, b) => acc + b.byteLength, 0);
  const finalBuffer = new Uint8Array(totalLength);
  let offset = 0;
  for (const res of results) {
    finalBuffer.set(new Uint8Array(res), offset);
    offset += res.byteLength;
  }
  return finalBuffer.buffer;
};

export const pcmToWav = (pcmBuffer: ArrayBuffer, sampleRate: number = 24000): Blob => {
  const length = pcmBuffer.byteLength;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);
  view.setUint32(0, 0x52494646, false); 
  view.setUint32(4, 36 + length, true); 
  view.setUint32(8, 0x57415645, false);
  view.setUint32(12, 0x666d7420, false); 
  view.setUint32(16, 16, true); 
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); 
  view.setUint32(24, sampleRate, true); 
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); 
  view.setUint16(34, 16, true); 
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, length, true); 
  new Uint8Array(buffer, 44).set(new Uint8Array(pcmBuffer));
  return new Blob([buffer], { type: 'audio/wav' });
};

export const pcmToMp3 = (pcmBuffer: ArrayBuffer, sampleRate: number = 24000): Blob => {
  const lamejs = (window as any).lamejs;
  if (!lamejs?.Mp3Encoder) return pcmToWav(pcmBuffer, sampleRate);
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
  const samples = new Int16Array(pcmBuffer);
  const mp3Data = [];
  for (let i = 0; i < samples.length; i += 1152) {
    const chunk = samples.subarray(i, i + 1152);
    const mp3buf = encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) mp3Data.push(mp3buf);
  }
  const final = encoder.flush();
  if (final.length > 0) mp3Data.push(final);
  return new Blob(mp3Data, { type: 'audio/mp3' });
};

export const analyzeVoice = async (rawAudioBuffer: ArrayBuffer, onLog?: (m: string, t: 'info' | 'error') => void, apiKey: string = ""): Promise<any> => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(rawAudioBuffer.slice(0));
  const durationToKeep = Math.min(audioBuffer.duration, 20);
  const framesToKeep = Math.floor(durationToKeep * audioBuffer.sampleRate);
  const newBuffer = audioContext.createBuffer(audioBuffer.numberOfChannels, framesToKeep, audioBuffer.sampleRate);
  for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
    newBuffer.getChannelData(i).set(audioBuffer.getChannelData(i).slice(0, framesToKeep));
  }
  const wavBlob = pcmToWav(audioBufferToWav(newBuffer), audioBuffer.sampleRate);
  const reader = new FileReader();
  const base64 = await new Promise<string>((resolve) => {
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(wavBlob);
  });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType: 'audio/wav' } },
          { text: `Analyze this audio. Return JSON: gender ("Nam"/"Nữ"), region ("Bắc"/"Trung"/"Nam"), toneSummary (5 words), suggestedName (Vietnamese), description.` }
        ]
      },
      config: { responseMimeType: "application/json" }
    });
    
    let jsonText = response.text || "{}";
    jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    return JSON.parse(jsonText);
  } catch (e: any) {
    throw new Error(handleAiError(e).message);
  }
};

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length * numChannels * 2;
  const result = new ArrayBuffer(length);
  const view = new DataView(result);
  const channels = [];
  for (let i = 0; i < numChannels; i++) channels.push(buffer.getChannelData(i));
  let offset = 0;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][i];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  return result;
}

export const generateMarketingContent = async (imageBase64: string | null, description: string, onLog?: any, apiKey: string = "") => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [];
    if (imageBase64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
    parts.push({ text: `Đóng vai chuyên gia marketing. Dựa trên: "${description}", tạo tiêu đề (dưới 10 từ) và nội dung quảng cáo (30 từ) hấp dẫn. Trả về JSON {title, content}.` });
    const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: { parts }, config: { responseMimeType: "application/json" } });
    
    let jsonText = response.text || "{}";
    jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    return JSON.parse(jsonText);
  } catch (e: any) { throw new Error(handleAiError(e).message); }
};

export const generateAdImage = async (prompt: string, onLog?: any, apiKey: string = "") => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ text: `High-quality advertising background: ${prompt}. No text.` }],
      config: { imageConfig: { aspectRatio: "1:1" } }
    });
    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!part) throw new Error("AI không trả về ảnh.");
    return `data:image/png;base64,${part.inlineData.data}`;
  } catch (e: any) {
    const errorInfo = handleAiError(e);
    // Thêm thông tin chi tiết hơn cho rate limit và overload errors
    if (errorInfo.isRateLimit && !errorInfo.isOverload) {
      throw new Error(`${errorInfo.message} Key có thể đã hết quota cho model tạo ảnh.`);
    }
    if (errorInfo.isOverload) {
      throw new Error(`${errorInfo.message} Server đang quá tải, vui lòng thử lại sau.`);
    }
    throw new Error(errorInfo.message);
  }
};

export const mixAudio = async (speechBuffer: ArrayBuffer, musicBuffer: ArrayBuffer, musicVolume: number): Promise<ArrayBuffer> => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // Decode both buffers
  const speech = await ctx.decodeAudioData(speechBuffer.slice(0));
  const music = await ctx.decodeAudioData(musicBuffer.slice(0));

  // Create OfflineAudioContext with the duration of the speech
  const offlineCtx = new OfflineAudioContext(1, speech.length, speech.sampleRate);

  // 1. Setup Speech Source
  const speechSource = offlineCtx.createBufferSource();
  speechSource.buffer = speech;
  speechSource.connect(offlineCtx.destination);
  speechSource.start(0);

  // 2. Setup Music Source (Looping to fit speech duration)
  const musicSource = offlineCtx.createBufferSource();
  musicSource.buffer = music;
  musicSource.loop = true; // Loop background music
  
  // 3. Apply Volume to Music
  const gainNode = offlineCtx.createGain();
  gainNode.gain.value = musicVolume; // 0.0 to 1.0
  
  musicSource.connect(gainNode);
  gainNode.connect(offlineCtx.destination);
  musicSource.start(0);

  // 4. Render
  const renderedBuffer = await offlineCtx.startRendering();
  
  // 5. Convert back to WAV ArrayBuffer
  return audioBufferToWav(renderedBuffer);
};
