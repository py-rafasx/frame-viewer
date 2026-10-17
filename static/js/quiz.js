// Frieren Quiz — lógica única da página quiz/.
// Depende de i18n.js (carregado antes no HTML) e de quiz/questions.json, buscado
// em tempo de execução (fonte única das perguntas: base + comunidade).
//
// Recursos: respostas pré-selecionadas (múltipla escolha), pulos limitados,
// ajuda "eliminar uma resposta" e pontuação final. Multi-idioma via i18n.js.

const SKIPS_TOTAL = 3;
const HELPS_TOTAL = 3;

// Quiz adaptativo: quantidade de perguntas por rodada e níveis de dificuldade.
// Começa no nível easy e sobe/desce conforme os acertos/erros.
const QUESTIONS_PER_ROUND = 10;
const DIFFICULTY_ORDER = ["easy", "medium", "hard"];
const DIFFICULTY_KEYS = { easy: "diffEasy", medium: "diffMedium", hard: "diffHard" };

let state = null;

const el = {
    lang_select: document.getElementById("lang-select"),
    screen_start: document.getElementById("screen-start"),
    screen_play: document.getElementById("screen-play"),
    screen_results: document.getElementById("screen-results"),
    start_btn: document.getElementById("start-btn"),
    progress_fill: document.getElementById("progress-fill"),
    question_progress: document.getElementById("question-progress"),
    difficulty_badge: document.getElementById("difficulty-badge"),
    question_media: document.getElementById("question-media"),
    question_text: document.getElementById("question-text"),
    options: document.getElementById("options"),
    actions: document.getElementById("actions"),
    skip_btn: document.getElementById("skip-btn"),
    eliminate_btn: document.getElementById("eliminate-btn"),
    feedback: document.getElementById("feedback"),
    next_btn: document.getElementById("next-btn"),
    result_score: document.getElementById("result-score"),
    result_correct: document.getElementById("result-correct"),
    result_skips: document.getElementById("result-skips"),
    result_helps: document.getElementById("result-helps"),
    restart_btn: document.getElementById("restart-btn"),
    subtitle: document.getElementById("subtitle"),
    hero_title: document.getElementById("hero-title"),
    meta: document.getElementById("meta"),
    brand_sub: document.getElementById("brand-sub"),
    back_link: document.getElementById("back-link"),
    suggest_link: document.getElementById("suggest-link"),
    lang_label: document.getElementById("lang-label"),
    load_status: document.getElementById("load-status")
};

// Todas as perguntas (base + comunidade) vivem em quiz/questions.json — fonte única.
// A Action de sugestões faz push no mesmo arquivo (.github/scripts/add-question.js),
// então não há mais perguntas embutidas em JS.
const QUESTIONS_URL = "questions.json";
let QUIZ_QUESTIONS = [];
let questions_ready = false;
let questions_error = false;

function load_questions() {
    return fetch(QUESTIONS_URL, { cache: "no-store" })
        .then(function (response) {
            if (!response.ok) throw new Error("HTTP " + response.status);
            return response.text();
        })
        .then(function (text) {
            const list = JSON.parse(text.replace(/^\uFEFF/, ""));
            if (!Array.isArray(list)) throw new Error("questions.json não é uma lista");
            QUIZ_QUESTIONS = list.filter(function (q) {
                return q && q.id && q.question && Array.isArray(q.options);
            });
            if (QUIZ_QUESTIONS.length === 0) throw new Error("nenhuma pergunta válida");
            questions_ready = true;
            questions_error = false;
        })
        .catch(function (error) {
            questions_ready = false;
            questions_error = true;
            console.error("Falha ao carregar as perguntas:", error);
        })
        .then(function () {
            apply_static_texts();
            render();
        });
}

// ------------------------------------------------------------------ estado

function shuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr;
}

function build_pools() {
    const pools = {};
    for (const level of DIFFICULTY_ORDER) {
        pools[level] = shuffle(QUIZ_QUESTIONS.filter(function (q) {
            return q.difficulty === level;
        }));
    }
    return pools;
}

