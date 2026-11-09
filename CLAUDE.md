# House Builder — guia para sessões do Claude

Editor de plantas residenciais 2D + visualização 3D, inspirado no Planner 5D (Windows 4.2.2).
Idioma da interface e da conversa com o usuário: **português (pt-BR)**.

> **Mantenha este arquivo atualizado.** Ao concluir uma mudança relevante (nova funcionalidade, decisão de
> arquitetura, comando, armadilha descoberta), atualize as seções abaixo e o "Estado do projeto" no mesmo turno.

## Regras do usuário (não negociáveis)

- **Gerenciador de pacotes: npm.** Nunca use pnpm ou yarn. Não crie `pnpm-lock.yaml`/`pnpm-workspace.yaml`.
  Para shadcn: `npx shadcn@latest add <componente>`.
- **UI: shadcn/ui.** Formulários sempre com **TanStack Form** ligado aos componentes shadcn (ver abaixo).
- Stack fixa: TanStack Start (rotas por arquivo), React 19, Tailwind 4, Prisma 7 + SQLite, three.js.
- Não commitar nem apagar arquivos que o usuário não pediu. Não copiar código, modelos ou texturas do Planner 5D.
- **TDD obrigatório:** para QUALQUER bug ou funcionalidade, **escreva o teste primeiro**, rode e **veja-o falhar (RED)** pelo motivo
  certo, só então implemente até ficar verde (GREEN) e refatore. Mostre ao usuário o resultado RED→GREEN. Corrigir sem teste
  de regressão não vale. Veja "Testes (TDD)" abaixo.

## Comandos

```bash
npm install                 # no Windows: --no-audit --no-fund --prefer-offline --maxsockets=4
npm run db:generate         # Prisma client -> src/generated/prisma (gitignored)
npm run db:push             # cria/sincroniza dev.db (SQLite)
npm run db:seed             # projetos de exemplo (prisma/seed.ts)
npm run dev                 # http://localhost:3000
npm run dev:vr              # HTTPS autoassinado em 0.0.0.0:3001 (--mode vr) para testar WebXR no Meta Quest
npm run build               # build de produção (nitro)
npm test                    # Vitest (vitest run) — deve ficar 100% verde antes de encerrar qualquer tarefa
npm run test:watch          # Vitest em modo watch (use durante o ciclo RED→GREEN)
npx tsc --noEmit            # checagem de tipos (deve ficar limpa)
npm run check               # Biome (lint + format)
```

`.env.local` precisa de `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`. O servidor de preview do app
usa `.claude/launch.json` (`npm run dev`, porta 3000).

## Arquitetura

```
src/routes/
  index.tsx                       lista de projetos + modelos iniciais
  projects.$projectId.tsx         editor (ssr: false — usa canvas/WebGL)
  __root.tsx                      shell, <Toaster/> (sonner)
src/components/
  ui/                             shadcn/ui (não editar à mão; importam cn de "#/lib/utils")
  form/form-hooks.tsx             createFormHook: TextField, NumberField, SelectField, SwitchField,
                                  SliderField, ColorField, TextAreaField + SubmitButton
  planner/
    editor.tsx                    layout "tela livre": canvas em tela cheia + painéis flutuantes; autosave (2,5 s), atalho Ctrl+S
    left-panel.tsx                painel esquerdo: project-header (nome/menu/recolher) + floors-list (pisos) + layers-panel (árvore)
    dock.tsx · view-selector.tsx · top-actions.tsx   dock inferior de ferramentas + "Objetos"; seletor de visão em vidro fosco; desfazer/opções/exportar/salvar
    plan-canvas.tsx               orquestrador do 2D: ferramentas, eventos de ponteiro/teclado/roda, câmera, auto-pan
    plan-scene.tsx                cena 2D MEMOIZADA (salas, paredes, aberturas, escadas, itens); não depende da câmera
    plan-overlay.tsx              chrome em espaço de TELA: seleção, 8 alças, rotação, guias, medidas, rótulos, pílulas
    plan-shapes.tsx               ItemShape/OpeningShape (traços com vector-effect non-scaling-stroke)
    viewport-grid.tsx             grade em <canvas> sob o desenho (as réguas das bordas foram removidas)
    zoom-controls.tsx · plan-context-menu.tsx · room-rename.tsx   pílula de zoom, menu de contexto, renomear cômodo (TanStack Form)
    view-3d.tsx                   three.js: paredes com recortes, pisos, móveis, telhado, órbita/caminhada
    properties-panel.tsx          formulários por entidade (parede, cômodo, abertura, objeto, escada, piso/projeto)
    entity-form.ts                useEntityForm: TanStack Form <-> store (valida com zod, 1 passo de undo)
    layers-panel.tsx              árvore de camadas estilo Figma (aba "Camadas" do painel esquerdo)
    objects-drawer.tsx (gaveta de portas/janelas/objetos) · catalog-panel.tsx (só ItemPreview/Icon) · floors-panel.tsx (legado, sem uso) · assistant-panel.tsx · material-picker.tsx · new-project-dialog.tsx
src/lib/planner/
  types.ts                        modelo: Project > Floor > walls/rooms/openings/items/rulers/stairs/roof
  store.ts                        PlannerStore (useSyncExternalStore), histórico undo/redo, gestos
  geometry.ts · topology.ts       geometria; divisão de paredes em T e detecção automática de cômodos
  camera.ts · bounds.ts · snapping.ts · cursors.ts   câmera pura (zoomAt, fitBox, wheel, tween, passos de grade),
                                  caixas/contornos, guias inteligentes e medição, cursores SVG que giram com o objeto
  catalog.ts · materials.ts · textures.ts   catálogo paramétrico (primitivas), materiais, texturas procedurais
  templates.ts · factory.ts · export.ts · assistant.ts
  projects.functions.ts           server functions (createServerFn + zod .validator) sobre o Prisma
prisma/schema.prisma              model Project { id, name, data (JSON string), thumbnail, floors, area }
```

