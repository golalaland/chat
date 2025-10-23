/* ---------------- Firebase Setup ---------------- */
import { 
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

/* ---------------- Current User ---------------- */
let currentUser = null;

/* ---------------- Load & Sync Current User ---------------- */
async function loadCurrentUserForGame() {
  try {
    const storedUser = JSON.parse(
      localStorage.getItem('vipUser') || localStorage.getItem('hostUser') || '{}'
    );
    if (!storedUser?.email) return;

    // Create a safe UID key for Firestore
    const uid = String(storedUser.email).replace(/[.#$[\]]/g, ',');
    const userRef = doc(db, 'users', uid);

    // Initial fetch
    const snap = await getDoc(userRef);
    currentUser = snap.exists()
      ? { uid, ...snap.data() }
      : {
          uid,
          stars: 0,
          cash: 0,
          chatId: storedUser.displayName || storedUser.email.split('@')[0]
        };

    // Subscribe to realtime updates
    onSnapshot(userRef, (docSnap) => {
      const data = docSnap.data();
      if (!data) return;
      currentUser = { uid, ...data };
      updateGameUI(currentUser);
    });

  } catch (err) {
    console.error('Error loading current user for game:', err);
  }
}

/* ---------------- Update Game UI ---------------- */
function updateGameUI(user) {
  const starsEl = document.getElementById('game-stars');
  const cashEl  = document.getElementById('game-cash');
  if (starsEl) starsEl.textContent = `${user.stars} ⭐️`;
  if (cashEl)  cashEl.textContent = `₦${user.cash}`;
}

/* ---------------- Game Config ---------------- */
const INITIAL_POT    = 1_000_000; // ₦1,000,000
const DEDUCT_PER_WIN = 1_000;     // ₦ per win deducted from pot
const REWARD_TO_USER = 1_000;     // ₦ per win reward
const STARS_PER_WIN  = 40;        // 5*8 stars
const NUM_BLOCKS     = 8;
const STAR_COST      = 10;        // stars to join

/* ---------------- UI References ---------------- */
const joinTrainBtn       = document.getElementById('joinTrainBtn');
const confirmModal       = document.getElementById('confirmModal');
const confirmYes         = document.getElementById('confirmYes');
const confirmNo          = document.getElementById('confirmNo');
const loadingContainer   = document.getElementById('loadingContainer');
const loadingBar         = document.getElementById('loadingBar');
const trainEmoji         = document.getElementById('trainEmoji');
const problemBoard       = document.getElementById('problemBoard');
const submitAnswersBtn   = document.getElementById('submitAnswers');
const popupEl            = document.getElementById('popup');
const dailyPotEl         = document.getElementById('dailyPot');
const closedOverlay      = document.getElementById('closedOverlay');
const reopenCountdown    = document.getElementById('reopenCountdown');
const confirmText        = document.getElementById('confirmText');

const trainNameEl        = document.getElementById('trainName');
const trainDateEl        = document.getElementById('trainDate');
const trainTimeEl        = document.getElementById('trainTime');
const trainDestinationEl = document.getElementById('trainDestination');

const profileNameEl      = document.getElementById('profileName');
const starCountEl        = document.getElementById('starCount');
const cashCountEl        = document.getElementById('cashCount');

/* ---------------- DOMContentLoaded Init ---------------- */
document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentUserForGame();   // wait until Firestore user is loaded
  console.log('✅ Game user loaded and synced');
  init();                           // now safe to initialize the UI & timers
});

  /* ---------------- Sounds (change paths if desired) ---------------- */
  const SOUND_PATHS = {
    start:  './sounds/train_start.mp3',
    depart: './sounds/train_depart.mp3',
    whistle:'./sounds/train_whistle.mp3',
    ding:   './sounds/cha_ching.mp3',
    error:  './sounds/error_bell.mp3'
  };
  function playAudio(src, opts = {}) {
    if (!src) return;
    try {
      const a = new Audio(src);
      a.volume = opts.volume ?? 0.8;
      if (opts.loop) a.loop = true;
      a.play().catch(()=>{/* ignore autoplay errors */});
      return a;
    } catch (e) { /* ignore */ }
  }

/* ---------------- Local state & persistence ---------------- */
let loadingInterval = null;
let loadingProgress = 0;
let trainActive = false;
let currentProblems = []; // [{a, b, ans}]

// localStorage keys
const KEY_POT       = 'moneytrain_pot';
const KEY_RESET_DAY = 'moneytrain_reset_day';
const KEY_HALF_DAY  = 'moneytrain_half_date';

/* ---------------- storage helpers ---------------- */
function getStoredPot() {
  const raw = localStorage.getItem(KEY_POT);
  return raw ? parseInt(raw, 10) : null;
}

function setStoredPot(value) {
  const pot = Math.max(0, Math.floor(value));
  localStorage.setItem(KEY_POT, String(pot));
  updatePotUI();
}

function getPotResetDay() { return localStorage.getItem(KEY_RESET_DAY) || null; }
function setPotResetDay(dateStr) { localStorage.setItem(KEY_RESET_DAY, dateStr); }

function getHalfAlertDate() { return localStorage.getItem(KEY_HALF_DAY) || null; }
function setHalfAlertDate(dateStr) { localStorage.setItem(KEY_HALF_DAY, dateStr); }

/* ---------------- pot initialization ---------------- */
function initializePot() {
  const today = new Date().toISOString().slice(0, 10);
  const resetDay = getPotResetDay();

  if (!getStoredPot() || resetDay !== today) {
    setStoredPot(INITIAL_POT);
    setPotResetDay(today);
    setHalfAlertDate('');
  }
}

/* ---------------- UI updater ---------------- */
function updatePotUI() {
  const pot = getStoredPot() ?? INITIAL_POT;
  if (dailyPotEl) dailyPotEl.textContent = pot.toLocaleString();

  if (pot <= 0) {
    handleStationClosed();
  } else if (!closedOverlay.classList.contains('hidden') && !isPastMidnightReset()) {
    closedOverlay.classList.add('hidden');
    joinTrainBtn.disabled = false;
    joinTrainBtn.style.opacity = '1';
  }
}

/* ---------------- terminal helpers ---------------- */
const trainNames = [
  "Money Express", "Starliner 9000", "Frenzy Rail", "Lucky Cargo",
  "Fortune Flyer", "Crypto Cruiser", "Golden Dash", "Midnight Ride"
];
const destinations = [
  "Lagos","Accra","Nairobi","Cape Town","Johannesburg",
  "Abuja","Kigali","London","Dubai","New York"
];

// Only set terminal if train is not active
function setTrainTerminal() {
  if (trainActive) return;

  const name = trainNames[Math.floor(Math.random() * trainNames.length)];
  const dest = destinations[Math.floor(Math.random() * destinations.length)];
  const date = new Date().toLocaleDateString('en-GB', { 
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' 
  });

  if (trainNameEl) trainNameEl.textContent = name;
  if (trainDateEl) trainDateEl.textContent = date;
  if (trainDestinationEl) trainDestinationEl.textContent = dest;
  if (confirmText) confirmText.textContent = `Join ${name} → ${dest}? Ready to play?`;
}

// update the clock on the terminal
function updateTrainTime() {
  if (!trainTimeEl) return;
  const now = new Date();
  trainTimeEl.textContent = now.toLocaleTimeString('en-GB', { hour12: false });
}

/* ---------------- popup helper ---------------- */
let popupTimeout = null;
function showPopup(text, duration = 1800) {
  if (!popupEl) {
    console.warn('popup element not found');
    return;
  }
  popupEl.textContent = text;
  popupEl.style.display = 'block';
  popupEl.style.opacity = '1';

  if (popupTimeout) clearTimeout(popupTimeout);
  popupTimeout = setTimeout(() => {
    popupEl.style.opacity = '0';
    setTimeout(() => popupEl.style.display = 'none', 300);
  }, duration);
}

/* ---------------- halfway alert once per day ---------------- */
function maybeShowHalfwayAlert() {
  const pot = getStoredPot() ?? INITIAL_POT;
  const half = Math.floor(INITIAL_POT / 2);
  const today = new Date().toISOString().slice(0, 10);
  const shownDate = getHalfAlertDate();

  if (pot <= half && shownDate !== today) {
    setHalfAlertDate(today);
    showPopup('⚠️ Halfway mined — pot is running low!', 4000);

    const terminal = document.getElementById('trainTerminal');
    if (terminal) {
      terminal.style.boxShadow = '0 0 30px rgba(255,165,0,0.28)';
      setTimeout(() => terminal.style.boxShadow = '', 2500);
    }
  }
}

/* ---------------- station closed / reopen countdown ---------------- */
let countdownTimer = null;

// returns milliseconds until next midnight
function timeToNextMidnight() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return Math.max(0, tomorrow - now);
}

