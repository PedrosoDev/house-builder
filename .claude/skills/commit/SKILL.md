---
name: commit
description: Cria commits Git pequenos, atômicos e auto-explicativos seguindo Conventional Commits com escopo, em português. Use sempre que o usuário pedir para commitar, fazer commit, "comita isso", "salva no git", agrupar mudanças em commits, ou quando houver alterações no working tree prontas para versionar. NÃO adiciona Claude como coautor.
---

# Commit

Cria commits Git pequenos, atômicos e auto-explicativos. Cada commit agrupa
mudanças relacionadas por unidade lógica — nunca um único commit gigante com
tudo misturado.

## Regras inegociáveis

1. **Nunca** adicionar coautor. Não usar `Co-authored-by`, não citar Claude,
   Anthropic, IA ou ferramentas na mensagem ou no rodapé. A autoria é só do usuário.
2. **Commits pequenos e atômicos**: cada commit faz uma coisa só e pode ser
   revertido isoladamente sem quebrar nada.
3. **Auto-explicativo**: lendo só a mensagem dá pra entender o que mudou e por quê,
   sem abrir o diff.
4. Idioma das mensagens: **português**.

## Formato da mensagem

Conventional Commits **com escopo**:

```
<tipo>(<escopo>): <descrição curta no imperativo>
```

- `tipo`: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `perf`,
  `build`, `ci`, `revert`.
- `escopo`: módulo/área afetada (ex: `api`, `auth`, `ui`, `db`, `n8n`). Quando
  não houver escopo natural, omitir os parênteses: `chore: ...`.
- `descrição`: imperativo, minúscula inicial, sem ponto final, ≤ 72 caracteres.
- Corpo (opcional): só quando o "porquê" não couber no título. Linha em branco
  separando, texto explicando a motivação — não o óbvio do diff.

Exemplos:
```
feat(auth): adiciona refresh token com rotação
fix(api): corrige timeout no callback de webhook
refactor(db): extrai query de propostas para repository
docs(readme): documenta as 3 rotas do flow de análise
chore: atualiza dependências do lockfile
```

## Fluxo

1. **Inspecionar o estado**:
   ```bash
   git status
   git diff           # mudanças não staged
   git diff --staged  # mudanças já staged
   ```
   Se não houver mudança nenhuma, avisar e parar.

2. **Agrupar por unidade lógica**. Analisar o diff e separar as mudanças em
   grupos coesos (uma feature, um fix, um refactor por grupo). Arquivos não
   relacionados vão em commits diferentes, mesmo que tenham sido alterados juntos.
   Se um único arquivo contém mudanças de naturezas diferentes, usar
   `git add -p` para stage parcial por hunk.

3. **Apresentar o plano** ao usuário antes de commitar: liste os commits
   planejados (mensagem + arquivos/hunks de cada um) e peça confirmação.
   Não commitar sem o ok.

4. **Commitar grupo a grupo**, fazendo stage só do que pertence a cada commit:
   ```bash
   git add <arquivos-do-grupo>
   git commit -m "tipo(escopo): descrição"
   ```
   Para mensagem com corpo, usar múltiplos `-m`:
   ```bash
   git commit -m "feat(api): adiciona rota de callback" -m "Recebe o retorno do webhook e atualiza o status da análise para concluído."
   ```

5. **Conferir** ao final:
   ```bash
   git log --oneline -n <quantidade-criada>
   ```
   Mostrar o resultado ao usuário.

## Garantias contra coautoria

- Nunca passar `--author` apontando para Claude.
- Nunca incluir trailers como `Co-authored-by:`, `Signed-off-by:` (a menos que o
  usuário peça explicitamente o seu próprio sign-off).
- Não escrever frases como "gerado por", "com ajuda de IA", "via Claude" em
  lugar nenhum da mensagem.
- Se o repositório tiver um template de commit que injete coautoria, ignorar
  esse trecho.

## Casos de borda

- **Tudo é uma coisa só de verdade**: se o diff realmente for uma única mudança
  coesa, um commit só está certo — não fatiar artificialmente.
- **Pre-commit hooks**: se um hook falhar, reportar o erro ao usuário e não
  contornar com `--no-verify` sem autorização.
- **Nada staged e nada modificado**: informar que não há o que commitar.
- **Arquivos novos não rastreados**: incluir no agrupamento normalmente
  (`git add` cobre untracked).
