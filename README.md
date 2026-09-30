# Minha Carteira — gestão de investimentos pessoais

Monólito **Next.js 16** (App Router) que implementa o [documento de arquitetura](.ai/architecture.md):
catálogo de ativos (renda fixa e variável), carteiras, transações com validação da linha do tempo,
posição consolidada calculada, cotações com cache de 30 min e simulador.

| Camada | Tecnologia |
|---|---|
| Frontend | React 19, Tailwind 4, shadcn/ui (Base UI), Recharts, react-hook-form + zod |
| Estado | Redux Toolkit + RTK Query (padrão Presentational / Container) |
| Backend | Route Handlers (`src/app/api`) + `proxy.ts` (antigo middleware) validando a sessão |
| Auth | bcryptjs + JWT HS256 (`jose`) em cookie httpOnly |
| Banco | PostgreSQL + Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Integrações | brapi.dev (ações, FIIs, ETFs, BDRs) e API SGS do Banco Central (CDI, Selic, IPCA) |

## Como rodar

Pré-requisitos: Node 20+ e PostgreSQL (Docker **ou** `npx prisma dev`).

```bash
npm install                 # também roda "prisma generate"
cp .env.example .env        # ajuste JWT_SECRET (e BRAPI_TOKEN, opcional)
```

Banco — escolha uma opção:

```bash
docker compose up -d        # Postgres 16 em localhost:5432 (URL já está no .env.example)
```

```bash
npx prisma dev --name investment_portfolio --detach   # sem Docker: Postgres local do Prisma
# copie a URL "postgres://..." exibida para DATABASE_URL no .env
```

> O `prisma dev` atende bem um processo por vez: rode o seed com o `npm run dev` parado
> (com o app aberto durante o seed podem ocorrer erros `08P01` temporários). Com Docker não há essa limitação.

Migrations, carga inicial e app:

```bash
npx prisma migrate dev      # cria as tabelas
npm run seed                # carga manual do catálogo (~3 min)
npm run dev                 # http://localhost:3000
```

### Seed (carga manual)

`prisma/seed.ts` é idempotente (upsert por `code`):

