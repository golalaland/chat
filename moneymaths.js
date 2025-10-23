import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------------- Firebase Config ---------------- */
const firebaseConfig = {
  apiKey: "AIzaSyDbKz4ef_eUDlCukjmnK38sOwueYuzqoao",
  authDomain: "metaverse-1010.firebaseapp.com",
  projectId: "metaverse-1010",
  storageBucket: "metaverse-1010.appspot.com",
  messagingSenderId: "1044064238233",
  appId: "1:1044064238233:web:2fbdfb811cb0a3ba349608",
  measurementId: "G-S77BMC266C",
  databaseURL: "https://metaverse-1010-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---------------- Config ---------------- */
const INITIAL_POT = 1_000_000;
const DEDUCT_PER_WIN = 1_000;
const REWARD_TO_USER = 1_000;
const STARS_PER_WIN = 40;
const NUM_BLOCKS = 8;
const STAR_COST = 10;

/* ---------------- UI Refs ---------------- */
const joinTrainBtn      = document.getElementById('joinTrainBtn');
const confirmModal      = document.getElementById('confirmModal');
const confirmYes        = document.getElementById('confirmYes');
const confirmNo         = document.getElementById('confirmNo');
const loadingContainer  = document.getElementById('loadingContainer');
const loadingBar        = document.getElementById('loadingBar');
const trainEmoji        = document.getElementById('trainEmoji');
const problemBoard      = document.getElementById('problemBoard');
const submitAnswersBtn  = document.getElementById('submitAnswers');
const popupEl           = document.getElementById('popup');
const dailyPotEl        = document.getElementById('dailyPot');
const closedOverlay     = document.getElementById('closedOverlay');
const reopenCountdown   = document.getElementById('reopenCountdown');
const confirmText       = document.getElementById('confirmText');
const trainNameEl       = document.getElementById('trainName');
const trainDateEl       = document.getElementById('trainDate');
const trainTimeEl       = document.getElementById('trainTime');
const trainDestinationEl= document.getElementById('trainDestination');
const profileNameEl     = document.getElementById('profileName');
const starCountEl       = document.getElementById('starCount');
const cashCountEl       = document.getElementById('cashCount');
const redeemBtn         = document.getElementById('redeemBtn');
const tipBtn            = document.getElementById('tipBtn');

/* ---------------- Sounds ---------------- */
const SOUND_PATHS = {
  start: './sounds/train_start.mp3',
  depart: './sounds/train_depart.mp3',
  whistle: './sounds/train_whistle.mp3',
  ding: './sounds/cha_ching.mp3',
  error: './sounds/error_bell.mp3'
};
function playAudio(src, opts = {}) {
  if (!src) return;
  try {
    const a = new Audio(src);
    a.volume = opts.volume ?? 0.8;
    if (opts.loop) a.loop = true;
    a.play().catch(() => {});
    return a;
  } catch(e){}
}

/* ---------------- State ---------------- */
let loadingInterval = null;
let loadingProgress = 0;
let trainActive = false;
let currentProblems = [];
let userRef = null;
let currentUser = null; // must be set from auth

/* ---------------- User Firestore Helpers ---------------- */
async function initUser(uid, name='GUEST 0000'){
  currentUser = { uid };
  userRef = doc(db, "users", uid);

  // Create default user if doesn't exist
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()){
    await setDoc(userRef, {
      cash: 0,
      stars: 50,
      dailyPot: INITIAL_POT,
      lastPotReset: new Date().toISOString().slice(0,10),
      halfAlertDate: '',
      profileName: name
    });
  }

  // Realtime updates
  onSnapshot(userRef, docSnap => {
    if (!docSnap.exists()) return;
    const data = docSnap.data();

    if (starCountEl) starCountEl.textContent = data.stars ?? '0';
    if (cashCountEl) cashCountEl.textContent = (data.cash ?? 0).toLocaleString();
    if (dailyPotEl) dailyPotEl.textContent = (data.dailyPot ?? INITIAL_POT).toLocaleString();
    if (profileNameEl) profileNameEl.textContent = data.profileName ?? name;

    if ((data.dailyPot ?? INITIAL_POT) <= 0) handleStationClosed();
  });

  // Set redeem/tip links
  if (redeemBtn) redeemBtn.href = `https://golalaland.github.io/chat/nushop.html?uid=${encodeURIComponent(uid)}`;
  if (tipBtn) tipBtn.href = `https://golalaland.github.io/chat/nutips.html?uid=${encodeURIComponent(uid)}`;
}