// Quantas perguntas a rodada tem (limitado pelo total disponível).
function round_total() {
    return Math.min(QUESTIONS_PER_ROUND, QUIZ_QUESTIONS.length);
}

// Escolhe a próxima pergunta: tenta o nível atual e, se esgotado,
// busca nos níveis vizinhos (mais fácil primeiro, depois o mais difícil).
function pick_next() {
    const start = state.level; // índice direto em DIFFICULTY_ORDER (0=easy, 1=medium, 2=hard)
    const order = [];
    for (let offset = 0; offset < DIFFICULTY_ORDER.length; offset++) {
        const down = start - offset;
        const up = start + offset;
        if (down >= 0) order.push(DIFFICULTY_ORDER[down]);
        if (offset > 0 && up < DIFFICULTY_ORDER.length) order.push(DIFFICULTY_ORDER[up]);
    }
    for (const level of order) {
        if (state.pools[level].length > 0) return state.pools[level].shift();
    }
    return null;
}

function fresh_state() {
    return {
        screen: "start",
        pools: build_pools(),
        level: 0,             // índice em DIFFICULTY_ORDER (0 = easy)
        current: null,        // pergunta atual
        asked: 0,             // quantas perguntas já foram apresentadas na rodada
        last_result: null,    // "correct" | "wrong" | "skip" — ajusta a dificuldade
        score: 0,
        skips_left: SKIPS_TOTAL,
        helps_left: HELPS_TOTAL,
        skips_used: 0,
        helps_used: 0,
        answered: false,
        selected: null,
        option_order: [],     // ordem sorteada das alternativas (índices originais)
        eliminated: []
    };
}

function current_question() {
    return state.current;
}

// Define a pergunta atual e sorteia a ordem das alternativas.
function set_current(question) {
    state.current = question;
    state.option_order = question
        ? shuffle(question.options.map(function (_, i) { return i; }))
        : [];
    state.eliminated = [];
}

// ------------------------------------------------------------------ tradução da tela

function apply_static_texts() {
    el.hero_title.textContent = t("title");
    el.subtitle.textContent = t("subtitle");
    el.meta.innerHTML = "";
    if (questions_ready) {
        [
            t("metaQuestions", { n: round_total() }),
            t("metaSkips", { n: SKIPS_TOTAL }),
            t("metaRemoves", { n: HELPS_TOTAL })
        ].forEach(function (text) {
            const span = document.createElement("span");
            span.textContent = text;
            el.meta.appendChild(span);
        });
    }
    el.brand_sub.textContent = t("brandSub");
    el.back_link.textContent = t("backToViewer");
    if (el.suggest_link) el.suggest_link.textContent = t("suggestQuestion");
    el.lang_label.textContent = t("language");

    // botão iniciar: reflete o carregamento (ou falha) de questions.json
    if (questions_error) {
        el.start_btn.textContent = t("start");
        el.start_btn.disabled = true;
    } else if (!questions_ready) {
        el.start_btn.textContent = t("loading");
        el.start_btn.disabled = true;
    } else {
        el.start_btn.textContent = t("start");
        el.start_btn.disabled = false;
    }
    if (el.load_status) {
        el.load_status.hidden = !questions_error;
        el.load_status.textContent = questions_error ? t("loadError") : "";
    }

    el.restart_btn.textContent = t("playAgain");
    document.getElementById("results-title").textContent = t("resultsTitle");
    document.getElementById("label-score").textContent = t("yourScore");
    document.getElementById("label-correct").textContent = t("correctCount");
    document.getElementById("label-skips").textContent = t("skipsUsed");
    document.getElementById("label-helps").textContent = t("helpsUsed");
    document.title = t("title");
}

function fill_lang_select() {
    el.lang_select.innerHTML = "";
    for (const code of SUPPORTED_LANGS) {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = I18N[code].langName;
        el.lang_select.appendChild(option);
    }
    el.lang_select.value = get_lang();
}

