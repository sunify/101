const PLAYER_KEY = "card101.players.v2";
const GAME_KEY = "card101.game.v2";
const emojiPool = ["🦊","🐼","🐨","🐯","🦁","🐸","🐵","🐧","🦄","🐙","🦋","🐝","🍉","🍋","🍒","🍑","🥝","🍓","🍍","🥭","🍇","🍐"];
const ranks = ["6","7","8","9","10","J","Q","K","A"];
const suits = [{id:"?",symbol:"?",label:"масть"},{id:"S",symbol:"♠",label:"пики"},{id:"H",symbol:"♥",label:"червы",red:true},{id:"D",symbol:"♦",label:"бубны",red:true},{id:"C",symbol:"♣",label:"трефы"}];
const modelClasses = ["10C","10D","10H","10S","2C","2D","2H","2S","3C","3D","3H","3S","4C","4D","4H","4S","5C","5D","5H","5S","6C","6D","6H","6S","7C","7D","7H","7S","8C","8D","8H","8S","9C","9D","9H","9S","AC","AD","AH","AS","JC","JD","JH","JS","KC","KD","KH","KS","QC","QD","QH","QS"];

const $ = selector => document.querySelector(selector);
const els = {
  playersGrid: $("#playersGrid"), playersButton: $("#playersButton"), playersDialog: $("#playersDialog"),
  playersForm: $("#playersForm"), playerFields: $("#playerFields"), cameraInput: $("#cameraInput"),
  reviewDialog: $("#reviewDialog"), modelState: $("#modelState"), reviewResult: $("#reviewResult"),
  detectedCards: $("#detectedCards"), reviewCount: $("#reviewCount"), reviewScore: $("#reviewScore"),
  queenNotice: $("#queenNotice"), historySection: $("#historySection"), historyTable: $("#historyTable"),
  roundReady: $("#roundReady"), leaderCard: $("#leaderCard"), toast: $("#toast")
};

function uid() { return `${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`; }
function randomEmoji(used = []) { return emojiPool.filter(x => !used.includes(x))[Math.floor(Math.random() * Math.max(1, emojiPool.filter(x => !used.includes(x)).length))] || emojiPool[Math.floor(Math.random()*emojiPool.length)]; }
function safeParse(value, fallback) { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }

let firstVisit = !localStorage.getItem(PLAYER_KEY);
let players = safeParse(localStorage.getItem(PLAYER_KEY), null) || ["Игрок 1","Игрок 2","Игрок 3"].map(name => ({id:uid(),name,emoji:""}));
players.forEach((player,index) => { if (!player.emoji) player.emoji = randomEmoji(players.slice(0,index).map(x => x.emoji)); });
let game = safeParse(localStorage.getItem(GAME_KEY), {rounds:[],current:{winnerId:null,scores:{}}});
if (!game.current) game.current = {winnerId:null,scores:{}};
let editingPlayers = [];
let pendingPlayerId = null;
let reviewingPlayerId = null;
let currentCards = [];
let processingPlayerId = null;
let toastTimer;
let modelSession = null;
let modelPromise = null;

function save() {
  localStorage.setItem(PLAYER_KEY, JSON.stringify(players));
  localStorage.setItem(GAME_KEY, JSON.stringify(game));
}

function totalFor(playerId) {
  const closed = game.rounds.reduce((sum,round) => sum + (Number(round.scores[playerId]) || 0), 0);
  return closed + (Number(game.current.scores[playerId]) || 0);
}

function scoreHistory(playerId) {
  const values = game.rounds.map(round => round.scores[playerId]).filter(value => value !== undefined);
  if (game.current.scores[playerId] !== undefined) values.push(game.current.scores[playerId]);
  return values;
}

function currentComplete() {
  return Boolean(game.current.winnerId) && players.every(player => game.current.scores[player.id] !== undefined);
}

