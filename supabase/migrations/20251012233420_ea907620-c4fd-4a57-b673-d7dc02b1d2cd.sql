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
CREATE TABLE public.transacoes (
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
CREATE INDEX idx_transacoes_user_id ON public.transacoes(user_id);
CREATE INDEX idx_transacoes_quando ON public.transacoes(quando);
CREATE INDEX idx_transacoes_tipo ON public.transacoes(tipo);
CREATE INDEX idx_transacoes_categoria ON public.transacoes(categoria);