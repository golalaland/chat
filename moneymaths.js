// Money Train + Firebase integration
// Replace your existing JS1 file with this (or merge accordingly).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  collection,
  getDocs,
  runTransaction,
  serverTimestamp,
  updateDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

  /* ---------------- Config ---------------- */
  const INITIAL_POT       = 1_000_000; // $1,000,000
  const DEDUCT_PER_WIN    = 1_000;     // deduct from pot per win
  const REWARD_TO_USER    = 1_000;     // reward to user per win
  const STARS_PER_WIN     = 5 * 8;     // 40 stars
  const NUM_BLOCKS        = 8;
  const STAR_COST         = 10;        // cost to join (enforced)

  /* ---------------- Firebase (from your JS2) ---------------- */
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
  const popupEl           = document.getElementById('popup'); // your star-popup
  const dailyPotEl        = document.getElementById('dailyPot');
  const closedOverlay     = document.getElementById('closedOverlay');
  const reopenCountdown   = document.getElementById('reopenCountdown');
  const confirmText       = document.getElementById('confirmText');

  const trainNameEl       = document.getElementById('trainName');
  const trainDateEl       = document.getElementById('trainDate');
  const trainTimeEl       = document.getElementById('trainTime');
  const trainDestinationEl= document.getElementById('trainDestination');

  const profileNameEl     = document.getElementById('profileName') || document.getElementById('username');
  // accept both id variants for stars/cash used across pages
  const starCountEl       = document.getElementById('starCount') || document.getElementById('stars-count');
  const cashCountEl       = document.getElementById('cashCount') || document.getElementById('cash-count');

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
  let currentProblems = []; // [{a,b,ans}]
  // localStorage keys
  const KEY_POT        = 'moneytrain_pot';
  const KEY_RESET_DAY  = 'moneytrain_reset_day';
  const KEY_HALF_DAY   = 'moneytrain_half_date';

  /* ---------------- storage helpers ---------------- */
  function getStoredPot(){
    const raw = localStorage.getItem(KEY_POT);
    return raw ? parseInt(raw,10) : null;
  }
  function setStoredPot(v){
    localStorage.setItem(KEY_POT, String(Math.max(0, Math.floor(v))));
    updatePotUI();
  }
  function getPotResetDay(){ return localStorage.getItem(KEY_RESET_DAY) || null; }
  function setPotResetDay(s){ localStorage.setItem(KEY_RESET_DAY, s); }
  function getHalfAlertDate(){ return localStorage.getItem(KEY_HALF_DAY) || null; }
  function setHalfAlertDate(s){ localStorage.setItem(KEY_HALF_DAY, s); }

  function initializePot(){
    const today = new Date().toISOString().slice(0,10);
    const resetDay = getPotResetDay();
    if (!getStoredPot() || resetDay !== today){
      setStoredPot(INITIAL_POT);
      setPotResetDay(today);
      setHalfAlertDate('');
    }
  }

 function updatePotUI() {
  const pot = getStoredPot() ?? INITIAL_POT;

  // --- FIXED FRONT DISPLAY ---
  if (dailyPotEl) dailyPotEl.textContent = '$10,000'; // always show this
  
  // --- BACKEND POT LOGIC STILL ACTIVE ---
  if (pot <= 0) {
    handleStationClosed();
  } else {
    if (
      closedOverlay &&
      !closedOverlay.classList.contains('hidden') &&
      !isPastMidnightReset()
    ) {
      closedOverlay.classList.add('hidden');
      if (joinTrainBtn) {
        joinTrainBtn.disabled = false;
        joinTrainBtn.style.opacity = '1';
      }
    }
  }
}

  /* ---------------- terminal helpers ---------------- */
  const trainNames = ["Money Express","Starliner 9000","Frenzy Rail","Lucky Cargo","Fortune Flyer","Crypto Cruiser","Golden Dash","Midnight Ride"];
  const destinations = ["Lagos","Accra","Nairobi","Cape Town","Johannesburg","Abuja","Kigali","London","Dubai","New York"];

  // Only set terminal if not mid-game (avoid overwriting)
  function setTrainTerminal(){
    if (trainActive) return;
    const name = trainNames[Math.floor(Math.random()*trainNames.length)];
    const dest = destinations[Math.floor(Math.random()*destinations.length)];
    const date = new Date().toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
    if (trainNameEl) trainNameEl.textContent = name;
    if (trainDateEl) trainDateEl.textContent = date;
    if (trainDestinationEl) trainDestinationEl.textContent = dest;
    if (confirmText) confirmText.textContent = `Join ${name} train to → ${dest}? Ready to play ?`;
  }

  function updateTrainTime(){
    if (!trainTimeEl) return;
    const now = new Date();
    trainTimeEl.textContent = now.toLocaleTimeString('en-GB',{hour12:false});
  }

  /* ---------------- popup helper ---------------- */
  let popupTimeout = null;
  function showPopup(text, ms=1800){
    if (!popupEl) {
      console.warn('popup element not found');
      return;
    }
    popupEl.textContent = text;
    popupEl.style.display = 'block';
    popupEl.style.opacity = '1';
    if (popupTimeout) clearTimeout(popupTimeout);
    popupTimeout = setTimeout(()=>{
      popupEl.style.opacity = '0';
      setTimeout(()=>{ popupEl.style.display = 'none'; }, 300);
    }, ms);
  }

  /* ---------------- halfway alert once per day ---------------- */
  function maybeShowHalfwayAlert(){
    const pot = getStoredPot() ?? INITIAL_POT;
    const half = Math.floor(INITIAL_POT/2);
    const today = new Date().toISOString().slice(0,10);
    const shownDate = getHalfAlertDate();
    if (pot <= half && shownDate !== today){
      setHalfAlertDate(today);
      showPopup('⚠️ Tickets are Halfway mined — daily reward is running low!', 4000);
      const terminal = document.getElementById('trainTerminal');
      if (terminal){
        terminal.style.boxShadow = '0 0 30px rgba(255,165,0,0.28)';
        setTimeout(()=> terminal.style.boxShadow = '', 2500);
      }
    }
  }

  /* ---------------- station closed / reopen countdown ---------------- */
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
    if (closedOverlay) closedOverlay.classList.remove('hidden');
    if (joinTrainBtn) { joinTrainBtn.disabled = true; joinTrainBtn.style.display = 'block'; joinTrainBtn.style.opacity = '0.5'; }
    if (countdownTimer) clearInterval(countdownTimer);
    function tick(){
      const ms = timeToNextMidnight();
      if (reopenCountdown) reopenCountdown.textContent = formatHMS(ms);
      if (ms <= 0){
        clearInterval(countdownTimer);
        resetPotAndReopen();
      }
    }
    tick();
    countdownTimer = setInterval(tick, 1000);
    playAudio(SOUND_PATHS.depart);
  }

  function resetPotAndReopen(){
    setStoredPot(INITIAL_POT);
    const today = new Date().toISOString().slice(0,10);
    setPotResetDay(today);
    setHalfAlertDate('');
    if (closedOverlay) closedOverlay.classList.add('hidden');
    if (joinTrainBtn) { joinTrainBtn.disabled = false; joinTrainBtn.style.opacity = '1'; }
    setTrainTerminal();
    updatePotUI();
    showPopup('🔁 Pot reset! Station reopened.', 3000);
  }

  function isPastMidnightReset(){ return getPotResetDay() !== new Date().toISOString().slice(0,10); }

  /* ---------------- problems generator ---------------- */
  function generateProblems(){
    currentProblems = [];
    if (problemBoard) problemBoard.innerHTML = '';
    // layout: keep inline blocks as small flex columns
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
      input.style.background = '#0e0e0e';
      input.style.color = '#fff';
      input.style.textAlign = 'center';
      input.dataset.index = i;

      wrapper.appendChild(label);
      wrapper.appendChild(input);
      problemBoard.appendChild(wrapper);
    }


    // watch inputs: only enable button when all fields are filled (not necessarily correct)
    const inputs = problemBoard.querySelectorAll('.problemInput');
    function checkFilled(){
      const allFilled = Array.from(inputs).every(i => i.value.trim() !== '');
      if (submitAnswersBtn) {
        submitAnswersBtn.disabled = !allFilled;
        submitAnswersBtn.style.opacity = allFilled ? '1' : '0.6';
      }
    }
    inputs.forEach(inp => {
      inp.addEventListener('input', checkFilled);
    });
    // initial check (in case some browser auto-fills)
    checkFilled();
  }

  /* ---------------- loading bar ---------------- */
  function startLoadingBar(){
    if (loadingContainer) loadingContainer.style.display = 'block';
    loadingProgress = 0;
    if (loadingBar) loadingBar.style.width = '0%';
    if (trainEmoji) trainEmoji.style.left = '0px';
    // play start sound
    playAudio(SOUND_PATHS.start, true); // loop start chug (it will be freed - we won't keep reference)
    loadingInterval = setInterval(()=>{
      loadingProgress++;
      const percent = (loadingProgress/52) * 100; // 52s window
      if (loadingBar) loadingBar.style.width = `${percent}%`;
      if (trainEmoji) trainEmoji.style.left = `calc(${percent}% - 12px)`;
      if (loadingProgress >= 52){
        clearInterval(loadingInterval);
        loadingInterval = null;
        if (trainActive){
          trainActive = false;
          stopLoadingBar();
          playAudio(SOUND_PATHS.depart);
          endTrain(false);
        }
      }
    }, 1000);
  }

  function stopLoadingBar(){
    if (loadingInterval) { clearInterval(loadingInterval); loadingInterval = null; }
    if (loadingContainer) loadingContainer.style.display = 'none';
    if (loadingBar) loadingBar.style.width = '0%';
    if (trainEmoji) trainEmoji.style.left = '0px';
  }

