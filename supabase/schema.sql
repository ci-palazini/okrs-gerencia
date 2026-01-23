-- =====================================================
-- OKR Dashboard 2026 - Schema Completo (V2)
-- Execute este SQL no Supabase SQL Editor
-- ATENÇÃO: Este script APAGA todos os dados existentes
-- =====================================================

-- Limpar tabelas existentes (ordem reversa por foreign keys)
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.kr_quarterly_data CASCADE;
DROP TABLE IF EXISTS public.actions CASCADE;
DROP TABLE IF EXISTS public.key_results CASCADE;
DROP TABLE IF EXISTS public.objectives CASCADE;
DROP TABLE IF EXISTS public.pillars CASCADE;
DROP TABLE IF EXISTS public.business_units CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. USERS TABLE (extends auth.users)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. BUSINESS UNITS (SXS Brazil, Hiter, etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.business_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 3. PILLARS TABLE (Rentabilidade, Lead Time, Segurança)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.pillars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT NOT NULL DEFAULT 'target',
    color TEXT NOT NULL DEFAULT '#6366f1',
    order_index INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 4. OBJECTIVES (Objetivos por Pilar e Unidade)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.objectives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
    pillar_id UUID NOT NULL REFERENCES public.pillars(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    year INTEGER NOT NULL DEFAULT 2026,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(business_unit_id, pillar_id, code, year)
);

-- =====================================================
-- 5. KEY RESULTS (KRs vinculados aos objetivos)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.key_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    objective_id UUID NOT NULL REFERENCES public.objectives(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    owner_name TEXT,
    source TEXT, -- Fonte dos dados (SAP, AX, Finance, etc.)
    metric_type TEXT NOT NULL DEFAULT 'percentage' CHECK (metric_type IN ('percentage', 'number', 'currency', 'days')),
    unit TEXT NOT NULL DEFAULT '%',
    order_index INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 6. KR QUARTERLY DATA (Dados trimestrais dos KRs)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.kr_quarterly_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_result_id UUID NOT NULL REFERENCES public.key_results(id) ON DELETE CASCADE,
    quarter INTEGER NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
    year INTEGER NOT NULL DEFAULT 2026,
    baseline NUMERIC,
    target NUMERIC,
    actual NUMERIC,
    progress NUMERIC GENERATED ALWAYS AS (
        CASE 
            WHEN target IS NULL OR target = baseline THEN 0
            WHEN actual IS NULL THEN 0
            ELSE ROUND(((actual - COALESCE(baseline, 0)) / NULLIF(target - COALESCE(baseline, 0), 0)) * 100, 2)
        END
    ) STORED,
    confidence TEXT CHECK (confidence IN ('on_track', 'at_risk', 'off_track')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(key_result_id, quarter, year)
);

-- =====================================================
-- 7. ACTIONS (Ações vinculadas aos KRs)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_result_id UUID NOT NULL REFERENCES public.key_results(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'blocked')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date DATE,
    owner_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 8. AUDIT LOGS (Log de auditoria)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_email TEXT,
    user_name TEXT,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    entity_name TEXT,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kr_quarterly_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all profiles" ON public.users
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Business Units: all authenticated can read
CREATE POLICY "Business units viewable by authenticated" ON public.business_units
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Business units editable by authenticated" ON public.business_units
    FOR ALL TO authenticated USING (true);

-- Pillars: all authenticated can read/write
CREATE POLICY "Pillars viewable by authenticated" ON public.pillars
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Pillars editable by authenticated" ON public.pillars
    FOR ALL TO authenticated USING (true);

-- Objectives: all authenticated can read/write
CREATE POLICY "Objectives viewable by authenticated" ON public.objectives
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Objectives editable by authenticated" ON public.objectives
    FOR ALL TO authenticated USING (true);

-- Key Results: all authenticated can read/write
CREATE POLICY "Key results viewable by authenticated" ON public.key_results
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Key results editable by authenticated" ON public.key_results
    FOR ALL TO authenticated USING (true);

-- KR Quarterly Data: all authenticated can read/write
CREATE POLICY "KR quarterly data viewable by authenticated" ON public.kr_quarterly_data
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "KR quarterly data editable by authenticated" ON public.kr_quarterly_data
    FOR ALL TO authenticated USING (true);

-- Actions: all authenticated can read/write
CREATE POLICY "Actions viewable by authenticated" ON public.actions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Actions editable by authenticated" ON public.actions
    FOR ALL TO authenticated USING (true);

-- Audit Logs: all authenticated can read, insert
CREATE POLICY "Audit logs viewable by authenticated" ON public.audit_logs
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Audit logs insertable by authenticated" ON public.audit_logs
    FOR INSERT TO authenticated WITH CHECK (true);

-- =====================================================
-- 10. FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_units_updated_at
    BEFORE UPDATE ON public.business_units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pillars_updated_at
    BEFORE UPDATE ON public.pillars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_objectives_updated_at
    BEFORE UPDATE ON public.objectives
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_key_results_updated_at
    BEFORE UPDATE ON public.key_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kr_quarterly_data_updated_at
    BEFORE UPDATE ON public.kr_quarterly_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_actions_updated_at
    BEFORE UPDATE ON public.actions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 11. INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_objectives_business_unit ON public.objectives(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_objectives_pillar ON public.objectives(pillar_id);
CREATE INDEX IF NOT EXISTS idx_objectives_year ON public.objectives(year);
CREATE INDEX IF NOT EXISTS idx_key_results_objective ON public.key_results(objective_id);
CREATE INDEX IF NOT EXISTS idx_kr_quarterly_data_kr ON public.kr_quarterly_data(key_result_id);
CREATE INDEX IF NOT EXISTS idx_kr_quarterly_data_quarter ON public.kr_quarterly_data(quarter, year);
CREATE INDEX IF NOT EXISTS idx_actions_key_result ON public.actions(key_result_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON public.actions(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
