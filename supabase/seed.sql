-- =====================================================
-- OKR Dashboard 2026 - Dados Iniciais (Seed)
-- Execute APÓS o schema.sql
-- =====================================================

-- =====================================================
-- 1. BUSINESS UNITS
-- =====================================================
INSERT INTO public.business_units (code, name, description, order_index) VALUES
    ('SXS', 'SXS Brazil', 'Spirax Sarco Brazil', 1),
    ('HITER', 'Hiter', 'Hiter Brasil', 2);

-- =====================================================
-- 2. PILLARS
-- =====================================================
INSERT INTO public.pillars (code, name, description, icon, color, order_index) VALUES
    ('RENT', 'Rentabilidade', 'Alcançar resultados acima do faturamento esperado, com melhor rentabilidade.', 'trending-up', '#10b981', 1),
    ('LEAD', 'Lead Time / Serviço', 'Ser reconhecidos como a principal referência do mercado em performance e pontualidade nas entregas.', 'truck', '#3b82f6', 2),
    ('SEG', 'Segurança', 'Transformação rumo a uma cultura de segurança proativa com participação integral dos colaboradores.', 'shield', '#f59e0b', 3);

-- =====================================================
-- 3. OBJECTIVES (por unidade e pilar)
-- =====================================================
-- SXS Brazil - Rentabilidade
INSERT INTO public.objectives (business_unit_id, pillar_id, code, title, description, year)
SELECT 
    bu.id,
    p.id,
    'OBJ-RENT',
    'Alcançar resultados acima do faturamento esperado, com melhor rentabilidade.',
    'Foco em uso de material, custo de pessoal, SSP exportação e eficiência fabril.',
    2026
FROM public.business_units bu, public.pillars p
WHERE bu.code = 'SXS' AND p.code = 'RENT';

-- SXS Brazil - Lead Time
INSERT INTO public.objectives (business_unit_id, pillar_id, code, title, description, year)
SELECT 
    bu.id,
    p.id,
    'OBJ-LEAD',
    'Ser reconhecidos como a principal referência do mercado em performance e pontualidade nas entregas.',
    'Foco em OTTC, Lead Time, OTTC de fornecedor e tempo de abertura de OV.',
    2026
FROM public.business_units bu, public.pillars p
WHERE bu.code = 'SXS' AND p.code = 'LEAD';

-- SXS Brazil - Segurança
INSERT INTO public.objectives (business_unit_id, pillar_id, code, title, description, year)
SELECT 
    bu.id,
    p.id,
    'OBJ-SEG',
    'Transformação rumo a uma cultura de segurança proativa com participação integral dos colaboradores.',
    'Foco em treinamentos e eliminação de riscos críticos.',
    2026
FROM public.business_units bu, public.pillars p
WHERE bu.code = 'SXS' AND p.code = 'SEG';

-- Hiter - Rentabilidade
INSERT INTO public.objectives (business_unit_id, pillar_id, code, title, description, year)
SELECT 
    bu.id,
    p.id,
    'OBJ-RENT',
    'Alcançar resultados acima do faturamento esperado, com melhor rentabilidade.',
    'Foco em uso de material, custo de pessoal, SSP exportação e eficiência fabril.',
    2026
FROM public.business_units bu, public.pillars p
WHERE bu.code = 'HITER' AND p.code = 'RENT';

-- Hiter - Lead Time
INSERT INTO public.objectives (business_unit_id, pillar_id, code, title, description, year)
SELECT 
    bu.id,
    p.id,
    'OBJ-LEAD',
    'Ser reconhecidos como a principal referência do mercado em performance e pontualidade nas entregas.',
    'Foco em OTTC, Lead Time, OTTC de fornecedor e tempo de abertura de OV.',
    2026
FROM public.business_units bu, public.pillars p
WHERE bu.code = 'HITER' AND p.code = 'LEAD';

-- Hiter - Segurança
INSERT INTO public.objectives (business_unit_id, pillar_id, code, title, description, year)
SELECT 
    bu.id,
    p.id,
    'OBJ-SEG',
    'Transformação rumo a uma cultura de segurança proativa com participação integral dos colaboradores.',
    'Foco em treinamentos e eliminação de riscos críticos.',
    2026
FROM public.business_units bu, public.pillars p
WHERE bu.code = 'HITER' AND p.code = 'SEG';

-- =====================================================
-- 4. KEY RESULTS - SXS Brazil
-- =====================================================

-- SXS - Rentabilidade KRs
INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '1.1', 'Uso de Material - MIX atual Mercado Local', 'Rafael', 'SAP', 'percentage', '%', 1
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'SXS' AND p.code = 'RENT';

INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '1.2', 'Custo de Pessoal vs SSP -355K/ano', 'Ricardo', 'Finance', 'currency', 'R$', 2
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'SXS' AND p.code = 'RENT';

INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '1.3', 'SSP Exportação (SV - CERTIFICADO - EMBALAGENS)', 'Csik / Danilo', 'SAP', 'percentage', '%', 3
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'SXS' AND p.code = 'RENT';

INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '1.4', 'Eficiência Fabril - UNIFICAR CRITÉRIO SARCO & HITER', 'Ricardo', 'Produção', 'percentage', '%', 4
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'SXS' AND p.code = 'RENT';

-- SXS - Lead Time KRs
INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '2.1', 'Aumento do índice de OTTC (%)', 'Ana Paula', 'SAP', 'percentage', '%', 1
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'SXS' AND p.code = 'LEAD';

INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '2.2', 'Redução de Lead Time (SV 80/SV4) (dias)', 'Gabriel', 'SAP', 'days', 'dias', 2
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'SXS' AND p.code = 'LEAD';

INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '2.3', 'Aumento do índice de OTTC de Fornecedor (Make to Order)', 'Talita', 'SAP', 'percentage', '%', 3
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'SXS' AND p.code = 'LEAD';

INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '2.4', 'Tempo de Abertura de OV (3 dias)', 'Ademir', 'SAP', 'days', 'dias', 4
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'SXS' AND p.code = 'LEAD';

-- SXS - Segurança KRs
INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '3.1', '90% de cumprimento do plano anual de treinamento de segurança', 'Ricardo / Evaldo', 'RH', 'percentage', '%', 1
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'SXS' AND p.code = 'SEG';

INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '3.2', 'Eliminar todos os riscos identificados como críticos, altos e significativos', 'Ricardo / Evaldo / Karina', 'EHS', 'percentage', '%', 2
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'SXS' AND p.code = 'SEG';

-- =====================================================
-- 5. KEY RESULTS - Hiter
-- =====================================================

-- Hiter - Rentabilidade KRs
INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '1.1', 'Uso de Material - MIX atual Mercado Local', 'Rafael', 'SAP', 'percentage', '%', 1
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'HITER' AND p.code = 'RENT';

INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '1.2', 'Custo de Pessoal vs SSP -355K/ano', 'Evaldo', 'Finance', 'currency', 'R$', 2
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'HITER' AND p.code = 'RENT';

INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '1.3', 'SSP Exportação (SV - CERTIFICADO - EMBALAGENS)', 'Eric / Danilo', 'SAP', 'percentage', '%', 3
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'HITER' AND p.code = 'RENT';

INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '1.4', 'Eficiência Fabril - UNIFICAR CRITÉRIO SARCO & HITER', 'Robson', 'Produção', 'percentage', '%', 4
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'HITER' AND p.code = 'RENT';

-- Hiter - Lead Time KRs
INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '2.1', 'Aumento do índice de OTTC', 'Fernando', 'SAP', 'percentage', '%', 1
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'HITER' AND p.code = 'LEAD';

INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '2.2', 'Redução de Lead Time (dias) (VSM)', 'Evaldo', 'SAP', 'days', 'dias', 2
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'HITER' AND p.code = 'LEAD';

INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '2.3', 'Aumento do índice de OTTC de Fornecedor (Make to Order)', 'Moura', 'SAP', 'percentage', '%', 3
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'HITER' AND p.code = 'LEAD';

INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '2.4', 'Tempo de Abertura de OV (3 dias)', 'Ademir', 'SAP', 'days', 'dias', 4
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'HITER' AND p.code = 'LEAD';

-- Hiter - Segurança KRs
INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '3.1', '90% de cumprimento do plano anual de treinamento de segurança', 'Ricardo / Evaldo', 'RH', 'percentage', '%', 1
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'HITER' AND p.code = 'SEG';

INSERT INTO public.key_results (objective_id, code, title, owner_name, source, metric_type, unit, order_index)
SELECT o.id, '3.2', 'Eliminar todos os riscos identificados como críticos, altos e significativos', 'Ricardo / Evaldo / Karina', 'EHS', 'percentage', '%', 2
FROM public.objectives o
JOIN public.business_units bu ON o.business_unit_id = bu.id
JOIN public.pillars p ON o.pillar_id = p.id
WHERE bu.code = 'HITER' AND p.code = 'SEG';

-- =====================================================
-- 6. KR QUARTERLY DATA (Q1 inicial para todos)
-- =====================================================

-- Inserir dados de Q1 para todos os KRs com valores zerados
INSERT INTO public.kr_quarterly_data (key_result_id, quarter, year, baseline, target, actual, confidence)
SELECT 
    kr.id,
    1, -- Q1
    2026,
    0, -- baseline
    0, -- target (a ser preenchido)
    NULL, -- actual (a ser preenchido)
    NULL -- confidence (a ser preenchido)
FROM public.key_results kr;

-- Inserir dados de Q2, Q3, Q4 vazios para todos os KRs
INSERT INTO public.kr_quarterly_data (key_result_id, quarter, year)
SELECT kr.id, 2, 2026 FROM public.key_results kr;

INSERT INTO public.kr_quarterly_data (key_result_id, quarter, year)
SELECT kr.id, 3, 2026 FROM public.key_results kr;

INSERT INTO public.kr_quarterly_data (key_result_id, quarter, year)
SELECT kr.id, 4, 2026 FROM public.key_results kr;
