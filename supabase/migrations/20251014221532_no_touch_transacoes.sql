-- ===== Enums/roles básicos (se ainda não existem) =====
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='Admins can view all roles') THEN
    CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='Users can view own roles') THEN
    CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- ===== Vínculo opcional WhatsApp ↔ user_id (não obrigatório para n8n) =====
CREATE TABLE IF NOT EXISTS public.whatsapp_links (
  whatsapp_jid TEXT PRIMARY KEY,           -- ex.: 5511999999999@s.whatsapp.net
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.whatsapp_links ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_whatsapp_links_user_id ON public.whatsapp_links(user_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='whatsapp_links' AND policyname='Admins can view all JID links') THEN
    CREATE POLICY "Admins can view all JID links" ON public.whatsapp_links FOR SELECT
    USING (public.has_role(auth.uid(),'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='whatsapp_links' AND policyname='Users can view own JID links') THEN
    CREATE POLICY "Users can view own JID links" ON public.whatsapp_links FOR SELECT
    USING (auth.uid()=user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='whatsapp_links' AND policyname='Users can insert own JID links') THEN
    CREATE POLICY "Users can insert own JID links" ON public.whatsapp_links FOR INSERT
    WITH CHECK (auth.uid()=user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='whatsapp_links' AND policyname='Users can delete own JID links') THEN
    CREATE POLICY "Users can delete own JID links" ON public.whatsapp_links FOR DELETE
    USING (auth.uid()=user_id);
  END IF;
END $$;

-- ===== Função de autorização por JID (sem tocar no schema de transacoes) =====
CREATE OR REPLACE FUNCTION public.can_access_transacao(_uid UUID, _jid TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    public.has_role(_uid,'admin')
    OR EXISTS (SELECT 1 FROM public.whatsapp_links wl WHERE wl.user_id=_uid AND wl.whatsapp_jid=_jid)
$$;

-- ===== Policies na TABELA EXISTENTE public.transacoes (usando coluna "user") =====
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Admin full
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transacoes' AND policyname='Admins can view all transactions') THEN
    CREATE POLICY "Admins can view all transactions" ON public.transacoes FOR SELECT
    USING (public.has_role(auth.uid(),'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transacoes' AND policyname='Admins can insert transactions') THEN
    CREATE POLICY "Admins can insert transactions" ON public.transacoes FOR INSERT
    WITH CHECK (public.has_role(auth.uid(),'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transacoes' AND policyname='Admins can update transactions') THEN
    CREATE POLICY "Admins can update transactions" ON public.transacoes FOR UPDATE
    USING (public.has_role(auth.uid(),'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transacoes' AND policyname='Admins can delete transactions') THEN
    CREATE POLICY "Admins can delete transactions" ON public.transacoes FOR DELETE
    USING (public.has_role(auth.uid(),'admin'));
  END IF;

  -- Usuário comum via JID (sem user_id na tabela)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transacoes' AND policyname='Users can view own transactions via JID') THEN
    CREATE POLICY "Users can view own transactions via JID" ON public.transacoes FOR SELECT
    USING (public.can_access_transacao(auth.uid(), "user"));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transacoes' AND policyname='Users can insert transactions via JID') THEN
    CREATE POLICY "Users can insert transactions via JID" ON public.transacoes FOR INSERT
    WITH CHECK (public.can_access_transacao(auth.uid(), "user"));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transacoes' AND policyname='Users can update transactions via JID') THEN
    CREATE POLICY "Users can update transactions via JID" ON public.transacoes FOR UPDATE
    USING (public.can_access_transacao(auth.uid(), "user"));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transacoes' AND policyname='Users can delete transactions via JID') THEN
    CREATE POLICY "Users can delete transactions via JID" ON public.transacoes FOR DELETE
    USING (public.can_access_transacao(auth.uid(), "user"));
  END IF;
END $$;

-- ===== Índices úteis SEM tocar em user_id =====
CREATE INDEX IF NOT EXISTS idx_transacoes_user_jid ON public.transacoes("user");
CREATE INDEX IF NOT EXISTS idx_transacoes_quando    ON public.transacoes("quando");
CREATE INDEX IF NOT EXISTS idx_transacoes_tipo      ON public.transacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_transacoes_categoria ON public.transacoes(categoria);

-- (Opcional) número sem sufixo para filtros
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='transacoes' AND column_name='phone_e164'
  ) THEN
    ALTER TABLE public.transacoes
      ADD COLUMN phone_e164 TEXT GENERATED ALWAYS AS (regexp_replace("user",'[^0-9]','','g')) STORED;
    CREATE INDEX IF NOT EXISTS idx_transacoes_phone_e164 ON public.transacoes(phone_e164);
  END IF;
END $$;