// format ms into HH:MM:SS
function formatHMS(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function handleStationClosed() {
  closedOverlay.classList.remove('hidden');
  joinTrainBtn.disabled = true;
  joinTrainBtn.style.display = 'block';
  joinTrainBtn.style.opacity = '0.5';

  if (countdownTimer) clearInterval(countdownTimer);

  function tick() {
    const ms = timeToNextMidnight();
    if (reopenCountdown) reopenCountdown.textContent = formatHMS(ms);

    if (ms <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
      resetPotAndReopen();
    }
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
  playAudio(SOUND_PATHS.depart);
}

async function resetPotAndReopen() {
  setStoredPot(INITIAL_POT);
  const today = new Date().toISOString().slice(0, 10);
  setPotResetDay(today);
  setHalfAlertDate('');
  closedOverlay.classList.add('hidden');
  joinTrainBtn.disabled = false;
  joinTrainBtn.style.opacity = '1';
  setTrainTerminal();
  updatePotUI();
  showPopup('🔁 Pot reset! Station reopened.', 3000);

  // Optional: sync to Firestore so other devices/users see the reset
  if (currentUser?.uid) {
    const userRef = doc(db, 'users', currentUser.uid);
    try {
      await updateDoc(userRef, {
        lastPotReset: today,
        pot: INITIAL_POT
      });
    } catch (err) {
      console.error('Failed to sync pot reset to Firestore:', err);
    }
  }
}

function isPastMidnightReset() {
  return getPotResetDay() !== new Date().toISOString().slice(0, 10);
}

/* ---------------- problems generator ---------------- */
async function generateProblems() {
  currentProblems = [];
  problemBoard.innerHTML = '';

  for (let i = 0; i < NUM_BLOCKS; i++) {
    let a = Math.floor(Math.random() * 20) + 1;
    let b = Math.floor(Math.random() * 20) + 1;
    if (a < b) [a, b] = [b, a];

    currentProblems.push({ a, b, ans: a + b });

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
    input.style.background = '#0e0e0e';
    input.style.color = '#fff';
    input.style.textAlign = 'center';
    input.dataset.index = i;

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    problemBoard.appendChild(wrapper);
  }

  // show submit button
  submitAnswersBtn.style.display = 'block';
  submitAnswersBtn.disabled = true;
  submitAnswersBtn.style.opacity = '0.6';

  // enable button only when all inputs are filled
  const inputs = problemBoard.querySelectorAll('.problemInput');
  function checkFilled() {
    const allFilled = Array.from(inputs).every(i => i.value.trim() !== '');
    submitAnswersBtn.disabled = !allFilled;
    submitAnswersBtn.style.opacity = allFilled ? '1' : '0.6';
  }

  inputs.forEach(inp => inp.addEventListener('input', checkFilled));
  checkFilled();

  // optional: save generated problems to Firestore for current user
  if (currentUser?.uid) {
    const userRef = doc(db, 'users', currentUser.uid);
    try {
      await updateDoc(userRef, { lastProblems: currentProblems });
    } catch (err) {
      console.error('Failed to save last problems:', err);
    }
  }
}

  /* ---------------- loading bar ---------------- */
function startLoadingBar(){
  loadingContainer.style.display = 'block';
  loadingProgress = 0;
  loadingBar.style.width = '0%';
  trainEmoji.style.left = '0px';
  
  // play start sound (loop)
  playAudio(SOUND_PATHS.start, true);

  loadingInterval = setInterval(async () => {
    loadingProgress++;
    const percent = (loadingProgress / 39) * 100; // 39s window
    loadingBar.style.width = `${percent}%`;
    trainEmoji.style.left = `calc(${percent}% - 12px)`;

    if (loadingProgress >= 39){
      clearInterval(loadingInterval);
      loadingInterval = null;
      if (trainActive){
        trainActive = false;
        stopLoadingBar();
        playAudio(SOUND_PATHS.depart);
        await endTrain(false); // async in case we update Firestore
      }
    }
  }, 1000);
}

function stopLoadingBar(){
  if (loadingInterval) { 
    clearInterval(loadingInterval); 
    loadingInterval = null; 
  }
  loadingContainer.style.display = 'none';
  loadingBar.style.width = '0%';
  trainEmoji.style.left = '0px';
}

/* ---------------- modify user resource ---------------- */
async function modifyUserResource(type, amount) {
  if (!currentUser?.uid) return false;
  const uid = currentUser.uid;
  const userRef = doc(db, 'users', uid);

  try {
    await runTransaction(db, async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists()) throw new Error('User not found');
      const data = snap.data();

      let stars = Number(data.stars || 0);
      let cash  = Number(data.cash || 0);

      if (type === 'stars') {
        if (stars + amount < 0) throw new Error('Not enough stars');
        stars += amount;
      } else if (type === 'cash') {
        if (cash + amount < 0) throw new Error('Not enough cash');
        cash += amount;
      }

      t.update(userRef, { stars, cash });

      // update local UI immediately
      currentUser = { ...currentUser, stars, cash };
      if (starCountEl) starCountEl.textContent = stars;
      if (cashCountEl) cashCountEl.textContent = cash.toLocaleString();
    });
    return true;
  } catch (err) {
    console.error('Resource update failed:', err);
    showPopup(err.message || 'Failed to update resources', 2500);
    return false;
  }
}

