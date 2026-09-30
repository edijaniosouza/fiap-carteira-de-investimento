# Plano — Investment Portfolio (Next.js monólito)

## Contexto

Projeto de MBA: sistema de gestão de investimentos pessoais definido em `.ai/architecture.md` (Entregável 1). Pasta vazia fora esse documento → greenfield. Objetivo: monólito Next.js (frontend + Route Handlers + middleware de sessão) sobre PostgreSQL, com catálogo de ativos (seed brapi + CSV Tesouro), carteiras, transações com validação de quantidade na linha do tempo, posições calculadas, cotações com cache de 30 min (brapi + BCB SGS) e simulador.

Decisões com usuário:
- Next.js (App Router, TypeScript) + **Prisma** + **PostgreSQL via Docker Compose**
- Auth **custom**: bcryptjs + JWT (`jose`) em cookie httpOnly
- Recuperação de senha **mock** (link logado no console)
- UI **Tailwind + shadcn/ui** (+ Recharts)
- Frontend: padrão **Presentational / Container** + **Redux Toolkit + RTK Query**
- Plano free: **1 portfolio por usuário** (constante configurável)
- **Terminologia em inglês** no código, modelos, endpoints e rotas (textos da UI continuam em pt-BR)
- **snake_case em tudo** (ver Convenções)
- **Sem testes automatizados** — verificação manual + lint/typecheck/build

## Convenções de nomenclatura

| Elemento | Padrão | Exemplo |
|---|---|---|
| Variáveis, funções, parâmetros, propriedades de objeto | snake_case | `unit_price`, `calculate_positions()` |
| Arquivos e pastas | snake_case | `market_data_service.ts`, `portfolio_card.tsx` |
| Campos Prisma, tabelas e colunas | snake_case (tabelas no plural via `@@map`) | `transactions.portfolio_id` |
| JSON de request/response, query params | snake_case | `?page=1&limit=20`, `{ average_price }` |
| Segmentos de rota (páginas e API) | snake_case | `/api/auth/forgot_password`, `/api/quotes/[asset_id]` |
| Constantes | UPPER_SNAKE_CASE | `FREE_PLAN_LIMITS`, `QUOTE_CACHE_TTL_MS` |
| Componentes React, types/interfaces, models/enums Prisma | PascalCase (obrigatório JSX / tipos) | `PortfolioCard`, `type PositionDto`, `model Transaction` |

**Exceções impostas por framework/lib** (documentar no README):
- React hooks mantêm `useXxx` (regra `rules-of-hooks` só reconhece `use[A-Z]`): `useAppDispatch`, `useAppSelector`, hooks gerados pelo RTK Query (`useGetPortfoliosQuery`) — por isso endpoints do RTK Query ficam em camelCase.
- Nomes reservados Next.js: `page.tsx`, `layout.tsx`, `route.ts`, `middleware.ts`, exports `GET/POST/PATCH/DELETE`, `generateMetadata`, props `params`/`searchParams`.
- APIs de libs (`createSlice`, `configureStore`, `reducerPath`, `zodResolver`…) e componentes gerados pelo shadcn em `components/ui/` (kebab-case, não editar nome).

Enforcement: ESLint `@typescript-eslint/naming-convention` (variable/function/parameter/property → snake_case; `UPPER_CASE` p/ const globais; `PascalCase` p/ typeLike e funções que retornam JSX; filtro liberando `^use[A-Z]`) + `eslint-plugin-check-file` p/ nomes de arquivos/pastas snake_case (ignorando `components/ui/**` e arquivos reservados Next).

## Estrutura de pastas

