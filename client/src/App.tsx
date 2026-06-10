import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="/auth" element={<div className="flex items-center justify-center min-h-screen text-2xl font-bold">Naval War — Auth</div>} />
        <Route path="/lobby" element={<div className="flex items-center justify-center min-h-screen text-2xl font-bold">Lobby</div>} />
        <Route path="/game/:roomId" element={<div className="flex items-center justify-center min-h-screen text-2xl font-bold">Game</div>} />
        <Route path="/ranking" element={<div className="flex items-center justify-center min-h-screen text-2xl font-bold">Ranking</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