/* ------------------ Firestore user integration ------------------ */
let currentUser = null;          // full user doc (uid + fields)
let currentUserUnsub = null;     // snapshot unsubscribe

// Helper: sanitize email to match Firestore doc ID style
const sanitizeEmailToId = (raw) => String(raw || '').replace(/[.#$[\]]/g, ',');

// Load logged-in user exactly like your shop does
async function loadCurrentUserForGame() {
  try {
    // Try vipUser then hostUser (same logic as shop)
    const vipRaw = localStorage.getItem('vipUser');
    const hostRaw = localStorage.getItem('hostUser');
    const storedUser = vipRaw ? JSON.parse(vipRaw) : hostRaw ? JSON.parse(hostRaw) : null;

    // Default UI while loading
    if (profileNameEl) profileNameEl.textContent = profileNameEl.textContent || 'GUEST 0000';
    if (starCountEl) starCountEl.textContent = starCountEl.textContent || '50';
    if (cashCountEl) cashCountEl.textContent = cashCountEl.textContent || '0';

    // If no stored user, stop
    if (!storedUser?.email) {
      currentUser = null;
      return;
    }

    // --- 🔹 Prepare Firestore reference ---
    const uid = sanitizeEmailToId(storedUser.email);
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);

    // --- 🔹 Fallback if no record found ---
    if (!snap.exists()) {
      currentUser = {
        uid,
        stars: 0,
        cash: 0,
        isHost: false,
        chatId: storedUser.displayName || storedUser.email.split('@')[0],
        email: storedUser.email
      };

      // Update UI
      if (profileNameEl) profileNameEl.textContent = currentUser.chatId;
      if (starCountEl) starCountEl.textContent = String(currentUser.stars);
      if (cashCountEl) cashCountEl.textContent = String(currentUser.cash);
      return;
    }

    // --- ✅ Set current user and attach real-time listener ---
    currentUser = { uid, ...snap.data() };

    // Unsubscribe previous listener if any
    if (currentUserUnsub) currentUserUnsub();

    // 🔁 Live sync user's data between Firestore, localStorage, and UI
    currentUserUnsub = onSnapshot(userRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const newData = docSnap.data();
      currentUser = { uid, ...newData };

      // Update localStorage copy for other pages (shop, etc.)
      if (newData.isVIP) {
        localStorage.setItem('vipUser', JSON.stringify(newData));
      } else {
        localStorage.setItem('hostUser', JSON.stringify(newData));
      }


// ✅ Update UI in real time (Money Game elements)
if (starCountEl) {
  starCountEl.textContent = (newData.stars ?? 0).toLocaleString();
}

if (cashCountEl) {
  const cashValue = Number(newData.cash ?? 0);
  cashCountEl.textContent = `₦${cashValue.toLocaleString()}`;
}

if (profileNameEl) {
  profileNameEl.textContent =
    newData.chatId ||
    storedUser.displayName ||
    storedUser.email.split('@')[0];
}
});

  } catch (err) {
    console.error('loadCurrentUserForGame error', err);
  }
}
  // Use a transaction to deduct stars when joining (atomic check)
  async function tryDeductStarsForJoin(cost) {
    if (!currentUser?.uid) return { ok: false, message: 'You are not logged in' };
    const userRef = doc(db, 'users', currentUser.uid);
    try {
      await runTransaction(db, async (t) => {
        const u = await t.get(userRef);
        if (!u.exists()) throw new Error('User not found');
        const udata = u.data();
        const currentStars = Number(udata.stars || 0);
        if (currentStars < cost) throw new Error('Not enough stars');
        t.update(userRef, { stars: currentStars - cost });
      });
      return { ok: true };
    } catch (e) {
      console.warn('Deduct stars failed', e);
      return { ok: false, message: e.message || 'Could not deduct stars' };
    }
  }

  // Give reward: add cash & stars in a transaction
  async function giveWinRewards(rewardCash, rewardStars) {
    if (!currentUser?.uid) {
      // if no user, just update UI locally
      if (cashCountEl) cashCountEl.textContent = String((parseInt(cashCountEl.textContent.replace(/,/g,''),10) || 0) + rewardCash);
      if (starCountEl) starCountEl.textContent = String((parseInt(starCountEl.textContent,10) || 0) + rewardStars);
      return;
    }
    const userRef = doc(db, 'users', currentUser.uid);
    try {
      await runTransaction(db, async (t) => {
        const u = await t.get(userRef);
        if (!u.exists()) throw new Error('User not found');
        const udata = u.data();
        const newCash = (Number(udata.cash || 0) + Number(rewardCash));
        const newStars = (Number(udata.stars || 0) + Number(rewardStars));
        t.update(userRef, { cash: newCash, stars: newStars });
      });
      return { ok: true };
    } catch (e) {
      console.error('giveWinRewards error', e);
      return { ok: false, message: e.message || 'Failed to give rewards' };
    }
  }
  