// ------------------------------------------------------------------ render

function render() {
    el.screen_start.hidden = state.screen !== "start";
    el.screen_play.hidden = state.screen !== "play";
    el.screen_results.hidden = state.screen !== "results";

    if (state.screen === "play") render_question();
    else if (state.screen === "results") render_results();
}

function render_media(question) {
    el.question_media.innerHTML = "";
    el.question_media.className = "question-media";
    if (!question.image) {
        el.question_media.hidden = true;
        return;
    }
    el.question_media.hidden = false;

    // imageReveal === "after": a imagem revela a resposta, então fica borrada
    // sob um véu até o jogador responder (quem pula não vê).
    const reveal_after = question.imageReveal === "after";
    const revealed = !reveal_after || state.answered;

    const img = document.createElement("img");
    img.className = "question-image" + (revealed ? "" : " blurred");
    img.alt = revealed ? tr(question.imageAlt) : "";
    img.src = question.image;

    // se a imagem não existir, mostra um espaço reservado em vez de imagem quebrada
    img.onerror = function () {
        el.question_media.innerHTML = "";
        el.question_media.className = "question-media";
        const placeholder = document.createElement("div");
        placeholder.className = "image-unavailable";
        placeholder.textContent = t("imageUnavailable");
        el.question_media.appendChild(placeholder);
    };

    el.question_media.appendChild(img);

    if (!revealed) {
        el.question_media.classList.add("revealing");
        const cover = document.createElement("div");
        cover.className = "image-cover";
        cover.textContent = t("answerToReveal");
        el.question_media.appendChild(cover);
    }
}

function render_question() {
    const question = current_question();
    const total = round_total();

    el.question_progress.textContent = t("questionOf", { current: state.asked, total: total });
    const answered_ratio = ((state.asked - 1) + (state.answered ? 1 : 0)) / total;
    el.progress_fill.style.width = (answered_ratio * 100) + "%";

    // etiqueta de dificuldade da pergunta atual
    const qdiff = question.difficulty;
    el.difficulty_badge.textContent = t(DIFFICULTY_KEYS[qdiff] || qdiff);
    el.difficulty_badge.className = "difficulty-badge " + qdiff;
    el.difficulty_badge.title = t("difficulty");

    el.question_text.textContent = tr(question.question);
    render_media(question);

    // alternativas (ordem sorteada a cada pergunta)
    el.options.innerHTML = "";
    state.option_order.forEach(function (orig_i, display_i) {
        const option = question.options[orig_i];
        const button = document.createElement("button");
        button.type = "button";
        button.className = "option";
        button.dataset.index = display_i;

        const badge = document.createElement("span");
        badge.className = "option-badge";
        badge.textContent = String.fromCharCode(65 + display_i);
        const text = document.createElement("span");
        text.className = "option-text";
        text.textContent = tr(option);
        button.appendChild(badge);
        button.appendChild(text);

        if (state.eliminated.includes(display_i)) {
            button.classList.add("eliminated");
            button.disabled = true;
        }

        if (state.answered) {
            button.disabled = true;
            if (orig_i === question.correct) button.classList.add("correct");
            else if (display_i === state.selected) button.classList.add("wrong");
            else button.classList.add("dim");
        } else {
            button.addEventListener("click", function () { answer(display_i); });
        }

        el.options.appendChild(button);
    });

    // ações (pular / eliminar) — só antes de responder
    el.actions.hidden = state.answered;

    el.skip_btn.textContent = state.skips_left > 0
        ? t("skipWithCount", { n: state.skips_left })
        : t("noSkips");
    el.skip_btn.disabled = state.skips_left <= 0;

    const eliminate_used_here = state.eliminated.length > 0;
    el.eliminate_btn.textContent = state.helps_left > 0 && !eliminate_used_here
        ? t("eliminateWithCount", { n: state.helps_left })
        : (state.helps_left > 0 ? t("eliminate") : t("noHelps"));
    el.eliminate_btn.disabled = state.helps_left <= 0 || eliminate_used_here;

    // feedback + botão avançar
    el.feedback.innerHTML = "";
    if (state.answered) {
        const is_correct = state.option_order[state.selected] === question.correct;
        const title = document.createElement("strong");
        title.className = "feedback-title " + (is_correct ? "ok" : "no");
        title.textContent = is_correct ? t("correct") : t("wrong");
        el.feedback.appendChild(title);

        if (!is_correct) {
            const detail = document.createElement("p");
            detail.className = "feedback-detail";
            detail.textContent = t("correctAnswerWas", { answer: tr(question.options[question.correct]) });
            el.feedback.appendChild(detail);
        }

        el.next_btn.hidden = false;
        el.next_btn.textContent = (state.asked < total) ? t("next") : t("finish");
    } else {
        el.next_btn.hidden = true;
    }

    el.feedback.hidden = !state.answered;
}

