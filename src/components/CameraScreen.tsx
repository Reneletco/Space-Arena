import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useCamera } from '../hooks/useCamera';
import { CameraView } from './camera/CameraView';
import "./CameraScreen.css";

export default function CameraScreen() {
  const navigate = useNavigate();
  const setImage = useGameStore((state) => state.setImage);

  const {
    videoRef,
    canvasRef,
    error,
    isCameraReady,
    capture,
  } = useCamera();

  const handleCapture = () => {
    const photo = capture();
    if (photo) {
      setImage(photo);
      navigate('/recognition');
    }
  };


  return (
    <div className="app-container">
      <h1 className="app-title">Space Arena</h1>
      
      <div className="camera-area">
        <div className="camera-placeholder">
          <CameraView
            videoRef={videoRef}
            canvasRef={canvasRef}
            error={error}
            isCameraReady={isCameraReady}
          />
        </div>

        <button 
          className="capture-btn" 
          onClick={handleCapture}
          disabled={!isCameraReady}
        >
          Сделать фото
        </button>
      </div>
    </div>
  );
}