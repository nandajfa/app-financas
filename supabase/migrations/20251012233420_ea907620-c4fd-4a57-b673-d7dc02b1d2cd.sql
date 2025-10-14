-- Criar enum para tipos de transação
CREATE TYPE public.transaction_type AS ENUM ('receita', 'despesa');

-- Criar tabela de perfis
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Criar enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Criar tabela de roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função para verificar se usuário tem role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Políticas para user_roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Criar tabela de transações
CREATE TABLE IF NOT EXISTS public.transacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  quando TIMESTAMP WITH TIME ZONE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  estabelecimento TEXT NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  detalhes TEXT,
  tipo transaction_type NOT NULL,
  categoria TEXT NOT NULL
);

-- Garantir compatibilidade com tabelas existentes que possam usar "user" ao invés de "user_id"
DO $$
DECLARE
  v_col_type TEXT;
BEGIN
  -- Adiciona ou renomeia a coluna para garantir que "user_id" exista
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transacoes'
      AND column_name = 'user_id'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'transacoes'
        AND column_name = 'user'
    ) THEN
      ALTER TABLE public.transacoes RENAME COLUMN "user" TO user_id;
    ELSE
      ALTER TABLE public.transacoes ADD COLUMN user_id UUID;
    END IF;
  END IF;

  -- Converte a coluna para UUID caso ainda não esteja nesse formato
  SELECT data_type
    INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'transacoes'
    AND column_name = 'user_id'
  LIMIT 1;

  IF v_col_type IS NOT NULL AND v_col_type <> 'uuid' THEN
    BEGIN
      ALTER TABLE public.transacoes
        ALTER COLUMN user_id TYPE UUID
        USING (
          CASE
            WHEN NULLIF(TRIM(user_id::text), '') IS NULL THEN NULL
            WHEN user_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (user_id::text)::uuid
            ELSE NULL
          END
        );
    EXCEPTION
      WHEN others THEN
        RAISE EXCEPTION 'Não foi possível converter a coluna user_id para UUID. Verifique os dados existentes antes de executar a migração.';
    END;
  END IF;

  -- Garante a restrição de chave estrangeira apenas se ainda não existir
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transacoes_user_id_fkey'
      AND conrelid = 'public.transacoes'::regclass
  ) THEN
    ALTER TABLE public.transacoes
      ADD CONSTRAINT transacoes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- Define NOT NULL somente quando todos os registros estiverem preenchidos
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transacoes'
      AND column_name = 'user_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.transacoes
    WHERE user_id IS NULL
  ) THEN
    ALTER TABLE public.transacoes
      ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;

-- Políticas para transações (apenas admins podem ver todas)
CREATE POLICY "Admins can view all transactions"
  ON public.transacoes FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert transactions"
  ON public.transacoes FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update transactions"
  ON public.transacoes FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete transactions"
  ON public.transacoes FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para criar profile automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_transacoes_user_id ON public.transacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_quando ON public.transacoes(quando);
CREATE INDEX IF NOT EXISTS idx_transacoes_tipo ON public.transacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_transacoes_categoria ON public.transacoes(categoria);
