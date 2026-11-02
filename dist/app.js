const ranks = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const suits = [
  { id: "?", symbol: "?", label: "масть не важна", red: false },
  { id: "S", symbol: "♠", label: "пики", red: false },
  { id: "H", symbol: "♥", label: "червы", red: true },
  { id: "D", symbol: "♦", label: "бубны", red: true },
  { id: "C", symbol: "♣", label: "трефы", red: false },
];

const modelClasses = [
  "10C","10D","10H","10S","2C","2D","2H","2S","3C","3D","3H","3S","4C","4D","4H","4S",
  "5C","5D","5H","5S","6C","6D","6H","6S","7C","7D","7H","7S","8C","8D","8H","8S",
  "9C","9D","9H","9S","AC","AD","AH","AS","JC","JD","JH","JS","KC","KD","KH","KS","QC","QD","QH","QS"
];
const suitCodes = { H: "H", D: "D", C: "C", S: "S" };
let modelSession = null;
let modelPromise = null;

const examples = [
  {
    cards: [["7","C"],["K","D"],["8","C"],["Q","S"],["9","C"],["10","C"]]
  },
  {
    cards: [["6","D"],["7","H"],["6","C"],["8","D"]]
  },
  {
    cards: [["A","D"],["J","H"],["10","S"],["K","H"]]
  }
];

