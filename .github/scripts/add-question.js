"use strict";

// Lê uma issue (criada pelo Issue Form "Sugerir uma pergunta"), baixa a imagem
// anexada, adiciona a pergunta em quiz/questions.json e deixa a imagem em quiz/img/.
// Roda no GitHub Actions; nada é executado a partir do conteúdo da issue.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const QUESTIONS_JSON = path.join(ROOT, "quiz", "questions.json");
const IMG_DIR = path.join(ROOT, "quiz", "img");

// Rótulos do formulário (.github/ISSUE_TEMPLATE/sugestao-pergunta.yml).
const LABELS = {
  category: "Categoria",
  difficulty: "Dificuldade",
  qEn: "Pergunta (English)",
  qPt: "Pergunta (Português BR)",
  qEs: "Pergunta (Español)",
  options: ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
  correct: "Resposta correta",
  image: "Imagem",
  imageAlt: "Texto alternativo da imagem"
};

const CATEGORIES = ["characters", "magic", "places", "story", "trivia"];
const DIFFICULTIES = ["easy", "medium", "hard"];
const DEFAULT_ALT = {
  en: "Image for the question",
  "pt-BR": "Imagem da pergunta",
  es: "Imagen de la pregunta"
};

// Hosts aceitos para baixar a imagem (evita SSRF para endereços internos).
const ALLOWED_IMAGE_HOSTS = [
  "github.com",
  "user-images.githubusercontent.com",
  "objects.githubusercontent.com",
  "raw.githubusercontent.com",
  "camo.githubusercontent.com",
  "avatars.githubusercontent.com"
];

function set_output(name, value) {
  const out = process.env.GITHUB_OUTPUT;
  const line = `${name}=${String(value).replace(/\r?\n/g, " ")}\n`;
  if (out) fs.appendFileSync(out, line);
  else process.stdout.write(line);
}

function parse_body(raw) {
  const body = String(raw || "").replace(/\r\n/g, "\n");
  const map = {};
  body.split(/\n### /).forEach(function (chunk) {
    let text = chunk.startsWith("### ") ? chunk.slice(4) : chunk;
    const nl = text.indexOf("\n");
    const heading = (nl === -1 ? text : text.slice(0, nl)).trim();
    const content = nl === -1 ? "" : text.slice(nl + 1).trim();
    if (heading) map[heading] = content;
  });
  return map;
}

function clean(value) {
  const text = value == null ? "" : String(value).trim();
  return text === "_No response_" ? "" : text;
}

// Cada alternativa aceita 1 a 3 linhas (en, pt-BR, es). Se faltar, repete.
function parse_option(block) {
  const lines = clean(block)
    .split("\n")
    .map(function (line) { return line.trim(); })
    .filter(Boolean);
  if (lines.length === 0) return null;
  if (lines.length >= 3) return { en: lines[0], "pt-BR": lines[1], es: lines[2] };
  if (lines.length === 2) return { en: lines[0], "pt-BR": lines[1], es: lines[1] };
  return { en: lines[0], "pt-BR": lines[0], es: lines[0] };
}

function slugify(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function extract_image_url(text) {
  const markdown = text.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
  if (markdown) return markdown[1];
  const bare = text.match(/https?:\/\/[^\s)]+/);
  return bare ? bare[0] : null;
}

function ext_from_type(type) {
  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif"
  };
  return map[String(type).split(";")[0].trim().toLowerCase()] || null;
}

function ext_from_url(url) {
  const match = String(url).split("?")[0].match(/\.(jpe?g|png|webp|gif|avif)$/i);
  return match ? match[1].toLowerCase().replace("jpeg", "jpg") : null;
}