1. **Ativos da B3** via `brapi.dev/api/quote/list` (funciona sem token; ignora mercado fracionário). Sem internet, usa uma amostra fixa.
2. **Tesouro Direto** a partir de `prisma/data/treasury_prices.csv`. Baixe manualmente o arquivo
   *PrecoTaxaTesouroDireto.csv* no portal [Tesouro Transparente](https://www.tesourotransparente.gov.br/ckan/dataset/taxas-dos-titulos-ofertados-pelo-tesouro-direto)
   e salve com esse nome. Sem o arquivo, são criados 3 títulos de exemplo.
3. **Índices** CDI, Selic e IPCA com a taxa atual do BCB (SGS 4389, 432 e 13522).
4. **CDBs de exemplo** (100% CDI, 110% CDI, Pré 12%, IPCA + 6%).

### Scripts

| Script | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint, incluindo as regras de nomenclatura |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm run seed` | Carga manual do catálogo |
| `npm run db:migrate` / `db:studio` | Prisma migrate / Prisma Studio |

## Arquitetura

```
src/
├─ proxy.ts                # valida o JWT: páginas → redirect /sign_in, /api → 401
├─ app/
│  ├─ (auth)/              # sign_in, sign_up, forgot_password, reset_password
│  ├─ (app)/               # dashboard, catalog, portfolios, portfolios/[id](/transactions), simulator, profile
│  └─ api/                 # Route Handlers (contrato da API)
├─ services/               # regras de negócio (Route Handler → zod → service → Prisma)
│  ├─ timeline_validation.ts   # quantidade nunca negativa na linha do tempo (função pura)
│  ├─ position_service.ts      # posição por custo médio (função pura)
│  ├─ fixed_income.ts          # taxa efetiva por indexador, IR regressivo
│  └─ market/                  # brapi, BCB e cache de cotações (30 min, no banco)
├─ store/                  # Redux: store por sessão, slices e RTK Query (injectEndpoints)
├─ containers/             # componentes "smart": RTK Query + dispatch, sem estilo próprio
├─ components/             # componentes de apresentação: só props → UI (ui/ = shadcn)
├─ lib/                    # prisma, auth, http, validators (zod), formatação
└─ types/api.ts            # DTOs compartilhados entre API e frontend (snake_case)
```

- **Páginas** (Server Components) só leem `params`/`searchParams` e renderizam um container.
- **Containers** usam hooks do RTK Query e `useAppSelector`/`useAppDispatch`, tratam loading/erro/vazio e passam dados e callbacks (`on_submit`, `on_delete`...).
- **Presentational** nunca importam `@/store` nem fazem fetch.
- **RTK Query** invalida por tags: uma mutation de transação invalida `Transaction`, `Position` e `Portfolio`, e as telas se atualizam sozinhas. Um 401 `UNAUTHORIZED` limpa a sessão e redireciona para o login.
- **Slices**: `session` (usuário atual, hidratado pelo layout raiz), `ui` (dialogs, compra vinda do catálogo, exclusões pendentes), `catalog_filters` (filtros lembrados entre páginas e espelhados na URL), `simulator`.

### Endpoints

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/sign_up` · `sign_in` · `sign_out` | Cadastro, login (cookie `session`) e logout |
| POST | `/api/auth/forgot_password` · `reset_password` | Recuperação de senha (link **logado no console** do servidor) |
| GET/PATCH | `/api/auth/profile` | Perfil (e-mail/senha exigem `current_password`) |
| GET | `/api/catalog?type=&q=&page=&limit=` | Busca paginada (`type` aceita lista separada por vírgula) |
| GET/POST | `/api/portfolios` | Lista e cria (plano free: **1 carteira**, senão 403) |
| GET/PATCH/DELETE | `/api/portfolios/[id]` | Visão consolidada / renomear / excluir |
| GET/POST | `/api/portfolios/[id]/transactions` | Lista e cria transações |
| PATCH/DELETE | `/api/portfolios/[id]/transactions/[transaction_id]` | Edita/exclui (422 se a quantidade ficar negativa) |
| GET | `/api/portfolios/[id]/positions` | Posições (quantidade, preço médio, resultado) |
| POST | `/api/simulations` | Simulação com taxa/cotação atual |
| GET | `/api/quotes/[asset_id]` | Cotação atual com cache de 30 min |

Erros seguem `{ "error": { "code", "message", "details?" } }`. Portfolios de outro usuário respondem 404.

### Regras de negócio

- **Linha do tempo**: transações do mesmo ativo são ordenadas por data (compras antes de vendas no mesmo dia); criar, editar ou excluir é rejeitado com 422 se o saldo ficar negativo em qualquer ponto. A validação roda numa transação do banco com `SELECT ... FOR UPDATE` na carteira.
- **Posição**: custo médio. Venda gera resultado realizado e não altera o preço médio.
- **Preço atual**: renda variável usa a cotação (brapi); Tesouro usa o PU do CSV; CDB (e Tesouro sem PU) é **estimado** pela taxa atual do indexador desde a data média de compra. Se a fonte falhar, usa-se a última cotação salva (`STALE`).
- **Simulação**: renda fixa com juros compostos mensais + IR regressivo; renda variável calcula a quantidade comprável e três cenários ilustrativos (-10%, +8%, +20% a.a.).

## Convenções de nomenclatura

Código, modelos, rotas e endpoints em **inglês**; textos da interface em **pt-BR**.

| Elemento | Padrão | Exemplo |
|---|---|---|
| Variáveis, funções, parâmetros, propriedades | snake_case | `unit_price`, `calculate_positions()` |
| Arquivos e pastas | snake_case | `market_data_service.ts`, `portfolio_card.tsx` |
| Tabelas e colunas | snake_case (tabelas no plural via `@@map`) | `transactions.portfolio_id` |
| JSON e query params | snake_case | `{ "average_price": 35 }` |
| Segmentos de rota | snake_case | `/api/auth/forgot_password` |
| Constantes | UPPER_SNAKE_CASE | `QUOTE_CACHE_TTL_MS` |
| Componentes, types, models/enums Prisma | PascalCase | `PositionsTable`, `PositionDto` |

**Exceções impostas por framework/biblioteca**

- Hooks mantêm `useXxx` (a regra *Rules of Hooks* só reconhece `use[A-Z]`): `useAppDispatch`, `useDebouncedValue` e os hooks gerados pelo RTK Query — por isso os **nomes de endpoints do RTK Query são camelCase** (`getPortfolios` → `useGetPortfoliosQuery`).
- Nomes reservados do Next.js: `page.tsx`, `layout.tsx`, `route.ts`, `proxy.ts`, exports `GET/POST/PATCH/DELETE`, props `params`/`searchParams` (renomeadas na desestruturação: `searchParams: search_params`).
- Chaves de objetos passados a bibliotecas (`initialState`, `reducerPath`, `httpOnly`, `orderBy`...) e props JSX de componentes de terceiros (`className`, `onClick`).
- Componentes gerados pelo shadcn em `src/components/ui/` (kebab-case) e `src/lib/utils.ts`.

As regras são verificadas por `npm run lint` (`@typescript-eslint/naming-convention` + `eslint-plugin-check-file`).