/* ---------------- start / end train (streamlined + Firestore + UI polish) ---------------- */

async function startTrain() {
  const howToPlayBtn = document.getElementById('howToPlayBtn');

  // --- Prechecks ---
  const pot = getStoredPot() ?? INITIAL_POT;
  if (pot <= 0) {
    showPopup('🚧 Train Station closed for today. Come back tomorrow.');
    return;
  }

  const curStars = currentUser?.stars != null
    ? Number(currentUser.stars)
    : parseInt(starCountEl?.textContent || '0', 10) || 0;

  if (curStars < STAR_COST) {
    showPopup('Not enough stars to mine Tickets.');
    return;
  }

  const deductResult = await tryDeductStarsForJoin(STAR_COST);
  if (!deductResult.ok) {
    showPopup(deductResult.message || 'Not enough stars.');
    playAudio(SOUND_PATHS.error);
    return;
  }

  // --- Update UI optimistically ---
  if (starCountEl) starCountEl.textContent = String(Math.max(0, curStars - STAR_COST));
  if (joinTrainBtn) joinTrainBtn.style.display = 'none';
  if (howToPlayBtn) howToPlayBtn.style.display = 'none';

  trainActive = true;

  // --- Setup game ---
  generateProblems();
  if (problemBoard) problemBoard.classList.remove('hidden');

  if (submitAnswersBtn) {
    submitAnswersBtn.classList.remove('hidden');
    submitAnswersBtn.style.display = 'block';
    submitAnswersBtn.disabled = false;
    submitAnswersBtn.style.opacity = '0.6'; // dimmed until ready

    // --- Add input listener to brighten button only when all fields filled ---
    const inputs = Array.from(document.querySelectorAll('.problemInput'));
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        const allFilled = inputs.every(i => i.value.trim() !== '');
        submitAnswersBtn.style.opacity = allFilled ? '1' : '0.6';
      });
    });

    // --- Add click handler ---
    submitAnswersBtn.onclick = async () => {
      if (!trainActive) return;

      const allFilled = inputs.every(i => i.value.trim() !== '');
      if (!allFilled) {
        showPopup("You're not done yet! Fill all ticket numbers.", 2400);
        if (SOUND_PATHS.error) playAudio(SOUND_PATHS.error);
        return;
      }

      let correct = true;
      inputs.forEach((inp, idx) => {
        const val = parseInt(inp.value, 10);
        if (val !== currentProblems[idx].ans) correct = false;
      });

      const ticketNumber = `TICKET-${Math.floor(Math.random()*9000)+1000}`;
      await endTrain(correct, ticketNumber);
    };
  }
}

