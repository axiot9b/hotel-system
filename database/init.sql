-- ============================================
-- HOTEL SYSTEM - Schema Completo PostgreSQL
-- ============================================

-- Usuarios del sistema (staff del hotel)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'receptionist'
        CHECK (role IN ('admin', 'manager', 'receptionist', 'accounting', 'housekeeping')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Huéspedes
CREATE TABLE IF NOT EXISTS guests (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80) NOT NULL,
    id_type VARCHAR(30) DEFAULT 'dni'
        CHECK (id_type IN ('dni', 'passport', 'license', 'other')),
    id_number VARCHAR(30),
    email VARCHAR(100),
    phone VARCHAR(30),
    country VARCHAR(60),
    city VARCHAR(60),
    address TEXT,
    notes TEXT,
    is_frequent BOOLEAN DEFAULT false,
    total_stays INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_guests_name ON guests(last_name, first_name);
CREATE INDEX idx_guests_id_number ON guests(id_number);

-- Tipos de habitación
CREATE TABLE IF NOT EXISTS room_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    base_price DECIMAL(10,2) NOT NULL,
    max_occupancy INTEGER NOT NULL DEFAULT 2,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habitaciones
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    room_number VARCHAR(10) UNIQUE NOT NULL,
    room_type_id INTEGER NOT NULL REFERENCES room_types(id),
    floor INTEGER DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'occupied', 'reserved', 'cleaning', 'maintenance')),
    features TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_rooms_status ON rooms(status);

-- Reservaciones
CREATE TABLE IF NOT EXISTS reservations (
    id SERIAL PRIMARY KEY,
    guest_id INTEGER NOT NULL REFERENCES guests(id),
    room_id INTEGER NOT NULL REFERENCES rooms(id),
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    actual_check_in TIMESTAMP WITH TIME ZONE,
    actual_check_out TIMESTAMP WITH TIME ZONE,
    nights INTEGER NOT NULL,
    adults INTEGER DEFAULT 1,
    children INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
    rate_per_night DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    notes TEXT,
    source VARCHAR(30) DEFAULT 'direct'
        CHECK (source IN ('direct', 'booking', 'airbnb', 'expedia', 'agency', 'phone', 'walk_in', 'other')),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_dates CHECK (check_out_date > check_in_date)
);

CREATE INDEX idx_reservations_dates ON reservations(check_in_date, check_out_date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_guest ON reservations(guest_id);
CREATE INDEX idx_reservations_room ON reservations(room_id);

-- Cargos extras (minibar, servicio, late checkout, etc.)
CREATE TABLE IF NOT EXISTS extra_charges (
    id SERIAL PRIMARY KEY,
    reservation_id INTEGER NOT NULL REFERENCES reservations(id),
    description VARCHAR(200) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    category VARCHAR(30) DEFAULT 'service'
        CHECK (category IN ('service', 'minibar', 'damage', 'late_checkout', 'other')),
    charged_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pagos
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    reservation_id INTEGER NOT NULL REFERENCES reservations(id),
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL
        CHECK (payment_method IN ('cash', 'card', 'transfer', 'other')),
    payment_type VARCHAR(20) NOT NULL DEFAULT 'payment'
        CHECK (payment_type IN ('deposit', 'payment', 'refund')),
    reference VARCHAR(100),
    notes TEXT,
    received_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payments_reservation ON payments(reservation_id);

-- Housekeeping
CREATE TABLE IF NOT EXISTS housekeeping_tasks (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id),
    assigned_to INTEGER REFERENCES users(id),
    task_type VARCHAR(30) NOT NULL DEFAULT 'cleaning'
        CHECK (task_type IN ('cleaning', 'deep_cleaning', 'inspection', 'restock')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed')),
    notes TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Caja diaria
CREATE TABLE IF NOT EXISTS daily_cash (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    opening_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    closing_balance DECIMAL(10,2),
    total_income DECIMAL(10,2) DEFAULT 0,
    total_expenses DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(10) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    opened_by INTEGER REFERENCES users(id),
    closed_by INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Log de auditoría
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_date ON audit_log(created_at);
CREATE INDEX idx_audit_user ON audit_log(user_id);

-- Historial de mantenimiento por habitación
CREATE TABLE IF NOT EXISTS maintenance_logs (
    id           SERIAL PRIMARY KEY,
    room_id      INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    reported_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type         VARCHAR(20) NOT NULL DEFAULT 'repair'
                 CHECK (type IN ('repair', 'inspection', 'preventive', 'cleaning')),
    status       VARCHAR(20) NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'in_progress', 'closed')),
    priority     VARCHAR(10) NOT NULL DEFAULT 'normal'
                 CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    description  TEXT NOT NULL,
    resolution   TEXT,
    cost         DECIMAL(10, 2),
    started_at   TIMESTAMP WITH TIME ZONE,
    closed_at    TIMESTAMP WITH TIME ZONE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_maintenance_room   ON maintenance_logs(room_id);
CREATE INDEX idx_maintenance_status ON maintenance_logs(status);

-- Bloqueos de habitaciones (mantenimiento, VIP, cierre temporal)
CREATE TABLE IF NOT EXISTS room_blocks (
    id          SERIAL PRIMARY KEY,
    room_id     INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    reason      VARCHAR(200) NOT NULL DEFAULT 'Bloqueo',
    created_by  INTEGER REFERENCES users(id),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_block_dates CHECK (end_date > start_date)
);

CREATE INDEX idx_room_blocks_room  ON room_blocks(room_id);
CREATE INDEX idx_room_blocks_dates ON room_blocks(start_date, end_date);

-- Tarifas por temporada (por tipo de habitación)
CREATE TABLE IF NOT EXISTS room_rates (
    id             SERIAL PRIMARY KEY,
    room_type_id   INTEGER NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
    name           VARCHAR(80) NOT NULL,
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL,
    rate_per_night DECIMAL(10,2) NOT NULL,
    description    TEXT,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_rate_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_room_rates_type  ON room_rates(room_type_id);
CREATE INDEX idx_room_rates_dates ON room_rates(start_date, end_date);
