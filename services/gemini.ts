import { GoogleGenAI, Modality, Type } from "@google/genai";
import { ReadingMode, VoiceEmotion, AdvancedVoiceSettings } from "../types";
import { VIETNAMESE_ABBREVIATIONS } from "../constants";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Xử lý lỗi Gemini API chi tiết để phản hồi người dùng rõ ràng.
 * Sửa lỗi "substring is not a function" bằng cách ép kiểu chuỗi an toàn.
 */
export const handleAiError = (error: any): { message: string, isRateLimit: boolean, shouldWait: boolean } => {
  // Đảm bảo message luôn là string nguyên thủy
  const rawMessage = error?.message ? String(error.message) : String(error);
  const lowerMessage = rawMessage.toLowerCase();
  
  const isRateLimit = lowerMessage.includes("429") || lowerMessage.includes("resource exhausted") || lowerMessage.includes("quota");
  const isServerBusy = lowerMessage.includes("500") || lowerMessage.includes("503");
  const isInvalidKey = lowerMessage.includes("400") || lowerMessage.includes("401") || lowerMessage.includes("403") || lowerMessage.includes("api key") || lowerMessage.includes("invalid argument") || lowerMessage.includes("not found");
  const isSafetyBlock = lowerMessage.includes("safety") || lowerMessage.includes("blocked");

  if (isRateLimit) {
    return { 
      message: "❌ HẾT HẠN MỨC (QUOTA EXHAUSTED): Tài khoản Google AI đã đạt giới hạn yêu cầu. Vui lòng thử lại sau 1-2 phút hoặc nâng cấp API Key.", 
      isRateLimit: true, 
      shouldWait: false 
    };
  }

  if (isServerBusy) {
    return { 
      message: "⚠️ MÁY CHỦ AI ĐANG QUÁ TẢI: Google AI đang xử lý quá nhiều yêu cầu. Hệ thống sẽ thử lại sau vài giây...", 
      isRateLimit: false, 
      shouldWait: true 
    };
  }

  if (isInvalidKey) {
    return { 
      message: "🚫 LỖI API KEY: Mã truy cập AI không hợp lệ, đã bị thu hồi hoặc chưa được cấu hình đúng. Vui lòng kiểm tra lại cấu hình hệ thống.", 
      isRateLimit: false, 
      shouldWait: false 
    };
  }

  if (isSafetyBlock) {
     return { 
       message: "🛡️ NỘI DUNG BỊ CHẶN: Văn bản vi phạm chính sách an toàn của Google AI (Bạo lực, thù ghét, hoặc nội dung nhạy cảm). Hãy chỉnh sửa lại văn bản.", 
       isRateLimit: false, 
       shouldWait: false 
     };
  }
  
  return { 
    message: `❗ LỖI KỸ THUẬT: ${rawMessage.substring(0, 150) || "Kết nối tới AI thất bại"}. Vui lòng kiểm tra đường truyền mạng.`, 
    isRateLimit: false, 
    shouldWait: false 
  };
};

/**
 * Hàm chuẩn hóa văn bản thông minh trước khi đọc.
 * 1. Thay thế các từ viết tắt (UBND, HĐND...) thành câu đầy đủ.
 * 2. Thay thế các ký tự đặc biệt như "-" thành dấu phẩy để AI ngắt nghỉ đúng nhịp.
 */
const normalizeTextForSpeech = (text: string): string => {
  let processed = text;

  // 1. Thay thế dấu gạch ngang giữa các cụm từ (VD: Đảng uỷ- HĐND) thành dấu phẩy để tạo nhịp nghỉ
  // Regex này tìm dấu gạch ngang có khoảng trắng xung quanh hoặc không, không phải là số âm
  processed = processed.replace(/(\s+-\s+|(?<!\d)-(?!\d))/g, ", ");

  // 2. Thay thế các từ viết tắt dựa trên từ điển
  // Sử dụng Regex với biên từ (\b) để đảm bảo không thay thế nhầm (ví dụ không thay thế chữ trong từ khác)
  Object.entries(VIETNAMESE_ABBREVIATIONS).forEach(([abbr, fullText]) => {
    // Flag 'g' để thay thế tất cả, 'i' để không phân biệt hoa thường (tùy chọn, ở đây ta ưu tiên khớp chính xác hoặc linh hoạt)
    // Với các từ viết tắt hành chính, thường là viết hoa, nhưng user có thể viết thường.
    // Ta dùng 'i' (insensitive) để hỗ trợ tốt nhất.
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
    processed = processed.replace(regex, fullText);
  });

  // 3. Xử lý khoảng trắng thừa
  processed = processed.replace(/\s+/g, ' ').trim();

  return processed;
};

