import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Fingerprint, Lock, AlertCircle, Info, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { handleFirebaseError, OperationType } from '../lib/firebase-error';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !pin) {
      setError('Por favor, ingresa tu usuario y PIN.');
      return;
    }
    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      setError('El PIN debe ser exactamente de 6 dígitos numéricos.');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const email = `${username.trim().toLowerCase()}@chronosabc.com`;
      await signInWithEmailAndPassword(auth, email, pin);
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Usuario o PIN incorrectos.');
      } else {
        setError(err.message || 'Error al iniciar sesión.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 selection:bg-indigo-100 selection:text-indigo-900">
      <div className="w-full max-w-[1000px] grid md:grid-cols-2 bg-white rounded-3xl shadow-xl shadow-neutral-200/50 overflow-hidden border border-neutral-100">
        
        {/* Left Side: Branding & Info */}
        <div className="bg-indigo-600 p-10 flex flex-col justify-between relative overflow-hidden text-white">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-700 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
          
          <div className="relative z-10">
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">Chronos ABC</h1>
            <p className="text-indigo-200 font-medium tracking-wide text-sm uppercase">Control de Asistencia</p>
          </div>

          <div className="relative z-10 mt-12 mb-8">
            <h2 className="text-4xl font-semibold leading-tight mb-4">Gestiona los<br/>ponches al instante.</h2>
            <p className="text-indigo-100 text-lg">
              Sistema de entradas y salidas sincronizado perfectamente para PC y Android.
            </p>
          </div>

          <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl text-sm leading-relaxed">
            <h3 className="font-semibold text-white mb-2 flex items-center"><Fingerprint className="w-4 h-4 mr-2" /> Seguridad de Nivel Bancario</h3>
            <p className="text-indigo-100">
              Las huellas se validan mediante <strong className="text-white">WebAuthn / Passkeys</strong>. Nunca extraemos la "imagen" de tu huella; utilizamos el enclave seguro de tu propio dispositivo para validar tu identidad de forma inviolable, cumpliendo las leyes de privacidad.
            </p>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="p-10 md:p-14 flex flex-col justify-center">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-neutral-900">Iniciar Sesión</h2>
            <p className="text-neutral-500 mt-2">Accede con tu cuenta o biometría</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Usuario</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors outline-none text-neutral-900" 
                  placeholder="Ej. m.gonzalez"
                />
                <User className="w-5 h-5 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">PIN de Acceso</label>
              <div className="relative">
                <input 
                  type="password" 
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors outline-none text-neutral-900 font-mono tracking-widest text-lg" 
                  placeholder="••••••"
                />
                <Lock className="w-5 h-5 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center text-red-600 bg-red-50 p-3 rounded-lg text-sm"
                >
                  <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
                  <p>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              type="submit"
              className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-medium py-3.5 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-neutral-900/10"
            >
              Entrar
            </button>
          </form>

          <div className="mt-8 flex items-center justify-center space-x-4">
            <div className="h-px bg-neutral-200 flex-1"></div>
            <span className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Punto de Marcaje</span>
            <div className="h-px bg-neutral-200 flex-1"></div>
          </div>

          <div className="mt-6 flex flex-col items-center">
            <button
              onClick={() => navigate('/kiosco')}
              className="w-full bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200 text-indigo-700 font-semibold mb-2 py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center shadow-sm"
            >
              <Fingerprint className="w-5 h-5 mr-2" />
              Abrir Kiosco de Asistencia
            </button>
            <p className="text-xs text-neutral-500 mt-2 text-center max-w-xs">
              Módulo exclusivo para que los empleados registren sus entradas y salidas usando PIN o huella.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
