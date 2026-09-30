# Documento de Arquitetura — Entregável 1

## Projeto

Sistema de gestão de investimentos pessoais, permitindo ao usuário acompanhar rendas fixas e variáveis, montar e gerenciar carteiras, registrar suas transações e simular novos investimentos.

## Funcionalidades principais

- Exibição de listagem de rendas fixas e variáveis
- Listagem dos investimentos em posse
- Simulação de investimento
- Cadastro de investimentos
- Edição das carteiras
- Visão da carteira
- Login e Cadastro

## Tipos de usuário

### Usuário Comum (Free)

Único tipo de usuário do sistema:

- **Autenticação**: login, cadastro, recuperação de senha e edição de perfil
- **Carteiras**: criar, editar e excluir carteiras (com limites do plano gratuito)
- **Investimentos**: cadastrar, editar e excluir ativos (renda fixa e variável)
- **Visualização**: dashboard geral, listagens de investimentos em posse e separadas por tipo
- **Simulação**: acesso livre às simulações básicas

## Diagrama de arquitetura

```mermaid
flowchart LR

    user(["Usuário (browser)"])

    subgraph next["Next.js (monólito)"]
        direction LR
        fe["Páginas (Frontend)<br/>login, catálogo, carteira, transações, simulador"]
        mw["Middleware: valida sessão"]

        subgraph be["Route Handlers / Server Actions (Backend)"]
            direction LR
            auth["Auth: cadastro e login"]
            cat["Catálogo: busca e paginação"]
            sim["Simulação (mock, taxa atual)"]
            tx["Transações: criar, editar, excluir"]
            cart["Carteira: visão consolidada"]
            mkt["Market Data + cache (30 min)"]
            val["Validação: quantidade nunca negativa na linha do tempo"]
            pos["Cálculo de posições: quantidade, preço médio, resultado"]
        end

        fe --> mw
        mw -->|"requisição autenticada"| be
    end

    db[("PostgreSQL")]

    subgraph ext["Serviços externos (gratuitos)"]
        direction TB
        brapi["brapi.dev<br/>(plano gratuito)"]
        bcb["API SGS - Banco Central"]
    end

    seed[/"Script de seed<br/>(executado manualmente)"/]

    user --> fe
    tx -->|"valida antes de salvar"| val
    val -->|"grava transação"| db
    cart -->|"calcula"| pos
    pos -->|"lê transações"| tx
    cart -->|"cotações atuais"| mkt
    cat -->|"busca (ILIKE + LIMIT/OFFSET)"| db
    sim -->|"taxa atual"| mkt
    auth -->|"usuários"| db
    mkt -->|"lê/grava cache"| db
    mkt -.->|"ações, FIIs, ETFs"| brapi
    mkt -.->|"CDI, Selic, IPCA"| bcb
    seed -.-|"lista de ativos da B3"| brapi
    seed -.-|"salva catálogo + títulos do Tesouro (CSV)"| db

    classDef ator fill:#F5F5F5,stroke:#666666,color:#000000
    classDef frontend fill:#BBDEFB,stroke:#1565C0,color:#000000
    classDef middleware fill:#FFF9C4,stroke:#F9A825,color:#000000
    classDef backend fill:#E8F5E9,stroke:#2E7D32,color:#000000
    classDef integracao fill:#FFE0B2,stroke:#EF6C00,color:#000000
    classDef regra fill:#FCE4EC,stroke:#AD1457,color:#000000
    classDef db fill:#D1C4E9,stroke:#4527A0,color:#000000
    classDef externo fill:#FFCCBC,stroke:#BF360C,color:#000000
    classDef seed fill:#ECEFF1,stroke:#455A64,color:#000000
    classDef nextContainer fill:#E3F2FD,stroke:#1E88E5,stroke-dasharray: 5 5,color:#000000
    classDef extContainer fill:none,stroke:#9E9E9E,stroke-dasharray: 5 5,color:#000000

    class user ator
    class fe frontend
    class mw middleware
    class auth,cat,sim,tx,cart backend
    class mkt integracao
    class val,pos regra
    class db db
    class brapi,bcb externo
    class seed seed
    class next nextContainer
    class ext extContainer
```

## Entidades principais

| Entidade | Descrição | Atributos essenciais |
|---|---|---|
| **Usuário** | Conta do investidor | id, nome, email, senha (hash), criadoEm |
| **Carteira** | Agrupamento de investimentos de um usuário | id, usuarioId, nome, criadoEm |
| **Ativo** | Item do catálogo disponível para investir (renda fixa ou variável) | id, ticker/código, nome, tipo (ação, FII, ETF, Tesouro, CDB etc.), origem (brapi/BCB/seed) |
| **Transação** | Compra ou venda de um ativo dentro de uma carteira | id, carteiraId, ativoId, tipo (compra/venda), quantidade, preçoUnitário, data |
| **Cotação** | Cache de valores de mercado dos ativos | id, ativoId, valor, fonte (brapi/BCB), atualizadoEm |

> **Observação:** a posição consolidada de uma carteira (quantidade total, preço médio, resultado) não é uma entidade persistida — é **calculada** dinamicamente a partir das Transações, conforme indicado no diagrama (`cálculo de posições`).

## Endpoints da API

### Auth
- `POST /api/auth/cadastro`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/recuperar-senha`
- `GET /api/auth/perfil`
- `PATCH /api/auth/perfil`

### Catálogo
- `GET /api/catalogo?tipo=&q=&page=&limit=` — busca e paginação de ativos disponíveis (renda fixa/variável)

### Carteiras
- `GET /api/carteiras`
- `POST /api/carteiras`
- `GET /api/carteiras/:id` — visão consolidada (dashboard)
- `PATCH /api/carteiras/:id`
- `DELETE /api/carteiras/:id`

### Transações (investimentos dentro de uma carteira)
- `GET /api/carteiras/:id/transacoes`
- `POST /api/carteiras/:id/transacoes`
- `PATCH /api/carteiras/:id/transacoes/:transacaoId`
- `DELETE /api/carteiras/:id/transacoes/:transacaoId`
- `GET /api/carteiras/:id/posicoes` — posição consolidada (quantidade, preço médio, resultado)

### Simulação
- `POST /api/simulacoes` — simula um investimento com base na taxa/cotação atual

### Cotações (mercado)
- `GET /api/cotacoes/:ativoId` — cotação atual do ativo, com cache de 30 minutos

## Tecnologia definida

- **Frontend + Backend**: Next.js (monólito) — páginas React no frontend; Route Handlers/Server Actions no backend; middleware para validação de sessão
- **Banco de dados**: PostgreSQL (relacional, dados reais — não mockado)
- **Integrações externas**: brapi.dev (ações, FIIs, ETFs — plano gratuito) e API SGS do Banco Central (CDI, Selic, IPCA)
- **Carga inicial**: script de seed executado manualmente, populando o catálogo com a lista de ativos da B3 (via brapi) e títulos do Tesouro (via CSV)
