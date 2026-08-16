# Take-home — Pular entrega da semana

Aplicação desenvolvida em Next.js, TypeScript e MongoDB para listar as próximas entregas de um cliente e permitir o pulo de uma entrega respeitando regras de prazo, cota e status.

## Setup

Requisitos:

- Node 22+
- Docker
- Yarn

```bash
cp .env.example .env.local
docker compose up -d
yarn install
yarn seed
yarn dev
```

Aplicação:

```text
http://localhost:3000
```

Sanidade da API:

```text
http://localhost:3000/api/me
```

Outros comandos:

```bash
yarn test
yarn typecheck
yarn build
```

## Abordagem

Antes da implementação, tratei o enunciado como um contrato de produto e percorri o projeto existente para entender:

- regras obrigatórias e pontos deixados em aberto;
- cenários preparados no seed;
- modelo de domínio e estados das entregas;
- forma de autenticação fornecida pelo exercício;
- responsabilidades já resolvidas pela infraestrutura.

A partir disso, defini primeiro o comportamento esperado das regras de negócio e o contrato entre API e frontend.

A implementação foi organizada em três níveis:

```text
UI
↓
API / HTTP
↓
Operação de skip
↓
Regras de negócio
```

As regras temporais e de elegibilidade foram mantidas isoladas da camada HTTP para facilitar testes e evitar duplicação de lógica no frontend.

## Rotas implementadas

### GET `/api/deliveries`

Retorna as próximas quatro entregas do cliente autenticado, ordenadas por data.

Cada entrega contém também informações derivadas de elegibilidade:

```ts
canSkip
skipReason
```

A resposta também contém o resumo da cota:

```ts
skipAllowance: {
  used,
  remaining,
  limit
}
```

A elegibilidade é calculada no backend. O frontend apenas apresenta o resultado.

### POST `/api/deliveries/:id/skip`

Tenta pular uma entrega pertencente ao cliente autenticado.

O backend revalida todas as regras no momento da ação, independentemente do estado previamente apresentado pela interface.

Isso evita confiar em informações que podem ter ficado desatualizadas entre o carregamento da página e o clique.

## Decisões e premissas

### Horário de corte

O prazo foi interpretado como:

> até 2 dias antes da entrega, às 20h no horário de Brasília.

O horário das 20h foi tratado como inclusivo:

```text
19:59:59 → permitido
20:00:00 → permitido
20:00:01 → bloqueado
```

Essa interpretação foi escolhida para que o comportamento não seja desfavorável ou surpreendente para o cliente quando o produto comunica que a ação pode ser realizada "até às 20h".

As datas persistidas continuam em UTC. A conversão para `America/Sao_Paulo` ocorre apenas onde a regra de calendário exige essa interpretação.

### Janela de 8 semanas

A cota utiliza uma janela móvel baseada no instante registrado em `skippedAt`.

Um pulo conta enquanto estiver dentro das últimas 8 semanas.

Ao completar exatamente 8 semanas, ele deixa de consumir a cota.

Exemplo:

```text
Pulo realizado em 01/07 às 14:30
→ libera novamente a cota 8 semanas depois, às 14:30
```

O horário de corte das 20h não participa dessa regra, pois são conceitos independentes.

### Status das entregas

Uma nova operação de skip ocorre somente sobre uma entrega `SCHEDULED`.

Estados posteriores impedem a ação e recebem mensagens específicas na interface, por exemplo:

- `IN_PRODUCTION`
- `OUT_FOR_DELIVERY`
- `DELIVERED`

Entregas `CANCELLED` também não podem ser puladas.

### Idempotência

Há uma distinção intencional entre frontend e backend.

No frontend, uma entrega `SKIPPED` apresenta o botão desabilitado. Isso é uma decisão de experiência do usuário, evitando uma ação que não possui mais sentido na interface.

No backend, entretanto, uma nova chamada de skip para uma entrega já `SKIPPED` continua sendo aceita de forma idempotente:

- retorna sucesso;
- não altera `skippedAt`;
- não consome outra unidade da cota.

Essa garantia existe independentemente da interface, cobrindo situações como repetição de requisição, retry, múltiplas abas ou chamadas diretas à API.

### Concorrência

O update utiliza o estado `SCHEDULED` como parte do filtro da atualização.

Caso outra requisição modifique a entrega entre a leitura e o update, o estado atual é consultado novamente.

Se ela já tiver se tornado `SKIPPED`, a operação é tratada de forma idempotente.

### Plano do cliente

