# Frieren Frame Viewer

A simple way to browse Frieren frames, episode by episode. Every frame is a moment: the app shows the frame number and an estimated timestamp, and you can jump straight to a frame, shuffle, drag the progress bar or download the image. The URL keeps the moment — share `?season=1&episode=7&frame=1234` and the person opens exactly there.

**Live:** https://py-rafasx.github.io/frame-viewer/

The root `index.html` decides on its own whether to open the **desktop** version (fullscreen, keyboard) or the **mobile** version (touch-first, with swipe navigation). There is no tutorial because there's no need: the buttons do what they look like.

## Running locally

```bash
python server.py
```

Then http://localhost:8000/ — same thing as the site, but from your machine. (The server only listens on `127.0.0.1`, hides dotfiles and sends no-cache headers: refresh and you get the latest files.)

## Using your own frames (fork)

The app is plain static HTML/JS — the trick is where the images live. They are served from a GitHub repository organized like this:

```
your-repo/
└── 01/0001.jpg
   0002.jpg
   ...
   02/0001.jpg
   ...
```

One folder per episode (two digits), and inside it the frames `0001.jpg`, `0002.jpg`, ... (four digits).

After forking, open `static/js/frame-viewer.js` and edit the `seasons` map at the top:

```js
const seasons = {
    "1": {
        name: "Season 1",
        user_name: "your-user",
        repo: "your-frames-repo",
        branch: "main",
        img_fps: 3.5,           // capture fps — used only to estimate the timestamp
        episodes: {
            1: { name: "Episode 1", frames: 5460 },  // frames = how many files are in folder 01
            2: { name: "Episode 2", frames: 5300 },
        }
    },
};
```

- `user_name` + `repo` + `branch` tell the app where the images come from.
- `frames` per episode must match the real file count in that folder.
- Publish on GitHub Pages (Settings → Pages → branch `main`) and you're done.

Images try to load straight from GitHub raw; if that fails (rate limit, network), they fall back to a public proxy. For a small fork this works well.

## Structure

```
├── index.html / main.js       Router: opens desktop or mobile depending on the device
├── static/
│   ├── js/                    Shared JS: frame-viewer, i18n, quiz-data, quiz
│   ├── fundo.jpg              Background image
│   └── chibi-frieren.jpeg
├── desktop/index.html         Desktop version (Editorial+)
├── mobile/index.html          Mobile version (Stack)
├── quiz/
│   ├── index.html             Quiz page
│   ├── questions.json         Community questions (added via Issue Form + Action)
│   └── img/                   Quiz images
├── .github/                   Issue Form + Action: approved issue → pull request
└── server.py                  Local test server
```

## Keyboard (desktop)

`←`/`→` frame · `↑`/`↓` episode · `R` random. On mobile, swipe the image sideways.

## Quiz

There is a Frieren quiz at `/quiz/` (linked from the header of both versions). It has multiple-choice questions, a limited number of **skips** and **remove one answer** helps, and a final score. It supports three languages — English, Português (BR) and Español — switchable in the header.

- The quiz is **adaptive**: each round has `QUESTIONS_PER_ROUND` questions (10 by default). It starts on **easy** questions and moves up to **medium**/**hard** as you answer correctly (and back down on wrong answers); skips don't change the level. Each question's difficulty is shown in a badge.
- Questions live in `static/js/quiz-data.js`; add one by following the existing format (each text field holds `en`, `pt-BR` and `es`, `correct` is the 0-based index of the right option, and `difficulty` is `"easy"`, `"medium"` or `"hard"`).
- Questions can include an optional `image` (plus `imageAlt` for accessibility) to ask the player to guess a character, object or place from a picture. Put the files in `quiz/img/` and reference them as `img/your-file.jpg` (or `.webp`), or use any full URL. If an image is missing, the quiz shows a "image unavailable" placeholder instead of a broken image. The character-portrait questions follow one convention: **the file name is the answer** (e.g. `img/Macht.webp` → answer "Macht"), so the existing `img/Denken.webp`, `img/Qual.jpg`, `img/Übel.jpg`, etc. already have their questions.
- UI strings and language detection are in `static/js/i18n.js`. Language order: `?lang=pt` in the URL → `localStorage` → browser language → English.
- `static/js/quiz.js` holds the game logic; the round length and skips/helps limits are the `QUESTIONS_PER_ROUND`/`SKIPS_TOTAL`/`HELPS_TOTAL` constants at the top.
- Community questions are kept in `quiz/questions.json` and merged with the base ones at load. The quiz start screen has a **Suggest a question** link that opens the GitHub Issue Form (see below).

## Suggesting a question (community)

On the quiz start screen there is a **Suggest a question** link. It opens the GitHub Issue Form (`.github/ISSUE_TEMPLATE/sugestao-pergunta.yml`), where anyone with a GitHub account can send a question in English, Português (BR) and Español, choose the category and difficulty, mark the correct answer and attach an image (drag and drop) or paste an image URL. There is no anonymous submission — an issue needs a GitHub account.

When you (the maintainer) add the `aprovado` label to the issue, the `Add approved quiz question` Action runs `.github/scripts/add-question.js`, which:

1. reads the form fields;
2. downloads the attached image into `quiz/img/` (hosts restricted to GitHub), naming the file after the correct answer;
3. appends the question to `quiz/questions.json`;
4. opens a pull request (`question/issue-<n>`) for you to review and merge. Merging closes the issue.

One-time setup:

- Create the labels `sugestao-pergunta` (applied by the form) and `aprovado` (you apply it to approve) — Issues → Labels → New label.
- Enable PR creation by Actions: **Settings → Actions → General → Workflow permissions** → check **"Allow GitHub Actions to create and approve pull requests"**. If you prefer not to, create a personal access token and store it as the `GH_PAT` secret — the workflow uses it automatically when present.
- The base questions stay in `static/js/quiz-data.js`; community ones live only in `quiz/questions.json`.

## Honest notes

- The timestamp is an **estimate** (fixed fps per season), not the exact episode timecode.
- Depends on GitHub raw (proxy only as fallback); if GitHub is down, the app gets slow until it fails.