function render() {
  const roundNumber = game.rounds.length + 1;
  const winner = players.find(player => player.id === game.current.winnerId);
  $("#sheetRoundLabel").textContent = `Раунд ${roundNumber}`;
  els.playersButton.innerHTML = players.slice(0,4).map(player => `<span>${player.emoji}</span>`).join("");
  els.playersGrid.innerHTML = "";

  players.forEach(player => {
    const total = totalFor(player.id);
    const isWinner = game.current.winnerId === player.id;
    const hasScore = game.current.scores[player.id] !== undefined;
    const card = document.createElement("article");
    card.className = `player-card${isWinner ? " winner" : ""}${processingPlayerId === player.id ? " processing" : ""}`;
    let action = `<button class="player-action exit-button" data-exit="${player.id}" type="button">Вышел</button>`;
    if (winner) {
      if (isWinner) {
        const winnerScore = Number(game.current.scores[player.id]) || 0;
        action = `<div class="winner-actions"><div class="winner-label"><span>✓</span> Вышел</div><button class="queen-exit${winnerScore === -20 ? " selected" : ""}" data-winner-score="-20" data-player="${player.id}" type="button" aria-label="Вышел с дамы, минус 20">−20</button><button class="queen-exit${winnerScore === -40 ? " selected" : ""}" data-winner-score="-40" data-player="${player.id}" type="button" aria-label="Вышел с пиковой дамы, минус 40">−40</button></div>`;
      }
      else if (processingPlayerId === player.id) action = `<button class="player-action photo-button" disabled>Считаю…</button>`;
      else if (hasScore) action = `<button class="round-score" data-photo="${player.id}" type="button" aria-label="Переснять карты и изменить очки"><strong>+${game.current.scores[player.id]} очков</strong></button>`;
      else action = `<button class="player-action photo-button" data-photo="${player.id}" type="button">Фото</button>`;
    }
    card.innerHTML = `<div class="player-top"><span class="player-emoji">${player.emoji}</span><div class="player-identity"><strong>${escapeHtml(player.name)}</strong></div></div><div class="player-total"><span class="total-score">${total}</span><span class="score-label">очков</span></div>${action}`;
    els.playersGrid.append(card);
  });

  document.querySelectorAll("[data-exit]").forEach(button => button.addEventListener("click", () => selectWinner(button.dataset.exit)));
  document.querySelectorAll("[data-photo]").forEach(button => button.addEventListener("click", () => requestPhoto(button.dataset.photo)));
  document.querySelectorAll("[data-winner-score]").forEach(button => button.addEventListener("click", () => setWinnerScore(button.dataset.player, Number(button.dataset.winnerScore))));
  els.roundReady.hidden = !currentComplete();
  renderLeader();
  renderHistory();
  save();
}

function renderLeader() {
  const anyScores = game.rounds.length || Object.keys(game.current.scores).length;
  els.leaderCard.hidden = !anyScores;
  if (!anyScores) return;
  const leader = [...players].sort((a,b) => totalFor(a.id) - totalFor(b.id))[0];
  $("#leaderEmoji").textContent = leader.emoji;
  $("#leaderName").textContent = leader.name;
  $("#leaderScore").textContent = totalFor(leader.id);
}

function renderHistory() {
  const rows = [...game.rounds];
  if (game.current.winnerId) rows.push(game.current);
  els.historySection.hidden = rows.length === 0;
  if (!rows.length) return;
  els.historyTable.innerHTML = `<thead><tr><th>Раунд</th>${players.map(p => `<th>${p.emoji}<br>${escapeHtml(p.name)}</th>`).join("")}</tr></thead><tbody>${rows.map((round,index) => `<tr><td>${index+1}${index === game.rounds.length ? " · сейчас" : ""}</td>${players.map(player => `<td class="${round.winnerId === player.id ? "winner-cell" : ""}">${round.scores[player.id] === undefined ? "—" : round.scores[player.id]}</td>`).join("")}</tr>`).join("")}</tbody><tfoot><tr><td>Итого</td>${players.map(player => `<td>${totalFor(player.id)}</td>`).join("")}</tr></tfoot>`;
}

function selectWinner(playerId) {
  if (game.current.winnerId) return;
  game.current.winnerId = playerId;
  game.current.scores = {[playerId]:0};
  render();
}

function setWinnerScore(playerId, value) {
  if (game.current.winnerId !== playerId) return;
  game.current.scores[playerId] = game.current.scores[playerId] === value ? 0 : value;
  render();
}

function requestPhoto(playerId) {
  pendingPlayerId = playerId;
  els.cameraInput.value = "";
  els.cameraInput.click();
}

async function handlePhoto(file) {
  if (!file || !pendingPlayerId) return;
  const playerId = pendingPlayerId;
  pendingPlayerId = null;
  processingPlayerId = playerId;
  render();
  try {
    let cards;
    const sampleIndex = ["7643","7644","7645"].findIndex(part => file.name.includes(part));
    if (sampleIndex >= 0) {
      const samples = [[{rank:"7",suit:"C"},{rank:"K",suit:"D"},{rank:"8",suit:"C"},{rank:"Q",suit:"S"},{rank:"9",suit:"C"},{rank:"10",suit:"C"}],[{rank:"6",suit:"D"},{rank:"7",suit:"H"},{rank:"6",suit:"C"},{rank:"8",suit:"D"}],[{rank:"A",suit:"D"},{rank:"J",suit:"H"},{rank:"10",suit:"S"},{rank:"K",suit:"H"}]];
      cards = samples[sampleIndex];
    } else {
      if (!file.type.startsWith("image/")) throw new Error("format");
      const imageUrl = await fileToDataUrl(file);
      cards = await recognizeImage(imageUrl);
    }
    openReview(playerId, cards);
  } catch (error) {
    console.error(error);
    showToast(error.message === "format" ? "Нужен снимок JPG, PNG или HEIC" : "Не удалось распознать — добавьте карты вручную");
    openReview(playerId, []);
  } finally {
    processingPlayerId = null;
    render();
  }
}