function render_results() {
    const total = round_total();
    const percent = Math.round((state.score / total) * 100);
    el.result_score.textContent = percent + "%";
    el.result_correct.textContent = state.score + " / " + total;
    el.result_skips.textContent = state.skips_used;
    el.result_helps.textContent = state.helps_used;
}

// ------------------------------------------------------------------ ações

function answer(option_index) {
    if (state.answered || state.eliminated.includes(option_index)) return;
    state.answered = true;
    state.selected = option_index;
    const is_correct = state.option_order[option_index] === current_question().correct;
    state.last_result = is_correct ? "correct" : "wrong";
    if (is_correct) state.score++;
    render_question();
}

function skip() {
    if (state.answered || state.skips_left <= 0) return;
    state.skips_left--;
    state.skips_used++;
    state.last_result = "skip";
    advance();
}

function eliminate() {
    if (state.answered || state.helps_left <= 0 || state.eliminated.length > 0) return;
    const question = current_question();
    const wrong_display = [];
    state.option_order.forEach(function (orig, display) {
        if (orig !== question.correct && !state.eliminated.includes(display)) wrong_display.push(display);
    });
    if (wrong_display.length === 0) return;
    const pick = wrong_display[Math.floor(Math.random() * wrong_display.length)];
    state.eliminated.push(pick);
    state.helps_left--;
    state.helps_used++;
    render_question();
}

function advance() {
    // ajusta a dificuldade com base no resultado da última pergunta
    if (state.last_result === "correct") {
        state.level = Math.min(state.level + 1, DIFFICULTY_ORDER.length - 1);
    } else if (state.last_result === "wrong") {
        state.level = Math.max(state.level - 1, 0);
    }

    state.answered = false;
    state.selected = null;
    state.last_result = null;

    if (state.asked >= round_total()) {
        state.screen = "results";
        render();
        return;
    }

    const q = pick_next();
    if (!q) {
        state.screen = "results";
        render();
        return;
    }
    set_current(q);
    state.asked++;
    render();
}

function next() {
    advance();
}

function start() {
    if (!questions_ready || QUIZ_QUESTIONS.length === 0) return;
    state = fresh_state();
    set_current(pick_next());
    state.asked = 1;
    state.screen = "play";
    render();
}

function restart() {
    start();
}

// ------------------------------------------------------------------ eventos

el.lang_select.addEventListener("change", function () {
    set_lang(this.value);
    apply_static_texts();
    render();
});

el.start_btn.addEventListener("click", start);
el.restart_btn.addEventListener("click", restart);
el.skip_btn.addEventListener("click", skip);
el.eliminate_btn.addEventListener("click", eliminate);
el.next_btn.addEventListener("click", next);

// ------------------------------------------------------------------ init

(function init() {
    state = fresh_state();
    fill_lang_select();
    apply_static_texts();
    render();
    // As perguntas vêm de questions.json (fetch); o botão inicia desabilitado
    // ("Carregando…") e é liberado quando o arquivo chega (apply_static_texts).
    load_questions();
})();
