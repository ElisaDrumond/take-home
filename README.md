# Delivery Skip — Take-home

Aplicação desenvolvida em Next.js, TypeScript e MongoDB para listar as próximas entregas de um cliente e permitir o pulo de uma entrega respeitando regras de prazo, cota e status.

> Este repositório nasceu de um take-home com limite de 4 horas. O enunciado original foi preservado em [`CHALLENGE.md`](./CHALLENGE.md). Este README documenta a solução, as decisões e os trade-offs.

## O problema

A aplicação precisa permitir que um cliente pule uma entrega sem quebrar três regras principais:

- o pedido só pode ser pulado até 2 dias antes da entrega, às 20h no horário de Brasília;
- cada cliente pode usar no máximo 2 pulos em uma janela móvel de 8 semanas;
- pedidos em produção ou em estados posteriores não podem ser pulados.

A repetição da mesma operação sobre uma entrega já pulada deve ser idempotente.

## Stack

- Next.js 14 — Pages Router
- TypeScript
- MongoDB
- Jest
- date-fns / date-fns-tz
- Docker para o MongoDB local

## Arquitetura

Antes da implementação, tratei o enunciado como um contrato de produto e separei o fluxo em camadas com responsabilidades diferentes:

```text
UI
↓
API / HTTP
↓
Operação de skip
↓
Regras de negócio
```

As regras temporais e de elegibilidade ficam isoladas da camada HTTP. A API revalida as regras no momento da ação e o frontend apenas apresenta o resultado devolvido pelo backend.

Principais arquivos:

```text
src/lib/skip-rules.ts       regras puras de elegibilidade e tempo
src/lib/skip-delivery.ts    coordenação da operação e persistência
src/pages/api/deliveries    contrato HTTP
src/lib/serializers.ts      documentos do banco -> DTOs da API
__tests__/                  testes das regras e da operação
```

## Rotas

### `GET /api/deliveries`

Retorna as próximas quatro entregas do cliente autenticado, já acompanhadas da elegibilidade calculada no backend:

```ts
canSkip
skipReason
```

A resposta inclui também o resumo da cota:

```ts
skipAllowance: {
  used,
  remaining,
  limit
}
```

### `POST /api/deliveries/:id/skip`

Tenta pular uma entrega pertencente ao cliente autenticado.

A operação revalida todas as regras, mesmo que a tela tenha mostrado anteriormente que o pedido era elegível. Isso evita confiar em estado que pode ter ficado desatualizado entre o carregamento da página e o clique.

## Decisões de domínio

### Horário de corte

O prazo foi interpretado como “até 2 dias antes da entrega, às 20h em Brasília”. O instante das 20:00:00 foi tratado como inclusivo:

```text
19:59:59 → permitido
20:00:00 → permitido
20:00:01 → bloqueado
```

As datas persistidas continuam em UTC. A conversão para `America/Sao_Paulo` ocorre apenas onde a regra de calendário exige essa interpretação.

O relógio (`now`) é recebido como dependência nas funções de negócio. Isso deixa os cenários temporais determinísticos e testáveis sem depender do horário real da máquina.

### Janela de 8 semanas

A cota utiliza uma janela móvel baseada no instante registrado em `skippedAt`.

Um pulo conta enquanto estiver dentro das últimas 8 semanas. Ao completar exatamente 8 semanas, deixa de consumir a cota.

### Status

Uma nova operação de skip ocorre somente sobre `SCHEDULED`.

Estados posteriores ou incompatíveis recebem razões específicas, como:

- `IN_PRODUCTION`
- `OUT_FOR_DELIVERY`
- `DELIVERED`
- `CANCELLED`

### Idempotência

Há uma distinção intencional entre interface e backend.

Na UI, uma entrega `SKIPPED` apresenta o botão desabilitado. No backend, uma nova chamada para a mesma entrega continua sendo aceita de forma idempotente:

