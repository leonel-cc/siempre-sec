import { useEffect, useRef, useState } from 'react';
import { RemoteTrack, Room, RoomEvent, Track } from 'livekit-client';
import { Camera, ViewSession } from '../types';

type ViewerStatus = 'connecting' | 'live' | 'no-publisher' | 'offline' | 'error';

export function LiveCameraViewer({ camera, session, onClose }: {
  camera: Camera;
  session: ViewSession;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentTrackRef = useRef<RemoteTrack | null>(null);
  const [videoTrack, setVideoTrack] = useState<RemoteTrack | null>(null);
  const [status, setStatus] = useState<ViewerStatus>('connecting');
  const [detail, setDetail] = useState('Negociando conexión cifrada');

  useEffect(() => {
    const room = new Room({ adaptiveStream: true, dynacast: true });
    let active = true;

    const subscribed = (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Video && active) {
        currentTrackRef.current = track;
        setVideoTrack(track);
        setStatus('live');
        setDetail('Transmisión remota en vivo');
      }
    };
    const unsubscribed = (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Video && active) {
        track.detach();
        if (currentTrackRef.current === track) currentTrackRef.current = null;
        setVideoTrack(null);
        setStatus('no-publisher');
        setDetail('La sala está conectada, pero no publica video');
      }
    };
    const participantChanged = () => {
      if (active && !currentTrackRef.current) {
        setStatus('no-publisher');
        setDetail('Esperando al publicador de la instalación');
      }
    };
    const disconnected = () => {
      if (active) {
        currentTrackRef.current = null;
        setVideoTrack(null);
        setStatus('offline');
        setDetail('La sesión remota se desconectó');
      }
    };
    const reconnecting = () => {
      if (active) {
        setStatus('connecting');
        setDetail('Recuperando la conexión');
      }
    };

    room.on(RoomEvent.TrackSubscribed, subscribed);
    room.on(RoomEvent.TrackUnsubscribed, unsubscribed);
    room.on(RoomEvent.ParticipantConnected, participantChanged);
    room.on(RoomEvent.ParticipantDisconnected, participantChanged);
    room.on(RoomEvent.Disconnected, disconnected);
    room.on(RoomEvent.Reconnecting, reconnecting);

    const connect = async () => {
      try {
        if (session.provider.toLowerCase() !== 'livekit') {
          throw new Error(`Proveedor de video no compatible: ${session.provider}`);
        }
        await room.connect(session.url, session.token);
        if (!active) return;
        if (!currentTrackRef.current) {
          setStatus('no-publisher');
          setDetail(room.remoteParticipants.size > 0
            ? 'Publicador conectado; esperando una pista de video'
            : 'La sala está conectada, pero no hay publicador');
        }
      } catch (error) {
        if (active) {
          setStatus('error');
          setDetail(error instanceof Error ? error.message : 'No se pudo conectar a la sala de video');
        }
      }
    };

    void connect();
    return () => {
      active = false;
      currentTrackRef.current = null;
      setVideoTrack(null);
      room.removeAllListeners();
      void room.disconnect();
    };
  }, [session.provider, session.token, session.url]);

  useEffect(() => {
    const element = videoRef.current;
    if (!videoTrack || !element) return;
    videoTrack.attach(element);
    return () => {
      videoTrack.detach(element);
    };
  }, [videoTrack]);

  return (
    <section className="viewer" aria-label={`Vista en vivo de ${camera.displayName}`}>
      <header>
        <div><span className={`status-dot ${status}`} /><div><b>{camera.displayName}</b><small>{detail}</small></div></div>
        <button onClick={onClose} aria-label="Cerrar vista">×</button>
      </header>
      <div className="video-stage">
        {videoTrack && <video ref={videoRef} autoPlay playsInline />}
        {!videoTrack && (
          <div className={`signal-state ${status}`}>
            <span className="signal-rings"><i /><i /><i /></span>
            <b>{status === 'connecting' ? 'Conectando' : status === 'no-publisher' ? 'Sin señal del publicador' : status === 'offline' ? 'Cámara fuera de línea' : 'No fue posible abrir la vista'}</b>
            <p>{detail}</p>
          </div>
        )}
        <div className="viewer-overlay"><span>{status === 'live' ? '● EN VIVO' : 'VISTA REMOTA'}</span><small>Expira {new Date(session.expiresAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</small></div>
      </div>
    </section>
  );
}
