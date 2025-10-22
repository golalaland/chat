/* moneymaths.js
   Drop-in JS for Money Train HTML provided by user.
   Assumes HTML IDs: joinTrainBtn, confirmModal, confirmYes, confirmNo,
   loadingContainer, loadingBar, trainEmoji, problemBoard, submitAnswers,
   popup (star-popup), dailyPot, closedOverlay, reopenCountdown,
   trainName, trainDate, trainTime, trainDestination,
   profileName, starCount, cashCount
*/

document.addEventListener('DOMContentLoaded', () => {

  /* ---------------- Config ---------------- */
  const INITIAL_POT       = 1_000_000; // ₦1,000,000
  const DEDUCT_PER_WIN    = 1_000;     // deduct from pot per win
  const REWARD_TO_USER    = 1_000;     // reward to user per win
  const STARS_PER_WIN     = 5 * 8;     // 40 stars
  const NUM_BLOCKS        = 8;
  const STAR_COST         = 10;        // cost to join (enforced)

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

  const profileNameEl     = document.getElementById('profileName');
  const starCountEl       = document.getElementById('starCount');
  const cashCountEl       = document.getElementById('cashCount');

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

  function updatePotUI(){
    const pot = getStoredPot() ?? INITIAL_POT;
    dailyPotEl.textContent = pot.toLocaleString();
    if (pot <= 0){
      handleStationClosed();
    } else {
      if (!closedOverlay.classList.contains('hidden') && !isPastMidnightReset()){
        closedOverlay.classList.add('hidden');
        joinTrainBtn.disabled = false;
        joinTrainBtn.style.opacity = '1';
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
    if (confirmText) confirmText.textContent = `Join ${name} → ${dest}? Ready to play?`;
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
      showPopup('⚠️ Halfway mined — pot is running low!', 4000);
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
    closedOverlay.classList.remove('hidden');
    joinTrainBtn.disabled = true;
    joinTrainBtn.style.display = 'block';
    joinTrainBtn.style.opacity = '0.5';
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
    closedOverlay.classList.add('hidden');
    joinTrainBtn.disabled = false;
    joinTrainBtn.style.opacity = '1';
    setTrainTerminal();
    updatePotUI();
    showPopup('🔁 Pot reset! Station reopened.', 3000);
  }

  function isPastMidnightReset(){ return getPotResetDay() !== new Date().toISOString().slice(0,10); }

  /* ---------------- problems generator ---------------- */
  function generateProblems(){
    currentProblems = [];
    problemBoard.innerHTML = '';
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

    // show submit/verify button for gameplay and attach input watchers
    submitAnswersBtn.classList.remove('hidden');
submitAnswersBtn.style.display = 'block';
submitAnswersBtn.disabled = false;
submitAnswersBtn.style.opacity = '0.6';

    // watch inputs: only enable button when all fields are filled (not necessarily correct)
    const inputs = problemBoard.querySelectorAll('.problemInput');
    function checkFilled(){
      const allFilled = Array.from(inputs).every(i => i.value.trim() !== '');
      submitAnswersBtn.disabled = !allFilled;
      submitAnswersBtn.style.opacity = allFilled ? '1' : '0.6';
    }
    inputs.forEach(inp => {
      inp.addEventListener('input', checkFilled);
      // prevent iOS zoom by ensuring font-size set via CSS (you added earlier)
    });
    // initial check (in case some browser auto-fills)
    checkFilled();
  }

  /* ---------------- loading bar ---------------- */
  function startLoadingBar(){
    loadingContainer.style.display = 'block';
    loadingProgress = 0;
    loadingBar.style.width = '0%';
    trainEmoji.style.left = '0px';
    // play start sound
    playAudio(SOUND_PATHS.start, true); // loop start chug (it will be freed - we won't keep reference)
    loadingInterval = setInterval(()=>{
      loadingProgress++;
      const percent = (loadingProgress/39) * 100; // 39s window
      loadingBar.style.width = `${percent}%`;
      trainEmoji.style.left = `calc(${percent}% - 12px)`;
      if (loadingProgress >= 39){
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
    loadingContainer.style.display = 'none';
    loadingBar.style.width = '0%';
    trainEmoji.style.left = '0px';
  }
/* ---------------- start / end train ---------------- */
function startTrain(){
    // ensure pot open
    if ((getStoredPot() ?? INITIAL_POT) <= 0){
        showPopup('🚧 Station closed for today. Come back tomorrow.');
        return;
    }
    // star check
    const curStars = parseInt(starCountEl.textContent,10) || 0;
    if (curStars < STAR_COST){
        showPopup('Not enough stars to join.');
        return;
    }
    // deduct star cost
    starCountEl.textContent = (curStars - STAR_COST);

    // state & UI
    trainActive = true;
    joinTrainBtn.style.display = 'none';
    generateProblems();

    // show problem board + button
    problemBoard.classList.remove('hidden');
    submitAnswersBtn.classList.remove('hidden');
    submitAnswersBtn.style.display = 'block';
    submitAnswersBtn.disabled = false;
    submitAnswersBtn.style.opacity = '0.6';

    // start timer & ambience sound
    startLoadingBar();

    // play looping train whistle ambience if not already playing
    if (!trainAmbience) {
        trainAmbience = playAudio(SOUND_PATHS.whistle, { loop: true, volume: 0.4 });
    }
}

function endTrain(success, ticketNumber=null){
    stopLoadingBar();

    // stop train ambience
    if (trainAmbience) {
        trainAmbience.pause();
        trainAmbience = null;
    }

    // hide problems & submit
    problemBoard.classList.add('hidden');
    submitAnswersBtn.classList.add('hidden');
    submitAnswersBtn.style.display = 'none';

    // show join again only if pot >0
    if ((getStoredPot() ?? INITIAL_POT) > 0){
        joinTrainBtn.style.display = 'block';
        joinTrainBtn.disabled = false;
        joinTrainBtn.style.opacity = '1';
    } else {
        joinTrainBtn.style.display = 'block';
        joinTrainBtn.disabled = true;
        joinTrainBtn.style.opacity = '0.5';
    }

    if (success){
        // give rewards
        const oldCash = parseInt(cashCountEl.textContent.replace(/,/g,''),10) || 0;
        const newCash = oldCash + REWARD_TO_USER;
        cashCountEl.textContent = newCash.toLocaleString();

        const oldStars = parseInt(starCountEl.textContent,10) || 0;
        const newStars = oldStars + STARS_PER_WIN;
        starCountEl.textContent = newStars;

        // deduct pot
        let pot = getStoredPot() ?? INITIAL_POT;
        pot = Math.max(0, pot - DEDUCT_PER_WIN);
        setStoredPot(pot);

        const dest = trainDestinationEl?.textContent || 'your destination';
        const tnum = ticketNumber || '---';

        showPopup(`🎫 You’ve secured your ${dest} train ticket number ${tnum} — welcome aboard! You earned ₦${REWARD_TO_USER.toLocaleString()}!`, 4500);
        playAudio(SOUND_PATHS.ding);

        maybeShowHalfwayAlert();

        if (pot <= 0) handleStationClosed();
    } else {
        showPopup('Train left! You missed Train! ☹️', 2200);
    }
}
  /* ---------------- submit answers handler ---------------- */
  submitAnswersBtn.addEventListener('click', () => {
    if (!trainActive) return;

    const inputs = Array.from(document.querySelectorAll('.problemInput'));
    // check empties:
    const anyEmpty = inputs.some(inp => inp.value === '' || inp.value === null);
    if (anyEmpty){
      showPopup("You're not yet done hashing your train ticket — hurry!", 2400);
      playAudio(SOUND_PATHS.error);
      return;
    }

    // evaluate correctness
    let allCorrect = true;
    inputs.forEach((inp, i) => {
      const val = parseInt(inp.value,10);
      const expected = currentProblems[i].ans;
      if (isNaN(val) || val !== expected) allCorrect = false;
    });

    // stop timer
    trainActive = false;
    stopLoadingBar();

    if (allCorrect){
      // build ticket number by concatenating each answer's string (in order)
      const answers = inputs.map(inp => String(parseInt(inp.value,10)));
      const ticketNumber = answers.join('');
      endTrain(true, ticketNumber);
    } else {
      showPopup("Some answers are incorrect — train left!", 3000);
      playAudio(SOUND_PATHS.depart);
      endTrain(false);
    }
  });

  /* ---------------- join modal wiring ---------------- */
  joinTrainBtn.addEventListener('click', () => {
    if (joinTrainBtn.disabled) return;
    confirmModal.style.display = 'flex';
    playAudio(SOUND_PATHS.whistle);
  });
  confirmYes.addEventListener('click', () => { confirmModal.style.display = 'none'; startTrain(); });
  confirmNo.addEventListener('click', () => { confirmModal.style.display = 'none'; });

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

    problemBoard.classList.add('hidden');
    submitAnswersBtn.style.display = 'none';

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

  /* ---------------- Expose debug helpers ---------------- */
  window.moneyTrainLocal = {
    getPot: () => getStoredPot(),
    setPot: (v) => setStoredPot(v),
    resetPotAndReopen,
    simulateWin: () => { trainActive = true; generateProblems(); endTrain(true,'TEST-TICKET'); }
  };

}); // DOMContentLoaded end