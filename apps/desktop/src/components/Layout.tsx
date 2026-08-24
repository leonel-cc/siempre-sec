import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/monitor', label: 'Monitoreo', icon: '🖥️' },
  { to: '/cameras', label: 'Cámaras', icon: '📷' },
  { to: '/events', label: 'Eventos', icon: '🔔' },
  { to: '/people', label: 'Personas', icon: '👤' },
  { to: '/zones', label: 'Zonas', icon: '🗺️' },
  { to: '/rules', label: 'Reglas', icon: '⚙️' },
  { to: '/settings', label: 'Configuración', icon: '🔧' },
  { to: '/status', label: 'Estado', icon: '💓' },
];

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-950">
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-lg font-bold text-security-400">🛡️ Security AI</h1>
          <p className="text-xs text-gray-500 mt-1">Video Surveillance System</p>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-security-600/20 text-security-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span>Sistema activo</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