async function endTrain(success, ticketNumber = null) {
  stopLoadingBar();
  trainActive = false;

  // Hide problems and submit button
  if (problemBoard) problemBoard.classList.add('hidden');
  if (submitAnswersBtn) {
    submitAnswersBtn.classList.add('hidden');
    submitAnswersBtn.style.display = 'none';
  }

  // Show join/tutorial buttons again
  if (joinTrainBtn) {
    const pot = getStoredPot() ?? INITIAL_POT;
    joinTrainBtn.style.display = 'block';
    joinTrainBtn.disabled = pot <= 0;
    joinTrainBtn.style.opacity = pot <= 0 ? '0.5' : '1';
  }
  if (howToPlayBtn) howToPlayBtn.style.display = 'inline-block';

  if (success) {
    // --- Calculate new rewards ---
    const rewardCash = REWARD_TO_USER;
    const rewardStars = STARS_PER_WIN;

    const oldCash = parseInt(cashCountEl?.textContent?.replace(/[^0-9]/g, ''), 10) || 0;
    const oldStars = parseInt(starCountEl?.textContent?.replace(/[^0-9]/g, ''), 10) || 0;

    const newCash = oldCash + rewardCash;
    const newStars = oldStars + rewardStars;

    if (cashCountEl) cashCountEl.textContent = `₦${newCash.toLocaleString()}`;
    if (starCountEl) starCountEl.textContent = newStars.toString();

    // Deduct from daily pot
    const updatedPot = Math.max(0, (getStoredPot() ?? INITIAL_POT) - DEDUCT_PER_WIN);
    setStoredPot(updatedPot);

    // Ticket info
    const dest = trainDestinationEl?.textContent || 'your destination';
    const tnum = ticketNumber || '---';

    // --- Show win modal ---
    showWinModal(rewardCash, tnum, dest);
    playAudio(SOUND_PATHS.ding);

    // Halfway alert & station closure
    maybeShowHalfwayAlert();
    if (updatedPot <= 0) handleStationClosed();

    // Persist rewards in Firestore & sync locally
    await giveWinRewards(rewardCash, rewardStars)
      .then(res => {
        if (res.ok) {
          // Update currentUser object
          currentUser.cash = (currentUser.cash || 0) + rewardCash;
          currentUser.stars = (currentUser.stars || 0) + rewardStars;

          // Update UI again (safety)
          if (cashCountEl) cashCountEl.textContent = `₦${currentUser.cash.toLocaleString()}`;
          if (starCountEl) starCountEl.textContent = currentUser.stars.toString();

          // Update localStorage copy
          const storedKey = currentUser.isVIP ? 'vipUser' : 'hostUser';
          localStorage.setItem(storedKey, JSON.stringify(currentUser));
        } else {
          showPopup('⚠️ Reward could not be saved. Try again or contact support.', 4500);
        }
      })
      .catch(err => {
        console.error('giveWinRewards failed', err);
        showPopup('⚠️ Reward save error. Try again later.', 4500);
      });

  } else {
    // Train failed
    showPopup('🚉 Train has left the station! You didn’t get a ticket 😢', 2200);
    playAudio(SOUND_PATHS.depart);
  }
}

