import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';

export default function CameraScreen() {
  const navigate = useNavigate();
  const setImage = useGameStore((state) => state.setImage);

  const handleCapture = () => {
    setImage('data:image/png;base64,...');
    navigate('/recognition');
  };

  return (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <h1>Space Arena</h1>
      <div style={{ background: '#333', width: '100%', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        [Видоискатель камеры]
      </div>
      <button onClick={handleCapture} style={{ marginTop: 20, padding: '10px 30px', fontSize: 18 }}>
        Сделать фото
      </button>
    </div>
  );
}