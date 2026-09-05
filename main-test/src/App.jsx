import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/useAuth.js';
import PublicHome from './pages/PublicHome.jsx';
import Welcome from './pages/Welcome.jsx';
import StatusCheck from './pages/StatusCheck.jsx';
import CallBoard from './pages/CallBoard.jsx';
import Login from './pages/Login.jsx';
import AdminLayout from './pages/AdminLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Employees from './pages/Employees.jsx';
import Exports from './pages/Exports.jsx';
import Logs from './pages/Logs.jsx';

function Guard({ children }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-muted font-body">
        Loading…
      </div>
    );
  }
  if (!session) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public, no login required */}
      <Route path="/" element={<Welcome />} />
      <Route path="/menu" element={<PublicHome />} />
      <Route path="/status" element={<StatusCheck />} />
      <Route path="/board" element={<CallBoard />} />

      {/* Admin */}
      <Route path="/admin/login" element={<Login />} />
      <Route
        path="/admin"
        element={
          <Guard>
            <AdminLayout />
          </Guard>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="employees" element={<Employees />} />
        <Route path="exports" element={<Exports />} />
        <Route path="logs" element={<Logs />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
