import React, { useEffect, useState } from 'react';
import { 
  Users, TrendingUp, Download, LayoutDashboard, 
  Settings, LogOut, ChevronRight, Bell, Clock, UserCheck, UserX, FileText,
  Fingerprint, Plus, X, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthProvider';
import { auth, db, secondaryAuth } from '../lib/firebase';
import { signOut, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, doc, where } from 'firebase/firestore';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, format, differenceInMinutes, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, userData } = useAuth();
  const [ponches, setPonches] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('Dashboard');

  const [ponchesHoy, setPonchesHoy] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  
  // Metrics
  const [metricas, setMetricas] = useState({
    presentes: 0,
    total: 0,
    ausencias: 0,
    tardanzas: 0,
    horas: 0
  });

  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    
    // Subscribe to active users
    const uq = query(collection(db, 'users'), where('isActive', '==', true));
    const unsubU = onSnapshot(uq, (snap) => {
      const us = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsuarios(us);
    });

    // Subscribe to today's ponches
    const today = new Date();
    const st = startOfDay(today);
    const ed = endOfDay(today);
    const pq = query(
      collection(db, 'ponches'), 
      where('timestamp', '>=', st),
      where('timestamp', '<=', ed),
      orderBy('timestamp', 'desc')
    );
    const unsubP = onSnapshot(pq, (snap) => {
      setPonchesHoy(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubU();
      unsubP();
    };
  }, [user]);

  useEffect(() => {
    // Calculate Metrics
    if (!usuarios.length) return;

    const arrivedUsers = new Set();
    let tardanzasCount = 0;
    
    // Sort ponches chronological for calculations
    const sorted = [...ponchesHoy].reverse();
    const minutesWorkByUser: Record<string, number> = {};
    const entryTimeByUser: Record<string, any> = {};

    sorted.forEach(p => {
      if (!p.timestamp) return;
      const time = p.timestamp.toDate();
      const h = time.getHours();
      const m = time.getMinutes();
      
      if (p.type === 'ENTRADA') {
        arrivedUsers.add(p.userId);
        if (!entryTimeByUser[p.userId]) {
          entryTimeByUser[p.userId] = time;
          // Considerar tardanza si es después de las 08:15 AM
          if (h > 8 || (h === 8 && m > 15)) {
            tardanzasCount++;
          }
        }
      } else if (p.type === 'SALIDA') {
        if (entryTimeByUser[p.userId]) {
          const entry = entryTimeByUser[p.userId];
          minutesWorkByUser[p.userId] = (minutesWorkByUser[p.userId] || 0) + differenceInMinutes(time, entry);
          delete entryTimeByUser[p.userId]; // Reset para manejar múltiples entradas/salidas
        }
      }
    });

    // Añadir tiempo en curso (desde última ENTRADA hasta ahora) si no hay SALIDA
    const now = new Date();
    Object.keys(entryTimeByUser).forEach(uid => {
      minutesWorkByUser[uid] = (minutesWorkByUser[uid] || 0) + differenceInMinutes(now, entryTimeByUser[uid]);
    });

    const totalMinutes = Object.values(minutesWorkByUser).reduce((a, b) => a + b, 0);

    setMetricas({
      total: usuarios.length,
      presentes: arrivedUsers.size,
      ausencias: usuarios.length - arrivedUsers.size,
      tardanzas: tardanzasCount,
      horas: Math.floor(totalMinutes / 60)
    });
  }, [ponchesHoy, usuarios]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const handlePonche = async (tipo: string) => {
    if (!user) return;
    try {
      if (window.PublicKeyCredential) {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const options: CredentialRequestOptions = {
          publicKey: {
            challenge,
            rpId: window.location.hostname,
            userVerification: "preferred",
            timeout: 60000,
          }
        };
        // Biometría
        await navigator.credentials.get(options).catch((e) => {
           console.log("Biometría falló o en entorno dev, permitiendo bypass", e);
           const inIframe = window.self !== window.top;
           if (inIframe) {
             throw new Error("No se pudo acceder a la biometría en el entorno de vista previa. Usa una pestaña nueva o un dispositivo móvil.");
           }
        });
      }

      await addDoc(collection(db, 'ponches'), {
        userId: user.uid,
        type: tipo,
        timestamp: serverTimestamp()
      });
      alert(`Ponche registrado con éxito: ${tipo}`);
    } catch(err: any) {
      alert("Error al registrar ponche: " + err.message);
    }
  };

  if (!user) return <div>Cargando...</div>;

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col md:flex-row font-sans text-neutral-900">
      {/* Sidebar for Desktop / Header for Mobile */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-neutral-200 flex flex-col shrink-0">
        <div className="p-6 flex items-center shrink-0">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-3 shadow-md">
            <span className="text-white font-bold text-xl">C</span>
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">Chronos ABC</h1>
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Control de Asistencia</p>
          </div>
        </div>
        
        <nav className="flex-1 px-4 pb-6 overflow-y-auto space-y-1">
          <div className="md:hidden flex space-x-2 pb-4 overflow-x-auto">
             {/* Mobile quick links could go here, omitting for simplicity */}
          </div>
          
          <div className="hidden md:block">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 mt-4 px-3">Gestión</h3>
            <NavItem icon={<LayoutDashboard className="w-5 h-5"/>} text="Dashboard" active={activeTab === 'Dashboard'} onClick={() => setActiveTab('Dashboard')} />
            <NavItem icon={<Users className="w-5 h-5"/>} text="Empleados" active={activeTab === 'Empleados'} onClick={() => setActiveTab('Empleados')} />
            <NavItem icon={<Clock className="w-5 h-5"/>} text="Ponches (Entradas y Salidas)" active={activeTab === 'Ponches'} onClick={() => setActiveTab('Ponches')} />
            
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 mt-8 px-3">Punto de Marcaje</h3>
            <NavItem icon={<Fingerprint className="w-5 h-5"/>} text="Abrir Kiosco" onClick={() => navigate('/kiosco')} />

            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 mt-8 px-3">Reportes</h3>
            <NavItem icon={<FileText className="w-5 h-5"/>} text="Reporte Diario" active={activeTab === 'Reporte Diario'} onClick={() => setActiveTab('Reporte Diario')} />
            <NavItem icon={<FileText className="w-5 h-5"/>} text="Reporte Semanal" active={activeTab === 'Reporte Semanal'} onClick={() => setActiveTab('Reporte Semanal')} />
            <NavItem icon={<FileText className="w-5 h-5"/>} text="Reporte Mensual" active={activeTab === 'Reporte Mensual'} onClick={() => setActiveTab('Reporte Mensual')} />

            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 mt-8 px-3">Sistema</h3>
            <NavItem icon={<Settings className="w-5 h-5"/>} text="Configuración" active={activeTab === 'Configuración'} onClick={() => setActiveTab('Configuración')} />
          </div>
        </nav>

        <div className="p-4 border-t border-neutral-200 hidden md:block">
           <button 
             onClick={handleLogout} 
             className="flex items-center w-full px-3 py-2 text-sm font-medium text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
           >
             <LogOut className="w-5 h-5 mr-3" />
             Cerrar Sesión
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto w-full">
        <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-xl font-semibold">{activeTab === 'Dashboard' ? 'Resumen de Hoy' : activeTab}</h2>
          <div className="flex items-center space-x-4">
             <button className="relative p-2 text-neutral-400 hover:text-neutral-600 transition-colors">
               <Bell className="w-5 h-5" />
               <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
             </button>
             <div className="flex items-center">
               <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                 AD
               </div>
             </div>
          </div>
        </header>

        <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
          {activeTab === 'Dashboard' && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard title="Empleados Presentes" value={metricas.presentes.toString()} trend={`de ${metricas.total}`} icon={<UserCheck className="text-emerald-600 w-6 h-6"/>} />
                <KpiCard title="Ausencias Hoy" value={metricas.ausencias.toString()} icon={<UserX className="text-rose-600 w-6 h-6"/>} />
                <KpiCard title="Tardanzas" value={metricas.tardanzas.toString()} icon={<Clock className="text-amber-600 w-6 h-6"/>} />
                <KpiCard title="Horas Trabajadas Hoy" value={`${metricas.horas}h`} icon={<TrendingUp className="text-indigo-600 w-6 h-6"/>} />
              </div>

              {/* Ponche Actions */}
              <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between shadow-lg shadow-indigo-900/20 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 mb-6 md:mb-0 md:mr-8 max-w-xl">
                  <h3 className="text-2xl font-bold mb-2">Hola, {userData?.name || user.email?.split('@')[0]} 👋</h3>
                  <p className="text-indigo-200">
                    Registra tu ponche usando tu huella dactilar.
                  </p>
                </div>
                
                <div className="relative z-10 shrink-0 w-full md:w-auto flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={() => handlePonche('ENTRADA')}
                    className="flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-md active:scale-95"
                  >
                    <Fingerprint className="w-5 h-5 mr-2" />
                    Entrada
                  </button>
                  <button 
                    onClick={() => handlePonche('SALIDA')}
                    className="flex items-center justify-center bg-rose-500 hover:bg-rose-400 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-md active:scale-95"
                  >
                    <Fingerprint className="w-5 h-5 mr-2" />
                    Salida
                  </button>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Últimos Ponches</h3>
                  <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center">
                    Ver todos <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
                <div className="divide-y divide-neutral-100">
                  {ponchesHoy.length === 0 ? (
                    <div className="p-6 text-center text-neutral-500">No hay ponches registrados hoy.</div>
                  ) : ponchesHoy.slice(0, 10).map((item, i) => {
                    const date = item.timestamp?.toDate ? item.timestamp.toDate() : new Date();
                    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const emp = usuarios.find(u => u.id === item.userId);
                    return (
                    <div key={item.id || i} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-neutral-50 transition-colors">
                      <div className="flex items-center mb-4 sm:mb-0">
                        <div className="w-20 text-center mr-6">
                          <span className="block text-sm font-bold text-neutral-900">{timeString.split(' ')[0]}</span>
                          <span className="block text-xs font-medium text-neutral-500">{timeString.split(' ')[1] || ''}</span>
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900">{emp?.name || 'Usuario'} <span className="text-xs text-neutral-400 font-normal ml-1">({emp?.username || item.userId.substring(0, 5)})</span></p>
                          <p className="text-sm text-neutral-500">Fecha: {format(date, "dd 'de' MMMM", { locale: es })}</p>
                        </div>
                      </div>
                      <div className="ml-24 sm:ml-0">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          item.type === 'ENTRADA' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' :
                          'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'
                        }`}>
                          {item.type}
                        </span>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {activeTab === 'Empleados' && <EmpleadosTab />}
          {activeTab === 'Ponches' && <PonchesTab ponches={ponchesHoy} usuarios={usuarios} />}
          {activeTab === 'Reporte Semanal' && <ReporteSemanalTab />}
          {activeTab === 'Configuración' && <ConfiguracionTab />}

          {activeTab !== 'Dashboard' && activeTab !== 'Empleados' && activeTab !== 'Ponches' && activeTab !== 'Reporte Semanal' && activeTab !== 'Configuración' && (
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-12 text-center">
              <h3 className="text-xl font-semibold mb-2">Módulo: {activeTab}</h3>
              <p className="text-neutral-500">Este módulo está en construcción. Próximamente disponible.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function EmpleadosTab() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showUsbModal, setShowUsbModal] = useState(false);
  const [usbStatus, setUsbStatus] = useState("Presione Iniciar para conectar con el lector.");
  const [capturedFingerprint, setCapturedFingerprint] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setEmpleados(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleEditClick = (emp: any) => {
    setEditingUser(emp);
    setNombre(emp.name);
    setUsername(emp.username);
    setIsActive(emp.isActive);
    setPin(''); // No mostramos el PIN actual
    setShowModal(true);
  };

  const handleCreateClick = () => {
    setEditingUser(null);
    setNombre('');
    setUsername('');
    setPin('');
    setIsActive(true);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !username) return;
    
    setLoading(true);
    try {
      if (editingUser) {
        // Edit existing user in Firestore
        await setDoc(doc(db, 'users', editingUser.id), {
          name: nombre,
          isActive: isActive,
          updatedAt: serverTimestamp()
        }, { merge: true });
        
        alert("Empleado actualizado con éxito.");
      } else {
        // Create new user
        if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {
          alert("El PIN debe ser exactamente de 6 dígitos numéricos.");
          setLoading(false);
          return;
        }

        const email = `${username.toLowerCase().trim()}@chronosabc.com`;
        const { user: newAuthUser } = await createUserWithEmailAndPassword(secondaryAuth, email, pin);
        
        await setDoc(doc(db, 'users', newAuthUser.uid), {
          username: username.toLowerCase().trim(),
          name: nombre,
          role: 'EMPLOYEE',
          isActive: true,
          hasBiometric: false, // Indicador visual
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

      if (window.PublicKeyCredential) {
        if (confirm(`¿Desea registrar la huella digital para ${nombre} en este dispositivo ahora mismo? (Opcional)`)) {
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);
          await navigator.credentials.create({
            publicKey: {
              challenge,
              rp: { name: "Chronos ABC", id: window.location.hostname },
              user: {
                id: new TextEncoder().encode(newAuthUser.uid),
                name: username,
                displayName: nombre
              },
              pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
              authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification: "required",
                residentKey: "required",
                requireResidentKey: true
              }
            }
          }).then(async () => {
            // Si se registró con éxito, actualizamos el indicador en Firestore
            await setDoc(doc(db, 'users', newAuthUser.uid), { hasBiometric: true }, { merge: true });
            alert("Huella vinculada exitosamente.");
          }).catch(err => {
            console.log("Registro de huella fallido", err);
            const inIframe = window.self !== window.top;
            if (inIframe) {
              alert(`No se pudo acceder a la huella digital debido a las restricciones de vista previa.\n\nPara usar la huella, por favor abre la aplicación en una pestaña nueva completa (usando el botón de "Open in new tab") o accede desde el enlace compartido directo en tu celular.`);
            } else {
              alert("Registro de huella cancelado o no disponible en este dispositivo: " + err.message);
            }
          });
        }
      }
        alert("Empleado creado con éxito.");
      }

      setShowModal(false);
    } catch(err: any) {
      if (err.code === 'auth/email-already-in-use') {
        alert("El ID de usuario ya está en uso.");
      } else {
        alert("Error: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Gestión de Empleados</h3>
        <button 
          onClick={handleCreateClick}
          className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Empleado
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500">
            <tr>
              <th className="px-6 py-4 font-medium">Nombre</th>
              <th className="px-6 py-4 font-medium">ID (Usuario)</th>
              <th className="px-6 py-4 font-medium">Huella</th>
              <th className="px-6 py-4 font-medium">Estado</th>
              <th className="px-6 py-4 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {empleados.map(emp => (
              <tr key={emp.id} className="hover:bg-neutral-50 transition-colors">
                <td className="px-6 py-4 font-medium text-neutral-900">{emp.name}</td>
                <td className="px-6 py-4 text-neutral-600">{emp.username}</td>
                <td className="px-6 py-4 text-neutral-600">
                  {emp.hasBiometric ? (
                    <Fingerprint className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <span className="text-xs text-neutral-400">Sin registrar</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${emp.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {emp.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => handleEditClick(emp)}
                    className="text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {empleados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                  No hay empleados registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="font-semibold text-lg text-neutral-900">{editingUser ? 'Editar Empleado' : 'Registrar Empleado'}</h3>
              <button onClick={() => setShowModal(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre Completo</label>
                <input 
                  type="text" 
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-colors"
                  placeholder="Ej. Ana Pérez"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">ID (Usuario para Login)</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={e => setUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
                  disabled={!!editingUser}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-colors disabled:opacity-50"
                  placeholder="Ej. a.perez"
                  required
                />
                {editingUser && <p className="text-xs text-neutral-500 mt-1">El ID de usuario no se puede cambiar.</p>}
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">PIN de Acceso Inicial</label>
                  <input 
                    type="password" 
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-colors font-mono tracking-widest text-lg"
                    placeholder="••••••"
                    required={!editingUser}
                  />
                </div>
              )}

              {editingUser && (
                <div className="flex items-center space-x-3 mt-4 pt-4 border-t border-neutral-100">
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                      />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-neutral-300'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isActive ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                    <span className="ml-3 text-sm font-medium text-neutral-700">
                      {isActive ? 'Empleado Activo' : 'Empleado Inactivo'}
                    </span>
                  </label>
                </div>
              )}

              <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {editingUser && window.PublicKeyCredential && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm(`¿Vincular huella de Windows/Android a ${editingUser.name}?`)) {
                        try {
                          const challenge = new Uint8Array(32);
                          window.crypto.getRandomValues(challenge);
                          await navigator.credentials.create({
                            publicKey: {
                              challenge,
                              rp: { name: "Chronos ABC", id: window.location.hostname },
                              user: {
                                id: new TextEncoder().encode(editingUser.id),
                                name: editingUser.username,
                                displayName: editingUser.name
                              },
                              pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
                              authenticatorSelection: {
                                authenticatorAttachment: "platform",
                                userVerification: "required",
                                residentKey: "required",
                                requireResidentKey: true
                              }
                            }
                          });
                          await setDoc(doc(db, 'users', editingUser.id), { hasBiometric: true }, { merge: true });
                          alert("Huella vinculada con éxito.");
                        } catch (err: any) {
                          alert("Error al registrar huella: " + err.message);
                        }
                      }
                    }}
                    className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg"
                  >
                    <Fingerprint className="w-4 h-4 mr-2" />
                    Huella Sistema (WebAuthn)
                  </button>
                )}
                
                {editingUser && (
                   <button
                    type="button"
                    onClick={() => {
                       setShowUsbModal(true);
                       setUsbStatus("Presione Iniciar para conectar con el lector.");
                    }}
                    className="flex items-center text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg ml-2"
                   >
                     <Fingerprint className="w-4 h-4 mr-2" />
                     Lector USB 2Connect
                   </button>
                )}
                
                <div className="flex justify-end space-x-3 w-full sm:w-auto">
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Guardando...' : (editingUser ? 'Guardar Cambios' : 'Crear y Vincular Huella')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUsbModal && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4 shadow-indigo-900/20">
             <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
               <Fingerprint className="w-8 h-8" />
             </div>
             <h3 className="font-semibold text-lg text-neutral-900">Registro de Huella 2Connect</h3>
             <p className="text-sm text-neutral-600 min-h-[40px] flex items-center justify-center">{usbStatus}</p>
             
             <div className="flex flex-col gap-3 mt-4">
               {!capturedFingerprint && (
                 <button
                   onClick={async () => {
                     setUsbStatus("Conectando al lector USB...");
                     try {
                       const ws = new WebSocket("ws://localhost:21187/fps");
                       
                       ws.onopen = () => {
                         setUsbStatus("Iniciando registro (Deberá poner y quitar el dedo un par de veces)...");
                         ws.send(JSON.stringify({ cmd: "enrol", data1: "0", data2: "0" }));
                       };

                       ws.onmessage = async (evt) => {
                         const obj = JSON.parse(evt.data);
                         if (obj.workmsg === 1) setUsbStatus("Asegúrese de conectar el lector USB.");
                         else if (obj.workmsg === 2) setUsbStatus("Ponga el dedo en el lector...");
                         else if (obj.workmsg === 3) setUsbStatus("Levante el dedo y vuelva a colocarlo...");
                         else if (obj.workmsg === 6) {
                           if (obj.retmsg === 1 && obj.data1 !== "null") {
                             setUsbStatus("¡Huella capturada correctamente! Ahora presione Guardar.");
                             setCapturedFingerprint(obj.data1);
                             ws.close();
                           } else {
                             setUsbStatus("Fallo al registrar la huella. Intente de nuevo.");
                             ws.close();
                           }
                         }
                       };

                       ws.onerror = () => {
                         setUsbStatus("Error: No se pudo conectar al lector. ¿Está instalado y corriendo el Web SDK?");
                       };
                     } catch (err) {
                       setUsbStatus("Error de conexión local.");
                     }
                   }}
                   className="w-full bg-emerald-600 text-white font-medium py-2 rounded-lg hover:bg-emerald-700 transition"
                 >
                   1. Iniciar Lector 2Connect
                 </button>
               )}

               <button
                 disabled={!capturedFingerprint}
                 onClick={async () => {
                   if (editingUser && capturedFingerprint) {
                     setUsbStatus("Guardando en la base de datos...");
                     try {
                       await setDoc(doc(db, 'users', editingUser.id), { 
                         hasBiometric: true, 
                         usbFingerprint: capturedFingerprint 
                       }, { merge: true });
                       
                       setUsbStatus("¡Huella guardada exitosamente!");
                       setCapturedFingerprint(null);
                       setTimeout(() => {
                         setShowUsbModal(false);
                         setUsbStatus("Presione Iniciar para conectar con el lector.");
                       }, 2000);
                     } catch (error) {
                       console.error("Error guardando huella:", error);
                       setUsbStatus("Error al guardar: " + (error instanceof Error ? error.message : String(error)));
                     }
                   }
                 }}
                 className="w-full bg-indigo-600 text-white font-medium py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 2. Guardar Huella Registrada
               </button>

               <button type="button" onClick={() => {
                   setShowUsbModal(false);
                   setCapturedFingerprint(null);
                   setUsbStatus("Presione Iniciar para conectar con el lector.");
               }} className="w-full text-neutral-500 font-medium py-2 rounded-lg hover:bg-neutral-100 transition">
                 Cancelar
               </button>
             </div>
             
             <div className="text-left text-xs bg-amber-50 text-amber-800 p-3 rounded-lg border border-amber-200 mt-4">
                <strong>Configuración:</strong> Asegúrese de que el servicio local esté ejecutándose en su PC (icono de la huella en la barra de tareas).
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, text, active = false, onClick }: { icon: React.ReactNode, text: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
      active 
        ? 'bg-indigo-50 text-indigo-700' 
        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
    }`}>
      <span className={`mr-3 ${active ? 'text-indigo-600' : 'text-neutral-400'}`}>{icon}</span>
      {text}
    </button>
  );
}

function KpiCard({ title, value, trend, icon }: { title: string, value: string, trend?: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-neutral-500">{title}</h3>
        <div className="p-2 bg-neutral-50 rounded-lg">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline space-x-2">
        <span className="text-3xl font-bold tracking-tight text-neutral-900">{value}</span>
        {trend && (
           <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
             {trend}
           </span>
        )}
      </div>
    </div>
  );
}

function PonchesTab({ ponches, usuarios }: { ponches: any[], usuarios: any[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
        <h3 className="font-semibold text-lg">Registro de Entradas y Salidas de Hoy</h3>
      </div>
      <div className="divide-y divide-neutral-100">
        {ponches.length === 0 ? (
          <div className="p-12 text-center text-neutral-500">No hay ponches registrados hoy.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-100">
              <tr>
                <th className="px-6 py-4 font-medium">Hora</th>
                <th className="px-6 py-4 font-medium">Empleado</th>
                <th className="px-6 py-4 font-medium">ID Usuario</th>
                <th className="px-6 py-4 font-medium">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {ponches.map((item) => {
                const date = item.timestamp?.toDate ? item.timestamp.toDate() : new Date();
                const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const emp = usuarios.find(u => u.id === item.userId);
                
                return (
                  <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-neutral-900">{timeString}</td>
                    <td className="px-6 py-4 font-medium text-neutral-900">{emp?.name || 'Desconocido'}</td>
                    <td className="px-6 py-4 text-neutral-500">{emp?.username || item.userId.substring(0, 5)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        item.type === 'ENTRADA' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' :
                        'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'
                      }`}>
                        {item.type}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ReporteSemanalTab() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snap) => {
         const us = snap.docs.map(d => ({ id: d.id, ...d.data() }));
         setUsuarios(us);
      });

      const st = startOfWeek(new Date(), { weekStartsOn: 1 });
      const ed = endOfWeek(new Date(), { weekStartsOn: 1 });
      
      const pq = query(
        collection(db, 'ponches'), 
        where('timestamp', '>=', st),
        where('timestamp', '<=', ed),
        orderBy('timestamp', 'asc')
      );
      
      const unsubscribePonches = onSnapshot(pq, (snap) => {
         const p = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
         setReportData(p);
         setLoading(false);
      });

      return () => {
        unsubscribeUsers();
        unsubscribePonches();
      };
    }
    fetchData();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading || !reportData) return <div className="text-center p-12 text-neutral-500">Cargando reporte...</div>;

  // Process Report Data by User
  const reportByUser: Record<string, { user: any, days: Record<string, string[]> }> = {};
  
  usuarios.forEach(u => {
    reportByUser[u.id] = { user: u, days: {} };
  });

  reportData.forEach((p: any) => {
    if (!p.timestamp) return;
    const date = p.timestamp.toDate();
    const dayKey = format(date, 'yyyy-MM-dd');
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (reportByUser[p.userId]) {
      if (!reportByUser[p.userId].days[dayKey]) {
        reportByUser[p.userId].days[dayKey] = [];
      }
      reportByUser[p.userId].days[dayKey].push(`${p.type}: ${timeStr}`);
    }
  });

  const weekDays = [];
  let curr = startOfWeek(new Date(), { weekStartsOn: 1 });
  for (let i = 0; i < 7; i++) {
    weekDays.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <h3 className="text-xl font-semibold">Reporte Semanal ({format(weekDays[0], "dd MMM")} - {format(weekDays[6], "dd MMM")})</h3>
        <button 
          onClick={handlePrint}
          className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-xl transition-colors shadow-sm"
        >
          <FileText className="w-5 h-5 mr-2" />
          Imprimir / Exportar
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-x-auto print:shadow-none print:border-none">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 print:text-black">
            <tr>
              <th className="px-6 py-4 font-medium sticky left-0 bg-neutral-50 z-10 print:static">Empleado</th>
              {weekDays.map((d, i) => (
                <th key={i} className="px-6 py-4 font-medium text-center">
                  <div className="font-bold text-neutral-700 print:text-black">{format(d, 'EEEE', { locale: es })}</div>
                  <div className="text-xs">{format(d, 'dd/MMM')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 print:divide-neutral-300 border-b border-neutral-200">
            {Object.values(reportByUser).map(({ user, days }) => (
              <tr key={user.id} className="hover:bg-neutral-50 transition-colors">
                <td className="px-6 py-4 font-medium text-neutral-900 sticky left-0 bg-white shadow-[1px_0_0_0_#f5f5f5] print:static print:shadow-none">
                  {user.name}
                  <div className="text-xs text-neutral-500 font-normal">Emp-ID: {user.username}</div>
                </td>
                {weekDays.map((d, i) => {
                  const dayKey = format(d, 'yyyy-MM-dd');
                  const records = days[dayKey] || [];
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  
                  return (
                    <td key={i} className={`px-6 py-4 align-top text-xs ${isWeekend ? 'bg-neutral-50/50' : ''}`}>
                      {records.length > 0 ? (
                        <div className="space-y-1 min-w-[100px]">
                          {records.map((r, ri) => (
                            <div key={ri} className={`px-2 py-0.5 rounded text-center ${r.startsWith('ENTRADA') ? 'bg-emerald-50 text-emerald-700 print:border print:border-emerald-300' : 'bg-rose-50 text-rose-700 print:border print:border-rose-300'}`}>
                              {r.split(': ')[1]}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-neutral-300 italic min-w-[100px]">-</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #root {
            visibility: hidden;
          }
           .bg-white.rounded-2xl.shadow-sm.border.border-neutral-200.overflow-x-auto, 
           .bg-white.rounded-2xl.shadow-sm.border.border-neutral-200.overflow-x-auto * {
            visibility: visible;
          }
          .bg-white.rounded-2xl.shadow-sm.border.border-neutral-200.overflow-x-auto {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

function ConfiguracionTab() {
  const { user, userData } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  const handleThemeChange = (t: string) => {
    setTheme(t);
    localStorage.setItem('theme', t);
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (newPassword !== confirmPassword) {
      alert("Las contraseñas no coinciden");
      return;
    }
    if (newPassword.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      await updatePassword(user, newPassword);
      alert("Contraseña actualizada con éxito");
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        alert("Por seguridad, debes cerrar sesión y volver a entrar para cambiar tu contraseña.");
      } else {
        alert("Error: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-neutral-100">
          <h3 className="font-semibold text-lg text-neutral-900">Cambiar Contraseña</h3>
          <p className="text-sm text-neutral-500 mt-1">Actualiza tu contraseña de acceso administrador.</p>
        </div>
        <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Nueva Contraseña</label>
            <input 
              type="password" 
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full max-w-sm px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Confirmar Contraseña</label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full max-w-sm px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-colors"
              required
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-neutral-100">
          <h3 className="font-semibold text-lg text-neutral-900">Apariencia</h3>
          <p className="text-sm text-neutral-500 mt-1">Personaliza el tema visual de la aplicación.</p>
        </div>
        <div className="p-6 flex space-x-4">
          <button
            onClick={() => handleThemeChange('light')}
            className={`px-4 py-3 border-2 rounded-xl flex items-center justify-center transition-all ${theme !== 'dark' ? 'border-indigo-600 bg-indigo-50/50' : 'border-neutral-200 hover:border-indigo-200'}`}
          >
            <span className={`font-medium ${theme !== 'dark' ? 'text-indigo-900' : 'text-neutral-700'}`}>Modo Claro</span>
          </button>
          <button
            onClick={() => handleThemeChange('dark')}
            className={`px-4 py-3 border-2 rounded-xl flex items-center justify-center transition-all ${theme === 'dark' ? 'border-indigo-600 bg-indigo-50/50' : 'border-neutral-200 hover:border-indigo-200'}`}
          >
            <span className={`font-medium ${theme === 'dark' ? 'text-indigo-900' : 'text-neutral-700'}`}>Modo Oscuro</span>
          </button>
        </div>
      </div>
    </div>
  );
}

