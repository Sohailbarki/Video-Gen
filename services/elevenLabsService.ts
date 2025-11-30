
export const generateElevenLabsTTS = async (
  text: string,
  apiKey: string,
  voiceId: string = '21m00Tcm4TlvDq8ikWAM' // Default voice (Rachel)
): Promise<Blob> => {
  if (!apiKey) throw new Error("ElevenLabs API Key is missing.");

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`ElevenLabs TTS Error: ${errorData.detail?.message || response.statusText}`);
    }

    return await response.blob();
  } catch (error: any) {
    console.error("ElevenLabs TTS Error:", error);
    throw new Error(error.message || "ElevenLabs TTS Failed");
  }
};