Alias de import: `#/*` -> `src/*`. Imports de componentes shadcn usam extensão (`#/components/ui/button.tsx`).

## Convenções do domínio

- Unidades internas: **centímetros** e **graus**. Coordenadas 2D (x, y) -> 3D (x, z); 1 cm = 0,01 unidade three.
- Projeto é um documento JSON único salvo em `Project.data`; `store.mutate*` clona e grava no histórico
  (máx. 100). Gestos (arrastar, digitar no painel) usam `beginGesture/endGesture` para virar 1 passo de undo.
- Mutação com `{ record: false }` não entra no histórico (usado durante arrastes e troca de piso).
- Catálogo: itens são listas de `Part` (box/cyl/sphere/cone em frações do footprint) — servem para 2D e 3D.
- Formulários novos: use `useAppForm` (`form-hooks.tsx`); para editar entidades do store use `useEntityForm`.

## Engenharia reversa do Planner 5D (resumo; detalhes no README)

Feita com o MCP **REA** sobre `C:\Program Files\WindowsApps\UABPlanner5D.Planner5D-HomeInteriorDesign_4.2.2.0_x64__ab7xzjg59kkje`
(WinUI3/.NET 8; editor é um Unity embutido via RPC; catálogo em `Assets/Catalog/database.sqlite`; módulos
Editor/Catalog/Projects/Spaces/AI/Collab/Commerce). O shell bash não lê `WindowsApps` (permission denied): use as
ferramentas do REA para inspecionar. Saídas grandes do REA vão para arquivo; filtre com python (`-I`, utf-8).
Se precisar investigar mais: comandos `ItemCommands.*`, `ProlongedAction.*` e `Presenters.*` em `Planner5D.Editor.dll`
(só 120 de 264 tipos foram listados) e tabelas `items`/`demo_projects` do catálogo (blobs não decodificados).

## Testes (TDD)

- Runner: **Vitest** (`vitest.config.ts` separado de `vite.config.ts` de propósito — o app carrega plugins TanStack Start/Nitro
  que os testes não precisam). Ambiente `node`; testes em `src/**/*.test.ts`, ao lado do código (`foo.ts` → `foo.test.ts`).
- **Ciclo:** 1) escreva o teste que descreve o comportamento/bug; 2) `npm test` e confirme que falha **pela razão esperada**
  (se falhar por import/erro de sintaxe, crie só um stub e rode de novo); 3) implemente o mínimo; 4) verde; 5) refatore; 6) `npx tsc --noEmit`
  e `npx biome check src`. Bug reportado = primeiro um teste que o reproduz.
- **Escreva a lógica como função pura** em `src/lib/planner/*` (recebe `Floor`/`Point`, devolve dados) e deixe o React/canvas só
  chamando-a — é o que torna testável. Para fluxos completos use `PlannerStore` (`new PlannerStore(createProject())`).
- Prefira `expect` do Vitest em testes novos (alguns arquivos antigos ainda usam `node:assert/strict` + `describe/it` do vitest).
- Testes existentes: `draw-snap` (encaixe de desenho em paredes/T), `nested-rooms` (cômodo dentro de cômodo com 2 paredes),
  `rect-room` (retângulo reaproveitando paredes), `topology` (`insetPolygon`), `camera` (zoom/roda/guias), `placement` (parede/janela),
  `wall-resize` (alterar comprimento), `length-input` (ler/formatar medida digitada), `wall-label` (posição dos rótulos), `axis-stick` (aderência aos eixos), `layers` (camadas), `wall-merge` (junção de paredes), `wall-faces` (encaixe nas faces da parede), `wall-items` (itens colados na parede), `layer-tree` (árvore de camadas), `wall-cutaway` (paredes estilo The Sims no 3D), `room-stack` (pisos aninhados no 3D), `orbit-limits` (faixa de zoom do 3D), `groups` (comandos de grupo), `dock-tools` (ferramentas do dock), `vr-locomotion` (andar/teleportar/portas em VR), `vr-link` (link do botão "Ver em VR"), `view-layout` (posição do 2D e do 3D por modo), `drawer-mode` (gaveta de objetos), `catalog-groups` (seções do catálogo e scroll-spy), `door-swing`, `store`.
- Interação com mouse/arrastar **não** é testável pelo REA; cubra a regra em função pura e deixe a verificação visual para o usuário.

## Modelo do canvas 2D (estudo do Figma — ver `docs/figma-canvas-study.md`)

