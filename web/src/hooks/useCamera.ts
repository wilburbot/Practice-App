import { useCallback, useRef, useState } from "react";

function pickMimeType(): string | undefined {
  const candidates = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type));
}

export function useCamera() {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);

  const startPreview = useCallback(async (videoEl: HTMLVideoElement) => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });
      streamRef.current = stream;
      videoEl.srcObject = stream;
      await videoEl.play();
      setIsPreviewing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not access the camera");
    }
  }, []);

  const stopPreview = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsPreviewing(false);
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(1000);
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setIsRecording(true);
  }, []);

  /** Seconds elapsed since recording started, or null if not currently recording. */
  const elapsedSeconds = useCallback((): number | null => {
    if (!startedAtRef.current) return null;
    return (Date.now() - startedAtRef.current) / 1000;
  }, []);

  const stopRecording = useCallback((): Promise<{ blob: Blob; durationSec: number } | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder) return resolve(null);
      const durationSec = elapsedSeconds() ?? 0;
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];
        startedAtRef.current = null;
        setIsRecording(false);
        resolve({ blob, durationSec });
      };
      recorder.stop();
    });
  }, [elapsedSeconds]);

  return {
    isPreviewing,
    isRecording,
    error,
    startPreview,
    stopPreview,
    startRecording,
    stopRecording,
    elapsedSeconds,
  };
}