`STANDARD` e `CLOSED_PLAN` não interferem na elegibilidade porque o enunciado não associa o plano à regra de pulo.

Não foi criada uma regra adicional sem suporte no requisito.

## Frontend

A interface exibe:

- próximas quatro entregas;
- data;
- valor;
- status;
- disponibilidade da ação;
- motivo do bloqueio;
- quantidade de pulos restantes.

A UI também possui o seletor de clientes fornecido para facilitar a validação dos cenários do seed.

Após um skip, as entregas são carregadas novamente porque a operação pode alterar:

- o status da entrega;
- a quantidade de pulos restantes;
- a elegibilidade das demais entregas.

## Testes

Foram priorizados testes automatizados das regras com maior risco de erro.

### Regras de negócio

`skip-rules.test.ts`

Cobre, entre outros:

- cálculo do cutoff em Brasília;
- comportamento antes das 20h;
- comportamento exatamente às 20h;
- comportamento após as 20h;
- limite de dois pulos;
- fronteira exata das 8 semanas;
- estados de produção;
- entrega já pulada;
- entrega cancelada.

Esses testes são majoritariamente comportamentais: recebem um cenário e verificam o resultado esperado sem depender de HTTP ou banco de dados.

### Operação de skip

`skip-delivery.test.ts`

A operação foi extraída da rota HTTP para permitir testes isolados com a collection do MongoDB mockada.

Foram cobertos:

- skip de entrega elegível;
- idempotência;
- cota esgotada;
- entrega em produção;
- tentativa de operar entrega de outro cliente;
- atualização concorrente.

Essa camada possui também verificações mais próximas de caixa-branca, como o filtro utilizado no `updateOne`.

### Integração

Os principais fluxos foram validados manualmente executando a aplicação contra o MongoDB local e realizando chamadas reais à API.

Não foi criada uma suíte automatizada de integração API + MongoDB dentro do escopo do take-home.

## Estratégia de desenvolvimento

A implementação não seguiu TDD estrito em todo o projeto.

Entretanto, houve uma abordagem próxima de test-first nas regras de negócio: os cenários e fronteiras foram definidos antes da implementação, principalmente para horário de corte, janela de 8 semanas, cota e idempotência.

Os testes também serviram como rede de segurança durante a extração da operação de skip da camada HTTP.

## Trade-offs

Para manter o escopo compatível com o tempo do exercício:

- mantive o cliente HTTP fornecido no projeto;
- não adicionei React Query ou SWR;
- não criei camadas genéricas de repository/controller/service;
- não criei autenticação real;
- não alterei a estrutura do MongoDB;
- mantive a tela simples e sem componentização excessiva;
- não adicionei testes automatizados de integração com banco real.

A abstração foi concentrada onde havia regra de negócio relevante e comportamento que merecia teste.

## Possíveis melhorias

Com mais tempo, algumas evoluções possíveis seriam:

- testes automatizados de integração envolvendo API e MongoDB isolado;
- estratégia transacional ou atômica mais robusta para concorrência envolvendo a cota de pulos;
- feedback visual mais rico após uma operação;
- logs estruturados e observabilidade;
- extração gradual de componentes caso a interface cresça.

Uma melhoria de experiência particularmente útil seria indicar quando o próximo pulo ficará disponível.

Como a janela é móvel e baseada em `skippedAt`, essa informação pode ser derivada a partir do pulo ativo mais antigo dentro das últimas 8 semanas:

```text
nextAvailableAt = oldestActiveSkip.skippedAt + 8 semanas
```

Assim, em vez de informar apenas:

```text
0 pulos disponíveis
```

a interface poderia apresentar algo como:

```text
Seu próximo pulo ficará disponível em 3 de setembro.
```

Isso não altera a regra de negócio existente; apenas torna a cota mais previsível para o cliente.

## Uso de IA

Utilizei IA como apoio durante:

- leitura e discussão do enunciado;
- identificação de casos limítrofes;
- discussão das regras temporais;
- desenho inicial do contrato das APIs;
- revisão de estratégia de testes;
- sugestões de organização e apresentação da solução.

As decisões foram revisadas antes da implementação.

Algumas sugestões foram descartadas ou ajustadas quando não estavam alinhadas ao comportamento esperado do produto. Um exemplo foi a interpretação inicial de que exatamente às 20h o prazo estaria encerrado. Após revisar a experiência esperada para o cliente, optei por considerar 20:00:00 ainda dentro do prazo e bloquear somente após esse instante.

Também evitei adicionar abstrações ou bibliotecas sugeridas quando não traziam benefício suficiente para o escopo do exercício.