```
carteira de investimento/
├─ docker-compose.yml               # postgres:16, volume, porta 5432
├─ .env.example                     # DATABASE_URL, JWT_SECRET, BRAPI_TOKEN, APP_URL
├─ prisma/
│  ├─ schema.prisma
│  ├─ seed.ts                       # npm run seed (manual)
│  └─ data/treasury_prices.csv      # CSV Tesouro Transparente (baixado manualmente)
├─ src/
│  ├─ middleware.ts                 # (proxy.ts se Next 16) valida JWT
│  ├─ app/
│  │  ├─ (auth)/sign_in, sign_up, forgot_password, reset_password
│  │  ├─ (app)/layout.tsx           # StoreProvider + shell (sidebar/topbar)
│  │  ├─ (app)/dashboard, catalog, portfolios, portfolios/[id],
│  │  │        portfolios/[id]/transactions, simulator, profile
│  │  └─ api/...                    # Route Handlers (ver Endpoints)
│  ├─ store/                        # Redux
│  │  ├─ store.ts                   # make_store() por request (padrão RTK + App Router)
│  │  ├─ store_provider.tsx         # 'use client', cria store em useRef, hidrata sessão
│  │  ├─ hooks.ts                   # useAppDispatch, useAppSelector
│  │  ├─ api/base_api.ts            # createApi + fetchBaseQuery('/api'), tagTypes
│  │  ├─ api/{auth,catalog,portfolio,transaction,simulation,quote}_api.ts  # injectEndpoints
│  │  └─ slices/{session,ui,catalog_filters,simulator}_slice.ts
│  ├─ containers/                   # client components "smart": RTK Query + dispatch, sem markup de estilo
│  │  └─ dashboard_container.tsx, catalog_container.tsx, portfolio_list_container.tsx,
│  │     portfolio_detail_container.tsx, transaction_list_container.tsx,
│  │     transaction_form_container.tsx, simulator_container.tsx, profile_container.tsx,
│  │     auth/{sign_in,sign_up,forgot_password,reset_password}_container.tsx
│  ├─ components/                   # presentational "dumb": só props → UI, sem Redux/fetch
│  │  ├─ ui/                        # shadcn (gerado)
│  │  └─ portfolio/, catalog/, transaction/, simulator/, dashboard/, auth/, layout/
│  ├─ lib/
│  │  ├─ prisma.ts                  # singleton PrismaClient
│  │  ├─ auth/{jwt.ts,password.ts,session.ts}
│  │  ├─ http.ts                    # json_ok/json_error + with_validation(zod)
│  │  ├─ free_plan.ts               # FREE_PLAN_LIMITS = { max_portfolios: 1 }
│  │  ├─ format.ts                  # format_brl, format_percent, format_date (Intl pt-BR)
│  │  └─ validators/*.ts            # schemas zod por recurso (snake_case)
│  └─ services/                     # regra de negócio (usada pelos Route Handlers)
│     ├─ auth_service.ts
│     ├─ catalog_service.ts
│     ├─ portfolio_service.ts
│     ├─ transaction_service.ts
│     ├─ position_service.ts        # cálculo de posições (puro)
│     ├─ timeline_validation.ts     # quantidade nunca negativa (puro)
│     ├─ simulation_service.ts
│     └─ market/{market_data_service.ts, brapi_client.ts, bcb_client.ts}
```

Camadas backend: **Route Handler → zod → service → Prisma**.

## Frontend: Presentational / Container + Redux

- **Page (`page.tsx`, Server Component)**: só compõe layout e renderiza o container; lê `params`/`searchParams` e repassa. Sem fetch de dados de domínio (dados vêm via RTK Query no container → fonte única de estado).
- **Container (`'use client'`)**: usa hooks RTK Query (`useGetPortfolioQuery`, `useCreateTransactionMutation`…) e `useAppSelector`/`useAppDispatch`; mapeia estado → props; trata loading/erro/vazio; passa callbacks `on_submit`, `on_delete`, `on_page_change`.
- **Presentational**: função pura de props (`PortfolioSummaryCards`, `PositionsTable`, `AllocationPieChart`, `TransactionForm`, `CatalogTable`, `SimulationResult`…). Pode ter estado local de UI trivial (ex.: react-hook-form), nunca Redux nem fetch.
- **RTK Query (`base_api`)**: `tagTypes: ['Portfolio','Transaction','Position','Catalog','Quote','Profile']`; mutations de transação invalidam `Transaction`, `Position`, `Portfolio` (id); cookie httpOnly enviado automaticamente (`credentials: 'same-origin'`); `baseQuery` com interceptor: 401 → dispatch `session_slice.signed_out` + redirect `/sign_in`.
- **Slices**:
  - `session_slice`: `current_user` (hidratado no `StoreProvider` a partir de `get_session()` no layout server).
  - `ui_slice`: dialogs abertos (`transaction_dialog`, `confirm_delete`), toasts.
  - `catalog_filters_slice`: `type`, `q`, `page`, `limit` (sincronizado com query string).
  - `simulator_slice`: `asset_id`, `amount`, `months` do formulário.
