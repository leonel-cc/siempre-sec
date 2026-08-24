import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import { Spinner, CardSkeleton } from '../components/Loading';

export default function People() {
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [registering, setRegistering] = useState<string | null>(null);
  const [capturedFaces, setCapturedFaces] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { loadPeople(); }, []);

  async function loadPeople() {
    try { setPeople(await api.people.list()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function addPerson() {
    if (!name.trim()) return;
    try {
      const person = await api.people.create({ name: name.trim() });
      setPeople(prev => [...prev, person]);
      setName('');
      setShowForm(false);
    } catch (e) { console.error(e); }
  }

  async function removePerson(id: string) {
    try { await api.people.remove(id); setPeople(prev => prev.filter(p => p.id !== id)); }
    catch (e) { console.error(e); }
  }

  async function startFaceRegistration(personId: string) {
    setRegistering(personId);
    setCapturedFaces([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e) {
      console.error('Camera access denied:', e);
      alert('Se necesita acceso a la cámara para registrar rostros');
      setRegistering(null);
    }
  }

  function captureFace() {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const b64 = canvas.toDataURL('image/jpeg').split(',')[1];
    setCapturedFaces(prev => [...prev, b64]);
  }

  async function submitFaceRegistration() {
    if (!registering || capturedFaces.length === 0) return;
    try {
      for (const face of capturedFaces) {
        const response = await fetch('http://localhost:5000/embedding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: face, person_id: registering }),
        });
        if (response.ok) {
          const data = await response.json();
          await fetch(`http://localhost:3000/api/people/${registering}/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embedding: data.embedding }),
          });
        }
      }
      stopCamera();
      setRegistering(null);
      setCapturedFaces([]);
    } catch (e) { console.error(e); }
  }

  function stopCamera() {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Personas Conocidas</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-security-600 hover:bg-security-700 rounded-lg text-sm">
          + Agregar Persona
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex gap-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-security-500"
            onKeyDown={e => e.key === 'Enter' && addPerson()} />
          <button onClick={addPerson} className="px-4 py-2 bg-security-600 hover:bg-security-700 rounded-lg text-sm">Guardar</button>
        </div>
      )}

      {registering && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Registrar Rostro</h2>
            <button onClick={() => { stopCamera(); setRegistering(null); }} className="text-gray-400 hover:text-white text-sm">✕</button>
          </div>
          <div className="flex gap-4">
            <div className="relative">
              <video ref={videoRef} className="rounded w-80 bg-black" playsInline />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-gray-400">Captura {capturedFaces.length} de al menos 3 imágenes</p>
              <button onClick={captureFace} className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm">
                📸 Capturar Rostro
              </button>
              {capturedFaces.length >= 3 && (
                <button onClick={submitFaceRegistration}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm">
                  ✅ Registrar ({capturedFaces.length} fotos)
                </button>
              )}
              <div className="flex gap-1 flex-wrap">
                {capturedFaces.map((_, i) => (
                  <span key={i} className="w-6 h-6 rounded bg-security-600 flex items-center justify-center text-xs">{i+1}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : people.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">👤</p>
          <p>No hay personas registradas</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {people.map((person) => (
            <div key={person.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{person.name}</h3>
                  <p className="text-xs text-gray-500">{person.enabled ? 'Activo' : 'Inactivo'}</p>
                </div>
                <span className="text-2xl">👤</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startFaceRegistration(person.id)}
                  className="flex-1 px-3 py-1.5 bg-security-600/20 text-security-400 rounded text-xs hover:bg-security-600/30">
                  Registrar Rostro
                </button>
                <button onClick={() => removePerson(person.id)}
                  className="px-3 py-1.5 bg-red-900/20 text-red-400 rounded text-xs hover:bg-red-900/30">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
