-- Drop table if exists to reset schema (since we are in dev and just created it)
DROP TABLE IF EXISTS public.ideas CASCADE;

-- Create ideas table
CREATE TABLE IF NOT EXISTS public.ideas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    -- Reference public.users instead of auth.users to allow easy joining with user profiles
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all authenticated users" ON public.ideas
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.ideas
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for users based on id" ON public.ideas
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for users based on id" ON public.ideas
    FOR DELETE USING (auth.uid() = user_id);