- Store criado **por request** (`make_store`) dentro do provider client — padrão oficial RTK p/ App Router, evita vazar estado entre usuários.

## Modelo de dados (`prisma/schema.prisma`)

Enums: `AssetType { STOCK FII ETF BDR TREASURY CDB INDEX }`, `AssetSource { BRAPI BCB SEED }`, `TransactionType { BUY SELL }`, `Indexer { PRE CDI SELIC IPCA }`.

| Model → tabela | Campos (snake_case) |
|---|---|
| `User` → `users` | id (cuid), name, email @unique, password_hash, created_at |
| `PasswordResetToken` → `password_reset_tokens` | id, user_id, token_hash @unique, expires_at, used_at? |
| `Portfolio` → `portfolios` | id, user_id → users (cascade), name, created_at |
| `Asset` → `assets` | id, code @unique (ticker/código), name, type, source, indexer?, rate? (Decimal), maturity_date? |
| `Transaction` → `transactions` | id, portfolio_id (cascade), asset_id, type, quantity Decimal(20,8), unit_price Decimal(20,8), trade_date, created_at; índice (portfolio_id, asset_id, trade_date) |
| `Quote` → `quotes` | id, asset_id @unique, value Decimal, source, updated_at |

Índices CDI/Selic/IPCA = `Asset` tipo `INDEX`, source `BCB` (codes `CDI`, `SELIC`, `IPCA`) → reaproveitam `Quote` e cache. Busca ILIKE: `contains` + `mode: 'insensitive'` + índices em `code`/`name`. Decimals convertidos p/ `number`/string em mappers de DTO antes de serializar.

## Endpoints (Route Handlers em `src/app/api`)

Equivalentes em inglês dos endpoints do documento, + `reset_password` (2ª etapa do reset):

| Documento | Novo |
|---|---|
| `POST /api/auth/cadastro` | `POST /api/auth/sign_up` |
| `POST /api/auth/login` | `POST /api/auth/sign_in` (seta cookie `session`) |
| `POST /api/auth/logout` | `POST /api/auth/sign_out` |
| `POST /api/auth/recuperar-senha` | `POST /api/auth/forgot_password` (loga `APP_URL/reset_password?token=...`, sempre 200) |
| — | `POST /api/auth/reset_password` |
| `GET/PATCH /api/auth/perfil` | `GET/PATCH /api/auth/profile` (name, email, troca de senha c/ current_password) |
| `GET /api/catalogo?tipo=&q=&page=&limit=` | `GET /api/catalog?type=&q=&page=&limit=` → `{ items, page, limit, total }` (limit máx 50) |
| `GET/POST /api/carteiras` | `GET/POST /api/portfolios` (POST → **403** se `count >= FREE_PLAN_LIMITS.max_portfolios`) |
| `GET/PATCH/DELETE /api/carteiras/:id` | `GET/PATCH/DELETE /api/portfolios/[id]` (GET = visão consolidada) |
| `.../transacoes[/:transacaoId]` | `/api/portfolios/[id]/transactions[/[transaction_id]]` GET/POST/PATCH/DELETE |
| `.../posicoes` | `GET /api/portfolios/[id]/positions` |
| `POST /api/simulacoes` | `POST /api/simulations` |
| `GET /api/cotacoes/:ativoId` | `GET /api/quotes/[asset_id]` |

