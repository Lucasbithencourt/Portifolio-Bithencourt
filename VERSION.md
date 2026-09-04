# Versionamento de cache (cache busting)

Os arquivos locais `style.css` e `main.js` são carregados nas 6 páginas com
um parâmetro de versão na URL:

```html
<link rel="stylesheet" href="style.css?v=1" />
<script src="main.js?v=1"></script>
```

O navegador do visitante trata `style.css?v=1` e `style.css?v=2` como
arquivos diferentes. Então, mudar esse número força o download da versão
nova em vez de servir a antiga do cache.

## ⚠️ REGRA (manual — não é automático)

**Sempre que você editar `main.js` OU `style.css`, incremente o `?v=` desses
dois arquivos em TODAS as 6 páginas antes do próximo deploy.**

Ex.: `?v=1` → `?v=2` na próxima vez, `?v=3` na seguinte, e assim por diante.

- Use o MESMO número nos dois arquivos e nas 6 páginas (todas compartilham
  os mesmos `style.css` e `main.js`).
- As 5 páginas: `index.html`, `case.html`, `case-02.html`, `case-03.html`,
  `case-04.html`.
- NÃO mexa nos `<script>` do GSAP/Lenis (CDN) — eles já têm a versão na
  própria URL (`.../gsap/3.12.5/...`, `.../lenis@1.1.14/...`).

## Find-and-replace rápido (terminal, na raiz do projeto)

Troque `29` (versão atual) por `30` (versão nova) nas duas ocorrências:

```bash
# macOS (sed -i '')
sed -i '' 's|style.css?v=29|style.css?v=30|; s|main.js?v=29|main.js?v=30|' \
  index.html case.html case-02.html case-03.html case-04.html
```

Depois confirme que ficou tudo igual:

```bash
grep -o 'style.css?v=[0-9]*\|main.js?v=[0-9]*' *.html
```

Todos devem mostrar o MESMO número novo.

## Versão atual: v=29

(Atualize esta linha junto com o find-and-replace, pra você sempre saber
qual é o número corrente.)

---

Isso é uma solução manual e suficiente por enquanto. Quando montar um
processo de build (Vite, por exemplo), o hash de conteúdo nos nomes dos
arquivos passa a fazer isso automaticamente e este passo manual some.
