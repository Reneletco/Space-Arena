import { useRef, useState, useEffect, useCallback } from 'react';

const ACCESS_CAMERA_ERROR: string = "Не удалось получить доступ к камере. Проверьте разрешение"

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  error: string | null;
  capturedPhoto: string | null;
  isCameraReady: boolean;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  capture: () => string | null;
  clearPhoto: () => void;
}

export const useCamera = (): UseCameraReturn => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraReady(true);
      }
    } catch (err) {
      setError(ACCESS_CAMERA_ERROR);
      console.error("Camera error:", err);
      setIsCameraReady(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraReady(false);
    }
  }, []);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const photoDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedPhoto(photoDataUrl);

    return photoDataUrl
  }, []);

  const clearPhoto = useCallback(() => {
    setCapturedPhoto(null);
  }, []);

  useEffect(() => {
    startCamera();

    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  return {
    videoRef,
    canvasRef,
    error,
    capturedPhoto,
    isCameraReady,
    startCamera,
    stopCamera,
    capture,
    clearPhoto,
  };
};