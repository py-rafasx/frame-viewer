// Frieren Frame Viewer — lógica única para desktop e mobile.
// Carregado por desktop/index.html e mobile/index.html.
//
// CONFIGURAÇÃO (para fork): edite `seasons` abaixo e coloque seus frames em
// um repositório GitHub com imagens em {repo}/{branch}/{ep}/0001.jpg .. nnnn.jpg.
// `img_fps` é o fps de captura (usado só para estimar o timestamp).

const seasons = {
    "1": {
        name: "Season 1",
        user_name: "py-rafasx",
        repo: "frames",
        branch: "main",
        img_fps: 3.5,
        episodes: {
            1: { name: "Episode 1", frames: 5460 }, 2: { name: "Episode 2", frames: 5460 }, 3: { name: "Episode 3", frames: 5145 }, 4: { name: "Episode 4", frames: 5459 },
            5: { name: "Episode 5", frames: 5145 }, 6: { name: "Episode 6", frames: 5145 }, 7: { name: "Episode 7", frames: 5145 }, 8: { name: "Episode 8", frames: 5145 },
            9: { name: "Episode 9", frames: 5145 }, 10: { name: "Episode 10", frames: 5145 }, 11: { name: "Episode 11", frames: 5145 }, 12: { name: "Episode 12", frames: 5145 },
            13: { name: "Episode 13", frames: 5145 }, 14: { name: "Episode 14", frames: 5145 }, 15: { name: "Episode 15", frames: 5145 }, 16: { name: "Episode 16", frames: 5061 },
            17: { name: "Episode 17", frames: 5145 }, 18: { name: "Episode 18", frames: 5145 }, 19: { name: "Episode 19", frames: 5145 }, 20: { name: "Episode 20", frames: 5145 },
            21: { name: "Episode 21", frames: 5145 }, 22: { name: "Episode 22", frames: 5145 }, 23: { name: "Episode 23", frames: 5145 }, 24: { name: "Episode 24", frames: 5145 },
            25: { name: "Episode 25", frames: 5145 }, 26: { name: "Episode 26", frames: 5061 }, 27: { name: "Episode 27", frames: 5145 }, 28: { name: "Episode 28", frames: 5121 }
        }
    },
    "2": {
        name: "Season 2",
        user_name: "py-rafasx",
        repo: "season2",
        branch: "master",
        img_fps: 3.5,
        episodes: {
            1: { name: "Episode 1", frames: 5040 }, 2: { name: "Episode 2", frames: 5040 }, 3: { name: "Episode 3", frames: 5040 }, 4: { name: "Episode 4", frames: 5040 },
            5: { name: "Episode 5", frames: 5040 }, 6: { name: "Episode 6", frames: 5040 }, 7: { name: "Episode 7", frames: 5040 }, 8: { name: "Episode 8", frames: 5040 },
            9: { name: "Episode 9", frames: 5040 }, 10: { name: "Episode 10", frames: 5005 }
        }
    }
};

const base_url = "https://raw.githubusercontent.com";
const PROXY_BASE = "https://images.weserv.nl/?url=";

// ------------------------------------------------------------------ elementos

const prev_btn = document.getElementById("prev-btn");
const next_btn = document.getElementById("next-btn");
const random_btn = document.getElementById("random-btn");
const download_btn = document.getElementById("download-btn");
const season_list = document.getElementById("season-list");
const episode_list = document.getElementById("episode-list");
const current_image = document.getElementById("current-image");
const frame_input = document.getElementById("frame-input");
const progress_bar = document.getElementById("progress-bar");
const current_time_display = document.getElementById("current-time");
const total_time_display = document.getElementById("total-time");
const errMsgView = document.getElementById('err-msg-view');
const spinner = document.querySelector('.spinner');

// timestamp: desktop usa <input readonly>, mobile usa <span> (botão)
const timestamp_el = document.getElementById("timestamp-input") || document.getElementById("timestamp-btn");
const timestamp_is_input = timestamp_el && timestamp_el.tagName === "INPUT";

// globais usadas pelas páginas (wrapper scripts leem global_frame/seasons)
global_season = null;
global_episode = null;
global_frame = null;

// debounce do slider
let progress_bar_timeout = null;

// ------------------------------------------------------------------ URLs

function raw_image_url(frame_number) {
    return `${base_url}/${seasons[global_season].user_name}/${seasons[global_season].repo}/${seasons[global_season].branch}/${global_episode.toString().padStart(2, '0')}/${frame_number.toString().padStart(4, '0')}.jpg`;
}

function proxied_image_url(raw_url) {
    return `${PROXY_BASE}${encodeURIComponent(raw_url.replace(/^https?:\/\//, ''))}`;
}

// ------------------------------------------------------------------ listeners

season_list.addEventListener('change', function () {
    if (seasons[this.value]) {
        global_season = this.value;
        global_episode = 1;
        set_episode();
        load_frame_from_input_or_random();
    }
});

