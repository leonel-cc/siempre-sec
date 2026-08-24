import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Cameras from './pages/Cameras';
import Events from './pages/Events';
import People from './pages/People';
import Zones from './pages/Zones';
import Rules from './pages/Rules';
import Settings from './pages/Settings';
import SystemStatus from './pages/SystemStatus';
import Monitor from './pages/Monitor';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/monitor" element={<Monitor />} />
        <Route path="/cameras" element={<Cameras />} />
        <Route path="/events" element={<Events />} />
        <Route path="/people" element={<People />} />
        <Route path="/zones" element={<Zones />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/status" element={<SystemStatus />} />
      </Route>
    </Routes>
  );
}
