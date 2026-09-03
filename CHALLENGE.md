# Take-home — Pular entrega da semana

Esqueleto pronto: Next.js, Mongo, seed, auth falsa e Jest já configurados.
Você não deve gastar tempo com setup.

**Tempo: 4h.** O teto é real e a avaliação considera esse limite. Se estourar, pare e
escreva no README o que ficou faltando — isso não desconta nota.

---

## Setup

Requisitos: Node 18.18+ e Docker.

```bash
cp .env.example .env.local
docker compose up -d     # sobe o Mongo local
yarn install
yarn seed                # popula dados fictícios
yarn dev                 # http://localhost:3000
```

Sanidade: http://localhost:3000/api/me deve devolver a Ana.

Outros comandos: `yarn test`, `yarn typecheck`, `yarn build`.

## Stack

Next.js (Pages Router) · TypeScript · MongoDB · Jest · yarn.
API em `src/pages/api`. Sem GraphQL neste exercício.

## Autenticação (falsa)

O cliente autenticado vem do header `x-customer-id`. **Isso não é auth** — é um atalho
para você não perder tempo com login. Trate o retorno de `getCurrentCustomer` como se
viesse de um token já validado: é a única fonte confiável de quem está chamando.

Na tela tem um seletor de cliente. Em chamada direta, mande o header.

## Dados do seed

Todos fictícios. As datas são relativas ao momento em que você roda o seed.

| Cliente | Plano | Cidade | Situação |
|---|---|---|---|
| `cus_ana` | STANDARD | São Paulo | 1 pulo na janela atual |
| `cus_bruno` | CLOSED_PLAN | Campinas | 2 pulos na janela atual |
| `cus_carla` | STANDARD | São Paulo | 1 pulo, fora da janela (70 dias atrás) |

Entregas da Ana, uma para cada caso:

| Quando | Status | Cenário |
|---|---|---|
| −7d | DELIVERED | histórico |
| +1d | SCHEDULED | prazo de corte já passou |
| +2d | SCHEDULED | **limítrofe de propósito**: o corte é hoje às 20h |
| +3d | IN_PRODUCTION | dentro do prazo, mas já em produção |
| +10d | SCHEDULED | pode pular |
| +17d | SKIPPED | já pulada |
| +24d | SCHEDULED | pode pular |

`yarn seed` pode rodar quantas vezes quiser: limpa e recria tudo.

---

## O que implementar

### 1. Listar as próximas entregas

As próximas 4 entregas do cliente autenticado.

### 2. Pular uma entrega

**Regras de negócio:**

- Só é possível pular até o **prazo de corte: 2 dias antes da entrega, às 20h**
  (horário de Brasília).
- Máximo de **2 pulos por janela de 8 semanas**.
- Não é possível pular entrega que já está em produção (`IN_PRODUCTION` ou posterior).
- Pular uma entrega já pulada não deve gerar erro nem consumir cota extra.

O desenho das rotas (caminho, verbo, formato de resposta e de erro) é decisão sua.

### 3. Tela

Lista das próximas entregas com botão de pular. Quando não for possível pular, o botão
fica desabilitado **e mostra o motivo** ao cliente: prazo encerrado, cota esgotada, ou
pedido já em produção.

Visual não conta nota. Comportamento conta.

### 4. Testes

Cobrindo as regras de negócio. Você escolhe o nível de teste e justifica a escolha.
Ambiente padrão do Jest é `node`; para testar componente, use o docblock
`@jest-environment jsdom` no topo do arquivo (RTL e jest-dom já instalados).

### 5. README de decisões

Substitua ou complemente este arquivo com: decisões que tomou, trade-offs, o que ficou
fora do escopo, e as premissas que você assumiu. Curto, em bullets.

---

## Sobre IA

Uso de Claude Code ou equivalente é **esperado**, não tolerado. No README, registre onde
o agente ajudou e onde você descartou o que ele sugeriu.

## Liberdades

- Remodele os tipos em `src/lib/domain.ts` se fizer sentido — só registre o porquê.
- Troque o cliente HTTP do front (SWR, react-query) se preferir.
- Adicione bibliotecas se precisar. `date-fns` e `date-fns-tz` já estão instaladas.
- Não precisa mexer em Docker, CI ou deploy.

## Onde as coisas estão

```
src/pages/index.tsx        tela principal
src/pages/api/me.ts        rota pronta, use como referência de padrão
src/lib/domain.ts          tipos do domínio
src/lib/db.ts              conexão e coleções
src/lib/auth.ts            auth falsa
src/lib/serializers.ts     documento -> resposta da API
src/lib/api-client.ts      fetch do front
scripts/seed.ts            dados fictícios
__tests__/example.test.ts  teste de fumaça, pode apagar
```

## Sessão seguinte

Depois da entrega, marcamos 60 min para você apresentar o código e mexermos nele juntas.
Não precisa preparar nada além do que já entregou.
