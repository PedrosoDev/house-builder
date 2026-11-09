# House Builder

Editor de plantas residenciais em 2D com visualização 3D, inspirado nas funcionalidades do **Planner 5D**
(versão Windows 4.2.2). Construído com **TanStack Start**, **TanStack Form**, **shadcn/ui**, **three.js** e **Prisma (SQLite)**.

## Como rodar (npm)

Este projeto usa **npm**. Não use pnpm nem yarn.

```bash
npm install
npm run db:generate # gera o client do Prisma
npm run db:push     # cria o banco local (SQLite)
npm run db:seed     # opcional: projetos de exemplo
npm run dev         # http://localhost:3000
```

Outros comandos: `npm run build`, `npm run preview`, `npm run check` (Biome), `npx tsc --noEmit` (tipos),
`npm test` (Vitest) e `npm run test:watch`. O projeto é desenvolvido com TDD: o teste vem antes da implementação.

Requer um arquivo `.env.local` com `DATABASE_URL` (ex.: `file:./dev.db`), `BETTER_AUTH_URL` e `BETTER_AUTH_SECRET`.

> No Windows, se o `npm install` falhar com `EPERM`/`ENOENT`, apague `node_modules` e rode
> `npm install --no-audit --no-fund --prefer-offline --maxsockets=4`. Excluir a pasta do projeto do antivírus ajuda.
> O npm avisa sobre scripts de instalação não aprovados (`prisma`, `better-sqlite3`, `@prisma/engines`, `esbuild`);
> se algum falhar, use `npm install-scripts approve <pacote>`.

## O que a engenharia reversa (REA) mostrou sobre o Planner 5D

Análise estática do pacote instalado (`UABPlanner5D.Planner5D-HomeInteriorDesign_4.2.2.0`), sem executar o app:

| Achado | Evidência |
| --- | --- |
| Shell **WinUI 3 / .NET 8** com módulos `Planner5D.Editor`, `.Catalog`, `.Projects`, `.Spaces`, `.AI`, `.ExportImport`, `.Collab`, `.Commerce`, `.Unity3D` | `inspect_managed_artifact` / `inspect_managed_members` nas DLLs |
| O editor 2D/3D roda num **processo Unity embutido** (`Assets/UnityBuild`, `Planner5D.UnityStandalone.exe`) controlado por RPC; o shell só repassa mouse/teclado | `Planner5D.Unity3D` (`UnityEmbeddedProcess`, `EventsRedirector*`, `UnityConnection`) |
| Modelo de itens: **Project → Floor → Room / Wall / Partition / Door / Window / Point / Ground / Ruler / Group / objetos de catálogo** | apresentadores `*ItemPresenter` em `Planner5D.Editor` |
| Edição por **comandos desfazíveis** (Create/Delete/Move/Rotate/Duplicate/Group/Flip/Split wall/Wall thickness/Room height/Floor create-duplicate-reorder-rename/Hide roof/Change material/Open-close) | namespace `ItemCommands` |
| Desenho de paredes como *ação prolongada* (`DrawPartitionWall`), divisão de paredes, criação automática de cômodos fatiados | `ProlongedAction`, `CreateSlicedRooms` |
| Catálogo em SQLite: categorias hierárquicas (Construção, Exterior, Interior…), itens com flags `editable_materials/position/rotation/size`, texturas por tipo, tipos de cômodo, busca por índice de palavras, projetos-modelo | `inspect_sqlite_database` em `Assets/Catalog/database.sqlite` |
| Materiais: textura + cor + escala + rotação; tipos de textura (reboco, parquet, laminado, tijolo, pedra, papel de parede, azulejo, madeira, telhado, concreto…) | `DataModels.Items.Material`, tabela `texture_types` |
| Módulos de **IA**: chat que executa comandos no projeto (AddWall/AddItem/Group/ChangeMaterial/Delete), reconhecimento de planta (ONNX SqueezeNet), melhoria de render, busca de casa por endereço | `Planner5D.AI` |
| Projetos sincronizados com a nuvem (listas, arquivados, compartilhados), colaboração e loja | `Planner5D.Spaces`, `.Collab`, `.Commerce`, `.RabbitMQ` |

Nada do código, dos modelos 3D, das texturas ou do catálogo do Planner 5D foi copiado: o House Builder reimplementa o
comportamento observado com geometria e catálogo próprios (itens paramétricos feitos de primitivas).

