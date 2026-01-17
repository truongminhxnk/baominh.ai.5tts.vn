
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { ReadingMode, VoiceEmotion, AdvancedVoiceSettings } from "../types";
import { VIETNAMESE_ABBREVIATIONS } from "../constants";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Kiểm tra xem một API Key có hợp lệ và còn hoạt động không.
 */
export const validateApiKey = async (key: string): Promise<boolean> => {
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    // Thử một yêu cầu tạo nội dung cực ngắn để kiểm tra key
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'hi',
    });
    return !!response.text;
  } catch (e) {
    return false;
  }
};

/**
 * Xử lý lỗi Gemini API chi tiết để phản hồi người dùng rõ ràng.
 */
export const handleAiError = (error: any): { message: string, isRateLimit: boolean, shouldWait: boolean } => {
  const rawMessage = error?.message ? String(error.message) : String(error);
  const lowerMessage = rawMessage.toLowerCase();
  
  const isRateLimit = lowerMessage.includes("429") || lowerMessage.includes("resource exhausted") || lowerMessage.includes("quota");
  const isServerBusy = lowerMessage.includes("500") || lowerMessage.includes("503");
  const isInvalidKey = lowerMessage.includes("400") || lowerMessage.includes("401") || lowerMessage.includes("403") || lowerMessage.includes("api key");

  if (isRateLimit) {
    return { 
      message: "❌ HẾT HẠN MỨC (QUOTA EXHAUSTED): Tài khoản đã đạt giới hạn yêu cầu. Hệ thống sẽ tự động thử lại sau vài giây.", 
      isRateLimit: true, 
      shouldWait: true 
    };
  }

  if (isServerBusy) {
    return { 
      message: "⚠️ MÁY CHỦ QUÁ TẢI: Google AI đang bận. Đang thử lại...", 
      isRateLimit: false, 
      shouldWait: true 
    };
  }

  return { 
    message: `❗ LỖI: ${rawMessage.substring(0, 150)}`, 
    isRateLimit: false, 
    shouldWait: false 
  };
};

/**
 * Chuẩn hóa văn bản: Bung từ viết tắt và xử lý dấu câu để tạo nhịp nghỉ.
 */
const normalizeTextForSpeech = (text: string): string => {
  let processed = text;
  processed = processed.replace(/(\s+-\s+|(?<!\d)-(?!\d))/g, ", ");
  Object.entries(VIETNAMESE_ABBREVIATIONS).forEach(([abbr, fullText]) => {
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
    processed = processed.replace(regex, fullText);
  });
  return processed.replace(/\s+/g, ' ').trim();
};

/**
 * Cắt file âm thanh mẫu chỉ lấy tối đa 20 giây đầu tiên để phân tích giọng nói.
 */
export const trimAudioTo20Seconds = async (audioArrayBuffer: ArrayBuffer): Promise<{ base64: string, duration: number }> => {
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
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({ base64, duration: durationToKeep });
      };
      reader.readAsDataURL(wavBlob);
    });
  } catch (e) {
    console.error("Lỗi cắt âm thanh:", e);
    throw new Error("Không thể xử lý định dạng âm thanh này.");
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

/**
 * Mix TTS audio with background music.
 */
export const mixWithBackgroundAudio = async (
  ttsPcm: ArrayBuffer,
  bgAudioBuffer: ArrayBuffer,
  bgVolume: number = 0.3,
  sampleRate: number = 24000
): Promise<ArrayBuffer> => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
  
  // Decode both audios
  const ttsWavArrayBuffer = await pcmToWav(ttsPcm, sampleRate).arrayBuffer();
  const ttsBuffer = await audioContext.decodeAudioData(ttsWavArrayBuffer);
  const bgBuffer = await audioContext.decodeAudioData(bgAudioBuffer.slice(0));
  
  const frameCount = ttsBuffer.length;
  const mixedBuffer = audioContext.createBuffer(1, frameCount, sampleRate);
  
  const ttsData = ttsBuffer.getChannelData(0);
  const mixedData = mixedBuffer.getChannelData(0);
  
  // Background music data (handle stereo to mono if needed)
  const bgData = bgBuffer.getChannelData(0); 
  const bgLength = bgBuffer.length;

  for (let i = 0; i < frameCount; i++) {
    // Get background sample (looping)
    const bgSample = bgData[i % bgLength];
    // Mix: Voice (100%) + Background (Volume adjusted)
    // Simple additive mixing with clipping protection
    let mixed = ttsData[i] + (bgSample * bgVolume);
    mixedData[i] = Math.max(-1, Math.min(1, mixed));
  }

  return audioBufferToWav(mixedBuffer);
};

