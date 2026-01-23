-- 1. Remove coluna 'priority'
ALTER TABLE public.actions DROP COLUMN IF EXISTS priority;

-- 2. Atualizar status 'blocked' para 'pending' (para garantir integridade)
UPDATE public.actions SET status = 'pending' WHERE status = 'blocked';

-- 3. Atualizar constraint de status
ALTER TABLE public.actions DROP CONSTRAINT IF EXISTS actions_status_check;
ALTER TABLE public.actions ADD CONSTRAINT actions_status_check 
    CHECK (status IN ('pending', 'in_progress', 'done'));