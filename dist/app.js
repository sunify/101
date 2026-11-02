const ranks = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const suits = [
  { id: "S", symbol: "♠", label: "пики", red: false },
  { id: "H", symbol: "♥", label: "червы", red: true },
  { id: "D", symbol: "♦", label: "бубны", red: true },
  { id: "C", symbol: "♣", label: "трефы", red: false },
];

const examples = [
  {
    cards: [["6","C"],["Q","C"],["8","C"],["7","C"],["Q","S"],["K","D"]]
  },
  {
    cards: [["6","D"],["7","H"],["9","C"],["8","D"]]
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

function handleFile(file) {
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
  reader.onload = () => {
    openWorkspace(reader.result, [], false);
    els.notice.hidden = false;
    els.notice.textContent = "Для нового фото это экран проверки прототипа: добавьте карты вручную. Автораспознавание подключается на следующем этапе.";
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
  currentCards.push({ rank: "6", suit: "S" });
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