- **Cena × câmera × chrome:** `PlanScene` (memo) só re-renderiza quando o piso muda; zoom/pan só alteram o `transform` do grupo.
  Tudo que precisa de tamanho constante em px (seleção, alças, guias, rótulos) fica no `PlanOverlay`, convertendo mundo→tela com
  `toScreen`. Traços da cena usam `vector-effect="non-scaling-stroke"` — nunca dependa de `zoom` dentro de `plan-scene/plan-shapes`.
- **Entrada (igual ao Figma):** rolar = mover vista; Ctrl/⌘+rolar ou pinça = zoom no cursor (`interpretWheel`, listener nativo
  `{passive:false}`); Espaço/botão do meio/ferramenta Mão = arrastar; clique direito = menu de contexto; Shift+1 enquadrar tudo,
  Shift+2 enquadrar seleção, Shift+0 (ou Ctrl+0) 100%, +/− degraus. Preferência "Roda do mouse dá zoom".
- **Modificadores:** **Ctrl/⌘ desliga encaixe** (antes era Alt); Alt+arrastar duplica; Alt parado sobre outro objeto mede distâncias;
  Shift+arrastar trava o eixo; Shift ao redimensionar canto mantém proporção; Alt ao redimensionar é simétrico.
- **Guias inteligentes** (`snapBoxMove`, limiar 6 px/zoom) têm prioridade sobre o encaixe na grade; só em mover.
- Estado de UI do canvas (hover, guias, badge, rascunhos) é `useState` local; câmera e preferências ficam no `PlannerStore`.
- A visualização padrão ao abrir um projeto é **2D** (`view: "2d"` em `emptyState`; coberto por `store.test.ts`). `load()` mantém a visão escolhida.
- Handles do overlay usam `data-kind="handle"` + `data-extra`: `joint-a|b`, `vertex`, `rotate:<item|stair>`, `resize:<kind>:<hx>:<hy>`.
- A grade usa passos 1-2-5 (`gridSteps`); `zoom` = px por cm (limites 0,02–16).
- **Encaixe de desenho** (`draw-snap.ts`, `snapDrawPoint`): 1) ponta de parede existente; 2) a própria parede (junção em T): o
  ponto cai **exatamente na linha de centro**, e com âncora vale o ponto onde o raio travado em ângulo encontra a parede; 3) ângulo+grade.
  Ctrl só mantém as pontas. `afterWallAdded` ainda "cola" (`attachPoint`) pontas que terminam dentro da espessura de outra parede e a
  divide ali; **é essa divisão que fecha o ciclo e cria o cômodo** (cômodo dentro de cômodo com só 2 paredes).
- `addRectangleRoomShared` (topology): retângulo reaproveita paredes existentes (cantos/arestas), divide as que ele toca e não duplica.
  Cômodos aninhados **se sobrepõem** (o maior continua existindo); a soma de áreas conta a sobreposição duas vezes (pendente).
- **Posicionamento ao adicionar** (`placement.ts`): `placeItem`/`snapOpening` alimentam fantasma, clique e arrastar do catálogo
  (`store.dragPayload`, pois `dataTransfer` não é legível no dragover). Janelas/portas têm ímã de 44 px, preferem a parede anterior
  (histerese), encaixam em início/fim/centro/vizinha/alinhamento e mostram as distâncias. Ctrl desliga.
  **Sentido de abertura da porta** (`OpeningPlacement.mirror`): a porta abre para o lado da parede em que o mouse está (normal da
  parede = (−sin a, cos a); mouse do lado oposto ⇒ `mirror: true`; zona morta de 0,5 cm sobre a linha). Vale ao colocar (fantasma,
  clique, arrastar do catálogo); mover uma porta já existente NÃO muda o lado. Teste: `door-swing.test.ts`.
- **Editar medida/nome por duplo clique:** o rótulo da medida da parede (`data-kind="dim"`) abre `WallLengthEdit` e o nome do cômodo
  (`data-kind="roomlabel"`, ou qualquer ponto do cômodo) abre `RoomRename`; ambos usam TanStack Form + shadcn Input. A regra é pura:
  `setWallLength` (wall-resize.ts) move a ponta livre (ou `b`), vizinhas perpendiculares deslizam inteiras (retângulo continua
  retângulo), cômodos e aberturas acompanham; `parseLength` aceita `4,5`, `450cm`, `4.5m`, `12'6"`. **Armadilha:** com pointer capture
  (feito no pointerdown) o `dblclick` chega com `target` = contêiner — use `document.elementFromPoint`, nunca `e.target`.
- `insetPolygon` encolhe o polígono para dentro **em qualquer sentido de rotação** (havia um bug que sempre expandia; coberto por teste).

## Armadilhas conhecidas

- **Teste do 2D pelo REA:** `capture_browser_scenario` só tem goto/click/fill/press/wait; **não há mouse-move, arrastar nem roda**.
  Localizador: `{"kind":"css","selector":"..."}` (aceita `:has-text`); `press` exige `locator` (use `body`); `click` não aceita
  `position` (clica no centro do elemento). Screenshots vêm em base64 no JSON salvo: extraia com python e veja com Read.
  Arrastes/roda/guias/medição **não** têm teste automatizado.