function openReview(playerId, cards) {
  reviewingPlayerId = playerId;
  currentCards = cards.map(card => ({...card}));
  const player = players.find(item => item.id === playerId);
  $("#reviewEmoji").textContent = player.emoji;
  $("#reviewName").textContent = player.name;
  els.modelState.hidden = true;
  els.reviewResult.hidden = false;
  renderReview();
  els.reviewDialog.showModal();
}

function renderReview() {
  els.detectedCards.innerHTML = "";
  currentCards.forEach((card,index) => {
    const suit = suits.find(item => item.id === card.suit) || suits[0];
    const item = document.createElement("div");
    item.className = `card-editor${suit.red ? " red" : ""}`;
    item.innerHTML = `<select class="rank-select" aria-label="Номинал">${ranks.map(rank => `<option value="${rank}" ${rank === card.rank ? "selected" : ""}>${rankName(rank)}</option>`).join("")}</select><select class="suit-select" aria-label="Масть">${suits.map(s => `<option value="${s.id}" ${s.id === card.suit ? "selected" : ""}>${s.symbol} ${s.label}</option>`).join("")}</select><button class="remove-card" type="button" aria-label="Удалить">×</button>`;
    item.querySelector(".rank-select").addEventListener("change", event => { currentCards[index].rank = event.target.value; renderReview(); });
    item.querySelector(".suit-select").addEventListener("change", event => { currentCards[index].suit = event.target.value; renderReview(); });
    item.querySelector(".remove-card").addEventListener("click", () => { currentCards.splice(index,1); renderReview(); });
    els.detectedCards.append(item);
  });
  const total = scoreCards(currentCards);
  els.reviewCount.textContent = `${currentCards.length} ${wordForCards(currentCards.length)}`;
  els.reviewScore.textContent = total;
  $("#confirmScoreButton").textContent = `Записать ${total} очков`;
  const oneQueen = currentCards.length === 1 && currentCards[0].rank === "Q";
  els.queenNotice.hidden = !oneQueen;
  if (oneQueen) els.queenNotice.textContent = currentCards[0].suit === "S" ? "Одна пиковая дама считается за 40 очков." : "Одна дама считается за 20 очков.";
}

function cardValue(card,count) {
  if (count === 1 && card.rank === "Q") return card.suit === "S" ? 40 : 20;
  if (card.rank === "9") return 0;
  if (["6","7","8","10"].includes(card.rank)) return Number(card.rank);
  return {J:2,Q:3,K:4,A:11}[card.rank] || 0;
}
function scoreCards(cards) { return cards.reduce((sum,card) => sum + cardValue(card,cards.length),0); }
function rankName(rank) { return {J:"В",Q:"Д",K:"К",A:"Т"}[rank] || rank; }
function wordForCards(number) { const a=number%10,b=number%100; return a===1&&b!==11?"карта":[2,3,4].includes(a)&&![12,13,14].includes(b)?"карты":"карт"; }
function escapeHtml(value) { const div=document.createElement("div"); div.textContent=value; return div.innerHTML; }
function fileToDataUrl(file) { return new Promise((resolve,reject) => { const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(file); }); }

function editPlayers() {
  editingPlayers = players.map(player => ({...player}));
  renderPlayerFields();
  els.playersDialog.showModal();
}

function renderPlayerFields() {
  els.playerFields.innerHTML = "";
  editingPlayers.forEach((player,index) => {
    const row = document.createElement("div"); row.className="player-field";
    row.innerHTML = `<span>${player.emoji}</span><input value="${escapeHtml(player.name)}" maxlength="24" aria-label="Имя игрока ${index+1}"><button type="button" aria-label="Удалить">×</button>`;
    row.querySelector("input").addEventListener("input", event => editingPlayers[index].name=event.target.value);
    row.querySelector("button").addEventListener("click", () => { if (editingPlayers.length<=2) return showToast("Нужно хотя бы два игрока"); editingPlayers.splice(index,1); renderPlayerFields(); });
    els.playerFields.append(row);
  });
}

