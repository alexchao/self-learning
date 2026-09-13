import { useCallback, useEffect, useRef, useState } from "react";

/** Browser speech synthesis + recognition (no API keys). Language defaults to Taiwanese Mandarin. */

export function speakText(text: string, language = "zh-TW"): void {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  utterance.rate = 0.95;
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice =
    voices.find((voice) => voice.lang === language && /premium|enhanced/i.test(voice.name)) ??
    voices.find((voice) => voice.lang === language) ??
    voices.find((voice) => voice.lang.startsWith(language.split("-")[0] ?? language));
  if (preferredVoice) utterance.voice = preferredVoice;
  window.speechSynthesis.speak(utterance);
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

interface MinimalSpeechRecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface MinimalSpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<MinimalSpeechRecognitionResult>;
}
interface MinimalSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: MinimalSpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionConstructor = new () => MinimalSpeechRecognition;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const speechWindow = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function useSpeechDictation(language: string, onFinalTranscript: (transcript: string) => void) {
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  onFinalTranscriptRef.current = onFinalTranscript;
  const isSupported = typeof window !== "undefined" && getSpeechRecognitionConstructor() !== null;

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const RecognitionConstructor = getSpeechRecognitionConstructor();
    if (!RecognitionConstructor) return;
    const recognition = new RecognitionConstructor();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result) continue;
        if (result.isFinal) onFinalTranscriptRef.current(result[0].transcript);
        else interim += result[0].transcript;
      }
      setInterimTranscript(interim);
    };
    recognition.onerror = (event) => setErrorMessage(event.error === "not-allowed" ? "Microphone permission denied" : `Speech error: ${event.error}`);
    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
    };
    recognitionRef.current = recognition;
    setErrorMessage(null);
    recognition.start();
    setIsListening(true);
  }, [language]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  return { isSupported, isListening, interimTranscript, errorMessage, startListening, stopListening };
}