/* ---------------- start / end train (Firestore-backed) ---------------- */
async function startTrain() {
  // ensure pot open
  if ((getStoredPot() ?? INITIAL_POT) <= 0) {
    showPopup('🚧 Station closed for today. Come back tomorrow.');
    return;
  }

  if (!currentUser) {
    showPopup('User not loaded yet.');
    return;
  }

  // Deduct STAR_COST in Firestore
  const hasStars = await modifyUserResource('stars', -STAR_COST);
  if (!hasStars) {
    showPopup('Not enough stars to join.');
    playAudio(SOUND_PATHS.error);
    return;
  }

  // state & UI
  trainActive = true;
  joinTrainBtn.style.display = 'none';
  generateProblems();
  problemBoard.classList.remove('hidden');
  submitAnswersBtn.style.display = 'block';
  submitAnswersBtn.disabled = true;
  submitAnswersBtn.style.opacity = '0.6';

  // start timer & sound
  startLoadingBar();
  playAudio(SOUND_PATHS.whistle);
}

async function endTrain(success, ticketNumber = null) {
  stopLoadingBar();

  // hide problems & submit
  problemBoard.classList.add('hidden');
  submitAnswersBtn.style.display = 'none';

  // show join again only if pot > 0
  const pot = getStoredPot() ?? INITIAL_POT;
  joinTrainBtn.style.display = 'block';
  joinTrainBtn.disabled = pot <= 0;
  joinTrainBtn.style.opacity = pot > 0 ? '1' : '0.5';

  if (!currentUser) return;

  if (success) {
    // reward user in Firestore
    await modifyUserResource('cash', REWARD_TO_USER);
    await modifyUserResource('stars', STARS_PER_WIN);

    // deduct pot
    let newPot = Math.max(0, pot - DEDUCT_PER_WIN);
    setStoredPot(newPot);

    const dest = trainDestinationEl?.textContent || 'your destination';
    const tnum = ticketNumber || '---';
    showPopup(
      `🎫 You’ve secured your ${dest} train ticket number ${tnum} — welcome aboard! You earned ₦${REWARD_TO_USER.toLocaleString()}!`,
      4500
    );
    playAudio(SOUND_PATHS.ding);

    maybeShowHalfwayAlert();

    if (newPot <= 0) handleStationClosed();
  } else {
    showPopup('Train left! You got nothing 😢', 2200);
  }
}

  /* ---------------- submit answers handler (Firestore-compatible) ---------------- */