Recursos de portfolio checam **ownership** (`portfolio.user_id === session.user_id`, senão 404).

## Regras de negócio

**Sessão / middleware** — `jwt.ts` assina HS256 `{ sub, email }`, exp 7d, via `jose` (edge-compatible). Middleware protege páginas `(app)` (redirect `/sign_in`) e `/api/*` exceto `api/auth/{sign_up,sign_in,forgot_password,reset_password}` (401 JSON). `session.ts#get_session()` lê cookie em handlers/layout.

**Timeline validation** (`timeline_validation.ts`, puro) — recebe transações do par (portfolio, asset) com a mudança aplicada (create/update/delete), ordena por `trade_date` + `created_at`, acumula quantidade; saldo < 0 em algum ponto → 422 com data do conflito. Roda em `prisma.$transaction` antes de gravar. Edição que troca `asset_id` valida os dois ativos.

**Position calculation** (`position_service.ts`, puro, custo médio):
- BUY: `quantity += q; total_cost += q*p`
- SELL: `average_price = total_cost/quantity; realized_result += q*(p - average_price); total_cost -= q*average_price; quantity -= q`
- Saída por ativo: `quantity, average_price, total_cost, current_price, current_value, unrealized_result, realized_result, result_percent`; qtd 0 só com realizado.
- RV: `current_value = quantity × quote`. RF sem cotação de mercado: valor estimado acumulando taxa atual (CDI/Selic × rate, PRE, IPCA+rate) desde `trade_date` de cada compra — flag `is_estimated`.

**Portfolio summary** (`GET /portfolios/[id]`) — totais (`invested_total`, `current_total`, `result_total`), `allocation_by_type` (pizza), lista de posições.

**Market data + cache 30 min** (`market_data_service.ts#get_quote(asset)`):
1. lê `Quote`; se `updated_at` < 30 min (`QUOTE_CACHE_TTL_MS`) → retorna
2. senão busca fonte: brapi `GET https://brapi.dev/api/quote/{ticker}?token=BRAPI_TOKEN` (STOCK/FII/ETF/BDR) ou BCB SGS `https://api.bcb.gov.br/dados/serie/bcdata.sgs.{serie}/dados/ultimos/1?formato=json` (CDI anualizado 4389, Selic meta 432, IPCA 12m 13522)
3. upsert `Quote`; se API falhar retorna cache antigo com `is_stale: true`
- `get_quotes(assets[])` em lote (brapi aceita tickers separados por vírgula; fatiar conforme limite free). `fetch` com `cache: 'no-store'` (cache é o do banco).

**Simulation** (`POST /api/simulations` body `{ asset_id, amount, months }`, mock com taxa atual):
- RF/índice: taxa anual efetiva por indexer+rate e cotação atual do índice → juros compostos mensais; retorna `gross_value`, `earnings`, `income_tax` (regressivo 22,5/20/17,5/15%), `net_value`, `monthly_series`.
- RV: cotação atual → `share_quantity = floor(amount/price)`, `leftover`, `scenarios` mock (pessimistic/base/optimistic: -10%/+8%/+20% a.a.) projetados.

## Seed (`prisma/seed.ts`, `npm run seed`, manual)

1. `https://brapi.dev/api/quote/list` (paginado) → upsert `Asset` (brapi `type` stock/fund/bdr → STOCK/FII/BDR; ETF por lista conhecida) source BRAPI.
2. `prisma/data/treasury_prices.csv` (PrecoTaxaTesouroDireto, `;`, decimal `,`) → data base mais recente por título → upsert `Asset` TREASURY (indexer inferido do nome: Selic/IPCA+/Prefixado, rate, maturity_date) + `Quote` com PU, source SEED.
3. Índices CDI/SELIC/IPCA (source BCB) + CDBs exemplo ("CDB 100% CDI", "CDB 110% CDI", "CDB Pré 12%") source SEED.
4. Idempotente (upsert por `code`). Rodar com `tsx`; `prisma.seed` no `package.json`.