episode_list.addEventListener('change', function () {
    if (seasons[global_season] && seasons[global_season].episodes[this.value]) {
        global_episode = parseInt(this.value);
        load_frame_from_input_or_random();
    }
});

frame_input.removeEventListener('change', null);
frame_input.removeEventListener('keypress', null);

// salto pelo teclado: confirma em Enter em vez de disparar a cada dígito
frame_input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        const frame_number = parseInt(this.value);
        if (!isNaN(frame_number)) load_frame(frame_number);
        this.blur();
    }
});
frame_input.addEventListener('change', function () {
    const frame_number = parseInt(this.value);
    if (!isNaN(frame_number)) load_frame(frame_number);
});

// slider com debounce para não sobrecarregar ao arrastar
progress_bar.addEventListener('input', function () {
    if (progress_bar_timeout) clearTimeout(progress_bar_timeout);
    progress_bar_timeout = setTimeout(() => {
        const max_frames = seasons[global_season].episodes[global_episode].frames;
        const progress_percentage = parseFloat(this.value);
        const target_frame = Math.round(1 + (progress_percentage / 100) * (max_frames - 1));
        load_frame(Math.max(1, Math.min(target_frame, max_frames)));
        progress_bar_timeout = null;
    }, 50);
});

document.addEventListener('DOMContentLoaded', function () {
    set_season();
    set_episode();
    loadFromURL();
});

// ------------------------------------------------------------------ teclado

addEventListener('keydown', function (event) {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowup', 'arrowright', 'arrowdown', 'a', 'w', 'd', 's'].includes(key)) {
        event.preventDefault();
        if (key === 'arrowleft' || key === 'a') prev_frame();
        else if (key === 'arrowright' || key === 'd') next_frame();
    } else if (key === 'r') {
        random_frame();
    }
});

addEventListener('keydown', function (event) {
    const key = event.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') {
        if (global_episode < Object.keys(seasons[global_season].episodes).length) {
            global_episode++;
            episode_list.value = global_episode;
        }
    } else if (key === 'arrowdown' || key === 's') {
        if (global_episode > 1) {
            global_episode--;
            episode_list.value = global_episode;
        }
    }
    if (key === 'arrowup' || key === 'w' || key === 'arrowdown' || key === 's') {
        event.preventDefault();
        load_frame(global_frame);
    }
});

// ------------------------------------------------------------------ gestos (swipe)

(function attach_swipe() {
    const zone = current_image.parentElement;
    if (!zone || !window.TouchEvent) return;
    let start_x = null;
    zone.addEventListener('touchstart', function (event) {
        start_x = event.touches[0].clientX;
    }, { passive: true });
    zone.addEventListener('touchend', function (event) {
        if (start_x == null) return;
        const delta_x = event.changedTouches[0].clientX - start_x;
        start_x = null;
        if (Math.abs(delta_x) < 40) return;
        if (delta_x < 0) next_frame(); else prev_frame();
    }, { passive: true });
})();

// ------------------------------------------------------------------ temporadas

function set_season() {
    season_list.innerHTML = '';
    const seasonIds = Object.keys(seasons);
    for (const seasonId of seasonIds) {
        const option = document.createElement('option');
        option.value = seasonId;
        option.textContent = seasons[seasonId].name;
        season_list.appendChild(option);
    }
    if (global_season == null) {
        global_season = seasonIds[Math.floor(Math.random() * seasonIds.length)];
        season_list.value = global_season;
    } else {
        season_list.value = global_season;
    }
}

function set_episode() {
    episode_list.innerHTML = '';
    for (const [episodeId, episodeData] of Object.entries(seasons[global_season].episodes)) {
        const option = document.createElement('option');
        option.value = episodeId;
        option.textContent = episodeData.name;
        episode_list.appendChild(option);
    }
    if (global_episode == null) {
        global_episode = Math.floor(Math.random() * Object.keys(seasons[global_season].episodes).length) + 1;
    }
    episode_list.value = global_episode;
}

// ------------------------------------------------------------------ tempo

function format_time_from_seconds(total_seconds) {
    const hours = Math.floor(total_seconds / 3600);
    const minutes = Math.floor((total_seconds % 3600) / 60);
    const seconds = total_seconds % 60;
    const milliseconds = (seconds - Math.floor(seconds)) * 100;
    return `${hours.toString().padStart(1, '0')}:${minutes.toString().padStart(2, '0')}:${Math.floor(seconds).toString().padStart(2, '0')}.${milliseconds.toFixed(0).padStart(2, '0')}`;
}

function frame_to_seconds(frame_number) {
    return frame_number / seasons[global_season].img_fps;
}

function set_timestamp() {
    const text = format_time_from_seconds(frame_to_seconds(global_frame));
    if (timestamp_is_input) timestamp_el.value = text;
    else timestamp_el.textContent = text;
    update_progress_bar();
}

// ------------------------------------------------------------------ navegação

function load_frame_from_input_or_random() {
    const inputFrame = parseInt(frame_input.value);
    if (!isNaN(inputFrame) && inputFrame > 0) {
        load_frame(inputFrame);
    } else {
        random_frame();
    }
}

