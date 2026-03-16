import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RoomsPage from './pages/RoomsPage';
import GuestsPage from './pages/GuestsPage';
import ReservationsPage from './pages/ReservationsPage';
import ReservationDetailPage from './pages/ReservationDetailPage';
import HousekeepingPage from './pages/HousekeepingPage';
import RoomTypesPage from './pages/RoomTypesPage';
import UsersPage from './pages/UsersPage';
import AuditPage from './pages/AuditPage';
import GuestDetailPage from './pages/GuestDetailPage';
import MaintenancePage from './pages/MaintenancePage';
import DailyCashPage from './pages/DailyCashPage';
import FinancePage from './pages/FinancePage';
import InvoicePage from './pages/InvoicePage';
import CalendarPage from './pages/CalendarPage';
import RatesPage from './pages/RatesPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  return user ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Invoice is standalone (no sidebar) */}
      <Route path="/invoice/:id" element={<ProtectedRoute><InvoicePage /></ProtectedRoute>} />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="guests" element={<GuestsPage />} />
        <Route path="guests/:id" element={<GuestDetailPage />} />
        <Route path="reservations" element={<ReservationsPage />} />
        <Route path="reservations/:id" element={<ReservationDetailPage />} />
        <Route path="housekeeping" element={<HousekeepingPage />} />
        <Route path="room-types" element={<RoomTypesPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="daily-cash" element={<DailyCashPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="maintenance" element={<MaintenancePage />} />
        <Route path="rates" element={<RatesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
