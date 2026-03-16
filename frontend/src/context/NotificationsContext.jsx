import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationsContext = createContext({});

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState({
    checkInsToday:  0,
    checkOutsToday: 0,
    pendingTasks:   0,
    roomsCleaning:  0,
    cashOpen:       false
  });
  const intervalRef = useRef(null);

  const fetchNotifs = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.get('/notifications');
      setNotifs(data);
    } catch {
      // silencioso — no interrumpir la UI si falla
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    fetchNotifs();
    intervalRef.current = setInterval(fetchNotifs, 30_000);

    return () => clearInterval(intervalRef.current);
  }, [user, fetchNotifs]);

  // total de alertas para el badge global
  const totalAlerts = notifs.checkInsToday + notifs.checkOutsToday;

  return (
    <NotificationsContext.Provider value={{ ...notifs, totalAlerts, refresh: fetchNotifs }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
