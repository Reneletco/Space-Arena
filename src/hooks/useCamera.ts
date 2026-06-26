import { useRef, useState, useCallback } from 'react';

const ACCESS_CAMERA_ERROR = 'Не удалось получить доступ к камере. Проверьте разрешение';

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  error: string | null;
  capturedPhoto: string | null;
  isCameraReady: boolean;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  capture: () => string | null;
  clearPhoto: () => void;
}

export const useCamera = (): UseCameraReturn => {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const [error,         setError]         = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraReady(true);
      }
    } catch (err) {
      setError(ACCESS_CAMERA_ERROR);
      console.error('Camera error:', err);
      setIsCameraReady(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
      setIsCameraReady(false);
    }
  }, []);

  const capture = useCallback((): string | null => {
    if (!videoRef.current) return null;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedPhoto(dataUrl);
    return dataUrl;
  }, []);

  const clearPhoto = useCallback(() => setCapturedPhoto(null), []);

  // Камера НЕ запускается автоматически — только через startCamera()
  return { videoRef, error, capturedPhoto, isCameraReady, startCamera, stopCamera, capture, clearPhoto };
};