## Páginas (texto da UI em pt-BR)

- `(auth)`: `sign_in`, `sign_up`, `forgot_password`, `reset_password` → containers com mutations do `auth_api`; formulários presentational com react-hook-form + zod.
- `dashboard`: cards de totais, pizza de alocação, top posições. Sem portfolio → CTA "Criar carteira".
- `catalog`: tabs Renda Variável / Renda Fixa, busca c/ debounce, filtro type, paginação (`catalog_filters_slice` ↔ URL), ações "Registrar compra" e "Simular".
- `portfolios`: listar/criar/renomear/excluir (criar desabilitado + aviso ao atingir limite free).
- `portfolios/[id]`: visão consolidada + tabela de posições.
- `portfolios/[id]/transactions`: tabela + dialog criar/editar (combobox de ativo buscando `catalog`), excluir com confirmação; erro 422 da timeline exibido no form.
- `simulator`: ativo, valor, prazo → resultado + gráfico.
- `profile`: editar nome/email/senha, sign out.

## Ordem de execução

1. **Scaffold**: `create-next-app` (TS, App Router, Tailwind, ESLint, `src/`), shadcn init + componentes (button, input, form, card, table, dialog, tabs, select, command, sonner), deps (`prisma @prisma/client zod jose bcryptjs react-hook-form @hookform/resolvers recharts tsx @reduxjs/toolkit react-redux eslint-plugin-check-file`), regras ESLint de naming, `docker-compose.yml`, `.env.example`, `.gitignore`, `git init`.
2. **Banco**: `schema.prisma` (snake_case + `@@map`), `prisma migrate dev --name init`, `lib/prisma.ts`.
3. **Auth backend**: jwt/password/session, 7 endpoints, middleware.
4. **Redux base**: `make_store`, `store_provider`, `hooks`, `base_api`, `session_slice`, `ui_slice`; páginas/containers de auth.
5. **Seed + Market data**: clients brapi/BCB, `market_data_service`, seed, `GET /api/quotes/[asset_id]`.
6. **Catalog**: service + endpoint + `catalog_api` + `catalog_filters_slice` + container/presentational.
7. **Portfolios + Transactions**: timeline validation, positions, endpoints, limite free, `portfolio_api`/`transaction_api`, containers/presentationals.
8. **Dashboard / summary**.
9. **Simulation**: service + endpoint + `simulation_api` + `simulator_slice` + página.
10. **Profile + polimento**: loading/erro/vazio, `README.md` (setup + convenções + exceções de naming).

## Verificação

- `docker compose up -d` → `npx prisma migrate dev` → `npm run seed` (contagem de assets no `npx prisma studio`; conferir tabelas/colunas snake_case no Postgres).
- `npm run dev` e fluxo: sign_up → sign_in → `/dashboard` sem cookie redireciona p/ `/sign_in` → criar portfolio → 2º portfolio bloqueado (403 / botão desabilitado) → catalog busca "PETR" e filtro TREASURY → BUY 100 PETR4 → SELL 150 retorna 422 → editar compra antiga deixando saldo negativo retorna 422 → posições com average_price/resultado corretos (conferir à mão: 2 compras + 1 venda) → após mutation, tabela de posições atualiza sozinha (invalidação RTK Query) → 2ª cotação em < 30 min não chama brapi (log) → simulação CDB 110% CDI e ação → forgot_password loga link, reset_password funciona → profile edita nome.
- Redux DevTools: slices e cache RTK Query presentes; nenhum presentational importa `store/` (grep `from '@/store` em `src/components` → vazio).
- `curl` em `/api/*` sem cookie → 401; portfolio de outro usuário → 404; JSON de resposta em snake_case.
- `npm run lint` (naming rules sem violações), `npx tsc --noEmit`, `npm run build` sem erros.