/**
 * Cắt âm thanh mẫu chỉ lấy 20 giây đầu tiên để phân tích.
 */
const trimAudioTo20Seconds = async (audioArrayBuffer: ArrayBuffer): Promise<{ base64: string, duration: number }> => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(audioArrayBuffer.slice(0));
    
    const durationToKeep = Math.min(audioBuffer.duration, 20);
    const sampleRate = audioBuffer.sampleRate;
    const framesToKeep = Math.floor(durationToKeep * sampleRate);
    
    const newBuffer = audioContext.createBuffer(audioBuffer.numberOfChannels, framesToKeep, sampleRate);
    
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      newBuffer.getChannelData(i).set(audioBuffer.getChannelData(i).slice(0, framesToKeep));
    }

    const wavBlob = pcmToWav(audioBufferToWav(newBuffer), sampleRate);
    const reader = new FileReader();
    
    return new Promise((resolve) => {
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({ base64, duration: durationToKeep });
      };
      reader.readAsDataURL(wavBlob);
    });
  } catch (e) {
    const blob = new Blob([audioArrayBuffer], { type: 'audio/wav' });
    const reader = new FileReader();
    return new Promise((resolve) => {
        reader.onloadend = () => resolve({ base64: (reader.result as string).split(',')[1], duration: 0 });
        reader.readAsDataURL(blob);
    });
  }
};

export function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length * numChannels * 2;
  const result = new ArrayBuffer(length);
  const view = new DataView(result);
  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
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

export const mixAudio = async (speechBuffer: ArrayBuffer, musicBuffer: ArrayBuffer, musicVolume: number): Promise<ArrayBuffer> => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // Decode both buffers
  // Note: decodeAudioData detaches the buffer, so we slice it to keep the original safe if needed elsewhere
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

export const generateContentFromDescription = async (
  prompt: string, 
  modePrompt: string, 
  onLog?: (m: string, t: 'info' | 'error') => void,
  apiKey: string = process.env.API_KEY || ""
) => {
  onLog?.("Gemini đang soạn thảo nội dung...", "info");
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `${modePrompt}\n\nYêu cầu: ${prompt}`,
    });
    return response.text || '';
  } catch (error: any) {
    const errorInfo = handleAiError(error);
    onLog?.(errorInfo.message, 'error');
    throw new Error(errorInfo.message);
  }
};

export const generateMarketingContent = async (
  imageBase64: string | null,
  description: string,
  onLog?: (m: string, t: 'info' | 'error') => void,
  apiKey: string = process.env.API_KEY || ""
): Promise<{title: string, content: string}> => {
  onLog?.("Gemini đang phân tích và viết quảng cáo...", "info");
  try {
    const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [];
    
    if (imageBase64) {
      parts.push({ inlineData: { data: imageBase64, mimeType: 'image/jpeg' } });
    }
    
    parts.push({ 
      text: `Bạn là chuyên gia Marketing. Hãy viết nội dung quảng cáo ngắn gọn, giật gân, thu hút cho sản phẩm/dịch vụ này.
      ${description ? `Mô tả thêm: ${description}` : ''}
      
      Yêu cầu trả về JSON với định dạng:
      {
        "title": "Tiêu đề ngắn (dưới 10 từ), viết hoa, gây sốc hoặc tò mò",
        "content": "Nội dung chính (dưới 50 từ), kêu gọi hành động mạnh mẽ, dùng icon emoji."
      }` 
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING }
          },
          required: ["title", "content"]
        }
      }
    });

    return JSON.parse(response.text || '{"title": "Quảng cáo", "content": "Nội dung đang cập nhật..."}');
  } catch (error: any) {
    const errorInfo = handleAiError(error);
    onLog?.(errorInfo.message, 'error');
    throw new Error(errorInfo.message);
  }
};