- **Windows + antivírus**: `npm install` pode falhar com EPERM/ENOENT e deixar `node_modules` quebrado. Remova com
  `robocopy <pasta vazia> node_modules /MIR` + `Remove-Item`, depois reinstale com `--maxsockets=4`. A instalação leva ~14 min.
- shadcn CLI gera `import { cn } from "cn"` neste projeto: troque por `"#/lib/utils"` e remova o pacote `cn` se for instalado.
  Se o registro der timeout, adicione os componentes em lotes pequenos.
- `src/generated/prisma` e `*.db` estão no `.gitignore`; rode `db:generate` após clonar.
- `tsr generate` / `npm run generate-routes` recria `src/routeTree.gen.ts`.
- Biome ignora `src/components/ui` e `src/generated` e desliga algumas regras a11y/hooks (ver `biome.json`).
- Resize do navegador de preview pode ficar emulado: volte para `desktop` ao terminar testes.

## Estado do projeto

**Implementado e verificado** (typecheck + build limpos; editor testado no navegador): projetos (criar por modelo,
renomear, duplicar, excluir, importar/exportar JSON, autosave), planta 2D (paredes, divisórias, cômodos, portas,
janelas, escadas, régua, borracha, snap, seleção múltipla, undo/redo, zoom/pan), múltiplos pisos e telhados,
vista 3D (órbita, caminhada, corte), catálogo (~60 objetos, 21 categorias), materiais, assistente offline em pt-BR,
exportação (PNG/SVG/3D PNG/CSV).

**2D estilo Figma (refatoração concluída, verificada parcialmente):** grade adaptativa, zoom em degraus/enquadrar,
caixa de seleção com 8 alças + pílula de dimensões, rótulos em tela, menu de contexto, renomear cômodo, guias inteligentes,
medição com Alt, auto-pan, Alt+arrastar duplica. **Verificado:** render, seleção/alças/pílula, atalhos de zoom (Shift+1,
`=`, Shift+0) no Chrome via REA; matemática pura (camera/snapping/resize) com script tsx (13 checks, não commitado).
**NÃO verificado (sem mouse/roda no REA):** arrastar/mover/redimensionar/girar com o mouse, guias e medição ao vivo, auto-pan,
Ctrl+roda/pinça, clique direito, duplo clique em cômodo, hit-test de paredes com `non-scaling-stroke`, `onPointerCancel`.

**Não verificado manualmente ainda**: modo caminhada 3D, exportações (PNG/SVG/CSV), importação de JSON,
drag&drop do catálogo, ferramenta de escada/régua/borracha, assistente além de “criar quarto” e “adicionar sofá”,
duplicação/exclusão de projeto na tela inicial, `db:seed`. Exportar PNG/SVG da planta (`export.ts`) usa o SVG do canvas: o
seletor `.planner-canvas svg` agora pega a cena (overlay/chrome ficam fora) — conferir se a exportação ainda sai completa.

**Fora do escopo** (dependem de serviços do Planner 5D): nuvem/colaboração, loja, reconhecimento de planta por
imagem, render por IA, busca de casa por endereço, concursos, catálogo completo de modelos 3D.

**Ideias de próximos passos**: testes automatizados de geometria/topologia/store, escadas em L/espiral
(`Stair.kind` já existe), telhado por polígono, cotas editáveis, mais objetos no catálogo, medidas imperiais nos
formulários, autenticação (better-auth está instalado mas não usado).

**Pendências do repositório**: nenhum commit ainda (branch `master`, sem histórico); arquivos do starter
(`.cta.json`, `vercel.json`) mantidos. `src/integrations/better-auth/header-user.tsx` foi removido (era do starter).

## Aderência aos eixos ao mover paredes (`axis-stick.ts`)

- Mover parede(s) ou arrastar uma ponta: a parede movida e as paredes afetadas por efeito colateral ficam coladas na
  horizontal/vertical (limiar `AXIS_STICK_PX` = 16 px / zoom, em `plan-canvas.tsx`) e só viram diagonal com um movimento extra deliberado. Linhas-guia vermelhas
  mostram o eixo colado. Ctrl/⌘ ou "Encaixe magnético" desligado = sem aderência. Tem prioridade sobre guias inteligentes e grade.
- Funções puras: `snapShiftToAxes`/`axisPairs` (mover), `snapPointToAxes`/`jointRefs` (ponta), `hitsToGuides`/`guidesForPoint`.
  Testes: `axis-stick.test.ts`. A integração com o mouse (`plan-canvas.tsx`) NÃO foi verificada no navegador.

## Camadas (ordem de empilhamento no 2D) — `layers.ts`

- `renderOrder(items)` (usada em `plan-scene.tsx`) ordena por `Item.z` (explícito); sem `z`, vale a ordem de criação, mas itens
  **rasos** (`isFlat`: altura ≤ 5 cm e sem elevação, ex. tapete) ficam por baixo de todo o resto. Hit-test segue a mesma ordem.