/* ---------------- Firestore Updates ---------------- */
async function updateUserCash(amount){ if (!userRef) return; await updateDoc(userRef,{ cash: increment(amount) }); }
async function updateUserStars(amount){ if (!userRef) return; await updateDoc(userRef,{ stars: increment(amount) }); }
async function updateUserPot(amount){ if (!userRef) return; await updateDoc(userRef,{ dailyPot: increment(amount) }); }
async function setHalfAlertDate(dateStr){ if (!userRef) return; await updateDoc(userRef,{ halfAlertDate: dateStr }); }
async function setPotResetDate(dateStr){ if (!userRef) return; await updateDoc(userRef,{ lastPotReset: dateStr }); }

/* ---------------- Terminal Helpers ---------------- */
const trainNames = ["Money Express","Starliner 9000","Frenzy Rail","Lucky Cargo","Fortune Flyer","Crypto Cruiser","Golden Dash","Midnight Ride"];
const destinations = ["Lagos","Accra","Nairobi","Cape Town","Johannesburg","Abuja","Kigali","London","Dubai","New York"];

function setTrainTerminal(){
  if (trainActive) return;
  const name = trainNames[Math.floor(Math.random()*trainNames.length)];
  const dest = destinations[Math.floor(Math.random()*destinations.length)];
  const date = new Date().toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
  if (trainNameEl) trainNameEl.textContent = name;
  if (trainDateEl) trainDateEl.textContent = date;
  if (trainDestinationEl) trainDestinationEl.textContent = dest;
  if (confirmText) confirmText.textContent = `Join ${name} → ${dest}? Ready to play?`;
}

function updateTrainTime(){
  if (!trainTimeEl) return;
  const now = new Date();
  trainTimeEl.textContent = now.toLocaleTimeString('en-GB',{hour12:false});
}

/* ---------------- Popup ---------------- */
let popupTimeout = null;
function showPopup(text, ms=1800){
  if (!popupEl) return;
  popupEl.textContent = text;
  popupEl.style.display = 'block';
  popupEl.style.opacity = '1';
  if (popupTimeout) clearTimeout(popupTimeout);
  popupTimeout = setTimeout(()=>{
    popupEl.style.opacity = '0';
    setTimeout(()=>{ popupEl.style.display = 'none'; },300);
  }, ms);
}

/* ---------------- Halfway Alert ---------------- */
async function maybeShowHalfwayAlert(){
  if (!userRef) return;
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) return;
  const data = snapshot.data();
  const pot = data.dailyPot ?? INITIAL_POT;
  const half = Math.floor(INITIAL_POT/2);
  const today = new Date().toISOString().slice(0,10);
  const shownDate = data.halfAlertDate ?? '';
  if (pot <= half && shownDate !== today){
    await setHalfAlertDate(today);
    showPopup('⚠️ Halfway mined — pot is running low!', 4000);
    const terminal = document.getElementById('trainTerminal');
    if (terminal){
      terminal.style.boxShadow = '0 0 30px rgba(255,165,0,0.28)';
      setTimeout(()=> terminal.style.boxShadow = '', 2500);
    }
  }
}

/* ---------------- Station Closed / Reopen ---------------- */
let countdownTimer = null;
function timeToNextMidnight(){
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate()+1);
  tomorrow.setHours(0,0,0,0);
  return Math.max(0, tomorrow - now);
}
function formatHMS(ms){
  const s = Math.floor(ms/1000);
  const hh = String(Math.floor(s/3600)).padStart(2,'0');
  const mm = String(Math.floor((s%3600)/60)).padStart(2,'0');
  const ss = String(s%60).padStart(2,'0');
  return `${hh}:${mm}:${ss}`;
}

function handleStationClosed(){
  closedOverlay.classList.remove('hidden');
  joinTrainBtn.disabled = true;
  joinTrainBtn.style.opacity = '0.5';
  if (countdownTimer) clearInterval(countdownTimer);
  function tick(){
    const ms = timeToNextMidnight();
    if (reopenCountdown) reopenCountdown.textContent = formatHMS(ms);
    if (ms <= 0){ clearInterval(countdownTimer); resetPotAndReopen(); }
  }
  tick();
  countdownTimer = setInterval(tick,1000);
  playAudio(SOUND_PATHS.depart);
}

