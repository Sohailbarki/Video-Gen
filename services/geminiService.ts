
import { GoogleGenAI, Type } from "@google/genai";
import { ViralScript } from "../types";
import { blobToBase64, base64ToBlob, createWavBlobFromPcm } from "../utils/mediaHelpers";

const getClient = (apiKey?: string) => new GoogleGenAI({ apiKey: apiKey || process.env.API_KEY || '' });

export const validateGeminiKey = async (apiKey: string): Promise<{ valid: boolean; error?: string }> => {
  if (!apiKey) return { valid: false, error: "API Key is empty" };
  try {
    const ai = new GoogleGenAI({ apiKey });
    await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: 'ping' }] }], config: { maxOutputTokens: 1 } });
    return { valid: true };
  } catch (e: any) { return { valid: false, error: e.message || "Invalid API Key" }; }
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    hook: { type: Type.STRING, description: "The hook text." },
    beats: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          timestamp: { type: Type.STRING },
          visual: { type: Type.STRING, description: "Detailed cinematographic description of the scene." },
          audio: { type: Type.STRING }
        }
      }
    },
    script: { type: Type.STRING },
    onScreenText: { type: Type.STRING },
    hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
    cta: { type: Type.STRING },
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    captionFile: { type: Type.STRING }
  },
  required: ["hook", "beats", "script", "onScreenText", "hashtags", "cta", "title", "description"]
};

export const generateViralDraft = async (
  topic: string, 
  tone: string, 
  duration: string,
  platform: string,
  targetAudience: string,
  apiKey?: string
): Promise<ViralScript> => {
  try {
    const ai = getClient(apiKey);
    
    // ENHANCED "DIRECTOR MODE" PROMPT
    const prompt = `
      Act as a world-class viral video director. Create a highly detailed shooting script.
      
      Request:
      - Topic: ${topic}
      - Tone: ${tone}
      - Platform: ${platform} (Vertical 9:16)
      - Audience: ${targetAudience}
      - Duration: ${duration}
      
      CRITICAL INSTRUCTIONS:
      1. **Visual Specificity**: The 'visual' field for each beat MUST be a detailed cinematographic description. Include Camera Angle (e.g., Low angle, Drone shot), Lighting (e.g., Neon, Golden Hour), and Action.
         - BAD: "Intro scene"
         - GOOD: "Low angle wide shot of a cyberpunk street at night, neon rain reflecting on pavement, fast forward dolly zoom."
      2. **Pacing**: The script must be timed perfectly for ${duration}.
      3. **Hook**: The first scene (0:00-0:03) must be visually arresting to stop the scroll.
      
      Output strictly JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        systemInstruction: "You are a high-end video producer. You write detailed shooting scripts with specific visual direction.",
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText) as ViralScript;

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    // High-Quality Fallback
    return {
      title: "Viral Concept: " + topic,
      hook: "Stop doing this mistake immediately!",
      beats: [
        { timestamp: "0:00", visual: "Extreme close-up of a smashing glass object in slow motion, high contrast lighting.", audio: "Stop! You are destroying your progress." },
        { timestamp: "0:03", visual: "Fast-paced montage of successful workflow, bright natural lighting, smooth camera transitions.", audio: "Here is the secret method top 1% use." },
        { timestamp: "0:08", visual: "Medium shot of a confident person smiling at camera, golden hour lighting, bokeh background.", audio: "It's simpler than you think." }
      ],
      script: `Stop! You are destroying your progress. Here is the secret method top 1% use. It's simpler than you think. This changes everything about ${topic}.`,
      onScreenText: "The 1% Secret Method",
      hashtags: ["#viral", "#hack", "#fyp"],
      cta: "Link in bio",
      description: `The ultimate guide to ${topic}.`,
      captionFile: "1\n00:00:00,000 --> 00:00:05,000\nStop! You are destroying your progress."
    };
  }
};

export const analyzeVideoSource = async (url: string, instructions: string, platform: string, apiKey?: string): Promise<ViralScript> => {
  try {
    const ai = getClient(apiKey);
    const prompt = `Analyze: ${url}. Goal: ${instructions}. Platform: ${platform}. Output JSON compatible with schema.`;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }], config: { tools: [{ googleSearch: {} }] } });
    const cleanText = response.text?.match(/```json\s*([\s\S]*?)\s*```/)?.[1] || response.text || '{}';
    return JSON.parse(cleanText) as ViralScript;
  } catch (error) { console.error(error); throw error; }
};

export const generateViralImage = async (prompt: string, referenceImageBlob?: Blob | null, apiKey?: string): Promise<Blob> => {
  try {
    const ai = getClient(apiKey);
    const parts: any[] = [{ text: prompt }];
    if (referenceImageBlob) {
      parts.push({ inlineData: { mimeType: referenceImageBlob.type || 'image/png', data: await blobToBase64(referenceImageBlob) } });
    }
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview', 
      contents: [{ parts: parts }], 
      config: { tools: [{ googleSearch: {} }] } 
    });

    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error("No content returned from Gemini.");

    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
       throw new Error(`Image generation blocked. Reason: ${candidate.finishReason}`);
    }

    const imgPart = candidate.content?.parts?.find(p => p.inlineData);
    if (!imgPart?.inlineData?.data) {
       const textPart = candidate.content?.parts?.find(p => p.text);
       if (textPart) throw new Error(`Model returned text instead of image: ${textPart.text}`);
       throw new Error("No image data returned in response.");
    }
    
    return base64ToBlob(imgPart.inlineData.data, imgPart.inlineData.mimeType || 'image/png');
  } catch (error) {
    console.error("Image Generation Error:", error);
    throw error;
  }
};

export const generateViralVideo = async (prompt: string, imageBlob?: Blob | null, apiKey?: string): Promise<Blob> => {
  const ai = getClient(apiKey);
  let operation;
  try {
    if (imageBlob) {
      operation = await ai.models.generateVideos({ model: 'veo-3.1-fast-generate-preview', prompt, image: { imageBytes: await blobToBase64(imageBlob), mimeType: imageBlob.type }, config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '9:16' } });
    } else {
      operation = await ai.models.generateVideos({ model: 'veo-3.1-fast-generate-preview', prompt, config: { numberOfVideos: 1, aspectRatio: '9:16', resolution: '720p' } });
    }
  } catch (e: any) {
    let msg = e.message;
    if (msg.includes('{')) { try { 
        const json = JSON.parse(msg.substring(msg.indexOf('{')));
        if (json.error?.code === 429) throw new Error("Quota exceeded (429). Check billing.");
        msg = json.error.message;
    } catch {} }
    throw new Error(`Veo Init Failed: ${msg}`);
  }

  if (!operation || !operation.name) throw new Error("No operation returned from Veo");

  while (!operation.done) {
    await new Promise(r => setTimeout(r, 10000));
    operation = await ai.operations.getVideosOperation({ operation });
  }
  if (operation.error) throw new Error(`Video generation failed: ${operation.error.message}`);
  
  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri || (operation.result as any)?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) throw new Error("No video URI returned");
  
  const res = await fetch(`${videoUri}&key=${apiKey}`);
  if (!res.ok) throw new Error("Failed to download video");
  return await res.blob();
};

export const generateViralVoiceover = async (text: string, voiceName: string = 'Kore', apiKey?: string): Promise<Blob> => {
  const ai = getClient(apiKey);
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } }
  });
  const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!data) throw new Error("No audio data returned");
  const binaryString = atob(data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return createWavBlobFromPcm(bytes, 24000);
};
