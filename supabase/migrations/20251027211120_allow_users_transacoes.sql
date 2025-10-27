-- Ensure regular authenticated users can manage their own transactions
DO $$
BEGIN
  -- Only run policy creation if the user_id column exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transacoes'
      AND column_name = 'user_id'
  ) THEN
    -- Make sure RLS is enabled
    EXECUTE 'ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY';

    -- Allow users to view their own transactions
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'transacoes'
        AND policyname = ''Users can view own transactions''
    ) THEN
      EXECUTE $$
        CREATE POLICY "Users can view own transactions" ON public.transacoes
        FOR SELECT
        USING (auth.uid() = user_id);
      $$;
    END IF;

    -- Allow users to insert transactions for themselves
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'transacoes'
        AND policyname = ''Users can insert own transactions''
    ) THEN
      EXECUTE $$
        CREATE POLICY "Users can insert own transactions" ON public.transacoes
        FOR INSERT
        WITH CHECK (auth.uid() = user_id);
      $$;
    END IF;

    -- Allow users to update their own transactions
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'transacoes'
        AND policyname = ''Users can update own transactions''
    ) THEN
      EXECUTE $$
        CREATE POLICY "Users can update own transactions" ON public.transacoes
        FOR UPDATE
        USING (auth.uid() = user_id);
      $$;
    END IF;

    -- Allow users to delete their own transactions
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'transacoes'
        AND policyname = ''Users can delete own transactions''
    ) THEN
      EXECUTE $$
        CREATE POLICY "Users can delete own transactions" ON public.transacoes
        FOR DELETE
        USING (auth.uid() = user_id);
      $$;
    END IF;

    -- Helpful index for filtering by user_id (idempotent)
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_transacoes_user_id ON public.transacoes(user_id)';
  END IF;
END;
$$;
