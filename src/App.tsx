import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/AuthProvider';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Kiosco from './pages/Kiosco';
import LectorAutomatico from './pages/LectorAutomatico';

function App() {
  useEffect(() => {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, []);

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          {/* Kiosco = solo huella (lector USB 2Connect), sin teclado ni pantalla. */}
          <Route path="/kiosco" element={<LectorAutomatico />} />
          {/* Kiosco anterior (usuario + huella/PIN), para quien no tiene huella registrada. */}
          <Route path="/kiosco-usuario" element={<Kiosco />} />
          <Route path="/lector" element={<LectorAutomatico />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