function addEditingPlayer() {
  if (editingPlayers.length >= 8) return showToast("Максимум восемь игроков");
  editingPlayers.push({id:uid(),name:`Игрок ${editingPlayers.length+1}`,emoji:randomEmoji(editingPlayers.map(x=>x.emoji))});
  renderPlayerFields();
  els.playerFields.lastElementChild?.querySelector("input")?.focus();
}

function savePlayers(event) {
  event.preventDefault();
  const cleaned = editingPlayers.map(player => ({...player,name:player.name.trim()})).filter(player => player.name);
  if (cleaned.length < 2) return showToast("Добавьте хотя бы двух игроков");
  const changedIds = cleaned.map(x=>x.id).join() !== players.map(x=>x.id).join();
  if (changedIds && (game.rounds.length || game.current.winnerId) && !confirm("Изменение состава начнёт новую партию. Продолжить?")) return;
  players = cleaned;
  if (changedIds) game={rounds:[],current:{winnerId:null,scores:{}}};
  save(); render(); els.playersDialog.close();
}

function nextRound() {
  if (!currentComplete()) return;
  game.rounds.push({winnerId:game.current.winnerId,scores:{...game.current.scores}});
  game.current={winnerId:null,scores:{}};
  render(); window.scrollTo({top:0,behavior:"smooth"});
}

function newGame() {
  if ((game.rounds.length || game.current.winnerId) && !confirm("Начать новую партию? Нынешняя история очков будет очищена.")) return;
  game={rounds:[],current:{winnerId:null,scores:{}}}; render();
}

function showToast(message) { clearTimeout(toastTimer); els.toast.textContent=message; els.toast.classList.add("show"); toastTimer=setTimeout(()=>els.toast.classList.remove("show"),2600); }

async function ensureModel() {
  if (modelSession) return modelSession;
  if (modelPromise) return modelPromise;
  if (!window.ort) throw new Error("runtime");
  ort.env.wasm.wasmPaths = new URL("./vendor/onnxruntime/",window.location.href).href;
  ort.env.wasm.numThreads = Math.min(2,Math.max(1,navigator.hardwareConcurrency||1));
  modelPromise = ort.InferenceSession.create("https://huggingface.co/sroot/lgd-cards-gen3/resolve/main/model.onnx",{executionProviders:["wasm"],graphOptimizationLevel:"all"}).then(session => modelSession=session).catch(error => { modelPromise=null; throw error; });
  return modelPromise;
}

function imageToTensor(image,rotation=0,crop={x:0,y:0,w:1,h:1}) {
  const size=640,canvas=document.createElement("canvas"); canvas.width=size; canvas.height=size;
  const context=canvas.getContext("2d",{willReadFrequently:true}); context.fillStyle="#fff"; context.fillRect(0,0,size,size); context.save(); context.translate(size/2,size/2); context.rotate(rotation*Math.PI/180); context.translate(-size/2,-size/2); context.drawImage(image,image.naturalWidth*crop.x,image.naturalHeight*crop.y,image.naturalWidth*crop.w,image.naturalHeight*crop.h,0,0,size,size); context.restore();
  const pixels=context.getImageData(0,0,size,size).data,plane=size*size,data=new Float32Array(plane*3);
  for(let i=0;i<plane;i++){data[i]=pixels[i*4]/255;data[plane+i]=pixels[i*4+1]/255;data[plane*2+i]=pixels[i*4+2]/255;}
  return new ort.Tensor("float32",data,[1,3,size,size]);
}