async function resetPotAndReopen(){
  await updateUserPot(INITIAL_POT); // reset
  await setPotResetDate(new Date().toISOString().slice(0,10));
  await setHalfAlertDate('');
  closedOverlay.classList.add('hidden');
  joinTrainBtn.disabled = false;
  joinTrainBtn.style.opacity = '1';
  setTrainTerminal();
  showPopup('🔁 Pot reset! Station reopened.', 3000);
}

/* ---------------- Problems Generator ---------------- */
function generateProblems(){
  currentProblems = [];
  problemBoard.innerHTML = '';
  for (let i=0;i<NUM_BLOCKS;i++){
    let a = Math.floor(Math.random()*20)+1;
    let b = Math.floor(Math.random()*20)+1;
    if (a < b) [a,b] = [b,a];
    currentProblems.push({a,b,ans:a+b});

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '6px';
    wrapper.style.margin = '6px';

    const label = document.createElement('div');
    label.textContent = `${a} + ${b}`;
    label.style.fontWeight = '700';
    label.style.fontSize = '12px';
    label.style.color = '#fff';

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'problemInput';
    input.inputMode = 'numeric';
    input.placeholder = '?';
    input.style.width = '60px';
    input.style.padding = '6px';
    input.style.borderRadius = '6px';
    input.style.border = '1px solid rgba(255,255,255,0.12)';
    input.style.background = 'rgba(0,0,0,0.22)';
    input.style.color = '#fff';
    wrapper.appendChild(label);
    wrapper.appendChild(input);
    problemBoard.appendChild(wrapper);
  }
}

/* ---------------- Train Loading ---------------- */
function startTrainLoading(){
  if (!loadingContainer) return;
  loadingContainer.style.display = 'block';
  loadingProgress = 0;
  loadingBar.style.width = '0%';
  loadingInterval = setInterval(()=>{
    loadingProgress += Math.random()*7;
    if (loadingProgress>=100){ loadingProgress=100; clearInterval(loadingInterval); loadingContainer.style.display='none'; showProblems(); }
    loadingBar.style.width = loadingProgress+'%';
    trainEmoji.style.left = (loadingProgress/100*problemBoard.offsetWidth)+'px';
  },80);
  playAudio(SOUND_PATHS.start, {loop:true});
}

/* ---------------- Show Problems ---------------- */
function showProblems(){
  trainActive = true;
  generateProblems();
}

/* ---------------- Submit Answers ---------------- */
async function checkAnswers(){
  if (!userRef) return;
  const inputs = [...document.querySelectorAll('.problemInput')];
  if (inputs.length !== NUM_BLOCKS) return;

  let correct = 0;
  inputs.forEach((input,i)=>{
    if (parseInt(input.value) === currentProblems[i].ans) correct++;
  });

  if (correct === NUM_BLOCKS){
    // full reward
    await updateUserCash(REWARD_TO_USER);
    await updateUserPot(-DEDUCT_PER_WIN);
    await updateUserStars(STARS_PER_WIN);
    showPopup('✅ Jackpot! You earned '+REWARD_TO_USER.toLocaleString(),2500);
    playAudio(SOUND_PATHS.ding);
    maybeShowHalfwayAlert();
  } else {
    showPopup(`❌ Wrong answers. Try again! (${correct}/${NUM_BLOCKS})`,2500);
    playAudio(SOUND_PATHS.error);
  }

  trainActive = false;
}

/* ---------------- Event Listeners ---------------- */
joinTrainBtn?.addEventListener('click',()=>{
  setTrainTerminal();
  confirmModal.classList.remove('hidden');
});

confirmYes?.addEventListener('click',()=>{
  confirmModal.classList.add('hidden');
  startTrainLoading();
});

confirmNo?.addEventListener('click',()=>{
  confirmModal.classList.add('hidden');
});

submitAnswersBtn?.addEventListener('click', checkAnswers);

/* ---------------- Update Terminal Clock ---------------- */
setInterval(updateTrainTime,1000);

/* ---------------- Init ---------------- */
// TEMP TEST USER
initUser('demoUser123','Flash Player');