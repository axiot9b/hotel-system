-- ============================================================
-- add_features.sql — Run this on EXISTING databases to add
-- the new tables/columns without losing data.
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS).
-- ============================================================

-- 1. Canal de origen en reservaciones
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS source VARCHAR(30) DEFAULT 'direct'
    CHECK (source IN ('direct', 'booking', 'airbnb', 'expedia', 'agency', 'phone', 'walk_in', 'other'));

-- 2. Bloqueos de habitaciones
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

CREATE INDEX IF NOT EXISTS idx_room_blocks_room  ON room_blocks(room_id);
CREATE INDEX IF NOT EXISTS idx_room_blocks_dates ON room_blocks(start_date, end_date);

-- 3. Tarifas por temporada
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

CREATE INDEX IF NOT EXISTS idx_room_rates_type  ON room_rates(room_type_id);
CREATE INDEX IF NOT EXISTS idx_room_rates_dates ON room_rates(start_date, end_date);

-- 4. Descuentos en reservaciones
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS discount_type   VARCHAR(10) CHECK (discount_type IN ('percent','amount')),
  ADD COLUMN IF NOT EXISTS discount_value  DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason TEXT;