function update_progress_bar() {
    if (!global_season || !global_episode || !global_frame) return;
    const max_frames = seasons[global_season].episodes[global_episode].frames;
    progress_bar.value = ((global_frame - 1) / (max_frames - 1)) * 100;
    current_time_display.textContent = format_time_from_seconds(frame_to_seconds(global_frame));
    total_time_display.textContent = format_time_from_seconds(frame_to_seconds(max_frames));
}

function prev_frame() {
    if (global_frame > 1) load_frame(global_frame - 1);
}

function next_frame() {
    const max_frames = seasons[global_season].episodes[global_episode].frames;
    if (global_frame < max_frames) load_frame(global_frame + 1);
}

function random_frame() {
    const max_frames = seasons[global_season].episodes[global_episode].frames;
    load_frame(Math.floor(Math.random() * max_frames) + 1);
}

// ------------------------------------------------------------------ carregamento

function load_frame(frame_number) {
    if (frame_number === null || frame_number === undefined) {
        errMsgView.style.display = 'flex';
        errMsgView.textContent = 'Invalid frame number. Please enter a valid frame.';
        return;
    }
    errMsgView.style.display = 'none';

    const max_frames = seasons[global_season].episodes[global_episode].frames;
    if (frame_number < 1 || frame_number > max_frames) {
        frame_input.value = global_frame;
        return;
    }

    const image_url = raw_image_url(frame_number);
    const proxied_url = proxied_image_url(image_url);

    spinner.style.display = 'block';
    current_image.src = image_url; // tenta o GitHub raw primeiro
    global_frame = frame_number;

    if (document.activeElement !== frame_input) {
        frame_input.value = frame_number;
    }

    current_image.onload = () => {
        spinner.style.display = 'none';
    };

    // fallback: se o raw falhar (404, rate-limit, rede), usa o proxy
    current_image.onerror = () => {
        current_image.src = proxied_url;
        current_image.onerror = () => {
            spinner.style.display = 'none';
            errMsgView.style.display = 'flex';
            errMsgView.textContent = 'Error loading image. Choose another frame.';
        };
    };

    preload_next_frame();
    updateURL();
    set_timestamp();
}

// pré-carrega o próximo frame para evitar flicker ao avançar
let preload_cache = [];
function preload_next_frame() {
    const max_frames = seasons[global_season].episodes[global_episode].frames;
    if (global_frame >= max_frames) return;
    const next_url = raw_image_url(global_frame + 1);
    preload_cache = preload_cache.filter(l => !l.settled);
    const loader = new Image();
    loader.settled = false;
    loader.onload = loader.onerror = () => { loader.settled = true; };
    loader.src = next_url;
    preload_cache.push(loader);
}

// ------------------------------------------------------------------ download

async function download_frame() {
    try {
        if (!current_image.complete || !current_image.naturalWidth) {
            errMsgView.style.display = 'flex';
            errMsgView.textContent = 'Wait for the image to load completely.';
            return;
        }

        // tenta baixar do GitHub raw; se falhar, usa o proxy
        const raw = raw_image_url(global_frame);
        let response = await fetch(raw);
        if (!response.ok) {
            response = await fetch(proxied_image_url(raw));
        }
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const blob = await response.blob();
        if (blob.size === 0) throw new Error('Empty or corrupted image');

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `season${global_season}_episode${global_episode}_frame${global_frame.toString().padStart(4, '0')}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error(`[download_frame] ${error.message}`);
        errMsgView.style.display = 'flex';
        errMsgView.textContent = 'Error downloading frame. Please try again.';
    }
}

prev_btn.addEventListener('click', prev_frame);
next_btn.addEventListener('click', next_frame);
random_btn.addEventListener('click', random_frame);
download_btn.addEventListener('click', download_frame);

// ------------------------------------------------------------------ URL

function updateURL() {
    const params = new URLSearchParams(window.location.search);
    params.set('season', global_season);
    params.set('episode', global_episode);
    params.set('frame', global_frame);
    window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
}

function loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    const season = params.get('season');
    const episode = params.get('episode');
    const frame = params.get('frame');

    if (!season && !episode && !frame) {
        global_season = Math.floor(Math.random() * Object.keys(seasons).length) + 1;
        global_episode = Math.floor(Math.random() * Object.keys(seasons[global_season].episodes).length) + 1;
        season_list.value = global_season;
        set_episode();
        random_frame();
        return;
    }

    if (season && Object.keys(seasons).includes(season)) {
        global_season = season;
        season_list.value = season;
        set_episode();
    }

    if (episode && Object.keys(seasons[global_season].episodes).includes(episode)) {
        global_episode = episode;
        episode_list.value = episode;
    }

    if (frame) {
        const frameNumber = parseInt(frame);
        if (!isNaN(frameNumber)) load_frame(frameNumber);
    }
}

window.addEventListener('popstate', loadFromURL);