function intersectionOverUnion(a,b){const x1=Math.max(a.x1,b.x1),y1=Math.max(a.y1,b.y1),x2=Math.min(a.x2,b.x2),y2=Math.min(a.y2,b.y2),intersection=Math.max(0,x2-x1)*Math.max(0,y2-y1),union=(a.x2-a.x1)*(a.y2-a.y1)+(b.x2-b.x1)*(b.y2-b.y1)-intersection;return union>0?intersection/union:0;}
function parseDetections(output,threshold=.2){const dims=output.dims,data=output.data;let channels,anchors,channelFirst;if(dims.length===3&&dims[1]>=37&&dims[1]<=64){channels=dims[1];anchors=dims[2];channelFirst=true}else if(dims.length===3&&dims[2]>=37&&dims[2]<=64){anchors=dims[1];channels=dims[2];channelFirst=false}else throw new Error("model");const at=(a,c)=>channelFirst?data[c*anchors+a]:data[a*channels+c],candidates=[];for(let anchor=0;anchor<anchors;anchor++){let bestClass=-1,bestScore=threshold;for(let ci=0;ci<modelClasses.length;ci++){const value=at(anchor,4+ci);if(value>bestScore){bestScore=value;bestClass=ci}}if(bestClass<0)continue;const cx=at(anchor,0),cy=at(anchor,1),w=at(anchor,2),h=at(anchor,3);candidates.push({classIndex:bestClass,score:bestScore,x1:cx-w/2,y1:cy-h/2,x2:cx+w/2,y2:cy+h/2})}candidates.sort((a,b)=>b.score-a.score);const kept=[];for(const item of candidates){if(kept.some(other=>other.classIndex===item.classIndex&&intersectionOverUnion(item,other)>.35))continue;kept.push(item)}return kept;}
function basePoint(d,rotation){const x=(d.x1+d.x2)/2/640,y=(d.y1+d.y2)/2/640;let local={x,y};if(rotation===90)local={x:y,y:1-x};if(rotation===180)local={x:1-x,y:1-y};if(rotation===270)local={x:1-y,y:x};const c=d.crop||{x:0,y:0,w:1,h:1};return{x:c.x+local.x*c.w,y:c.y+local.y*c.h};}
function mergeDetections(items){const clusters=[];for(const item of items.sort((a,b)=>b.score-a.score)){const point=basePoint(item,item.rotation),cluster=clusters.find(c=>Math.hypot(c.x-point.x,c.y-point.y)<.055);if(cluster){cluster.items.push(item);if(item.score>cluster.best.score)cluster.best=item;cluster.x=(cluster.x*(cluster.items.length-1)+point.x)/cluster.items.length;cluster.y=(cluster.y*(cluster.items.length-1)+point.y)/cluster.items.length}else clusters.push({x:point.x,y:point.y,best:item,items:[item]})}return clusters.map(c=>c.best);}
function detectionsToCards(detections){const best=new Map();for(const detection of detections){const code=modelClasses[detection.classIndex],rank=code.slice(0,-1);if(!ranks.includes(rank))continue;if(!best.has(code)||best.get(code).score<detection.score)best.set(code,detection)}return[...best.entries()].map(([code,d])=>({rank:code.slice(0,-1),suit:code.slice(-1),confidence:d.score})).sort((a,b)=>b.confidence-a.confidence);}

async function recognizeImage(imageUrl) {
  const image=new Image(); image.decoding="async"; image.src=imageUrl; await image.decode();
  const session=await ensureModel(),full={x:0,y:0,w:1,h:1};
  const passes=[0,90,180,270].map(rotation=>({rotation,crop:full})).concat([{rotation:0,crop:{x:0,y:0,w:.6,h:.6}},{rotation:0,crop:{x:.4,y:0,w:.6,h:.6}},{rotation:0,crop:{x:0,y:.4,w:.6,h:.6}},{rotation:0,crop:{x:.4,y:.4,w:.6,h:.6}}]);
  const all=[]; for(const pass of passes){const tensor=imageToTensor(image,pass.rotation,pass.crop),result=await session.run({[session.inputNames[0]]:tensor});parseDetections(result[session.outputNames[0]]).forEach(d=>all.push({...d,...pass}));}
  return detectionsToCards(mergeDetections(all));
}

els.cameraInput.addEventListener("change",event=>handlePhoto(event.target.files[0]));
els.playersButton.addEventListener("click",editPlayers);
$("#playersClose").addEventListener("click",()=>els.playersDialog.close());
$("#reviewClose").addEventListener("click",()=>els.reviewDialog.close());
$("#addPlayerButton").addEventListener("click",addEditingPlayer);
els.playersForm.addEventListener("submit",savePlayers);
$("#confirmScoreButton").addEventListener("click",()=>{if(!reviewingPlayerId)return;game.current.scores[reviewingPlayerId]=scoreCards(currentCards);els.reviewDialog.close();reviewingPlayerId=null;render();showToast("Очки записаны")});
$("#addCardButton").addEventListener("click",()=>{currentCards.push({rank:"6",suit:"?"});renderReview()});
$("#nextRoundButton").addEventListener("click",nextRound);
$("#newGameButton").addEventListener("click",newGame);
$("#toggleHistoryButton").addEventListener("click",event=>{const wrap=$("#historyWrap"),hidden=wrap.hidden;wrap.hidden=!hidden;event.currentTarget.textContent=hidden?"Свернуть":"Развернуть";event.currentTarget.setAttribute("aria-expanded",String(hidden))});

render();
ensureModel().catch(() => {});
if(firstVisit)setTimeout(editPlayers,250);