export const analyzeVoice = async (
  rawAudioBuffer: ArrayBuffer, 
  onLog?: (m: string, t: 'info' | 'error') => void,
  apiKey: string = process.env.API_KEY || ""
): Promise<any> => {
  onLog?.("Đang chuẩn bị 20 giây âm thanh mẫu để phân tích...", "info");
  const { base64 } = await trimAudioTo20Seconds(rawAudioBuffer);

  onLog?.("Đang tạo độ trễ an toàn (3s)...", "info");
  await delay(3000);
  
  onLog?.("Đang phân tích đặc điểm giọng nói...", "info");

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
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            gender: { type: Type.STRING, enum: ["Nam", "Nữ"] },
            region: { type: Type.STRING, enum: ["Bắc", "Trung", "Nam", "Khác"] },
            toneSummary: { type: Type.STRING },
            suggestedName: { type: Type.STRING },
            description: { type: Type.STRING }
          },
          required: ["gender", "region", "toneSummary", "suggestedName", "description"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    const errorInfo = handleAiError(error);
    onLog?.(errorInfo.message, 'error');
    throw new Error(errorInfo.message);
  }
};

export const generateAudioSegment = async (
  text: string, 
  config: any,
  onLog?: (m: string, t: 'info' | 'error') => void,
  apiKey: string = process.env.API_KEY || ""
): Promise<ArrayBuffer> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName } },
        },
      },
    });

    const base64 = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    if (!base64) throw new Error("Google AI không phản hồi âm thanh.");
    
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes.buffer;
  } catch (error: any) {
    const errorInfo = handleAiError(error);
    onLog?.(errorInfo.message, 'error');
    throw new Error(errorInfo.message);
  }
};

export const generateAudioParallel = async (
  text: string,
  config: any,
  onProgress: (percent: number) => void,
  onLog?: (m: string, t: 'info' | 'error') => void,
  apiKey: string = process.env.API_KEY || ""
): Promise<ArrayBuffer> => {
  // 1. Chuẩn hóa văn bản: Bung các từ viết tắt & xử lý dấu câu
  const normalizedText = normalizeTextForSpeech(text);
  
  if (text !== normalizedText) {
    onLog?.("Đã tự động mở rộng các từ viết tắt để đọc rõ ràng hơn.", "info");
  }

  // 2. Chia đoạn văn bản đã chuẩn hóa
  const rawChunks = normalizedText.match(/[^.!?\n]+[.!?\n]*|[^.!?\n]+/g) || [normalizedText];
  const combinedChunks: string[] = [];
  let current = "";
  const SAFE_CHAR_LIMIT = 1200; 

  for (const c of rawChunks) {
    if ((current + c).length < SAFE_CHAR_LIMIT) {
      current += c;
    } else {
      if (current) combinedChunks.push(current.trim());
      current = c;
    }
  }
  if (current) combinedChunks.push(current.trim());

  const total = combinedChunks.length;
  onLog?.(`Khởi tạo chuyển đổi (${total} phân đoạn)...`, 'info');
  const results: ArrayBuffer[] = [];
  
  for (let i = 0; i < total; i++) {
    if (i > 0) {
        onLog?.(`Chờ 3s để xử lý đoạn tiếp theo (${i + 1}/${total})...`, 'info');
        // Tăng độ trễ lên 3000ms để an toàn hơn cho các tài khoản free
        await delay(3000);
    }
    
    const segment = await generateAudioSegment(combinedChunks[i], config, onLog, apiKey);
    results.push(segment);
    onProgress(Math.round(((i + 1) / total) * 100));
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
  if (!lamejs || !lamejs.Mp3Encoder) return pcmToWav(pcmBuffer, sampleRate);
  const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, 128); 
  const samples = new Int16Array(pcmBuffer);
  const mp3Data = [];
  for (let i = 0; i < samples.length; i += 1152) {
    const chunk = samples.subarray(i, i + 1152);
    const mp3buf = mp3encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) mp3Data.push(mp3buf);
  }
  const final = mp3encoder.flush();
  if (final.length > 0) mp3Data.push(final);
  return new Blob(mp3Data, { type: 'audio/mp3' });
};