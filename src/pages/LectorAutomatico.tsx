import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Fingerprint, CheckCircle2, XCircle, Loader2, PlugZap, KeyRound } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Lector automático (sin teclado ni pantalla táctil).
 *
 * Página para dejar abierta en Chrome en la PC que tiene el lector USB 2Connect
 * (Lirox LRU0808). Se conecta al servicio local de LIROX (fp-browser-service.exe,
 * ws://127.0.0.1:21187/fps), espera huellas sin parar, identifica al empleado entre
 * todas las huellas registradas y guarda el ponche. No hay que escribir nada:
 * solo poner el dedo.
 */

const READER_URL = 'ws://127.0.0.1:21187/fps';
const MATCH_THRESHOLD = 60;
const COOLDOWN_MS = 60_000;

type Emp = { id: string; name: string; template: string };
type Msg = { workmsg: number; retmsg: number; data1: string };
type LogItem = { t: Date; text: string; ok: boolean };

function parseMsg(raw: string): Msg | null {
  try {
    const o = JSON.parse(raw);
    return { workmsg: Number(o.workmsg) || 0, retmsg: Number(o.retmsg) || 0, data1: typeof o.data1 === 'string' ? o.data1 : '' };
  } catch {
    return null;
  }
}

/** Conexión al servicio local del lector con espera de respuestas por "workmsg". */
class ReaderConn {
  private ws: WebSocket;
  private waiters: { workmsg: number; resolve: (m: Msg) => void }[] = [];
  onClose: () => void = () => {};

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.onmessage = (e) => {
      const m = parseMsg(String(e.data));
      if (!m) return;
      const i = this.waiters.findIndex((w) => w.workmsg === m.workmsg);
      if (i >= 0) this.waiters.splice(i, 1)[0].resolve(m);
    };
    ws.onclose = () => {
      // Liberar a quien esté esperando respuesta para que el bucle pueda reconectar.
      for (const w of this.waiters.splice(0)) w.resolve({ workmsg: w.workmsg, retmsg: -1, data1: '' });
      this.onClose();
    };
  }

  static open(url: string): Promise<ReaderConn> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const t = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 5000);
      ws.onopen = () => { clearTimeout(t); resolve(new ReaderConn(ws)); };
      ws.onerror = () => { clearTimeout(t); reject(new Error('no conecta')); };
    });
  }

  private request(cmd: string, data1: string, data2: string, workmsg: number): Promise<Msg> {
    return new Promise((resolve) => {
      this.waiters.push({ workmsg, resolve });
      this.ws.send(JSON.stringify({ cmd, data1, data2 }));
    });
  }

  capture() { return this.request('capture', '1', '0', 5); }
  match(a: string, b: string) { return this.request('match', a, b, 9); }
  get open() { return this.ws.readyState === WebSocket.OPEN; }
  close() { this.ws.close(); }
}

let audioCtx: AudioContext | null = null;
function beep(freq: number, ms: number, times = 1) {
  try {
    audioCtx ??= new AudioContext();
    for (let i = 0; i < times; i++) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = freq;
      o.connect(g); g.connect(audioCtx.destination);
      const start = audioCtx.currentTime + i * (ms / 1000 + 0.08);
      o.start(start); o.stop(start + ms / 1000);
    }
  } catch { /* sin audio */ }
}

