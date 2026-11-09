# Estudo do canvas do Figma → estratégia para o 2D do House Builder

Fonte: Figma Desktop 126.11.8 instalado em `%LOCALAPPDATA%\Figma` e o cache web do app
(`%APPDATA%\Figma\DesktopProfile\v44\Cache`). Análise estática com o REA e scripts locais; o app **não foi executado**
e nada do código/WASM do Figma foi copiado para este repositório. Só registramos fatos de arquitetura e de UX.

## Observado (evidência direta)

| Fato | Como foi observado |
| --- | --- |
| O desktop é um shell **Electron** (`resources/app.asar`, `desktop_rust.node`, `figma_agent.exe`); o `app.asar` usa cabeçalho fora do padrão (entrada `.codesign`, tamanho `-1000`) e o REA o recusou como malformado | `inspect_desktop_application`, `analyze_javascript_application`, leitura do cabeçalho |
| O editor roda como **dois módulos WASM** (~29 MB e ~54 MB descomprimidos, brotli), compilados com Emscripten; uma única família de importações `gl` (WebGL), ~800–1800 imports, 2.8k–5.1k exports; seção `name` presente mas com símbolos minificados | parser de seções WASM sobre o cache (WABT não estava configurado no REA) |
| O JS do editor contém código de **WebGPU** (`navigator.gpu`), **OffscreenCanvas**, **Workers**, `SharedArrayBuffer`, `devicePixelRatio`, MSAA, `requestAnimationFrame` | contagem de termos nos bundles do cache |
| Entrada: `wheel` com `ctrlKey` (pinça do trackpad/zoom), `deltaMode`, `setPointerCapture`, `gesturestart` (Safari), `visualViewport`, tecla **Space** (arrastar), `contextmenu` próprio | idem |
| Ações nomeadas: `zoom-to-fit`, `zoom-to-selection`, `ZOOM_TO_100`/menu 50%/200%, `toggle-snapping-to-objects`, `toggle-snapping-to-geometry`, grade de pixels e *snap to pixel grid*, `toggle-rulers`, ferramenta **Measure** | idem |

## Inferido (não verificado em execução)

- O canvas **não é DOM/SVG**: uma cena em C++ é rasterizada na GPU; a UI de seleção (caixa, alças, guias, réguas) é desenhada pelo
  mesmo motor em espaço de tela, com tamanho constante em pixels.
- O ciclo é "evento → atualiza modelo → marca sujo → um único quadro por `requestAnimationFrame`", sem passar pelo React.
- Alterações de câmera (zoom/pan) são baratas: só mudam a matriz de vista; o conteúdo não é recriado.

## Estratégia adotada no House Builder (2D)

Mantivemos **SVG** (planta com centenas de elementos, texto nítido, exportável) mas copiamos a estratégia do Figma:

1. **Cena separada da câmera.** A cena (`plan-scene.tsx`) é memoizada e só re-renderiza quando o piso muda; zoom/pan só mudam a
   transformação do grupo. Traços usam `vector-effect: non-scaling-stroke`.
2. **Chrome em espaço de tela** (`plan-overlay.tsx`): seleção, alças, guias, medidas, rótulos e pílulas têm tamanho constante em px.
3. **Grade e réguas em `<canvas>`** (`viewport-grid.tsx`) com passo adaptativo 1-2-5 e retina (DPR).
4. **Modelo de entrada do Figma:** rolar = mover vista; Ctrl/⌘+rolar ou pinça = zoom no cursor; Espaço/botão do meio/mão = arrastar;
   clique direito = menu de contexto; Shift+1 enquadrar tudo, Shift+2 enquadrar seleção, Shift+0 100%, +/− degraus de zoom;
   transições animadas de câmera.
5. **Seleção estilo Figma:** hover, contorno por objeto + caixa de seleção com 8 alças de redimensionar, rotação pelos cantos,
   pílula com dimensões, marquee, Shift soma, Alt+arrastar duplica, Shift+arrastar trava eixo.
6. **Guias inteligentes** (snap a bordas/centros de objetos, linhas vermelhas) e **medição com Alt** (distâncias até o objeto sob o cursor).
7. **Auto-pan** ao arrastar perto da borda da viewport e **renomear cômodo** com duplo clique.

## Fora do escopo desta etapa

Renderização WebGL/WebGPU, guias arrastáveis a partir das réguas, snap à grade de pixels, redimensionar grupos, colaboração multiusuário.