/* ---------------- Win modal helper ---------------- */
function showWinModal(cashReward, ticketNumber, destination) {
  const modal = document.getElementById('winModal');
  const winTextEl = document.getElementById('winText');

  if (!modal) return;

  // Update content
  winTextEl.textContent = `🎟 Ticket: ${ticketNumber} — Destination: ${destination}\n💰 You earned ₦${cashReward.toLocaleString()}!`;

  // Show modal
  modal.classList.add('show');

  // Auto-hide after 5s
  setTimeout(() => {
    modal.classList.remove('show');  // fades out smoothly
  }, 5000);
}

  /* ---------------- join modal wiring ---------------- */
  joinTrainBtn?.addEventListener('click', () => {
    if (joinTrainBtn.disabled) return;
    if (confirmModal) confirmModal.style.display = 'flex';
    playAudio(SOUND_PATHS.whistle);
  });
  confirmYes?.addEventListener('click', () => { if (confirmModal) confirmModal.style.display = 'none'; startTrain(); });
  confirmNo?.addEventListener('click', () => { if (confirmModal) confirmModal.style.display = 'none'; });

  /* ---------------- Expose debug helpers ---------------- */
  window.moneyTrainLocal = {
    getPot: () => getStoredPot(),
    setPot: (v) => setStoredPot(v),
    resetPotAndReopen,
    simulateWin: () => { trainActive = true; generateProblems(); endTrain(true,'TEST-TICKET'); },
    // firebase helpers
    currentUser: () => currentUser,
    loadCurrentUserForGame
  };

  /* ---------------- init & timers ---------------- */
  function init(){
    // protect UI
    initializePot();
    updatePotUI();
    setTrainTerminal();
    setInterval(setTrainTerminal, 60_000);
    setInterval(updateTrainTime, 1000);
    updateTrainTime();
    maybeShowHalfwayAlert();

    if (problemBoard) problemBoard.classList.add('hidden');
    if (submitAnswersBtn) submitAnswersBtn.style.display = 'none';

    // schedule midnight reset (and fallback)
    const msToMid = timeToNextMidnight();
    setTimeout(()=> resetPotAndReopen(), msToMid + 1000);
    setInterval(()=> { if (isPastMidnightReset()) resetPotAndReopen(); }, 60_000);

    // initial profile UI if present
    if (profileNameEl) profileNameEl.textContent = profileNameEl.textContent || 'GUEST 0000';
    if (starCountEl) starCountEl.textContent = starCountEl.textContent || '50';
    if (cashCountEl) cashCountEl.textContent = cashCountEl.textContent || '0';
  }

  init();

  // Load user from Firestore & start listening (fire-and-forget)
  loadCurrentUserForGame().catch(err => console.error('loadCurrentUserForGame failed', err));

}); // DOMContentLoaded end

