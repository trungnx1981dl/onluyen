import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Practice from './pages/Practice';
import Host from './pages/Host';
import HostBoard from './pages/HostBoard';
import Player from './pages/Player';
import CustomCursor from './components/CustomCursor';

export default function App() {
  return (
    <BrowserRouter>
      <CustomCursor />
      <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-teal-200 selection:text-teal-900 overflow-x-hidden font-sans">
        <div className="fixed inset-0 z-[-1] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-50 via-slate-50 to-emerald-50"></div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin/*" element={<Admin />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/host" element={<Host />} />
          <Route path="/host/board/:quizId" element={<HostBoard />} />
          <Route path="/player" element={<Player />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