- `reorderLayers`/`store.reorderSelection(op)`: `front | back | forward | backward`, em bloco, grava `z` em todos os itens do piso
  (1 passo de undo). Atalhos Ctrl+] / Ctrl+[ (com Shift = extremos) e itens no menu de contexto. Testes: `layers.test.ts`.
- Só vale para itens (móveis/objetos); paredes/cômodos/aberturas seguem a ordem fixa da cena. Não verificado no navegador.

## Junção de paredes após mover (`mergeCollinearWalls` / `healAfterMove`, topology.ts)

- Ao soltar um arraste de parede/ponta, `healAfterMove` junta paredes colineares e iguais (espessura, tipo, altura, materiais) que
  só se encontram entre si (sem 3ª parede = sem T). Sem isso sobrava um pedaço extra na parede lateral ao afastar a divisória
  do T. Aberturas mantêm a posição no mundo; `prefer` mantém o id da parede selecionada. Só olha as pontas das paredes movidas e
  vizinhas (um "Dividir parede" deliberado em outro lugar não é desfeito). Testes: `wall-merge.test.ts`.
- **Verificação real no navegador é possível** com `playwright-core` + Chrome do sistema instalado numa pasta temporária (fora do projeto):
  `page.mouse.move/down/up` arrasta de verdade. Ao testar contra o projeto do usuário, bloqueie POSTs (`page.route`) para não salvar.

## Encaixe de objetos nas faces da parede (`wallFaceBoxes`, bounds.ts)

- Guias inteligentes de móveis/itens (ao adicionar em `snapTargets` e ao mover em `startMove`) usam as **faces** da parede
  (linha de centro ± espessura/2, com as pontas quadradas), não só a linha de centro/pontas. Assim o objeto encosta na superfície
  mesmo com a parede fora da grade, e não "gruda" dentro da parede. Parede diagonal só oferece as pontas (com a espessura).
  Testes: `wall-faces.test.ts`. Mover com o mouse não foi verificado no navegador.

## Itens colados na parede acompanham o movimento (`wall-items.ts`)

- Ao mover parede(s) (ou um cômodo), `itemsAttachedToWalls` (tolerância `ATTACH_TOLERANCE` = 15 cm da superfície, ao longo da parede,
  pegada real do item incluindo rotação) escolhe os itens que vão junto (`ride` no drag `move`). Não entram em `baseBox` (guias) e
  respeitam `locked`. Arrastar só a ponta (alça) não carrega itens. Testes: `wall-items.test.ts`.
  Verificado no navegador (Playwright, ver acima): arrastar divisória desceu os 3 itens colados e deixou os demais.
- **Grupos:** se um item colado na parede tem `groupId`, todos os itens do mesmo grupo vão junto (ex.: rack colado + TV a 16 cm).
  Grupos sem nenhum membro perto das paredes movidas ficam parados; grupos diferentes não se arrastam.

## Árvore de camadas e grupos (`layer-tree.ts`, `layers-panel.tsx`)

- `buildLayerTree(floor)` (pura): seções Objetos, Escadas, Portas e janelas, Paredes, Cômodos, Réguas (só as não vazias); objetos
  do topo para baixo seguindo `renderOrder`; itens com o mesmo `groupId` (2+) viram um nó `group:<gid>` na posição do membro mais
  alto. `nodeRefs`/`selectionState` (none/partial/all) ligam a árvore à seleção. Nome do grupo em `Floor.groupNames` (vazio = "Grupo N").
- Comandos de store: `renameGroup`, `removeFromGroup`, `addToGroup`, `setItemsLocked`, `groupSelection`/`ungroupSelection`;
  `tidyGroups` dissolve grupos com <2 membros e apaga nomes órfãos (também ao excluir). Testes: `layer-tree.test.ts`, `groups.test.ts`.
- Painel: clique seleciona (Ctrl/Shift soma/tira), clique no grupo seleciona todos os membros, duplo clique ou F2 renomeia (TanStack Form),
  cadeado por objeto/grupo, "tirar do grupo" ao passar o mouse, botões agrupar/desagrupar/subir/descer. Verificado no navegador
  (Playwright): árvore, seleção sincronizada com o canvas e agrupar. NÃO verificado: renomear grupo, travar, tirar do grupo, arrastar na árvore
  (reordenar/mover para dentro de grupo por arraste ainda não existe — use os botões/atalhos).
- **Hierarquia por cômodo:** os cômodos são nós de topo (`room:<id>`, selecionam só o cômodo) com objetos/grupos cujo centro está
  dentro do polígono e portas/janelas cujas paredes o cercam (distância ≤ espessura + 12 cm). Cômodos aninhados: vence o menor.
  Grupo vai pelo membro mais alto. O que não está em nenhum cômodo fica em "Fora dos cômodos" / "Portas e janelas fora dos cômodos"
  (sem cômodos o layout antigo "Objetos" continua). Escadas, paredes e réguas de medição (ferramenta "Medir") mantêm suas seções. Verificado no navegador.
- **Paredes dentro dos cômodos (opção C, decidida com o usuário):** cada cômodo tem, como PRIMEIRO filho, uma subpasta "Paredes" (`room:<id>/walls`, fechada por
  padrão via `LayerNode.collapsed`) com **referências** às paredes (ids `room:<rid>/wall:<wid>`, `ref` aponta para a mesma parede).
  Parede pertence ao cômodo se toda a sua extensão estiver dentro do polígono ou sobre o contorno (≤ espessura/2 + 8 cm): cobre
  paredes do cômodo, **compartilhadas** (aparecem em todos, com a etiqueta "compartilhada"), paredes do cômodo aninhado (aparecem
  no interno E no externo) e divisórias internas; parede que só encosta na borda não conta. Sem cômodo nenhum: seção "Paredes";
  com cômodos: só as sem cômodo ficam em "Paredes soltas". Selecionar uma parede destaca todas as suas linhas. Abrir/fechar é por
  `opens` (override por id) no painel. Verificado no navegador. Testes em `layer-tree.test.ts`.

## 3D estilo The Sims (`wall-cutaway.ts`, `view-3d.tsx`)

- Seletor "Inteiras | Auto | Baixas" na barra do 3D (estilo The Sims; `WallMode` = `up | cut | down`; padrão **Auto**; desligado no modo Caminhar). Paredes que ficam
  entre a câmera e o cômodo viram um "toco" de `CUT_HEIGHT` = 50 cm, então o cômodo aparece sem perder a separação entre eles.
- Alvo: `wallsToLower(walls, mode, cam, target)` (pura) baixa a parede se o centro dela está do lado da câmera em relação ao alvo
  da órbita E a normal está a ≤ 60° da direção da câmera. Cada parede tem um **nível** 0..1 (`stepLevel`, ease-out independente de fps,
  taxa 6/s) que anima até o alvo: o sumir/aparecer é suave.
- **Rampa** (`wallTopProfile`): na ponta que encontra uma parede alta, o topo do toco sobe em inclinação até a altura cheia no canto
  (`RAMP_LENGTH` = 80 cm; `endNeighbourLevels` dá o nível do vizinho em cada ponta, então a rampa também cresce/encolhe de forma contínua).
  `wallPieces` transforma o perfil + aberturas em caixas de topo inclinado (portas/janelas viram vão, furo ou entalhe aberto no topo).
- Render: cada parede tem a versão cheia (estática, `buildWall`) e a animada (`DynWall`, `slabGeometry` refeita só enquanto o nível
  muda). O loop só recalcula quando câmera/alvo/modo mudam (`wallSig`) ou há animação em curso (`wallSettled`). Objetos de porta/janela
  só aparecem quando o topo cobre a abertura. O picking ignora versões ocultas. Testes: `wall-cutaway.test.ts` (27). Verificado no
  navegador (Playwright + SwiftShader): modos, rotação e rampas visíveis. NÃO verificado: a suavidade da animação em tempo real (headless é lento).
  Limitação: divisórias atrás do alvo da órbita continuam inteiras.
- **Armadilhas de z-fighting/sombra (corrigidas):** (1) pisos de cômodos aninhados ficavam na mesma altura e listravam: `roomStackRanks`
  (room-stack.ts) dá um rank por área (maior = base) e cada piso sobe `ROOM_LAYER_GAP` = 4 mm × rank (teto desce). (2) Material
  `DoubleSide` em parede animada faz auto-sombra (listras): `slabGeometry` já tem enrolamento voltado para fora, então use `FrontSide`.
- **Roda do mouse no 3D:** `OrbitControls` com `zoomToCursor = true` (como o 2D), `zoomSpeed` 0,8 e faixa de zoom por tamanho da casa
  (`orbitLimits`: mín. 1 m, máx. `max(40, 6×tamanho)` até 280 m), aplicada em `frameProject`. Antes não havia limite e dava para
  atravessar o modelo ou perder a casa de vista. A página em si não rola (o editor é `h-dvh`); só o catálogo à esquerda tem scroll.

## Realidade virtual (WebXR no Meta Quest, sem instalar nada) — `vr-view.tsx`, `vr-locomotion.ts`, rota `/vr/$projectId`

- Rota **somente leitura** `/vr/$projectId` (`ssr: false`, sem login) monta `buildScene(project, { cutaway: false })` (paredes inteiras, teto ligado) e mostra
  "Entrar em VR". Sem headset/HTTPS ela mostra o motivo em pt-BR e uma órbita de pré-visualização. Só o **piso 0** é caminhável (sem escadas ainda).
- **WebXR exige HTTPS**; o IP da rede local em HTTP não conta como contexto seguro. `npm run dev:vr` liga `@vitejs/plugin-basic-ssl` via `--mode vr`
  (o `npm run dev` normal continua em HTTP/3000). No Quest: abrir `https://<IP-do-PC>:3001/vr/<id>` e aceitar o aviso de certificado. Firewall do Windows
  precisa liberar o `node.exe` no perfil da rede (Privado).
- **Controles:** analógico esquerdo = andar (relativo ao olhar); direito de lado = giro em passos de 30° (em torno da cabeça); direito para a frente =
  arco de teleporte, soltar teleporta (verde = válido, vermelho = parede no caminho). A cabeça mexe dentro de um `rig`; colisão e teleporte movem o rig.
- Lógica pura e testada (`vr-locomotion.test.ts`): `moveWithCollision` (círculo de 25 cm contra retângulos orientados das paredes, encosta e desliza;
  sub-passos de 10 cm evitam atravessar), `isPassable` (**porta e porta dupla só passam ABERTAS; arco, porta de correr e garagem são sempre livres
  (não têm animação de abrir); janela nunca**), `canTeleport`, `arcFloorHit` (parábola, alcance 12 m), `snapTurn`, `spawnPoint`. **Armadilha:** a colisão tem de ser incremental (somar o deslocamento da colisão ao passo seguinte); recalcular
  a partir da reta ideal a cada sub-passo descarta o empurrão e a pessoa atravessa a parede.
- **Portas interativas:** o raio de cada controle (alcance 6 m) fica verde e destaca a porta de giro apontada; **gatilho** abre/fecha com animação
  (`stepLevel` 0..1 sobre `pivot.userData.swing`, marcado em `buildOpening`). Paredes/móveis na frente escondem a porta atrás deles. O estado fica numa
  **cópia** do projeto (`structuredClone`): não altera o salvo; o `open` salvo no editor vale como estado inicial. Na pré-visualização no PC, clicar na
  folha também abre/fecha. Em dev, `window.__vr` (`doors/isOpen/focus/head`) serve aos testes com Playwright. Verificado no Chrome (clique na folha
  fecha/abre; clique no vão vazio não faz nada). **NÃO verificado:** o gatilho no Quest.
- **Botão "Ver em VR"** (`top-actions.tsx` → `vr-dialog.tsx`): salva, mostra o link `https://<ip>:3001/vr/<id>` (IP do PC via `getLanAddress`/`pickLanAddress`,
  que ignora WSL/VPN/Hamachi), copiar, abrir e "Tentar abrir no Quest" (`metaOpenUrl` = atalho `oculus.com/open_url`, **experimental, não verificado**).
  O endereço digitado é sempre forçado para https e lembrado no `localStorage`.
- Sem sombras em tempo real (Quest 2 precisa de 72 fps), `setFoveation(1)`. **NÃO verificado:** entrar em VR de verdade no Quest, desempenho e conforto
  (a parte de WebXR/controles não é testável pelo REA/Playwright); verificado no Chrome do PC só a renderização e a mensagem de "sem headset".
- Próximos passos: validar `open_url` da Meta, QR code, escadas/pisos, token de compartilhamento, deploy HTTPS real, abrir porta de correr/garagem com animação.

## Interface "tela livre" (B1 refinado) — `editor.tsx`

- Direção escolhida pelo usuário (mockups na tela de design do Claude, B1 refinado): o canvas (2D/3D) ocupa a tela toda e os painéis
  **flutuam** por cima. Esquerda: nome do projeto (menu: renomear com TanStack Form, importar, voltar; botão recolher) → **Pisos**
  (`floors-list.tsx`: escolher, olho, "+", menu duplicar/subir/descer/excluir) → **Camadas** (`layers-panel.tsx`). Direita: **editor**
  (`properties-panel.tsx`, card flutuante, rola se for alto). Topo central: **vidro fosco** (`view-selector.tsx`, `backdrop-blur`):
  2D / 2D+3D / 3D e, quando há 3D, Inteiras/Auto/Baixas + câmera + esconder teto. Topo direito: desfazer, refazer, enquadrar,
  assistente (popover), Opções, Exportar, Salvar. Embaixo: **dock** (`dock.tsx`) com as ferramentas nomeadas e o botão **Objetos**
  (abre a **gaveta de objetos**, ver abaixo).
- **Dock como abas:** a ferramenta selecionada é uma **pílula preta** (`bg-foreground`) que **desliza** até a aba escolhida (mede `offsetLeft/Width` da aba ativa e
  anima `left/top/width/height` em 300 ms com uma curva de mola leve; sem animação no primeiro desenho; `ResizeObserver` remede se o dock mudar).
  `dockActiveKey(tool, objectsOpen)` (pura, testada) diz qual aba está ativa: a que tem a ferramenta (variantes de grupo incluídas) ou **Objetos**
  enquanto a gaveta de objetos está aberta ou há um objeto sendo posicionado. Objetos é a última aba (não mais um botão preto fixo).
- `DOCK` (`dock-tools.ts`, pura, testada) define os botões: Parede e Cômodo são **grupos** (variantes no menu da setinha; o clique usa a
  última variante). Todas as 11 ferramentas do editor continuam acessíveis. Atalhos de teclado seguem em `plan-canvas.tsx`.
- **Insets:** como os painéis cobrem o canvas, `PlanCanvas` recebe `insets` (esquerda 300, direita 344 só fora do split, topo 56,
  base 96): `fitBox(..., { insets })` enquadra e centraliza na área visível (testado em `camera.test.ts`), o zoom é em torno do centro visível, a
  pílula de zoom fica no canto inferior direito e a dica da ferramenta acima do dock.
- Armadilha: um botão que abre `DropdownMenu` não aceita `onDoubleClick` (o primeiro clique já abre o menu) — o nome do projeto
  é renomeado pelo item "Renomear projeto". Para grupo de opções com `role="radio"` use o `ToggleGroup` do `radix-ui` (Biome proíbe div/button com role).
- Verificado no navegador (Playwright, 1280 e 1400 px): layout 2D/3D/split, dock (variantes e estado pressionado), pisos, renomear,
  recolher/abrir painel, catálogo. NÃO verificado: arrastar do catálogo para a planta com o popover aberto, tema escuro.
- **Réguas das bordas removidas** (decisão do usuário: não eram relevantes e brigavam com os painéis flutuantes): sem `showRulers`, sem
  atalho Shift+R, sem faixa em volta do canvas (teste em `store.test.ts`). A ferramenta **Medir** (`ruler`, régua de medição desenhada na
  planta) continua. As medidas vêm das cotas das paredes e da dica do cursor.

## Gaveta de objetos — `objects-drawer.tsx`, `drawer-mode.ts`, `catalog-groups.ts`

- **Substitui o painel esquerdo só enquanto um modo com muitas opções está ativo**, com o **mesmo tamanho** dele (`w-72`, `insets.left` = 300);
  ao sair do modo o painel normal (nome, pisos, camadas) volta. `drawerMode(tool, catalogOpen)` (pura, testada): ferramenta **Porta** →
  gaveta "Portas" (só presets de porta), **Janela** → "Janelas", ferramenta de objeto (`item`) ou botão **Objetos** → só objetos
  (**sem portas e janelas**, decisão do usuário); qualquer outra ferramenta → `null`.
- **Objetos: carrossel de categorias + seções com título fixo (opção G2, escolhida pelo usuário).** `groupCatalog(query)` monta a árvore de categorias
  e `sectionsOf` a achata nas categorias que têm objetos, em ordem de catálogo, com o caminho dos ancestrais (`Interior › Mobília`). No topo, um
  **carrossel** de ícones redondos (uma categoria cada; `role="tablist"`); abaixo, cada categoria é uma **seção** com título `sticky` (caminho em caixa alta
  + nome + contagem) e cartões 2 colunas (`ItemPreview`, nome, medida). Clicar num ícone rola até a seção; rolando a lista, `activeSectionIndex` (scroll-spy,
  pura, testada) destaca o ícone da seção lida e o carrossel centraliza o ícone ativo. Busca (ignora acento/maiúscula) deixa só as seções/ícones com resultado.
  Clicar num cartão posiciona; arrastar para a planta continua (`store.setDragPayload`).
- Sai com o X, Esc (o canvas já faz `setTool("select")`) ou escolhendo outra ferramenta no dock (`onPickTool` zera `catalogOpen`).
- Verificado no navegador (Playwright 1400 px): larguras iguais (288 px), abrir/fechar por Objetos, Porta, Janela, Seleção e Esc, clicar num ícone do carrossel (rola e destaca), scroll-spy na rolagem e busca.
  NÃO verificado: arrastar um cartão para a planta e telas estreitas (< 1280 px).

## Animações da interface (pequenas, em CSS)

- **Pílula deslizante** compartilhada: hook `useSlidingPill(activeKey)` (`use-sliding-pill.ts`) mede a aba ativa (`offsetLeft/Top/Width/Height`) e o `<span>`
  da pílula anima `left/top/width/height` em 300 ms (`cubic-bezier(.34,1.3,.64,1)`, uma mola leve); sem animação no 1º desenho; `ResizeObserver` remede.
  Usada no **dock** (pílula preta) e em cada grupo do **seletor de visão em vidro fosco** (pílula branca em 2D/2D+3D/3D, Inteiras/Auto/Baixas, câmera).
  O container das abas precisa ser `position: relative`.
- **Seletor de visão:** os controles do 3D ficam sempre montados num wrapper `overflow-hidden` com `max-width`/`opacity` em transição (a barra cresce do centro;
  `inert` + `aria-hidden` quando em 2D).
- **Painel esquerdo e gaveta de objetos:** `animate-in fade-in-0 slide-in-from-left-6` (tw-animate-css, 300 ms) ao montar, então a troca painel ⇄ gaveta e entre os
  modos da gaveta (`key={drawer}`) desliza/some com fade. **Editor da direita** (`properties-panel.tsx`): o conteúdo é remontado com `key` = seleção e entra com
  `fade-in-0 slide-in-from-right-3` (200 ms). Verificado no navegador amostrando opacidade/posição durante as transições; não há teste automatizado (visual).
- **Troca 2D ⇄ 3D ⇄ 2D+3D animada:** as duas seções (`main` do `editor.tsx`) são `absolute inset-y-0` e ficam em `left/width` dados por `viewLayout(view)` (pura, testada;
  2D = 0/100 %, 3D = 0/100 %, split = 0/50 % e 50/50 %; a seção escondida guarda a metade do split). `transition-[left,width,opacity] duration-300` desliza/alarga
  e faz fade; a seção que sai continua montada por 300 ms (`useDelayedUnmount`) com `opacity-0` e `pointer-events-none`; a que entra usa `animate-in fade-in-0`. O 3D fica por
  cima (`z-[1]`, `bg-background`) para o cruzamento. Verificado no navegador medindo opacidade e posição durante as trocas (2D→3D→split→2D).
- **Padrões do 3D** (`DEFAULT_VIEW3D` em `view-layout.ts`, testado): "Esconder teto e telhado" vem **ligado** por padrão (`cutaway: true`), câmera em órbita e paredes em **Auto**.