function makeCardScene(cards) {
  const palette = ["#143d31", "#1b4b3c", "#225544"];
  const cardWidth = cards.length > 4 ? 190 : 225;
  const markup = cards.map(([rank, suit], index) => {
    const suitInfo = suits.find(item => item.id === suit);
    const x = 110 + index * (cards.length > 4 ? 86 : 118);
    const y = 150 + (index % 2) * 20;
    const angle = -17 + index * (cards.length > 4 ? 6 : 10);
    const rankLabel = {J:"В",Q:"Д",K:"К",A:"Т"}[rank] || rank;
    const color = suitInfo.red ? "#c14f43" : "#173128";
    return `<g transform="translate(${x} ${y}) rotate(${angle})">
      <rect width="${cardWidth}" height="300" rx="16" fill="#fffdf8" stroke="#d9d6cc" stroke-width="3"/>
      <text x="22" y="52" font-family="Georgia,serif" font-size="42" font-weight="700" fill="${color}">${rankLabel}</text>
      <text x="23" y="91" font-family="Georgia,serif" font-size="38" fill="${color}">${suitInfo.symbol}</text>
      <text x="${cardWidth/2}" y="190" text-anchor="middle" font-family="Georgia,serif" font-size="74" fill="${color}" opacity=".9">${suitInfo.symbol}</text>
    </g>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs><radialGradient id="felt"><stop stop-color="${palette[2]}"/><stop offset="1" stop-color="${palette[0]}"/></radialGradient></defs>
    <rect width="800" height="600" fill="url(#felt)"/>
    <circle cx="95" cy="90" r="180" fill="#b9e0c9" opacity=".08"/>
    ${markup}
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

examples.forEach(example => { example.image = makeCardScene(example.cards); });

const els = {
  workspace: document.querySelector("#workspace"),
  preview: document.querySelector("#photoPreview"),
  cards: document.querySelector("#cardsList"),
  total: document.querySelector("#totalScore"),
  count: document.querySelector("#cardCount"),
  cardWord: document.querySelector("#cardWord"),
  formula: document.querySelector("#formula"),
  notice: document.querySelector("#notice"),
  status: document.querySelector("#statusText"),
  examples: document.querySelector("#exampleGrid"),
  dialog: document.querySelector("#rulesDialog"),
  toast: document.querySelector("#toast")
};

let currentCards = [];
let toastTimer;

function cardValue(card, count) {
  if (count === 1 && card.rank === "Q") return card.suit === "S" ? 40 : 20;
  if (card.rank === "9") return 0;
  if (["6", "7", "8", "10"].includes(card.rank)) return Number(card.rank);
  return { J: 2, Q: 3, K: 4, A: 11 }[card.rank] ?? 0;
}

function score(cards) { return cards.reduce((sum, card) => sum + cardValue(card, cards.length), 0); }

function cardLabel(card) {
  const names = { J: "В", Q: "Д", K: "К", A: "Т" };
  const suit = suits.find(item => item.id === card.suit);
  return `${names[card.rank] || card.rank}${suit?.symbol || ""}`;
}

function wordForCards(number) {
  const mod10 = number % 10;
  const mod100 = number % 100;
  if (mod10 === 1 && mod100 !== 11) return "карта";
  if ([2,3,4].includes(mod10) && ![12,13,14].includes(mod100)) return "карты";
  return "карт";
}

function render() {
  els.cards.innerHTML = "";
  currentCards.forEach((card, index) => {
    const suit = suits.find(item => item.id === card.suit);
    const editor = document.createElement("div");
    editor.className = `card-editor ${suit?.red ? "red" : ""}`;
    editor.innerHTML = `
      <select class="rank-select" aria-label="Номинал карты ${index + 1}">
        ${ranks.map(rank => `<option value="${rank}" ${rank === card.rank ? "selected" : ""}>${{J:"В",Q:"Д",K:"К",A:"Т"}[rank] || rank}</option>`).join("")}
      </select>
      <select class="suit-select" aria-label="Масть карты ${index + 1}">
        ${suits.map(item => `<option value="${item.id}" ${item.id === card.suit ? "selected" : ""}>${item.symbol} ${item.label}</option>`).join("")}
      </select>
      ${card.confidence ? `<span class="card-confidence">уверенность ${Math.round(card.confidence * 100)}%</span>` : ""}
      <button class="remove-card" type="button" aria-label="Удалить карту">×</button>`;
    editor.querySelector(".rank-select").addEventListener("change", event => {
      currentCards[index].rank = event.target.value;
      render();
    });
    editor.querySelector(".suit-select").addEventListener("change", event => {
      currentCards[index].suit = event.target.value;
      render();
    });
    editor.querySelector(".remove-card").addEventListener("click", () => {
      currentCards.splice(index, 1);
      render();
    });
    els.cards.append(editor);
  });

  const total = score(currentCards);
  els.total.textContent = total;
  els.count.textContent = currentCards.length;
  els.cardWord.textContent = wordForCards(currentCards.length);
  els.formula.textContent = currentCards.length
    ? `${currentCards.map(card => `${cardLabel(card)} · ${cardValue(card, currentCards.length)}`).join("  +  ")}  =  ${total}`
    : "Добавьте найденные на фото карты — сумма появится здесь.";

  const singletonQueen = currentCards.length === 1 && currentCards[0].rank === "Q";
  els.notice.hidden = !singletonQueen;
  if (singletonQueen) {
    els.notice.textContent = currentCards[0].suit === "S"
      ? "Особое правило: единственная пиковая дама считается за 40 очков."
      : "Особое правило: единственная дама считается за 20 очков.";
  }
}

function openWorkspace(image, cards, isDemo = true) {
  els.workspace.hidden = false;
  els.preview.src = image;
  currentCards = cards.map(([rank, suit]) => ({ rank, suit }));
  els.status.textContent = isDemo ? "Фото разобрано" : "Фото загружено";
  els.notice.hidden = isDemo;
  render();
  els.workspace.classList.add("scanning");
  setTimeout(() => els.workspace.classList.remove("scanning"), 1300);
  setTimeout(() => els.workspace.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
}

async function ensureModel() {
  if (modelSession) return modelSession;
  if (modelPromise) return modelPromise;
  if (!window.ort) throw new Error("ONNX Runtime не загрузился");
  ort.env.wasm.wasmPaths = new URL("./vendor/onnxruntime/", window.location.href).href;
  ort.env.wasm.numThreads = Math.min(2, Math.max(1, navigator.hardwareConcurrency || 1));
  modelPromise = ort.InferenceSession.create("https://huggingface.co/sroot/lgd-cards-gen3/resolve/main/model.onnx", {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all"
  }).then(session => {
    modelSession = session;
    return session;
  }).catch(error => {
    modelPromise = null;
    throw error;
  });
  return modelPromise;
}

function imageToTensor(image, rotation = 0, crop = {x:0,y:0,w:1,h:1}) {
  const size = 640;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#fff";
  context.fillRect(0, 0, size, size);
  context.save();
  context.translate(size / 2, size / 2);
  context.rotate(rotation * Math.PI / 180);
  context.translate(-size / 2, -size / 2);
  context.drawImage(
    image,
    image.naturalWidth * crop.x, image.naturalHeight * crop.y,
    image.naturalWidth * crop.w, image.naturalHeight * crop.h,
    0, 0, size, size
  );
  context.restore();
  const pixels = context.getImageData(0, 0, size, size).data;
  const plane = size * size;
  const data = new Float32Array(plane * 3);
  for (let index = 0; index < plane; index++) {
    data[index] = pixels[index * 4] / 255;
    data[plane + index] = pixels[index * 4 + 1] / 255;
    data[plane * 2 + index] = pixels[index * 4 + 2] / 255;
  }
  return new ort.Tensor("float32", data, [1, 3, size, size]);
}

function toBasePoint(detection, rotation) {
  const x = (detection.x1 + detection.x2) / 2 / 640;
  const y = (detection.y1 + detection.y2) / 2 / 640;
  let local = {x, y};
  if (rotation === 90) local = {x: y, y: 1 - x};
  if (rotation === 180) local = {x: 1 - x, y: 1 - y};
  if (rotation === 270) local = {x: 1 - y, y: x};
  const crop = detection.crop || {x:0,y:0,w:1,h:1};
  return {x: crop.x + local.x * crop.w, y: crop.y + local.y * crop.h};
}

function mergeRotatedDetections(items) {
  const clusters = [];
  for (const item of items.sort((a,b) => b.score - a.score)) {
    const point = toBasePoint(item, item.rotation);
    const cluster = clusters.find(candidate => Math.hypot(candidate.x - point.x, candidate.y - point.y) < .055);
    if (cluster) {
      cluster.items.push(item);
      if (item.score > cluster.best.score) cluster.best = item;
      cluster.x = (cluster.x * (cluster.items.length - 1) + point.x) / cluster.items.length;
      cluster.y = (cluster.y * (cluster.items.length - 1) + point.y) / cluster.items.length;
    } else {
      clusters.push({x: point.x, y: point.y, best: item, items: [item]});
    }
  }
  return clusters.map(cluster => cluster.best);
}

function intersectionOverUnion(a, b) {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = (a.x2-a.x1)*(a.y2-a.y1) + (b.x2-b.x1)*(b.y2-b.y1) - intersection;
  return union > 0 ? intersection / union : 0;
}

function parseDetections(output, threshold = 0.34) {
  const dims = output.dims;
  const data = output.data;
  let channels;
  let anchors;
  let channelFirst;
  if (dims.length === 3 && dims[1] >= 37 && dims[1] <= 64) {
    channels = dims[1]; anchors = dims[2]; channelFirst = true;
  } else if (dims.length === 3 && dims[2] >= 37 && dims[2] <= 64) {
    anchors = dims[1]; channels = dims[2]; channelFirst = false;
  } else {
    throw new Error(`Неожиданный формат модели: ${dims.join("×")}`);
  }
  const at = (anchor, channel) => channelFirst
    ? data[channel * anchors + anchor]
    : data[anchor * channels + channel];
  const candidates = [];
  for (let anchor = 0; anchor < anchors; anchor++) {
    let bestClass = -1;
    let bestScore = threshold;
    for (let classIndex = 0; classIndex < modelClasses.length; classIndex++) {
      const value = at(anchor, 4 + classIndex);
      if (value > bestScore) { bestScore = value; bestClass = classIndex; }
    }
    if (bestClass < 0) continue;
    const cx = at(anchor, 0), cy = at(anchor, 1), width = at(anchor, 2), height = at(anchor, 3);
    candidates.push({
      classIndex: bestClass,
      score: bestScore,
      x1: cx - width / 2,
      y1: cy - height / 2,
      x2: cx + width / 2,
      y2: cy + height / 2
    });
  }
  candidates.sort((a,b) => b.score - a.score);
  const kept = [];
  for (const item of candidates) {
    if (kept.some(other => other.classIndex === item.classIndex && intersectionOverUnion(item, other) > .35)) continue;
    kept.push(item);
  }
  return kept;
}

function detectionsToCards(detections) {
  const bestByCode = new Map();
  for (const detection of detections) {
    const code = modelClasses[detection.classIndex];
    if (!["6","7","8","9","10","A","J","Q","K"].includes(code.slice(0, -1))) continue;
    if (!bestByCode.has(code) || bestByCode.get(code).score < detection.score) bestByCode.set(code, detection);
  }
  const cards = [...bestByCode.entries()].map(([code, detection]) => ({
    rank: code.slice(0, -1).toUpperCase(),
    suit: suitCodes[code.slice(-1)],
    confidence: detection.score
  }));
  return cards.sort((a,b) => b.confidence - a.confidence);
}

async function recognizeImage(imageUrl) {
  const image = new Image();
  image.decoding = "async";
  image.src = imageUrl;
  await image.decode();
  els.status.textContent = "Загружаю модель";
  els.notice.hidden = false;
  els.notice.textContent = "Первый запуск загружает локальную модель (~47 МБ с движком). Фото никуда не отправляется.";
  const session = await ensureModel();
  els.status.textContent = "Ищу карты";
  const full = {x:0,y:0,w:1,h:1};
  const passes = [0,90,180,270].map(rotation => ({rotation,crop:full})).concat([
    {rotation:0,crop:{x:0,y:0,w:.6,h:.6}},
    {rotation:0,crop:{x:.4,y:0,w:.6,h:.6}},
    {rotation:0,crop:{x:0,y:.4,w:.6,h:.6}},
    {rotation:0,crop:{x:.4,y:.4,w:.6,h:.6}}
  ]);
  const allDetections = [];
  for (let passIndex = 0; passIndex < passes.length; passIndex++) {
    const {rotation, crop} = passes[passIndex];
    els.status.textContent = `Ищу карты · ${passIndex + 1}/${passes.length}`;
    const tensor = imageToTensor(image, rotation, crop);
    const result = await session.run({ [session.inputNames[0]]: tensor });
    const output = result[session.outputNames[0]];
    parseDetections(output, .20).forEach(detection => allDetections.push({...detection, rotation, crop}));
  }
  return detectionsToCards(mergeRotatedDetections(allDetections));
}

function renderExamples() {
  examples.forEach((example, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "example";
    button.innerHTML = `<img src="${example.image}" alt="Пример ${index + 1}: карты на столе" loading="lazy" />
      <span class="example-label"><span><span>Пример ${index + 1}</span><strong>${score(example.cards.map(([rank,suit]) => ({rank,suit})))} очков</strong></span><b>${example.cards.length} ${wordForCards(example.cards.length)}</b></span>`;
    button.addEventListener("click", () => openWorkspace(example.image, example.cards));
    els.examples.append(button);
  });
}

async function handleFile(file) {
  if (!file) return;
  const matched = ["7643", "7644", "7645"].findIndex(part => file.name.includes(part));
  if (matched >= 0) {
    openWorkspace(examples[matched].image, examples[matched].cards);
    return;
  }
  if (!file.type.startsWith("image/")) {
    showToast("DNG пока откройте через один из примеров или загрузите JPG/PNG");
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    openWorkspace(reader.result, [], false);
    els.notice.hidden = false;
    els.notice.textContent = "Подготавливаю изображение…";
    document.querySelector("#addCardButton").disabled = true;
    document.querySelector("#doneButton").disabled = true;
    try {
      currentCards = await recognizeImage(reader.result);
      render();
      els.status.textContent = currentCards.length ? `Найдено: ${currentCards.length}` : "Карты не найдены";
      els.notice.hidden = false;
      els.notice.textContent = currentCards.length
        ? "Проверьте результат: модель обучена на похожих веерах, но незнакомая колода или закрытый угол могут снизить точность."
        : "Не удалось уверенно прочитать углы. Раздвиньте карты, снимите ближе и без бликов — либо добавьте карты вручную.";
    } catch (error) {
      console.error(error);
      els.status.textContent = "Ошибка распознавания";
      els.notice.hidden = false;
      els.notice.textContent = "Модель не запустилась в этом браузере. Карты можно добавить вручную.";
    } finally {
      document.querySelector("#addCardButton").disabled = false;
      document.querySelector("#doneButton").disabled = false;
    }
  };
  reader.readAsDataURL(file);
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

renderExamples();
["cameraInput", "fileInput"].forEach(id => {
  document.querySelector(`#${id}`).addEventListener("change", event => handleFile(event.target.files[0]));
});
document.querySelector("#replaceButton").addEventListener("click", () => document.querySelector("#fileInput").click());
document.querySelector("#addCardButton").addEventListener("click", () => {
  currentCards.push({ rank: "6", suit: "?" });
  render();
});
document.querySelector("#doneButton").addEventListener("click", () => showToast(`Записано: ${score(currentCards)} очков`));
document.querySelector("#rulesButton").addEventListener("click", () => els.dialog.showModal());
document.querySelector("#dialogClose").addEventListener("click", () => els.dialog.close());
els.dialog.addEventListener("click", event => { if (event.target === els.dialog) els.dialog.close(); });

const dropZone = document.querySelector("#dropZone");
["dragenter", "dragover"].forEach(name => dropZone.addEventListener(name, event => {
  event.preventDefault();
  dropZone.classList.add("dragover");
}));
["dragleave", "drop"].forEach(name => dropZone.addEventListener(name, event => {
  event.preventDefault();
  dropZone.classList.remove("dragover");
}));
dropZone.addEventListener("drop", event => handleFile(event.dataTransfer.files[0]));
