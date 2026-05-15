import React, { useState, useEffect } from 'react';
import { Fingerprint, UserCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthProvider';
import { db, secondaryAuth } from '../lib/firebase';
import { collection, query, addDoc, serverTimestamp, getDocs, where, orderBy, onSnapshot } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';

declare global {
  interface Window {
    AndroidAuth?: {
      authenticate(userId: string): void;
    };
    onBiometricResult?: (userId: string, success: boolean, errorMessage: string) => void;
  }
}

export default function Kiosco() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [step, setStep] = useState<'id' | 'biometric' | 'pin'>('id');
  const [employee, setEmployee] = useState<any>(null);
  
  const [fails, setFails] = useState(0);
  const [pin, setPin] = useState('');
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  
  const [ponchesHoy, setPonchesHoy] = useState<any[]>([]);

  useEffect(() => {
    // Kiosco no requiere login de administrador para ser usado en dispositivos dedicados.
    // Cualquiera puede acceder a la URL y ponchar con sus credenciales o huella.
  }, []);

  useEffect(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const pq = query(
      collection(db, 'ponches'), 
      where('timestamp', '>=', today),
      orderBy('timestamp', 'desc')
    );
    const unsubP = onSnapshot(pq, (snap) => {
      setPonchesHoy(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubP();
  }, []);

  const reset = () => {
    setStep('id');
    setUsername('');
    setPin('');
    setEmployee(null);
    setFails(0);
    setStatus('idle');
    setMessage('');
  };

  const registerPunch = async (uid: string, name: string) => {
    const lastPunch = ponchesHoy.find(p => p.userId === uid);
    let tipo = 'ENTRADA';
    if (lastPunch && lastPunch.type === 'ENTRADA') {
      tipo = 'SALIDA';
    } else if (lastPunch && lastPunch.type === 'ALMUERZO_IN') {
      tipo = 'ALMUERZO_OUT';
    }

    await addDoc(collection(db, 'ponches'), {
      userId: uid,
      type: tipo,
      timestamp: serverTimestamp()
    });
    
    setStatus('success');
    setMessage(`¡${tipo} registrada para ${name}!`);
    
    setTimeout(() => {
      reset();
    }, 4000);
  };

  const handleIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;
    setStatus('loading');
    
    try {
      const q = query(collection(db, 'users'), where('username', '==', username.toLowerCase().trim()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        throw new Error("Empleado no encontrado.");
      }
      
      const emp = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
      if (!emp.isActive) {
        throw new Error("Empleado inactivo.");
      }
      
      setEmployee(emp);
      setFails(0);
      setStatus('idle');
      
      if (emp.hasBiometric) {
         setStep('biometric');
         setTimeout(() => triggerBiometric(emp), 300);
      } else {
         setStep('pin');
      }
      
    } catch (err: any) {
       setStatus('error');
       setMessage(err.message);
       setTimeout(() => {
           setStatus('idle');
           setMessage('');
       }, 3000);
    }
  };

  const triggerBiometric = async (emp: any) => {
    setStatus('loading');
    setMessage('Esperando huella...');

    // --- USB FINGERPRINT READER (2Connect SDK) ---
    if (emp.usbFingerprint) {
      try {
        const ws = new WebSocket("ws://localhost:21187/fps");
        let timeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            setMessage("No se pudo conectar al lector USB. ¿Está el servicio activo?");
            setStatus('error');
            setTimeout(() => setStep('pin'), 3000);
          }
        }, 3000);

        ws.onopen = () => {
          clearTimeout(timeout);
          setMessage("Coloque su dedo en el lector USB...");
          ws.send(JSON.stringify({ cmd: "capture", data1: "1", data2: "0" }));
        };

        ws.onmessage = async (evt) => {
          const obj = JSON.parse(evt.data);
          
          if (obj.workmsg === 2) {
             setMessage("Coloque su dedo en el lector USB...");
          } else if (obj.workmsg === 5) {
             if (obj.retmsg === 1 && obj.data1 !== "null") {
                setMessage("Analizando huella...");
                // Mandar a comparar localmente
                ws.send(JSON.stringify({ cmd: "match", data1: emp.usbFingerprint, data2: obj.data1 }));
             } else {
                setMessage("Fallo al leer la huella, intente otra vez.");
                ws.send(JSON.stringify({ cmd: "capture", data1: "1", data2: "0" }));
             }
          } else if (obj.workmsg === 9) {
             if (obj.retmsg >= 60) {
                // ÉXITO
                ws.close();
                await registerPunch(emp.id, emp.name);
             } else {
                // FALLÓ LA COMPARACIÓN
                setMessage(`Huella no coincide (Score: ${obj.retmsg}). Intente de nuevo.`);
                setTimeout(() => {
                  ws.send(JSON.stringify({ cmd: "capture", data1: "1", data2: "0" }));
                }, 1500);
                
                setFails(f => {
                   const newFails = f + 1;
                   if (newFails >= 3) {
                     ws.close();
                     setTimeout(() => {
                        setStep('pin');
                        setStatus('idle');
                        setMessage('');
                     }, 2000);
                   }
                   return newFails;
                });
             }
          }
        };

        ws.onerror = () => {
           console.error("WS USB Error");
        };

        return; // Salir de la función para no usar WebAuthn
      } catch (err) {
        console.error("Error USB", err);
      }
    }

    if (window.AndroidAuth) {
       // --- NATIVE ANDROID BIOMETRICS ---
       window.onBiometricResult = async (userId: string, success: boolean, errorMessage: string) => {
          if (success && userId === emp.id) {
             await registerPunch(emp.id, emp.name);
          } else {
             setStatus('error');
             setMessage(errorMessage || "Error al leer huella");
             setFails(f => {
               const newFails = f + 1;
               if (newFails >= 3) {
                 setTimeout(() => {
                    setStep('pin');
                    setStatus('idle');
                    setMessage('');
                 }, 2000);
               } else {
                 setTimeout(() => {
                    setStatus('idle');
                    setMessage('');
                 }, 3000);
               }
               return newFails;
             });
          }
       };
       window.AndroidAuth.authenticate(emp.id);
       return;
    }

    // --- WEBAUTHN FALLBACK (Desktops, iOS, standard browsers) ---
    try {
      if (!window.PublicKeyCredential) {
        throw new Error("Biometría no soportada en este entorno.");
      }

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      
      const options: CredentialRequestOptions = {
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          userVerification: "required",
          timeout: 60000,
        }
      };

      const assertion = await navigator.credentials.get(options).catch((e: any) => {
         throw new Error("Huella no detectada o cancelada.");
      }) as PublicKeyCredential;
      
      if (!assertion || !assertion.response || !('userHandle' in assertion.response)) {
        throw new Error("No se pudo identificar la huella.");
      }
      
      const userHandle = (assertion.response as any).userHandle as ArrayBuffer;
      const uidFromAuth = new TextDecoder().decode(userHandle);
      
      if (uidFromAuth !== emp.id) {
        throw new Error("La huella no coincide con el usuario.");
      }

      await registerPunch(emp.id, emp.name);

    } catch (err: any) {
      console.log(err);
      setStatus('error');
      let errorMessage = err.message || "Error al leer huella";
      if (err.name === 'NotAllowedError') {
         errorMessage = "No hay huella registrada en este dispositivo.";
      }
      setMessage(errorMessage);
      
      setFails(f => {
        const newFails = f + 1;
        if (newFails >= 3) {
          setTimeout(() => {
             setStep('pin');
             setStatus('idle');
             setMessage('');
          }, 2000);
        } else {
          setTimeout(() => {
             setStatus('idle');
             setMessage('');
          }, 3000);
        }
        return newFails;
      });
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 6) return;
    
    setStatus('loading');
    try {
      const email = `${employee.username}@chronosabc.com`;
      await signInWithEmailAndPassword(secondaryAuth, email, pin);
      // Valid pin! Register punch.
      await registerPunch(employee.id, employee.name);
    } catch (err: any) {
      setStatus('error');
      setMessage("PIN incorrecto.");
      setPin('');
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-6">
        <div className="bg-white dark:bg-neutral-800 rounded-3xl shadow-2xl p-8 sm:p-12 w-full max-w-md border border-neutral-100 dark:border-neutral-700 relative overflow-hidden">
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight">Kiosco de Marcaje</h1>
            <p className="text-neutral-500 dark:text-neutral-400 mt-2">
              {step === 'id' && 'Ingresa tu ID para comenzar'}
              {step === 'biometric' && `Hola ${employee?.name}, usa tu huella`}
              {step === 'pin' && 'Ingresa tu PIN de seguridad'}
            </p>
          </div>

          {step === 'id' && (
            <form onSubmit={handleIdSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  ID de Usuario
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="Ej: jperez"
                  className="w-full text-center text-2xl px-4 py-4 bg-neutral-50 dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-4 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all font-medium dark:text-white"
                  disabled={status === 'loading'}
                  autoFocus
                  required
                />
              </div>
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-4 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 flex justify-center items-center"
              >
                {status === 'loading' ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Siguiente'}
              </button>
            </form>
          )}

          {step === 'biometric' && (
            <div className="flex flex-col items-center">
              <button
                onClick={() => triggerBiometric(employee)}
                disabled={status === 'loading' || status === 'success'}
                className="relative group w-48 h-48 flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/30 rounded-full transition-all active:scale-95 disabled:scale-100 my-4"
              >
                <div className="absolute inset-0 bg-indigo-600 rounded-full opacity-0 group-hover:opacity-10 transition-opacity"></div>
                {status === 'loading' && <div className="absolute inset-[-10px] rounded-full border-[6px] border-indigo-200 dark:border-indigo-800 border-t-indigo-600 dark:border-t-indigo-500 animate-spin"></div>}
                <Fingerprint className={`w-24 h-24 transition-colors ${status === 'error' ? 'text-rose-500' : status === 'success' ? 'text-emerald-500' : 'text-indigo-600 dark:text-indigo-400'}`} />
              </button>
              
              {fails > 0 && fails < 3 && status !== 'success' && (
                 <p className="text-amber-600 dark:text-amber-500 text-sm mt-4 font-medium animate-pulse text-center">
                   Intento fallido {fails} de 3.<br/>Puedes usar tu PIN si fallas 3 veces.
                 </p>
              )}

              {status !== 'loading' && status !== 'success' && (
                <div className="flex flex-col items-center mt-6 space-y-3">
                  <button onClick={() => setStep('pin')} className="px-6 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium text-sm transition-colors border border-neutral-200 dark:border-neutral-700">
                    Usar PIN en su lugar
                  </button>
                  <button onClick={reset} className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 font-medium text-sm transition-colors">
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'pin' && (
            <form onSubmit={handlePinSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  PIN de Seguridad
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full text-center text-3xl tracking-[0.5em] px-4 py-4 bg-neutral-50 dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-4 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all font-mono dark:text-white"
                  disabled={status === 'loading' || status === 'success'}
                  autoFocus
                  required
                />
              </div>
              <button
                type="submit"
                disabled={status === 'loading' || pin.length !== 6 || status === 'success'}
                className="w-full py-4 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 flex justify-center items-center"
              >
                {status === 'loading' ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Confirmar PIN'}
              </button>
              
              {status !== 'loading' && status !== 'success' && (
                <div className="text-center pt-2">
                  <button type="button" onClick={reset} className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 font-medium text-sm transition-colors">
                    Cancelar
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Status Overlay for errors and success */}
          <div className="absolute bottom-0 left-0 right-0 h-16 flex items-center justify-center p-4">
             {status === 'success' && (
               <div className="text-emerald-600 dark:text-emerald-500 font-bold text-lg flex items-center animate-in fade-in slide-in-from-bottom-2">
                 <UserCheck className="w-6 h-6 mr-2" />
                 {message}
               </div>
             )}
             {status === 'error' && (
               <div className="text-rose-600 dark:text-rose-500 font-medium text-sm flex items-center animate-in fade-in slide-in-from-bottom-2 bg-rose-50 dark:bg-rose-900/30 px-4 py-2 rounded-lg">
                 <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                 <span className="truncate">{message}</span>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
