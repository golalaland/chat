/* ---------------- READY: Money Train local simulation (fixed submit + ticket) ---------------- */
document.addEventListener('DOMContentLoaded', () => {

  /* ------------- Config ------------- */
  const INITIAL_POT = 1000000; // ₦1,000,000 start
  const DEDUCT_PER_WIN = 1000;  // ₦1,000 per win (taken from pot)
  const REWARD_TO_USER = 1000;  // ₦1,000 reward to user per win
  const STARS_PER_WIN = 5 * 8;  // 40 stars (5 * NUM_BLOCKS)
  const NUM_BLOCKS = 8;
  const STAR_COST = 10; // cost in stars to join each train (enforced)

  /* ------------- UI Refs ------------- */
  const joinTrainBtn = document.getElementById('joinTrainBtn');
  const loadingContainer = document.getElementById('loadingContainer');
  const loadingBar = document.getElementById('loadingBar');
  const trainEmoji = document.getElementById('trainEmoji');
  const problemBoard = document.getElementById('problemBoard');
  const submitAnswersBtn = document.getElementById('submitAnswers');
  const popup = document.getElementById('popup');
  const dailyPotEl = document.getElementById('dailyPot');
  const closedOverlay = document.getElementById('closedOverlay');
  const reopenCountdown = document.getElementById('reopenCountdown');
  const confirmModal = document.getElementById('confirmModal');
  const confirmYes = document.getElementById('confirmYes');
  const confirmNo = document.getElementById('confirmNo');
  const confirmText = document.getElementById('confirmText');

  const profileNameEl = document.getElementById('profileName');
  const starCountEl = document.getElementById('starCount');
  const cashCountEl = document.getElementById('cashCount');
  const trainDestinationEl = document.getElementById('trainDestination');

  /* ------------- Sound Hooks ------------- */
  function playSound(name, loop=false){
    try {
      const a = new Audio(`./sounds/${name}.mp3`);
      a.volume = 0.7;
      a.loop = loop;
      a.play().catch(()=>{ /* ignore play errors */ });
      return a;
    } catch (e){
      return null;
    }
  }

  /* ------------- Local State & Persistence ------------- */
  let loadingInterval = null;
  let loadingProgress = 0;
  let trainActive = false;
  let currentProblems = [];

  // storage helpers
  function getStoredPot(){
    const raw = localStorage.getItem('moneytrain_pot');
    return raw ? parseInt(raw,10) : null;
  }
  function setStoredPot(v){
    localStorage.setItem('moneytrain_pot', String(Math.max(0, Math.floor(v))));
    updatePotUI();
  }
  function getHalfAlertDate(){ return localStorage.getItem('moneytrain_half_date') || null; }
  function setHalfAlertDate(s){ localStorage.setItem('moneytrain_half_date', s); }
  function getPotResetDay(){ return localStorage.getItem('moneytrain_reset_day') || null; }
  function setPotResetDay(s){ localStorage.setItem('moneytrain_reset_day', s); }

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

  /* ------------- Terminal helpers ------------- */
  const trainNames = ["Money Express","Starliner 9000","Frenzy Rail","Lucky Cargo","Fortune Flyer","Crypto Cruiser","Golden Dash","Midnight Ride"];
  const destinations = ["Lagos","Accra","Nairobi","Cape Town","Johannesburg","Abuja","Kigali","London","Dubai","New York"];

  function setTrainTerminal(){
    const name = trainNames[Math.floor(Math.random()*trainNames.length)];
    const dest = destinations[Math.floor(Math.random()*destinations.length)];
    const date = new Date().toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
    const elName = document.getElementById('trainName');
    const elDate = document.getElementById('trainDate');
    const elDest = document.getElementById('trainDestination');
    if (elName) elName.textContent = name;
    if (elDate) elDate.textContent = date;
    if (elDest) elDest.textContent = dest;
    if (confirmText) confirmText.textContent = `Join ${name} → ${dest}? Ready to play?`;
  }

  function updateTrainTime(){ const now = new Date(); const timeEl = document.getElementById('trainTime'); if (timeEl) timeEl.textContent = now.toLocaleTimeString('en-GB',{hour12:false}); }

  /* ------------- Popup helper ------------- */
  let popupTimeout = null;
  function showPopup(text, ms=4500){
    popup.textContent = text;
    popup.style.display = 'block';
    popup.style.opacity = '1';
    if (popupTimeout) clearTimeout(popupTimeout);
    popupTimeout = setTimeout(()=>{
      popup.style.opacity = '0';
      setTimeout(()=>{ popup.style.display = 'none'; }, 300);
    }, ms);
  }

  /* ------------- Halfway alert (once per day) ------------- */
  function maybeShowHalfwayAlert(){
    const pot = getStoredPot() ?? INITIAL_POT;
    const half = Math.floor(INITIAL_POT/2);
    const today = new Date().toISOString().slice(0,10);
    const shownDate = getHalfAlertDate();
    if (pot <= half && shownDate !== today){
      setHalfAlertDate(today);
      showPopup('⚠️ Halfway Mined! The pot is running low — hurry!', 6000);
      const terminal = document.getElementById('trainTerminal');
      if (terminal){
        terminal.style.boxShadow = '0 0 30px rgba(255,165,0,0.28)';
        setTimeout(()=>{ terminal.style.boxShadow = ''; }, 2500);
      }
    }
  }

  /* ------------- Station closed / reopen countdown ------------- */
  let countdownTimer = null;
  function timeToNextMidnight(){ const now = new Date(); const tomorrow = new Date(now); tomorrow.setDate(now.getDate()+1); tomorrow.setHours(0,0,0,0); return Math.max(0, tomorrow - now); }
  function formatHMS(ms){ const s = Math.floor(ms/1000); const hh = String(Math.floor(s/3600)).padStart(2,'0'); const mm = String(Math.floor((s%3600)/60)).padStart(2,'0'); const ss = String(s%60).padStart(2,'0'); return `${hh}:${mm}:${ss}`; }

  function handleStationClosed(){
    closedOverlay.classList.remove('hidden');
    joinTrainBtn.disabled = true;
    joinTrainBtn.style.display = 'block';
    joinTrainBtn.style.opacity = '0.5';
    if (countdownTimer) clearInterval(countdownTimer);
    function tick(){
      const ms = timeToNextMidnight();
      reopenCountdown.textContent = formatHMS(ms);
      if (ms <= 0){
        clearInterval(countdownTimer);
        resetPotAndReopen();
      }
    }
    tick();
    countdownTimer = setInterval(tick, 1000);
    playSound('train_depart');
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
    showPopup('🔁 Pot reset! Station reopened.', 3500);
  }

  function isPastMidnightReset(){ const today = new Date().toISOString().slice(0,10); return getPotResetDay() !== today; }

  /* ------------- Problems generator ------------- */
  function generateProblems(){
    currentProblems = [];
    problemBoard.innerHTML = '';
    for(let i=0;i<NUM_BLOCKS;i++){
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
  }

  /* ------------- Loading (countdown until train leaves) ------------- */
  function startLoadingBar(){
    loadingContainer.style.display = 'block';
    loadingProgress = 0;
    loadingBar.style.width = '0%';
    trainEmoji.style.left = '0px';
    loadingInterval = setInterval(()=>{
      loadingProgress++;
      const percent = (loadingProgress/39) * 100; // 39 seconds
      loadingBar.style.width = `${percent}%`;
      trainEmoji.style.left = `calc(${percent}% - 12px)`;
      if (loadingProgress >= 39){
        clearInterval(loadingInterval);
        loadingInterval = null;
        if (trainActive){
          trainActive = false;
          stopLoadingBar();
          playSound('train_depart');
          // if loading expired while user still solving -> fail
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

  /* ------------- Start / End Train flow ------------- */
  function startTrain(){
    // ensure station open
    if ((getStoredPot() ?? INITIAL_POT) <= 0) {
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

    // set state
    trainActive = true;

    // UI: hide join, show problems & submit button (use direct style to avoid class conflicts)
    joinTrainBtn.style.display = 'none';
    generateProblems();
    problemBoard.classList.remove('hidden');
    submitAnswersBtn.style.display = 'block';

    // start loading timer + sound
    startLoadingBar();
    playSound('train_start');
  }

  function endTrain(success, ticketNumber=null){
    stopLoadingBar();

    // hide problems & submit
    problemBoard.classList.add('hidden');
    submitAnswersBtn.style.display = 'none';

    // show join again only if pot still > 0
    if ((getStoredPot() ?? INITIAL_POT) > 0) {
      joinTrainBtn.style.display = 'block';
      joinTrainBtn.disabled = false;
      joinTrainBtn.style.opacity = '1';
    } else {
      joinTrainBtn.style.display = 'block';
      joinTrainBtn.disabled = true;
      joinTrainBtn.style.opacity = '0.5';
    }

    if (success){
      // Reward user: update cash and stars
      const oldCash = parseInt(cashCountEl.textContent.replace(/,/g,''),10) || 0;
      const newCash = oldCash + REWARD_TO_USER;
      cashCountEl.textContent = newCash.toLocaleString();

      const oldStars = parseInt(starCountEl.textContent,10) || 0;
      const newStars = oldStars + STARS_PER_WIN;
      starCountEl.textContent = newStars;

      // deduct from pot
      let pot = getStoredPot() ?? INITIAL_POT;
      pot = Math.max(0, pot - DEDUCT_PER_WIN);
      setStoredPot(pot);

      // ticket message: show destination and ticket number
      const dest = trainDestinationEl?.textContent || 'your destination';
      const tnum = ticketNumber || '---';
      showPopup(`🎫 You’ve secured your ${dest} train ticket number ${tnum} — welcome aboard! You earned ₦${REWARD_TO_USER.toLocaleString()}!`, 6000);
      playSound('cha_ching');

      maybeShowHalfwayAlert();

      if (pot <= 0){
        handleStationClosed();
      }
    } else {
      showPopup('Train left! You got nothing 😢', 2200);
    }
  }

  /* ------------- Submit handler (checks all 8 answers + creates ticket) ------------- */
  submitAnswersBtn.addEventListener('click', () => {
    if (!trainActive) return;

    const inputs = Array.from(document.querySelectorAll('.problemInput'));
    // check empties:
    const anyEmpty = inputs.some(inp => inp.value === '' || inp.value === null);
    if (anyEmpty){
      showPopup("You're not yet done hashing your train ticket — hurry!", 3000);
      playSound('error_bell');
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
      // success flow -> we pass ticketNumber to endTrain to display message
      endTrain(true, ticketNumber);
    } else {
      showPopup("Some answers are incorrect — train left!", 3000);
      playSound('train_depart');
      endTrain(false);
    }
  });

  /* ------------- Join button + modal wiring ------------- */
  joinTrainBtn.addEventListener('click', () => {
    if (joinTrainBtn.disabled) return;
    confirmModal.style.display = 'flex';
    playSound('train_whistle_short');
  });
  confirmYes.addEventListener('click', () => { confirmModal.style.display = 'none'; startTrain(); });
  confirmNo.addEventListener('click', () => { confirmModal.style.display = 'none'; });

  /* ------------- Init & timers ------------- */
  function init(){
    initializePot();
    updatePotUI();
    setTrainTerminal();
    setInterval(setTrainTerminal, 60000);
    setInterval(updateTrainTime, 1000);
    updateTrainTime();
    maybeShowHalfwayAlert();
    problemBoard.classList.add('hidden');
    submitAnswersBtn.style.display = 'none';

    // schedule midnight reset
    const msToMid = timeToNextMidnight();
    setTimeout(()=>{ resetPotAndReopen(); }, msToMid + 1000);
    setInterval(()=>{ if (isPastMidnightReset()){ resetPotAndReopen(); } }, 60_000);
  }

  init();

  // Expose debug helpers
  window.moneyTrainLocal = {
    getPot: () => getStoredPot(),
    setPot: (v) => setStoredPot(v),
    resetPotAndReopen,
    simulateWin: () => { trainActive = true; generateProblems(); endTrain(true,'TEST-TICKET'); }
  };

}); // DOMContentLoaded end