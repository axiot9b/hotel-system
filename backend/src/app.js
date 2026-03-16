require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const authRoutes = require('./routes/auth');
const guestRoutes = require('./routes/guests');
const roomRoutes = require('./routes/rooms');
const roomTypeRoutes = require('./routes/roomTypes');
const reservationRoutes = require('./routes/reservations');
const dashboardRoutes = require('./routes/dashboard');
const housekeepingRoutes = require('./routes/housekeeping');
const userRoutes = require('./routes/users');
const auditRoutes = require('./routes/audit');
const dailyCashRoutes = require('./routes/dailyCash');
const financeRoutes = require('./routes/finance');
const calendarRoutes = require('./routes/calendar');
const notificationsRoutes = require('./routes/notifications');
const maintenanceRoutes  = require('./routes/maintenance');
const roomBlocksRoutes   = require('./routes/room-blocks');
const roomRatesRoutes    = require('./routes/room-rates');
const searchRoutes       = require('./routes/search');

const app = express();

const isProduction = process.env.NODE_ENV === 'production';
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: isProduction ? false : 'http://localhost:5173',
  credentials: true
}));
if (process.env.NODE_ENV !== 'test') app.use(morgan('short'));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/room-types', roomTypeRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/housekeeping', housekeepingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/daily-cash', dailyCashRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/room-blocks', roomBlocksRoutes);
app.use('/api/room-rates',  roomRatesRoutes);
app.use('/api/search',      searchRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, _req, res, _next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: isProduction ? 'Error interno' : err.message
  });
});

// Serve frontend in production (after all API routes)
if (isProduction) {
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

module.exports = app;