export const generateContentFromDescription = async (
  prompt: string, 
  modePrompt: string, 
  onLog?: (m: string, t: 'info' | 'error') => void,
  apiKey: string = process.env.API_KEY || ""
) => {
  onLog?.("Đang soạn thảo nội dung (Độ trễ an toàn 2s)...", "info");
  await delay(2000); 
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

/**
 * Phân tích âm thanh mẫu với độ trễ 3s để tránh lỗi Quota.
 */
export const analyzeVoice = async (
  base64Audio: string, 
  onLog?: (m: string, t: 'info' | 'error' | 'success') => void,
  apiKey: string = process.env.API_KEY || ""
): Promise<any> => {
  onLog?.("Bắt đầu phân tích giọng nói (Độ trễ an toàn 3s)...", "info");
  await delay(3000); 

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: {
        parts: [
          { inlineData: { data: base64Audio, mimeType: 'audio/wav' } },
          { text: `Hãy phân tích âm thanh này và trả về JSON: 
            gender (Nam/Nữ), 
            region (Bắc/Trung/Nam/Khác), 
            toneSummary (tóm tắt tông giọng trong 5 từ), 
            suggestedName (tên tiếng Việt phù hợp), 
            description (mô tả chi tiết 2 dòng).` }
        ]
      },
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            gender: { type: Type.STRING },
            region: { type: Type.STRING },
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
  if (!base64) throw new Error("AI không phản hồi dữ liệu âm thanh.");
  
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes.buffer;
};

export const generateAudioParallel = async (
  text: string,
  config: any,
  onProgress: (percent: number) => void,
  onLog?: (m: string, t: 'info' | 'error') => void,
  apiKey: string = process.env.API_KEY || ""
): Promise<ArrayBuffer> => {
  const normalizedText = normalizeTextForSpeech(text);
  
  const rawChunks = normalizedText.match(/[^.!?\n]+[.!?\n]*|[^.!?\n]+/g) || [normalizedText];
  const combinedChunks: string[] = [];
  let current = "";
  const LIMIT = 1200; 

  for (const c of rawChunks) {
    if ((current + c).length < LIMIT) current += c;
    else {
      if (current) combinedChunks.push(current.trim());
      current = c;
    }
  }
  if (current) combinedChunks.push(current.trim());

  const total = combinedChunks.length;
  onLog?.(`Đã chia nhỏ văn bản thành ${total} đoạn để xử lý an toàn...`, 'info');
  const results: ArrayBuffer[] = [];
  
  for (let i = 0; i < total; i++) {
    if (i > 0) {
        onLog?.(`Đang tạo độ trễ 3 giây giữa các đoạn (${i + 1}/${total})...`, 'info');
        await delay(3000); 
    }
    
    let success = false;
    let retryCount = 0;
    while (!success && retryCount < 3) {
      try {
        const segment = await generateAudioSegment(combinedChunks[i], config, onLog, apiKey);
        results.push(segment);
        success = true;
      } catch (e: any) {
        retryCount++;
        onLog?.(`Lỗi đoạn ${i+1}, đang thử lại lần ${retryCount}/3 sau 5 giây...`, 'error');
        await delay(5000);
      }
    }
    
    if (!success) throw new Error(`Không thể xử lý đoạn văn bản thứ ${i+1}.`);
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
  
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
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
