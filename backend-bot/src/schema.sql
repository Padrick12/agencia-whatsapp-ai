-- Tabla de Negocios / Clientes (Multi-Tenant)
CREATE TABLE IF NOT EXISTS businesses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    category VARCHAR(100) DEFAULT 'General',
    system_prompt TEXT NOT NULL,
    knowledge_base TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Prospectos / Leads vinculada a un Negocio
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
    phone VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) DEFAULT 'Prospecto WhatsApp',
    status VARCHAR(30) DEFAULT 'NUEVO',
    budget VARCHAR(50),
    interest VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Historial de Mensajes
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    sender VARCHAR(20) NOT NULL, -- 'LEAD' o 'BOT'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
