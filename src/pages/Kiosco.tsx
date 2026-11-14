import { useCallback, useEffect, useRef, useState } from 'react';
import { UserCheck, AlertCircle, Loader2, Delete } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, addDoc, serverTimestamp, where, orderBy, onSnapshot } from 'firebase/firestore';
import { findUserIdByPin } from '../lib/pinIndexClient';
import { isValidPin } from '../shared/auth/pinIndex';

type Employee = { id: string; name: string; isActive: boolean };
type Ponche = { id: string; userId: string; type: string };

const PIN_LENGTH = 6;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const;

export default function Kiosco() {
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(new Date());

  // Datos precargados para que el ponche sea instantáneo
  const employeesRef = useRef<Map<string, Employee>>(new Map());
  const ponchesHoyRef = useRef<Ponche[]>([]);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>();
  const busyRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const map = new Map<string, Employee>();
      snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() as Omit<Employee, 'id'>) }));
      employeesRef.current = map;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pq = query(collection(db, 'ponches'), where('timestamp', '>=', today), orderBy('timestamp', 'desc'));
    const unsubP = onSnapshot(pq, (snap) => {
      ponchesHoyRef.current = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Ponche, 'id'>) }));
    });

    return () => {
      unsubUsers();
      unsubP();
      clearTimeout(resetTimer.current);
    };
  }, []);

  const finish = (kind: 'success' | 'error', text: string, ms: number) => {
    setStatus(kind);
    setMessage(text);
    setPin('');
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setStatus('idle');
      setMessage('');
    }, ms);
  };

  const submit = useCallback(async (code: string) => {
    if (!isValidPin(code) || busyRef.current) return;
    busyRef.current = true;
    setStatus('loading');
    try {
      const userId = await findUserIdByPin(code);
      const emp = userId ? employeesRef.current.get(userId) : undefined;
      if (!emp) throw new Error('PIN incorrecto.');
      if (!emp.isActive) throw new Error('Empleado inactivo.');

      const lastPunch = ponchesHoyRef.current.find((p) => p.userId === emp.id);
      let tipo = 'ENTRADA';
      if (lastPunch?.type === 'ENTRADA') tipo = 'SALIDA';
      else if (lastPunch?.type === 'ALMUERZO_IN') tipo = 'ALMUERZO_OUT';

      await addDoc(collection(db, 'ponches'), { userId: emp.id, type: tipo, timestamp: serverTimestamp() });
      const hora = new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
      finish('success', `${tipo} registrada · ${emp.name.trim()} · ${hora}`, 3000);
    } catch (err: any) {
      finish('error', err?.message === 'Empleado inactivo.' ? err.message : 'PIN incorrecto.', 2000);
    } finally {
      busyRef.current = false;
    }
  }, []);

  const press = useCallback((key: string) => {
    if (status === 'loading' || busyRef.current) return;
    if (status !== 'idle') {
      clearTimeout(resetTimer.current);
      setStatus('idle');
      setMessage('');
    }
    if (key === 'clear') return setPin('');
    if (key === 'back') return setPin(pin.slice(0, -1));
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPin(next);
    if (next.length === PIN_LENGTH) void submit(next);
  }, [pin, status, submit]);

  // Teclado físico (PC / teclado Bluetooth)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Escape') press('clear');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  return (
    <div className="min-h-[100dvh] bg-neutral-100 dark:bg-neutral-900 flex flex-col items-center justify-center p-4 select-none">
      <div className="bg-white dark:bg-neutral-800 rounded-3xl shadow-2xl p-6 sm:p-10 w-full max-w-sm border border-neutral-100 dark:border-neutral-700">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight">Kiosco de Marcaje</h1>
          <p className="text-4xl font-bold text-indigo-600 dark:text-indigo-400 mt-3 tabular-nums">
            {now.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 first-letter:uppercase">
            {now.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        <p className="text-center text-neutral-600 dark:text-neutral-300 font-medium mb-4">Ingresa tu PIN</p>

        <div className="flex justify-center gap-3 mb-4" aria-label={`${pin.length} de ${PIN_LENGTH} dígitos`}>
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span
              key={i}
              className={`w-4 h-4 rounded-full transition-colors ${
                status === 'error' ? 'bg-rose-500' :
                status === 'success' ? 'bg-emerald-500' :
                i < pin.length ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-neutral-200 dark:bg-neutral-700'
              }`}
            />
          ))}
        </div>

        <div className="h-14 flex items-center justify-center mb-2 text-center" role="status" aria-live="polite">
          {status === 'loading' && <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />}
          {status === 'success' && (
            <div className="text-emerald-600 dark:text-emerald-500 font-bold flex items-center">
              <UserCheck className="w-6 h-6 mr-2 flex-shrink-0" />
              <span>{message}</span>
            </div>
          )}
          {status === 'error' && (
            <div className="text-rose-600 dark:text-rose-500 font-semibold flex items-center bg-rose-50 dark:bg-rose-900/30 px-4 py-2 rounded-lg">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              <span>{message}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              disabled={status === 'loading'}
              className={`h-16 rounded-2xl text-2xl font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center ${
                k === 'clear' || k === 'back'
                  ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-200 text-base'
                  : 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100'
              }`}
              aria-label={k === 'clear' ? 'Borrar todo' : k === 'back' ? 'Borrar último dígito' : k}
            >
              {k === 'clear' ? 'Borrar' : k === 'back' ? <Delete className="w-6 h-6" /> : k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
