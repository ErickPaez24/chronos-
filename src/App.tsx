import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/AuthProvider';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Kiosco from './pages/Kiosco';

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
          <Route path="/kiosco" element={<Kiosco />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
