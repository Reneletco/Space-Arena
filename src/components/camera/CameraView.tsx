import './CameraView.css';

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  error: string | null;
  isCameraReady: boolean;
}

export const CameraView: React.FC<CameraViewProps> = ({ 
  videoRef,
  canvasRef,
  error,
  isCameraReady,
 }) => {

  if (error) {
    return (
      <div className="camera-error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="camera-screen">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="camera-video"
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {!isCameraReady && (
        <div className="loading-overlay">
          <p>Загрузка камеры...</p>
        </div>
      )}
    </div>
  );
};