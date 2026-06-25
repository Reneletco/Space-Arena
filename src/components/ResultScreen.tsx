import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';

export default function ResultScreen() {
  const navigate = useNavigate();
  const reset = useGameStore((state) => state.reset);

  const handleNewRound = () => {
    reset();
    navigate('/');
  };

  return (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <h2>🏆 Победитель</h2>
      <p style={{ fontSize: 24 }}>Игрок Красный</p>
      <button onClick={handleNewRound} style={{ marginTop: 20, padding: '10px 30px' }}>
        Новый раунд
      </button>
    </div>
  );
}