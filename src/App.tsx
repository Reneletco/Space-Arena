import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CameraScreen from './components/CameraScreen';
import RecognitionScreen from './components/RecognitionScreen';
import ArenaScreen from './components/ArenaScreen';
import ResultScreen from './components/ResultScreen';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CameraScreen />} />
        <Route path="/recognition" element={<RecognitionScreen />} />
        <Route path="/arena" element={<ArenaScreen />} />
        <Route path="/result" element={<ResultScreen />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;