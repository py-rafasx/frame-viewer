// i18n — infraestrutura simples de tradução (sem frameworks).
// Idiomas suportados: en, pt-BR, es.
// Ordem de detecção: ?lang= na URL -> localStorage -> navigator.language -> "en".

const SUPPORTED_LANGS = ["en", "pt-BR", "es"];
const LANG_STORAGE_KEY = "frieren-lang";

const I18N = {
    "en": {
        langName: "English",
        htmlLang: "en",
        brandSub: "Quiz",
        title: "Frieren Quiz",
        subtitle: "How well do you know Frieren: Beyond Journey's End?",
        metaQuestions: "{n} questions",
        metaSkips: "{n} skips",
        metaRemoves: "{n} removes",
        start: "Start quiz",
        questionOf: "Question {current} of {total}",
        chooseAnswer: "Choose an answer:",
        skip: "Skip",
        skipWithCount: "Skip ({n})",
        eliminate: "Remove one",
        eliminateWithCount: "Remove one ({n})",
        next: "Next",
        finish: "See result",
        correct: "Correct!",
        wrong: "Wrong!",
        correctAnswerWas: "The correct answer was: {answer}",
        imageUnavailable: "Image unavailable",
        resultsTitle: "Quiz complete",
        yourScore: "Your score",
        correctCount: "Correct answers",
        skipsUsed: "Skips used",
        helpsUsed: "Helps used",
        playAgain: "Play again",
        backToViewer: "Back to viewer",
        noSkips: "No skips left",
        noHelps: "No removes left",
        difficulty: "Difficulty",
        diffEasy: "Easy",
        diffMedium: "Medium",
        diffHard: "Hard",
        language: "Language",
        suggestQuestion: "Suggest a question"
    },
    "pt-BR": {
        langName: "Português (BR)",
        htmlLang: "pt-BR",
        brandSub: "Quiz",
        title: "Quiz de Frieren",
        subtitle: "Quanto você conhece Frieren: Beyond Journey's End?",
        metaQuestions: "{n} perguntas",
        metaSkips: "{n} pulos",
        metaRemoves: "{n} eliminações",
        start: "Começar o quiz",
        questionOf: "Pergunta {current} de {total}",
        chooseAnswer: "Escolha uma resposta:",
        skip: "Pular",
        skipWithCount: "Pular ({n})",
        eliminate: "Eliminar uma",
        eliminateWithCount: "Eliminar uma ({n})",
        next: "Próxima",
        finish: "Ver resultado",
        correct: "Correto!",
        wrong: "Errado!",
        correctAnswerWas: "A resposta correta era: {answer}",
        imageUnavailable: "Imagem indisponível",
        resultsTitle: "Quiz concluído",
        yourScore: "Sua pontuação",
        correctCount: "Acertos",
        skipsUsed: "Pulos usados",
        helpsUsed: "Ajudas usadas",
        playAgain: "Jogar de novo",
        backToViewer: "Voltar ao viewer",
        noSkips: "Sem pulos restantes",
        noHelps: "Sem eliminações restantes",
        difficulty: "Dificuldade",
        diffEasy: "Fácil",
        diffMedium: "Média",
        diffHard: "Difícil",
        language: "Idioma",
        suggestQuestion: "Sugerir uma pergunta"
    },
    "es": {
        langName: "Español",
        htmlLang: "es",
        brandSub: "Quiz",
        title: "Quiz de Frieren",
        subtitle: "¿Cuánto sabes de Frieren: Beyond Journey's End?",
        metaQuestions: "{n} preguntas",
        metaSkips: "{n} saltos",
        metaRemoves: "{n} eliminaciones",
        start: "Empezar el quiz",
        questionOf: "Pregunta {current} de {total}",
        chooseAnswer: "Elige una respuesta:",
        skip: "Saltar",
        skipWithCount: "Saltar ({n})",
        eliminate: "Eliminar una",
        eliminateWithCount: "Eliminar una ({n})",
        next: "Siguiente",
        finish: "Ver resultado",
        correct: "¡Correcto!",
        wrong: "¡Incorrecto!",
        correctAnswerWas: "La respuesta correcta era: {answer}",
        imageUnavailable: "Imagen no disponible",
        resultsTitle: "Quiz completado",
        yourScore: "Tu puntuación",
        correctCount: "Aciertos",
        skipsUsed: "Saltos usados",
        helpsUsed: "Ayudas usadas",
        playAgain: "Jugar otra vez",
        backToViewer: "Volver al visor",
        noSkips: "No quedan saltos",
        noHelps: "No quedan eliminaciones",
        difficulty: "Dificultad",
        diffEasy: "Fácil",
        diffMedium: "Media",
        diffHard: "Difícil",
        language: "Idioma",
        suggestQuestion: "Sugerir una pregunta"
    }
};

let current_lang = "en";

function normalize_lang(lang) {
    if (!lang) return null;
    const lower = lang.toLowerCase();
    if (lower.startsWith("pt")) return "pt-BR";
    if (lower.startsWith("es")) return "es";
    if (lower.startsWith("en")) return "en";
    return null;
}

function detect_lang() {
    const params = new URLSearchParams(window.location.search);
    const from_url = normalize_lang(params.get("lang"));
    if (from_url) return from_url;

    let stored = null;
    try { stored = localStorage.getItem(LANG_STORAGE_KEY); } catch (_) {}
    const from_store = normalize_lang(stored);
    if (from_store) return from_store;

    const from_nav = normalize_lang(navigator.language || (navigator.languages && navigator.languages[0]));
    if (from_nav) return from_nav;

    return "en";
}

function get_lang() {
    return current_lang;
}

function set_lang(lang) {
    const normalized = normalize_lang(lang) || "en";
    current_lang = normalized;
    try { localStorage.setItem(LANG_STORAGE_KEY, normalized); } catch (_) {}
    document.documentElement.lang = I18N[normalized].htmlLang;
}

// t("chave", { current: 1, total: 12 }) — interpola {placeholders}
function t(key, vars) {
    const dict = I18N[current_lang] || I18N.en;
    let str = dict[key] != null ? dict[key] : (I18N.en[key] != null ? I18N.en[key] : key);
    if (vars) {
        for (const name in vars) {
            str = str.replace(new RegExp("\\{" + name + "\\}", "g"), vars[name]);
        }
    }
    return str;
}

// traduz um objeto por idioma { en, "pt-BR", es } com fallback para en
function tr(obj) {
    if (obj == null) return "";
    return obj[current_lang] != null ? obj[current_lang] : (obj.en != null ? obj.en : "");
}

current_lang = detect_lang();