async function download_image(url, base_name, issue_number) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("a URL da imagem precisa ser https");
  const host_ok = ALLOWED_IMAGE_HOSTS.some(function (host) {
    return parsed.hostname === host || parsed.hostname.endsWith("." + host);
  });
  if (!host_ok) throw new Error("host da imagem não permitido: " + parsed.hostname);

  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error("falha ao baixar a imagem (" + response.status + ")");

  const ext =
    ext_from_type(response.headers.get("content-type")) ||
    ext_from_url(url) ||
    "jpg";

  fs.mkdirSync(IMG_DIR, { recursive: true });
  let file_name = base_name + "." + ext;
  if (fs.existsSync(path.join(IMG_DIR, file_name))) {
    file_name = base_name + "-" + issue_number + "." + ext;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(path.join(IMG_DIR, file_name), buffer);
  return "img/" + file_name;
}

function read_questions() {
  if (!fs.existsSync(QUESTIONS_JSON)) return [];
  const raw = fs.readFileSync(QUESTIONS_JSON, "utf8").replace(/^\uFEFF/, "").trim();
  if (!raw) return [];
  const list = JSON.parse(raw);
  if (!Array.isArray(list)) throw new Error("quiz/questions.json precisa ser um array");
  return list;
}

async function main() {
  const issue_number = process.env.ISSUE_NUMBER || "0";
  const fields = parse_body(process.env.ISSUE_BODY);

  const q_en = clean(fields[LABELS.qEn]);
  const q_pt = clean(fields[LABELS.qPt]) || q_en;
  const q_es = clean(fields[LABELS.qEs]) || q_en;
  if (!q_en) throw new Error("o campo 'Pergunta (English)' está vazio");

  const options = LABELS.options.map(function (label) {
    return parse_option(fields[label]);
  });
  if (options.some(function (option) { return !option; })) {
    throw new Error("uma ou mais alternativas estão vazias");
  }

  const category = clean(fields[LABELS.category]).toLowerCase();
  if (CATEGORIES.indexOf(category) === -1) {
    throw new Error("categoria inválida: " + category);
  }

  const difficulty = clean(fields[LABELS.difficulty]).toLowerCase();
  if (DIFFICULTIES.indexOf(difficulty) === -1) {
    throw new Error("dificuldade inválida: " + difficulty);
  }

  const letter = clean(fields[LABELS.correct]).toUpperCase();
  const correct = "ABCD".indexOf(letter);
  if (correct === -1) throw new Error("resposta correta inválida: " + letter);

  const question = {
    id: "community-" + issue_number,
    category: category,
    difficulty: difficulty,
    question: { en: q_en, "pt-BR": q_pt, es: q_es },
    options: options,
    correct: correct
  };

  const image_field = clean(fields[LABELS.image]);
  if (image_field) {
    const url = extract_image_url(image_field);
    if (!url) throw new Error("não achei uma URL de imagem válida no campo 'Imagem'");
    const base_name = slugify(options[correct].en) || "question-" + issue_number;
    question.image = await download_image(url, base_name, issue_number);

    const alt = clean(fields[LABELS.imageAlt]);
    question.imageAlt = alt
      ? { en: alt, "pt-BR": alt, es: alt }
      : Object.assign({}, DEFAULT_ALT);
  }

  const ordered = {
    id: question.id,
    category: question.category,
    difficulty: question.difficulty
  };
  if (question.image) {
    ordered.image = question.image;
    ordered.imageAlt = question.imageAlt;
  }
  ordered.question = question.question;
  ordered.options = question.options;
  ordered.correct = question.correct;

  const list = read_questions();
  if (list.some(function (entry) { return entry.id === ordered.id; })) {
    throw new Error("já existe uma pergunta para esta issue (community-" + issue_number + ")");
  }
  list.push(ordered);
  fs.writeFileSync(QUESTIONS_JSON, JSON.stringify(list, null, 4) + "\n");

  set_output("ok", "true");
  set_output("question_id", ordered.id);
  console.log("Adicionada pergunta " + ordered.id + " (total: " + list.length + ")");
}

main().catch(function (error) {
  console.error(error && error.message ? error.message : error);
  set_output("ok", "false");
  set_output("error", error && error.message ? error.message : String(error));
});