## Funcionalidades implementadas

- **Projetos**: criar a partir de modelos (cômodo vazio, studio, apartamento, casa de dois andares, casa de madeira), renomear, duplicar, excluir, importar/exportar JSON, salvamento automático.
- **Planta 2D**: paredes e divisórias com encaixe magnético (grade, ângulos de 15°, pontas de paredes), divisão automática de paredes em T, detecção automática de cômodos fechados, cômodos poligonais e retangulares, portas (simples, dupla, de correr, arco, garagem) e janelas arrastáveis sobre as paredes, escadas, régua, borracha, medidas e áreas, seleção múltipla com marquee, mover/rotacionar/duplicar/agrupar/travar/espelhar, copiar e colar, desfazer/refazer, zoom e pan.
- **Múltiplos pisos**: criar, duplicar, reordenar, renomear, ocultar, pé-direito por piso, piso inferior esmaecido; telhado (duas águas, quatro águas, uma água, laje).
- **3D (three.js)**: paredes com recortes reais de portas e janelas, pisos e forros com texturas procedurais, móveis montados por primitivas, escadas, telhados, sol/ambiente (dia, entardecer, noite, estúdio), corte (esconde teto/telhado), órbita ou caminhada em primeira pessoa (WASD), seleção por clique, captura de imagem.
- **Catálogo**: 21 categorias, ~60 objetos, busca por nome/tag, arrastar e soltar na planta, alinhamento automático às paredes.
- **Materiais**: texturas por família + cores + escala + rotação para paredes (cada lado), pisos, telhado e molduras.
- **Assistente offline**: comandos em português (“adicione um sofá na sala”, “crie um quarto de 4 por 3 metros”, “pinte a parede de azul”…). Não usa modelo remoto.
- **Exportação**: projeto (.house.json), planta (PNG/SVG), imagem 3D (PNG), quantitativo (CSV).

## Canvas 2D (estratégia do Figma)

O 2D segue o modelo de interação do Figma, estudado a partir do app desktop instalado e do cache web dele
(detalhes e o que foi observado × inferido em [`docs/figma-canvas-study.md`](docs/figma-canvas-study.md)).

| Ação | Atalho |
| --- | --- |
| Mover a vista | rolar · Espaço+arrastar · botão do meio · ferramenta Mão (H) |
| Zoom no cursor | Ctrl/⌘+rolar · pinça no trackpad · `+` / `−` (degraus) |
| Enquadrar tudo / seleção / 100% | Shift+1 / Shift+2 / Shift+0 |
| Réguas | Shift+R |
| Duplicar arrastando | Alt+arrastar |
| Medir distância até outro objeto | segurar Alt sobre ele (com algo selecionado) |
| Travar eixo / manter proporção | Shift ao arrastar / Shift ao redimensionar um canto |
| Desligar encaixe | Ctrl/⌘ |
| Menu de contexto | botão direito |
| Renomear cômodo | duplo clique |

## Arquitetura

```
src/
  routes/                     TanStack Start (arquivo = rota). index = projetos, projects.$projectId = editor (ssr: false)
  components/
    ui/                       componentes shadcn/ui
    form/form-hooks.tsx       createFormHook: campos shadcn (Field/Input/Select/Switch/Slider…) ligados ao TanStack Form
    planner/                  editor, canvas 2D (SVG), vista 3D (three.js), painéis (catálogo, pisos, propriedades, IA)
  lib/planner/                modelo de dados, geometria, catálogo, materiais, store com histórico, templates, export
  lib/planner/projects.functions.ts   server functions (Prisma) para listar/abrir/salvar/excluir projetos
prisma/schema.prisma          modelo Project (documento JSON + metadados)
```

Todos os formulários usam **TanStack Form + shadcn/ui** (`useAppForm`): diálogo de novo projeto, renomear, comando do
assistente e todo o painel de propriedades (`useEntityForm` valida com zod e grava no store como um único passo de desfazer).

## Fora do escopo (dependem de serviços do Planner 5D)

Sincronização em nuvem e colaboração em tempo real, loja/assinaturas, reconhecimento de planta por imagem (modelo ONNX
proprietário), melhoria de render por IA, busca de casas por endereço, concursos de design e o catálogo completo de modelos 3D do Planner 5D.