/* ---------------- How to Play ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  const howToPlayBtn = document.getElementById('howToPlayBtn');
  const howToPlayModal = document.getElementById('howToPlayModal');
  const closeHowTo = document.getElementById('closeHowTo');

  if (howToPlayBtn && howToPlayModal && closeHowTo) {
    howToPlayBtn.addEventListener('click', () => {
      howToPlayModal.style.display = 'flex';
    });

    closeHowTo.addEventListener('click', () => {
      howToPlayModal.style.display = 'none';
    });

    // Optional: click outside to close
    howToPlayModal.addEventListener('click', (e) => {
      if (e.target === howToPlayModal) howToPlayModal.style.display = 'none';
    });
  }
});

/* ---------------- Leaderboard---------------- */
document.addEventListener('DOMContentLoaded', () => {
  const leaderboardBtn = document.getElementById('leaderboardBtn');
  const leaderboardPopup = document.getElementById('leaderboardPopup');
  const closeBtn = document.getElementById('closeLeaderboard');
  const leaderboardList = document.getElementById('leaderboardList');

  const randomNames = ["Zara", "Leo", "Ava", "Max", "Mia", "Eli", "Luna", "Kai", "Nia", "Jax"];

  function generateRandomLeaderboard() {
    leaderboardList.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const name = randomNames[Math.floor(Math.random() * randomNames.length)];
      const cash = Math.floor(Math.random() * 5000 + 1000);
      const li = document.createElement('li');
      li.textContent = `${name} — $${cash.toLocaleString()}`;
      leaderboardList.appendChild(li);
    }
  }

  leaderboardBtn.addEventListener('click', () => {
    generateRandomLeaderboard();
    leaderboardPopup.style.display = 'block';
  });

  closeBtn.addEventListener('click', () => leaderboardPopup.style.display = 'none');

  leaderboardPopup.addEventListener('click', (e) => {
    if (e.target === leaderboardPopup) leaderboardPopup.style.display = 'none';
  });
});