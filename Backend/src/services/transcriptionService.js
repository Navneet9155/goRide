/**
 * transcriptionService.js
 *
 * Speech-to-Text transcription service using Free Groq Cloud Whisper API
 * (with fallback to OpenAI Whisper).
 *
 * Groq Cloud provides free access to whisper-large-v3-turbo with
 * ~200ms ultra-low latency and state-of-the-art Hindi / Hinglish / English accuracy.
 * Free signup: https://console.groq.com
 * Active model: whisper-large-v3-turbo
 */

const env = require("../config/env");

/** Clean carrier phrases from raw speech */
function extractCleanDestination(rawText) {
  if (!rawText || typeof rawText !== "string") return "";

  let text = rawText
    .replace(/[।,.!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Strip payment & vehicle terms
  text = text.replace(/(?:by|se|me|में|से)?\s*(?:online|upi|cash|कार्ड|card|पेमेंट|payment)\s*(?:se|payment|mode)?/gi, " ");
  text = text.replace(/(?:by|se|से)?\s*(?:car|कार|bike|बाइक|auto|ऑटो|suv|एसयूवी|cab|cabs)\s*(?:chahiye|ride|booking|चाहिए)?/gi, " ");
  text = text.replace(/\b(?:by|se|me|in)\b/gi, " ");
  text = text.replace(/(?:chahiye|चाहिए)/gi, " ");

  // Strip English & Hindi prefixes
  text = text.replace(/^(?:please\s+)?(?:take\s+(?:me\s+)?to|drop\s+(?:me\s+)?(?:at|to)|go\s+to|drive\s+to|book\s+a\s+ride\s+to|i\s+want\s+to\s+go\s+to|head\s+to)\s+/i, " ");
  text = text.replace(/^(?:mujhe|hume|humko|bhaiya|bhai|driver\s+ji|yaar|boss|sir|मुझे|हमें|कृपया|भाई|भैया)\s+/i, " ");

  // Strip Hindi & Devanagari suffixes
  text = text.replace(/(?:jaana\s+hai|jana\s+hai|le\s+chalo|le\s+ja|chalna\s+hai|pahuncha\s+do|drop\s+kardo|जाना\s+है|ले\s+चलो|चलना\s+है|पहुँचा\s+दो|पहुंचा\s+दो)/gi, " ");

  text = text.replace(/\s+/g, " ").trim();
  return text.length >= 2 ? text : rawText.trim();
}

/**
 * Transcribe audio buffer into text.
 * Priority: Groq Whisper (free, fastest) -> OpenAI Whisper -> Mock/Helper
 */
async function transcribeAudio(audioBuffer, mimeType = "audio/m4a", language = "hi") {
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error("Empty audio buffer provided");
  }

  // 1. Try Groq Cloud Whisper (Free 7,200 req/day, ~200ms latency)
  if (env.GROQ_API_KEY) {
    try {
      const blob = new Blob([audioBuffer], { type: mimeType });
      const formData = new FormData();
      formData.append("file", blob, "recording.m4a");
      formData.append("model", "whisper-large-v3-turbo");
      if (language) {
        formData.append("language", language === "en" ? "en" : "hi");
      }

      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const transcript = (data.text || "").trim();
        if (transcript) {
          return {
            transcript,
            cleanQuery: extractCleanDestination(transcript),
            provider: "groq-whisper",
          };
        }
      } else {
        const errText = await res.text();
        console.warn("[transcriptionService] Groq API returned error:", res.status, errText);
      }
    } catch (err) {
      console.warn("[transcriptionService] Groq transcription error:", err.message);
    }
  }

  // 2. Try OpenAI Whisper (if user configured OpenAI)
  if (env.OPENAI_API_KEY) {
    try {
      const blob = new Blob([audioBuffer], { type: mimeType });
      const formData = new FormData();
      formData.append("file", blob, "recording.m4a");
      formData.append("model", "whisper-1");
      if (language) {
        formData.append("language", language === "en" ? "en" : "hi");
      }

      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const transcript = (data.text || "").trim();
        if (transcript) {
          return {
            transcript,
            cleanQuery: extractCleanDestination(transcript),
            provider: "openai-whisper",
          };
        }
      }
    } catch (err) {
      console.warn("[transcriptionService] OpenAI transcription error:", err.message);
    }
  }

  // 3. Fallback when keys are not configured yet
  return {
    transcript: "",
    cleanQuery: "",
    provider: "none",
    message: "GROQ_API_KEY is required for voice transcription. Add free key from https://console.groq.com in Backend/.env",
  };
}

module.exports = {
  transcribeAudio,
  extractCleanDestination,
};