export default function LectorAutomatico() {
  const navigate = useNavigate();
  const [conn, setConn] = useState<'conectando' | 'ok' | 'sin-servicio'>('conectando');
  const [result, setResult] = useState<{ ok: boolean; text: string; sub?: string } | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);
  const [empCount, setEmpCount] = useState(0);
  const [clock, setClock] = useState(new Date());

  const emps = useRef<Emp[]>([]);
  const ponchesHoy = useRef<{ userId: string; type: string }[]>([]);
  const lastSeen = useRef(new Map<string, number>());

  const addLog = (text: string, ok: boolean) =>
    setLog((l) => [{ t: new Date(), text, ok }, ...l].slice(0, 12));

  const show = (ok: boolean, text: string, sub?: string) => {
    setResult({ ok, text, sub });
    setTimeout(() => setResult(null), 4000);
  };

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Empleados con huella USB registrada (se actualiza solo).
  useEffect(() => {
    return onSnapshot(collection(db, 'users'), (snap) => {
      emps.current = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((u) => typeof u.usbFingerprint === 'string' && u.usbFingerprint && u.isActive !== false)
        .map((u) => ({ id: u.id, name: u.name || u.username || u.id, template: u.usbFingerprint }));
      setEmpCount(emps.current.length);
    });
  }, []);

  // Ponches de hoy (para decidir ENTRADA / SALIDA).
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = query(collection(db, 'ponches'), where('timestamp', '>=', today), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snap) => {
      ponchesHoy.current = snap.docs.map((d) => d.data() as any);
    });
  }, []);

  // Bucle del lector: conectar, capturar, identificar, ponchar, repetir.
  useEffect(() => {
    let stopped = false;
    let reader: ReaderConn | null = null;

    const punch = async (emp: Emp, score: number) => {
      const now = Date.now();
      const prev = lastSeen.current.get(emp.id);
      if (prev && now - prev < COOLDOWN_MS) {
        beep(1800, 150);
        show(true, emp.name, 'Ya estaba registrado');
        return;
      }
      lastSeen.current.set(emp.id, now);
      const last = ponchesHoy.current.find((p) => p.userId === emp.id);
      let tipo = 'ENTRADA';
      if (last?.type === 'ENTRADA') tipo = 'SALIDA';
      else if (last?.type === 'ALMUERZO_IN') tipo = 'ALMUERZO_OUT';
      await addDoc(collection(db, 'ponches'), {
        userId: emp.id,
        type: tipo,
        timestamp: serverTimestamp(),
        notes: 'Lector USB 2Connect',
      });
      beep(1800, 180);
      show(true, emp.name, tipo === 'ENTRADA' ? 'Entrada registrada' : tipo === 'SALIDA' ? 'Salida registrada' : `${tipo} registrada`);
      addLog(`${tipo} — ${emp.name} (puntaje ${score})`, true);
    };

    const loop = async () => {
      while (!stopped) {
        try {
          reader = await ReaderConn.open(READER_URL);
        } catch {
          setConn('sin-servicio');
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }
        setConn('ok');
        let closed = false;
        reader.onClose = () => { closed = true; };

        while (!stopped && !closed && reader.open) {
          const cap = await reader.capture();
          if (closed || stopped) break;
          if (cap.retmsg !== 1 || !cap.data1 || cap.data1 === 'null') continue; // sin dedo / lectura mala
          const list = emps.current;
          if (!list.length) {
            beep(500, 250, 2);
            show(false, 'No hay huellas registradas');
            continue;
          }
          let best: Emp | null = null;
          let score = 0;
          for (const e of list) {
            const m = await reader.match(e.template, cap.data1);
            if (m.retmsg > score) { score = m.retmsg; best = e; }
          }
          if (best && score >= MATCH_THRESHOLD) {
            try {
              await punch(best, score);
            } catch (err: any) {
              beep(500, 250, 2);
              show(false, 'Error guardando el ponche', String(err?.message || err));
              addLog(`ERROR guardando ponche de ${best.name}`, false);
            }
          } else {
            beep(500, 250, 2);
            show(false, 'Huella no reconocida', 'Intente de nuevo');
            addLog(`Huella no reconocida (puntaje ${score})`, false);
          }
          await new Promise((r) => setTimeout(r, 1200)); // tiempo para retirar el dedo
        }
        setConn('conectando');
        await new Promise((r) => setTimeout(r, 2000));
      }
    };

    loop();
    return () => { stopped = true; reader?.close(); };
  }, []);

  return (
    <div
      className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 select-none"
      onClick={() => { try { audioCtx ??= new AudioContext(); void audioCtx.resume(); } catch { /* sin audio */ } }}
    >
      <div className="text-6xl font-light tabular-nums">{clock.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}</div>
      <div className="text-neutral-400 mt-1 capitalize">{clock.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })}</div>

      <div className="mt-12 flex flex-col items-center text-center min-h-[220px]">
        {result ? (
          <>
            {result.ok ? <CheckCircle2 className="w-28 h-28 text-emerald-400" /> : <XCircle className="w-28 h-28 text-rose-400" />}
            <div className="text-4xl font-semibold mt-4">{result.text}</div>
            {result.sub && <div className="text-xl text-neutral-300 mt-2">{result.sub}</div>}
          </>
        ) : conn === 'ok' ? (
          <>
            <Fingerprint className="w-28 h-28 text-indigo-400 animate-pulse" />
            <div className="text-3xl mt-4">Ponga el dedo en el lector</div>
          </>
        ) : conn === 'conectando' ? (
          <>
            <Loader2 className="w-20 h-20 text-neutral-400 animate-spin" />
            <div className="text-2xl mt-4 text-neutral-300">Conectando con el lector…</div>
          </>
        ) : (
          <>
            <PlugZap className="w-20 h-20 text-amber-400" />
            <div className="text-2xl mt-4">No se encuentra el servicio del lector</div>
            <div className="text-neutral-400 mt-2 max-w-md">
              Verifique que el lector esté conectado y que el programa de LIROX (fp-browser-service) esté abierto. Se reintenta solo.
            </div>
          </>
        )}
      </div>

      <div className="mt-8 flex flex-col items-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate('/kiosco-usuario');
          }}
          className="group flex items-center gap-3 px-6 py-3.5 bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 hover:text-white rounded-2xl font-medium text-base transition-all border border-neutral-800 hover:border-neutral-700 shadow-lg active:scale-95 cursor-pointer"
        >
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
            <KeyRound className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold">Entrar con código o contraseña</div>
            <div className="text-xs text-neutral-400">Marcar usando tu usuario y PIN</div>
          </div>
        </button>
      </div>

      <div className="mt-10 w-full max-w-lg text-sm">
        <div className="text-neutral-500 mb-2">{empCount} empleado(s) con huella registrada</div>
        {log.map((l, i) => (
          <div key={i} className={`flex justify-between py-1 border-b border-neutral-800 ${l.ok ? 'text-neutral-300' : 'text-rose-300'}`}>
            <span>{l.text}</span>
            <span className="tabular-nums text-neutral-500">{l.t.toLocaleTimeString('es-DO')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
