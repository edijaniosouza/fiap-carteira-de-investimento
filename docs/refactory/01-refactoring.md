## Contexto

Atue como um engenheiro de software senior e efetue as seguintes refatorações refatorações:

#: 1
Smell: round_money duplicado, e a mesma conta feita à mão
Onde: portfolio_service.ts:32, simulation_service.ts:28, transaction_service.ts:32
────────────────────────────────────────
#: 2
Smell: QUANTITY_EPSILON = 1e-8 definido duas vezes
Onde: position_service.ts:18, timeline_validation.ts:16
────────────────────────────────────────
#: 3
Smell: asset.rate == null ? null : Number(asset.rate) repetido 3 vezes
Onde: catalog_service.ts:17, portfolio_service.ts:132, simulation_service.ts:43
────────────────────────────────────────
#: 4
Smell: .toISOString().slice(0, 10) espalhado
Onde: catalog_service, transaction_service (2x), portfolio_validators
────────────────────────────────────────
#: 5
Smell: Magic numbers
Onde: fixed_income.ts:41 (24*60*60*1000), simulation_service.ts:38 (/12), fixed_income.ts:46-49 (180/360/720 e alíquotas), round_quantity (1e8)faixas)
────────────────────────────────────────
#: 6
Smell: Objeto "preço indisponível" duplicado
Onde: portfolio_service.ts:144 e :197
────────────────────────────────────────
#: 7
Smell: Duas consultas ao banco para a mesma carteira (get_owned_portfolio e depois findUniqueOrThrow)
Onde: portfolio_service.ts:229-234
────────────────────────────────────────
#: 8
Smell: Condição input.email && input.email !== user.email repetida
Onde: auth_service.ts:117 e :127
────────────────────────────────────────
#: 9
Smell: Ternário aninhado no comparator
Onde: timeline_validation.ts:26(a, b)
────────────────────────────────────────
#: 10
Smell: Mensagem e erro EMAIL_IN_USE duplicados
Onde: auth_service.ts:34 e :130

## Regras
- Não altere nehum teste unitário exceto em caso de mudança de nomenclatura ou pacotes