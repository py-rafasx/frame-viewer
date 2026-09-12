# Frieren Frame Viewer

A simple way to browse Frieren frames, episode by episode. Every frame is a moment: the app shows the frame number and an estimated timestamp, and you can jump straight to a frame, shuffle, drag the progress bar or download the image. The URL keeps the moment — share `?season=1&episode=7&frame=1234` and the person opens exactly there.

**Live:** https://javaraf.github.io/frame-viewer/

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
├── index.html / main.js     Router: opens desktop or mobile depending on the device
├── static/
│   └── js/frame-viewer.js   All viewer logic (shared by desktop and mobile)
├── desktop/index.html       Desktop version (Editorial+)
├── mobile/index.html        Mobile version (Stack)
├── static/                  Background image and favicon
└── server.py                Local test server
```

## Keyboard (desktop)

`←`/`→` frame · `↑`/`↓` episode · `R` random. On mobile, swipe the image sideways.

## Honest notes

- The timestamp is an **estimate** (fixed fps per season), not the exact episode timecode.
- Depends on GitHub raw (proxy only as fallback); if GitHub is down, the app gets slow until it fails.