submitAnswersBtn.addEventListener('click', async () => {
  if (!trainActive) return;

  const inputs = Array.from(document.querySelectorAll('.problemInput'));

  // check for empty fields
  const anyEmpty = inputs.some(inp => inp.value.trim() === '');
  if (anyEmpty) {
    showPopup("You're not yet done hashing your train ticket — hurry!", 2400);
    playAudio(SOUND_PATHS.error);
    return;
  }

  // evaluate correctness
  let allCorrect = true;
  inputs.forEach((inp, i) => {
    const val = parseInt(inp.value, 10);
    const expected = currentProblems[i].ans;
    if (isNaN(val) || val !== expected) allCorrect = false;
  });

  // stop timer
  trainActive = false;
  stopLoadingBar();

  if (allCorrect) {
    // build ticket number by concatenating each answer
    const ticketNumber = inputs.map(inp => String(parseInt(inp.value, 10))).join('');
    // Firestore update handled inside endTrain
    await endTrain(true, ticketNumber);
  } else {
    showPopup("Some answers are incorrect — train left!", 3000);
    playAudio(SOUND_PATHS.depart);
    await endTrain(false);
  }
});

  /* ---------------- join modal wiring ---------------- */
joinTrainBtn.addEventListener('click', () => {
  if (joinTrainBtn.disabled) return;
  confirmModal.style.display = 'flex';
  playAudio(SOUND_PATHS.whistle);
});
confirmYes.addEventListener('click', () => { 
  confirmModal.style.display = 'none'; 
  startTrain(); 
});
confirmNo.addEventListener('click', () => { 
  confirmModal.style.display = 'none'; 
});

