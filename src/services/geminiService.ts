import { GoogleGenAI, Type, Modality } from "@google/genai";
import { type WordCategory, type CEFRLevel } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface WordData {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  definition: string;
  example: string;
  category: WordCategory;
  level: CEFRLevel;
  audioData?: string;
}

export async function generateWord(category: WordCategory, level: CEFRLevel = 'B1'): Promise<WordData> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a high-quality English vocabulary word for category "${category}" at CEFR level "${level}". 
    Return JSON with: word, phonetic, partOfSpeech, definition, example.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          phonetic: { type: Type.STRING },
          partOfSpeech: { type: Type.STRING },
          definition: { type: Type.STRING },
          example: { type: Type.STRING }
        },
        required: ["word", "phonetic", "partOfSpeech", "definition", "example"]
      }
    }
  });

  const wordData = JSON.parse(response.text);
  wordData.category = category;
  wordData.level = level;

  // Start TTS in background, don't block the main word data return if it takes too long
  // We'll wait a maximum of 1.5s for TTS, otherwise return without it
  const ttsPromise = ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: wordData.word }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
    }
  }).then(res => res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data).catch(() => undefined);

  // Use a timeout to ensure we don't wait too long for audio
  const timeoutPromise = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 1500));
  
  wordData.audioData = await Promise.race([ttsPromise, timeoutPromise]);

  return wordData;
}

export async function fetchWordDetails(word: string): Promise<WordData> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Provide high-quality English vocabulary details for the word "${word}". 
    Return JSON with: word, phonetic, partOfSpeech, definition, example.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          phonetic: { type: Type.STRING },
          partOfSpeech: { type: Type.STRING },
          definition: { type: Type.STRING },
          example: { type: Type.STRING }
        },
        required: ["word", "phonetic", "partOfSpeech", "definition", "example"]
      }
    }
  });

  const wordData = JSON.parse(response.text);
  
  try {
    const ttsResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: wordData.word }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
      }
    });
    wordData.audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (e) {}

  return wordData;
}

export interface NpcDialogue {
  npcName: string;
  type: 'fill' | 'order' | 'choice';
  text: string;
  options: string[];
  answer: string;
  reward: { coins: number, xp: number };
}

export async function generateNpcDialogue(word: string): Promise<NpcDialogue> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Create a template-based English learning dialogue for an NPC. 
    The target word is "${word}". 
    Choose one type: 
    1. 'fill': "I need some ____ to bake bread." (options: [flour, flower], answer: "flour")
    2. 'order': "Please / bring / me / apples." (options: ["Please", "bring", "me", "apples"], answer: "Please bring me apples")
    3. 'choice': "What do you plant in spring?" (options: [seeds, snow, fire], answer: "seeds")
    
    Return JSON with: npcName (Merchant, Neighbor, or QuestGiver), type, text, options (array), answer, reward (coins and xp).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          npcName: { type: Type.STRING },
          type: { type: Type.STRING },
          text: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          answer: { type: Type.STRING },
          reward: {
            type: Type.OBJECT,
            properties: {
              coins: { type: Type.NUMBER },
              xp: { type: Type.NUMBER }
            },
            required: ["coins", "xp"]
          }
        },
        required: ["npcName", "type", "text", "options", "answer", "reward"]
      }
    }
  });

  return JSON.parse(response.text);
}

export interface GrowthChallenge {
  question: string;
  options: string[];
  answer: string;
}

export async function generateGrowthChallenge(word: string, stage: number): Promise<GrowthChallenge> {
  const types = ['meaning', 'spelling', 'fill'];
  const type = types[stage % 3];
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Create a ${type} challenge for the word "${word}". 
    Return JSON with: question, options (4 strings), answer (the correct option).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          answer: { type: Type.STRING }
        },
        required: ["question", "options", "answer"]
      }
    }
  });

  return JSON.parse(response.text);
}
