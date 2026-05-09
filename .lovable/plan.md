# Painel Superadmin

Criar um nível de acesso acima de admin (agência) para você (dionemoney1@gmail.com) acompanhar o crescimento do app e, no futuro, cobrar assinaturas.

## 1. Backend (banco de dados)

- Adicionar valor `superadmin` ao enum `app_role`.
- Criar conta auth para `dionemoney1@gmail.com` com a senha informada e inserir em `user_roles` com role `superadmin`.
- Criar tabela `agency_subscriptions` (preparar futuro):
  - `company_id` (FK lógica para companies)
  - `status` (`trial` | `active` | `inactive` | `canceled`) — default `trial`
  - `plan` (texto, ex: `free`, `starter`, `pro`) — default `free`
  - `started_at`, `current_period_end`, `canceled_at`
  - `monthly_amount` (numeric, default 0)
- Criar tabela `link_clicks` para rastrear cliques em links de divulgação:
  - `source` (texto, ex: `instagram`, `whatsapp`)
  - `campaign` (texto opcional)
  - `referrer`, `user_agent`, `ip_hash`
  - `created_at`
- Criar tabela `agency_activity` (opcional/leve): registra `last_seen_at` por company para distinguir ativo vs inativo. Alternativa mais barata: derivar atividade de `trips.updated_at` / `bookings.created_at` recentes.
- RLS: todas as tabelas novas só permitem leitura/escrita para `has_role(auth.uid(), 'superadmin')`. Superadmin também ganha policies de SELECT em `companies`, `user_companies`, `user_roles`, `profiles`, `bookings`, `trips`, `coupons`, `promotions` para enxergar tudo.
- Função `is_superadmin()` SECURITY DEFINER para reuso.

## 2. Frontend

- Atualizar `AuthContext` para reconhecer role `superadmin`.
- Atualizar `AppLayout` para aceitar `requiredRole="superadmin"`.
- Novo `SuperAdminSidebar` (ou estender `AppSidebar`) com itens:
  - Visão geral
  - Agências (ativas / inativas)
  - Assinaturas (placeholder com estrutura pronta)
  - Cliques & campanhas
  - Configurações
- Novas rotas em `/superadmin`:
  - `/superadmin` → Dashboard (KPIs: total de agências, ativas últimos 30d, inativas, total clientes, total reservas, total receita transacionada, cliques no link total/7d/30d).
  - `/superadmin/agencies` → tabela com nome, e-mail admin, plano, status, criada em, última atividade, nº de clientes, nº de viagens. Ação: ativar/desativar, editar plano.
  - `/superadmin/subscriptions` → lista de `agency_subscriptions` com filtros por status/plano. Botões: criar/editar plano (preparado para Stripe futuramente).
  - `/superadmin/clicks` → gráfico de cliques por dia + tabela por `source/campaign`. Endpoint público (`/r/:source`) que registra clique e redireciona para `/register`.
  - `/superadmin/settings` → futuro.
- Atualizar `Index.tsx` para redirecionar superadmin para `/superadmin`.
- Tela de login normal funciona — basta logar com o e-mail.

## 3. Tracking de cliques

- Rota pública `/r/:source` que faz `INSERT` em `link_clicks` (via edge function `track-click` para não expor RLS) e redireciona para `/register?ref=:source`.
- Edge function `track-click` recebe `source`, `campaign`, lê `referrer` e `user-agent`, faz hash do IP.

## 4. Métricas calculadas

- "Ativa": company com pelo menos 1 evento (trip criada, booking, login admin) nos últimos 30 dias.
- "Inativa": sem eventos há > 30 dias.
- Tudo agregado via queries no dashboard (sem materialized views por enquanto).

## 5. Preparação para cobrança futura

- Estrutura de `agency_subscriptions` já compatível com Stripe (campo `plan`, `status`, `current_period_end`).
- Quando você quiser ativar pagamento: integramos Stripe via Lovable Payments e ligamos webhook que atualiza essa tabela.

## Detalhes técnicos

- Criar a conta auth do superadmin via SQL na migration usando `supabase_auth_admin` não é possível direto; em vez disso, criamos a role e o registro em `user_roles` por e-mail conhecido, e você se cadastra normalmente em `/register` com `dionemoney1@gmail.com` + a senha. Um trigger `on_auth_user_created` detecta esse e-mail e insere `superadmin` em `user_roles` automaticamente. Alternativa: rodar `supabase.auth.admin.createUser` numa edge function one-shot com a senha do secret.
- Vou usar a alternativa da edge function `bootstrap-superadmin` (rodada uma vez) para já criar a conta com a senha informada — assim você não precisa registrar manualmente.
- A senha será armazenada como secret `SUPERADMIN_PASSWORD` (não fica em código).
