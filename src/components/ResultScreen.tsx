import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { TrophyIcon, HandshakeIcon, RestartIcon } from './icons';

const COLOR_HEX: Record<string, string> = {
  red: '#ff4444', blue: '#3399ff', green: '#33dd55', yellow: '#ffdd00',
};
const COLOR_RU: Record<string, string> = {
  red: 'Красный', blue: 'Синий', green: 'Зелёный', yellow: 'Жёлтый',
};

export default function ResultScreen() {
  const navigate = useNavigate();
  const { winner, reset } = useGameStore();

  const handleNew = () => { reset(); navigate('/'); };

  return (
    <div style={s.root}>
      <h2 style={s.title}>Результат боя</h2>
      {winner ? (
        <>
          <div style={{ ...s.badge, background: COLOR_HEX[winner] + '22', border: `3px solid ${COLOR_HEX[winner]}` }}>
            <TrophyIcon size={52} className="icon-pop" />
            <p style={{ color: COLOR_HEX[winner], fontSize: 26, fontWeight: 800, margin: '8px 0 0' }}>
              {COLOR_RU[winner]}
            </p>
            <p style={{ color: '#aaa', fontSize: 15, margin: '4px 0 0' }}>победил!</p>
          </div>
        </>
      ) : (
        <div style={{ ...s.badge, border: '3px solid #556' }}>
          <HandshakeIcon size={52} className="icon-pop" />
          <p style={{ color: '#ccc', fontSize: 22, fontWeight: 700, margin: '8px 0 0' }}>Ничья</p>
        </div>
      )}
      <button style={{ ...s.btn, display: 'inline-flex', alignItems: 'center', gap: 10 }} onClick={handleNew}>
        <RestartIcon /> Новый раунд
      </button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: 24, minHeight: '100dvh', background: '#0d0d1a', color: '#fff', boxSizing: 'border-box',
  },
  title: { fontSize: 22, margin: '0 0 24px', letterSpacing: 1 },
  badge: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '28px 40px', borderRadius: 18, marginBottom: 28,
  },
  btn: {
    padding: '14px 36px', fontSize: 18, fontWeight: 700, borderRadius: 10,
    border: 'none', cursor: 'pointer', color: '#fff',
    background: 'linear-gradient(135deg,#6644ff,#aa44ff)',
  },
};