- retorna o estado atual;
- preserva `skippedAt`;
- não consome outra unidade da cota.

Isso cobre retries, múltiplas abas e chamadas diretas à API.

### Concorrência

O `updateOne` exige que a entrega ainda esteja em `SCHEDULED` no momento da escrita.

Se outra requisição modificar a mesma entrega entre a leitura e o update, o estado é consultado novamente. Se ela já estiver `SKIPPED`, a operação é tratada como idempotente.

Essa proteção resolve concorrência sobre **a mesma entrega**, mas não garante atomicidade completa da **cota global** quando duas entregas diferentes são puladas ao mesmo tempo. Uma estratégia transacional ou outra modelagem atômica da cota ficou fora do escopo de 4 horas e é uma evolução arquitetural intencional para estudo posterior.

## Frontend

A interface exibe:

- próximas quatro entregas;
- data e valor;
- status;
- disponibilidade da ação;
- motivo do bloqueio;
- quantidade de pulos restantes.

Após um skip, a lista é consultada novamente porque a operação pode alterar o status da entrega, a cota restante e a elegibilidade das demais entregas.

O cliente HTTP simples fornecido pelo exercício foi mantido. Para um produto maior, server-state, cancelamento de requests e cache seriam candidatos naturais a uma solução como SWR ou TanStack Query.

## Testes

Foram priorizadas as regras com maior risco de erro.

### Regras de negócio

`skip-rules.test.ts` cobre, entre outros:

- cálculo do cutoff em Brasília;
- antes, exatamente no instante e depois das 20h;
- limite de dois pulos;
- fronteira exata das 8 semanas;
- estados de produção e estados finais;
- entrega já pulada.

### Operação de skip

`skip-delivery.test.ts` cobre:

- skip de entrega elegível;
- idempotência;
- cota esgotada;
- entrega em produção;
- isolamento entre clientes;
- atualização concorrente da mesma entrega.

A operação foi extraída da rota HTTP para permitir testes isolados com a collection do MongoDB mockada.

Não foi criada uma suíte automatizada de integração API + MongoDB dentro do limite do exercício.

## Trade-offs do limite de 4 horas

Para manter o escopo controlado:

- não adicionei React Query ou SWR;
- não criei camadas genéricas de repository/controller/service;
- não implementei autenticação real;
- não alterei a modelagem do MongoDB;
- mantive a tela simples e sem componentização excessiva;
- não adicionei testes automatizados com banco real;
- concentrei abstração apenas onde havia regra de negócio relevante.

## Evoluções que eu faria em um produto real

- tornar a cota de pulos robusta contra concorrência entre entregas diferentes;
- modelar estados do domínio de forma a reduzir combinações inválidas no TypeScript;
- adicionar testes de integração com MongoDB isolado;
- introduzir cancelamento de requests e uma estratégia explícita para server state no frontend;
- adicionar logs estruturados e observabilidade;
- informar quando o próximo pulo ficará disponível.

A última informação pode ser derivada do pulo ativo mais antigo na janela:

```text
nextAvailableAt = oldestActiveSkip.skippedAt + 8 semanas
```

## Setup

Requisitos:

- Node 18.18+
- Docker
- Yarn

```bash
cp .env.example .env.local
docker compose up -d
yarn install
yarn seed
yarn dev
```

Aplicação: `http://localhost:3000`

```bash
yarn test
yarn typecheck
yarn build
```

## Uso de IA

IA foi utilizada como apoio na leitura do enunciado, identificação de casos limítrofes, discussão das regras temporais, desenho inicial das APIs e revisão da estratégia de testes.

As decisões foram revisadas antes da implementação. Sugestões que aumentavam complexidade sem benefício suficiente para o limite do exercício foram descartadas. Uma interpretação inicial de que exatamente às 20h o prazo já estaria encerrado também foi rejeitada após revisar a experiência esperada para o cliente.