/* ---------------- init & timers ---------------- */
function init(){
  // initialize pot & UI
  initializePot();
  updatePotUI();
  setTrainTerminal();
  setInterval(setTrainTerminal, 60_000);
  setInterval(updateTrainTime, 1000);
  updateTrainTime();
  maybeShowHalfwayAlert();

  // hide problem board initially
  problemBoard.classList.add('hidden');
  submitAnswersBtn.style.display = 'none';

  // schedule midnight reset
  const msToMid = timeToNextMidnight();
  setTimeout(() => resetPotAndReopen(), msToMid + 1000);
  setInterval(() => { if (isPastMidnightReset()) resetPotAndReopen(); }, 60_000);

  // initial profile UI from Firestore user if loaded
  if (currentUser) {
    if (profileNameEl) profileNameEl.textContent = currentUser.chatId || 'GUEST 0000';
    if (starCountEl) starCountEl.textContent = currentUser.stars ?? '50';
    if (cashCountEl) cashCountEl.textContent = currentUser.cash ?? '0';
  } else {
    if (profileNameEl) profileNameEl.textContent = 'GUEST 0000';
    if (starCountEl) starCountEl.textContent = '50';
    if (cashCountEl) cashCountEl.textContent = '0';
  }
}


/* ---------------- Expose debug helpers ---------------- */
window.moneyTrainLocal = {
  getPot: () => getStoredPot(),
  setPot: (v) => setStoredPot(v),
  resetPotAndReopen,
  simulateWin: async () => { 
    trainActive = true; 
    generateProblems(); 
    await endTrain(true,'TEST-TICKET'); 
  }
};