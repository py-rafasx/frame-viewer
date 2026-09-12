# Frieren Frame Viewer

Um jeito simples de navegar pelos frames de Frieren, episódio por episódio. Cada frame é um momento: o app mostra o número do frame, o tempo aproximado, e dá pra pular direto, sortear, arrastar o progresso ou baixar a imagem. A URL guarda o momento — dá pra mandar `?season=1&episode=7&frame=1234` e a pessoa abre exatamente ali.

**Ao vivo:** https://javaraf.github.io/frame-viewer/

O `index.html` da raiz decide sozinho se abre a versão **desktop** (tela cheia, teclado) ou **mobile** (otimizada para toque, com swipe). Não tem tutorial porque não precisa: os botões fazem o que parecem.

## Rodando local

```bash
python server.py
```

Depois http://localhost:8000/ — mesma coisa que o site, só que da sua máquina. (O servidor só escuta em `127.0.0.1`, esconde arquivos ocultos e não guarda cache: recarregou, viu a versão nova.)

## Usando seus próprios frames (fork)

O app é só HTML/JS estático — o segredo é onde as imagens moram. Elas são servidas de um repositório GitHub organizado assim:

```
seu-repo/
└── 01/0001.jpg
   0002.jpg
   ...
   02/0001.jpg
   ...
```

Ou seja: uma pasta por episódio (com dois dígitos), e dentro os frames `0001.jpg`, `0002.jpg`, ... (quatro dígitos).

No fork, abra `frame-viewer.js` e ajuste o mapa `seasons` no topo:

```js
const seasons = {
    "1": {
        name: "Season 1",
        user_name: "seu-usuario",
        repo: "seu-repo-de-frames",
        branch: "main",
        img_fps: 3.5,            // fps da captura — usado só pra estimar o timestamp
        episodes: {
            1: { name: "Episode 1", frames: 5460 },  // frames = quantos arquivos tem na pasta 01
            2: { name: "Episode 2", frames: 5300 },
        }
    },
};
```

- `user_name` + `repo` + `branch` definem de onde vêm as imagens.
- `frames` por episódio precisa bater com a contagem real de arquivos da pasta.
- Publique no GitHub Pages (Settings → Pages → branch `main`) e pronto.

As imagens tentam carregar direto do GitHub raw; se falhar (rate-limit, rede), caem num proxy público como fallback. Pra fork pequeno isso resolve bem.

## Estrutura

```
├── index.html / main.js     Roteador: abre desktop ou mobile conforme o dispositivo
├── frame-viewer.js          Toda a lógica (desktop e mobile usam o mesmo arquivo)
├── desktop/index.html       Versão desktop (Editorial+)
├── mobile/index.html        Versão mobile (Stack)
├── static/                  Fundo e favicon
└── server.py                Servidor local de testes
```

## Teclado (desktop)

`←`/`→` frame · `↑`/`↓` episódio · `R` random. No celular, arraste a imagem pro lado.

## Observações honestas

- O timestamp é uma **estimativa** (fps fixo por temporada), não o timecode exato do episódio.
- Depende de GitHub raw (+ proxy só no fallback); se o GitHub cair, o app fica lento até cair de vez.