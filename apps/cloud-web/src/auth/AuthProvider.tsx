import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { User } from 'oidc-client-ts';
import { configErrors } from '../config';
import { userManager } from './manager';

interface AuthContextValue {
  user: User;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function returnPathFromState(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('returnTo' in state)) return '/';
  const returnTo = (state as { returnTo?: unknown }).returnTo;
  return typeof returnTo === 'string' && returnTo.startsWith('/') ? returnTo : '/';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userManager) {
      setLoading(false);
      return;
    }
    const manager = userManager;

    let active = true;
    const loaded = (nextUser: User) => {
      if (active) setUser(nextUser);
    };
    const unloaded = () => {
      if (active) setUser(null);
    };
    const renewalFailed = (renewalError: Error) => {
      if (active) setError(`No se pudo renovar la sesión: ${renewalError.message}`);
    };

    manager.events.addUserLoaded(loaded);
    manager.events.addUserUnloaded(unloaded);
    manager.events.addAccessTokenExpired(unloaded);
    manager.events.addSilentRenewError(renewalFailed);

    const initialize = async () => {
      try {
        const callbackUrl = new URL(window.location.href);
        const configuredCallback = new URL(manager.settings.redirect_uri);
        const isCallback = callbackUrl.pathname === configuredCallback.pathname
          && (callbackUrl.searchParams.has('code') || callbackUrl.searchParams.has('error'));
        const nextUser = isCallback
          ? await manager.signinRedirectCallback(window.location.href)
          : await manager.getUser();

        if (!active) return;
        if (nextUser && !nextUser.expired) {
          setUser(nextUser);
          if (isCallback) {
            window.history.replaceState({}, document.title, returnPathFromState(nextUser.state));
          }
        } else {
          setUser(null);
        }
      } catch (initializationError) {
        if (active) {
          setError(initializationError instanceof Error ? initializationError.message : 'No se pudo iniciar la sesión.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void initialize();
    return () => {
      active = false;
      manager.events.removeUserLoaded(loaded);
      manager.events.removeUserUnloaded(unloaded);
      manager.events.removeAccessTokenExpired(unloaded);
      manager.events.removeSilentRenewError(renewalFailed);
    };
  }, []);

  if (configErrors.length > 0) {
    return (
      <main className="center-screen">
        <section className="auth-card config-card">
          <Brand />
          <p className="eyebrow">Configuración requerida</p>
          <h1>El portal aún no está conectado.</h1>
          <p>Complete las variables Vite antes de iniciar la aplicación.</p>
          <ul>{configErrors.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      </main>
    );
  }

  if (loading) {
    return <main className="center-screen"><div className="loader" aria-label="Cargando sesión" /><span>Estableciendo canal seguro</span></main>;
  }

  if (!user) {
    const signIn = async () => {
      setError(null);
      await userManager?.signinRedirect({
        state: { returnTo: `${window.location.pathname}${window.location.search}` },
      });
    };
    return (
      <main className="login-screen">
        <section className="login-visual" aria-hidden="true">
          <div className="scan-frame"><span /><span /><span /><span /></div>
          <p>MONITOREO REMOTO / CANAL CIFRADO</p>
        </section>
        <section className="auth-card">
          <Brand />
          <p className="eyebrow">Centro de operaciones</p>
          <h1>Su perímetro,<br />siempre visible.</h1>
          <p>Acceda a organizaciones, cámaras y alertas desde una sesión protegida.</p>
          {error && <div className="notice error" role="alert">{error}</div>}
          <button className="button primary wide" onClick={() => void signIn()}>Ingresar con identidad segura</button>
          <small>Authorization Code + PKCE · Sin secretos en el navegador</small>
        </section>
      </main>
    );
  }

  const signOut = async () => {
    await userManager?.signoutRedirect();
  };

  return <AuthContext.Provider value={{ user, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark"><i /><i /><i /></span>
      <span>SIEMPRE<small>SECURITY CLOUD</small></span>
    </div>
  );
}
