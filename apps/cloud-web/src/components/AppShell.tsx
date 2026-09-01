import { ReactNode, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Brand, useAuth } from '../auth/AuthProvider';
import { roleLabel, useOrganizations } from '../organizations/OrganizationProvider';

const navigation = [
  { to: '/', label: 'Resumen', glyph: '⌂' },
  { to: '/cameras', label: 'Cámaras', glyph: '◉' },
  { to: '/events', label: 'Eventos', glyph: '!' },
  { to: '/enrollment', label: 'Instalar', glyph: '+' },
  { to: '/phone', label: 'Alertas', glyph: '⌁' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { memberships, selected, select, loading } = useOrganizations();
  const [profileOpen, setProfileOpen] = useState(false);
  const displayName = typeof user.profile.name === 'string'
    ? user.profile.name
    : typeof user.profile.email === 'string' ? user.profile.email : 'Usuario';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Navegación principal">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              <span className="nav-glyph">{item.glyph}</span>{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-status"><i /><span>Servicios cloud<small>Canal operativo</small></span></div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="organization-control">
            <label htmlFor="organization">Organización activa</label>
            <select
              id="organization"
              value={selected?.organizationId ?? ''}
              onChange={(event) => select(event.target.value)}
              disabled={loading || memberships.length === 0}
            >
              {memberships.length === 0 && <option value="">Sin organizaciones</option>}
              {memberships.map((membership) => (
                <option key={membership.id} value={membership.organizationId}>{membership.organization.name}</option>
              ))}
            </select>
            {selected && <span className="role-chip">{roleLabel(selected.role)}</span>}
          </div>
          <div className="profile">
            <button className="profile-button" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen}>
              <span>{displayName.slice(0, 1).toUpperCase()}</span>
              <b>{displayName}</b>
            </button>
            {profileOpen && (
              <div className="profile-menu">
                <small>Sesión OIDC activa</small>
                <button onClick={() => void signOut()}>Cerrar sesión</button>
              </div>
            )}
          </div>
        </header>
        <main className="content">{children}</main>
      </div>

      <nav className="mobile-nav" aria-label="Navegación móvil">
        {navigation.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}>
            <span>{item.glyph}</span>{item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, action }: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
      {action}
    </header>
  );
}

export function EmptyOrganization() {
  return (
    <section className="empty-state">
      <span className="empty-icon">◇</span>
      <h2>Seleccione una organización</h2>
      <p>Cree o elija una organización desde el resumen para continuar.</p>
    </section>
  );
}
