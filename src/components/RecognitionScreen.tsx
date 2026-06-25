import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';

export default function RecognitionScreen() {
  const navigate = useNavigate();
  const rawImage = useGameStore((state) => state.rawImage);
  const setShips = useGameStore((state) => state.setShips);

  const handleBattle = () => {
    setShips([]);
    navigate('/arena');
  };

  const handleRetake = () => {
    navigate('/');
  };

  return (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <h2>Распознавание</h2>
      {rawImage && <img src={rawImage} alt="Фото стола" style={{ maxWidth: '100%', maxHeight: 300 }} />}
      <div style={{ marginTop: 20 }}>
        <button onClick={handleBattle} style={{ marginRight: 10, padding: '10px 20px' }}>В бой!</button>
        <button onClick={handleRetake} style={{ padding: '10px 20px' }}>Переснять</button>
      </div>
    </div>
  );
}