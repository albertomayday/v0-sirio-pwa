-- SIRIO TPV - Esquema de Base de Datos
-- Migración inicial: Tablas principales + VeriFactu

-- Configuración del negocio
CREATE TABLE IF NOT EXISTS config (
  id SERIAL PRIMARY KEY,
  biz_name VARCHAR(100) NOT NULL DEFAULT 'Mi Negocio',
  biz_type VARCHAR(50) DEFAULT 'restaurante',
  iva DECIMAL(5,2) DEFAULT 21,
  currency CHAR(3) DEFAULT '€',
  iva_incluido BOOLEAN DEFAULT true,
  use_mesas BOOLEAN DEFAULT true,
  use_inventario BOOLEAN DEFAULT true,
  offline_mode BOOLEAN DEFAULT true,
  stock_alert BOOLEAN DEFAULT true,
  pay_methods JSONB DEFAULT '{"efectivo":true,"tarjeta":true,"bizum":true}',
  num_mesas INTEGER DEFAULT 10,
  mesa_prefix VARCHAR(20) DEFAULT 'Mesa ',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Categorías de productos
CREATE TABLE IF NOT EXISTS categorias (
  id VARCHAR(50) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Productos
CREATE TABLE IF NOT EXISTS productos (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  cat_id VARCHAR(50) REFERENCES categorias(id) ON DELETE SET NULL,
  badge VARCHAR(20),
  stock INTEGER,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Usuarios/Camareros
CREATE TABLE IF NOT EXISTS usuarios (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(100),
  activo BOOLEAN DEFAULT false,
  ventas INTEGER DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Mesas (estado actual)
CREATE TABLE IF NOT EXISTS mesas (
  id INTEGER PRIMARY KEY,
  estado VARCHAR(20) DEFAULT 'libre',
  usuario_id VARCHAR(10) REFERENCES usuarios(id) ON DELETE SET NULL,
  hora TIMESTAMP,
  comanda JSONB DEFAULT '[]',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tickets/Facturas (VeriFactu compliant)
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  ticket_id VARCHAR(20) UNIQUE NOT NULL,
  mesa_id INTEGER,
  usuario_id VARCHAR(10),
  usuario_name VARCHAR(100),
  metodo_pago VARCHAR(20),
  items JSONB NOT NULL,
  subtotal DECIMAL(12,2),
  iva_amount DECIMAL(12,2),
  total DECIMAL(12,2) NOT NULL,
  
  -- VeriFactu fields
  serie VARCHAR(50) DEFAULT 'SIRIO',
  numero INTEGER NOT NULL,
  tipo_factura VARCHAR(5) DEFAULT 'F2',
  hash_anterior VARCHAR(64) NOT NULL,
  hash_actual VARCHAR(64) NOT NULL,
  timestamp_factura TIMESTAMP NOT NULL,
  datos_hash TEXT,
  
  -- Destinatario (opcional para facturas completas F1)
  destinatario_nif VARCHAR(20),
  destinatario_nombre VARCHAR(200),
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cola de sincronización offline
CREATE TABLE IF NOT EXISTS sync_queue (
  id SERIAL PRIMARY KEY,
  operation_type VARCHAR(50) NOT NULL,
  table_name VARCHAR(50) NOT NULL,
  record_id VARCHAR(50),
  data JSONB NOT NULL,
  client_timestamp TIMESTAMP NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_tickets_fecha ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_hash ON tickets(hash_actual);
CREATE INDEX IF NOT EXISTS idx_tickets_numero ON tickets(numero);
CREATE INDEX IF NOT EXISTS idx_mesas_estado ON mesas(estado);
CREATE INDEX IF NOT EXISTS idx_mesas_updated ON mesas(updated_at);
CREATE INDEX IF NOT EXISTS idx_productos_cat ON productos(cat_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_processed ON sync_queue(processed);

-- Secuencia para números de factura VeriFactu
CREATE SEQUENCE IF NOT EXISTS verifactu_seq START 1;

-- Insertar configuración por defecto si no existe
INSERT INTO config (biz_name, biz_type) 
SELECT 'Mi Negocio', 'restaurante'
WHERE NOT EXISTS (SELECT 1 FROM config LIMIT 1);

-- Categorías por defecto
INSERT INTO categorias (id, label, orden) VALUES
  ('bebidas', 'Bebidas', 1),
  ('comida', 'Comida', 2),
  ('postres', 'Postres', 3),
  ('otros', 'Otros', 4)
ON CONFLICT (id) DO NOTHING;

-- Usuario por defecto
INSERT INTO usuarios (id, name, role, activo) VALUES
  ('01', 'Camarero 1', 'Camarero', true)
ON CONFLICT (id) DO NOTHING;
