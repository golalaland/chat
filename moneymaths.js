import { db, auth, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, increment, runTransaction } from './firebaseconfig.js';

document.addEventListener('DOMContentLoaded', () => {

  /* ---------------- Config ---------------- */
  const INITIAL_POT       = 1_000_000; // ₦1,000,000
  const DEDUCT_PER_WIN    = 1_000;     // deduct from pot per win
  const REWARD_TO_USER    = 1_000;     // reward to user per win
  const STARS_PER_WIN     = 40;        // 5 * 8
  const NUM_BLOCKS        = 8;
  const STAR_COST         = 10;        // cost to join

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

  /* ---------------- Sounds ---------------- */
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
      a.play().catch(()=>{});
      return a;
    } catch(e){ /* ignore */ }
  }

  /* ---------------- Local state ---------------- */
  let loadingInterval = null;
  let loadingProgress = 0;
  let trainActive = false;
  let currentProblems = []; // [{a,b,ans}]
  let currentUser = null;

  /* ---------------- Firebase helpers ---------------- */

  const todayStr = () => new Date().toISOString().slice(0,10);

  async function getDailyPotDocRef(){
    return doc(db, 'dailyPot', todayStr());
  }

  async function initializeDailyPot(){
    const potRef = await getDailyPotDocRef();
    const potSnap = await getDoc(potRef);
    if (!potSnap.exists()){
      await setDoc(potRef, { amount: INITIAL_POT });
    }
  }

  async function getPot(){
    const potRef = await getDailyPotDocRef();
    const potSnap = await getDoc(potRef);
    return potSnap.exists() ? potSnap.data().amount : INITIAL_POT;
  }

  async function updatePot(amount){
    const potRef = await getDailyPotDocRef();
    await setDoc(potRef, { amount }, { merge: true });
    updatePotUI(amount);
  }

  async function adjustPot(delta){
    const potRef = await getDailyPotDocRef();
    return runTransaction(db, async (t) => {
      const snap = await t.get(potRef);
      const current = snap.exists() ? snap.data().amount : INITIAL_POT;
      const next = Math.max(0, current + delta);
      t.set(potRef, { amount: next });
      return next;
    });
  }

  async function getUserDocRef(uid){
    return doc(db, 'users', uid);
  }

  async function fetchUserData(){
    if (!currentUser) return null;
    const userRef = await getUserDocRef(currentUser.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()){
      // create default user
      await setDoc(userRef, { stars: 50, cash: 0, displayName: 'GUEST 0000' });
      return { stars: 50, cash: 0, displayName: 'GUEST 0000' };
    }
    return snap.data();
  }

  async function adjustUserStars(delta){
    if (!currentUser) return;
    const userRef = await getUserDocRef(currentUser.uid);
    await updateDoc(userRef, { stars: increment(delta) });
  }

  async function adjustUserCash(delta){
    if (!currentUser) return;
    const userRef = await getUserDocRef(currentUser.uid);
    await updateDoc(userRef, { cash: increment(delta) });
  }

  async function updateUserUI(){
    if (!currentUser) return;
    const data = await fetchUserData();
    if (!data) return;
    starCountEl.textContent = data.stars;
    cashCountEl.textContent = data.cash.toLocaleString();
    profileNameEl.textContent = data.displayName || 'GUEST 0000';
  }

  /* ---------------- UI helpers ---------------- */
  function showPopup(text, ms=1800){
    if (!popupEl) return;
    popupEl.textContent = text;
    popupEl.style.display = 'block';
    popupEl.style.opacity = '1';
    setTimeout(()=>{ popupEl.style.opacity = '0'; setTimeout(()=>popupEl.style.display='none',300); }, ms);
  }

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

  /* ---------------- train problems ---------------- */
  function generateProblems(){
    currentProblems = [];
    problemBoard.innerHTML = '';
    for (let i=0;i<NUM_BLOCKS;i++){
      let a = Math.floor(Math.random()*20)+1;
      let b = Math.floor(Math.random()*20)+1;
      if (a < b) [a,b] = [b,a];
      currentProblems.push({a,b,ans:a+b});

      const wrapper = document.createElement('div');
      wrapper.style.display='flex';
      wrapper.style.flexDirection='column';
      wrapper.style.alignItems='center';
      wrapper.style.gap='6px';
      wrapper.style.margin='6px';

      const label = document.createElement('div');
      label.textContent = `${a} + ${b}`;
      label.style.fontWeight='700';
      label.style.fontSize='12px';
      label.style.color='#fff';

      const input = document.createElement('input');
      input.type='number';
      input.className='problemInput';
      input.inputMode='numeric';
      input.placeholder='?';
      input.style.width='60px';
      input.style.padding='6px';
      input.style.borderRadius='6px';
      input.style.border='1px solid rgba(255,255,255,0.12)';
      input.style.background='#0e0e0e';
      input.style.color='#fff';
      input.style.textAlign='center';
      input.dataset.index=i;

      wrapper.appendChild(label);
      wrapper.appendChild(input);
      problemBoard.appendChild(wrapper);
    }

    submitAnswersBtn.style.display='block';
    submitAnswersBtn.disabled=true;
    submitAnswersBtn.style.opacity='0.6';

    const inputs = problemBoard.querySelectorAll('.problemInput');
    function checkFilled(){
      const allFilled = Array.from(inputs).every(i=>i.value.trim()!=='');
      submitAnswersBtn.disabled = !allFilled;
      submitAnswersBtn.style.opacity = allFilled?'1':'0.6';
    }
    inputs.forEach(inp=>inp.addEventListener('input',checkFilled));
    checkFilled();
  }

  /* ---------------- loading bar ---------------- */
  function startLoadingBar(){
    loadingContainer.style.display='block';
    loadingProgress=0;
    loadingBar.style.width='0%';
    trainEmoji.style.left='0px';
    playAudio(SOUND_PATHS.start,true);

    loadingInterval = setInterval(()=>{
      loadingProgress++;
      const percent = (loadingProgress/39)*100;
      loadingBar.style.width=`${percent}%`;
      trainEmoji.style.left=`calc(${percent}% - 12px)`;
      if (loadingProgress>=39){
        clearInterval(loadingInterval);
        loadingInterval=null;
        if (trainActive){
          trainActive=false;
          stopLoadingBar();
          playAudio(SOUND_PATHS.depart);
          endTrain(false);
        }
      }
    },1000);
  }

  function stopLoadingBar(){
    if (loadingInterval){ clearInterval(loadingInterval); loadingInterval=null; }
    loadingContainer.style.display='none';
    loadingBar.style.width='0%';
    trainEmoji.style.left='0px';
  }

  /* ---------------- start/end train ---------------- */
  async function startTrain(){
    if (!currentUser) { showPopup("Not logged in"); return; }

    const userData = await fetchUserData();
    if ((await getPot()) <= 0){ showPopup('🚧 Station closed for today.'); return; }
    if ((userData?.stars??0) < STAR_COST){ showPopup('Not enough stars.'); return; }

    // deduct stars
    await adjustUserStars(-STAR_COST);

    trainActive=true;
    joinTrainBtn.style.display='none';
    generateProblems();
    problemBoard.classList.remove('hidden');
    submitAnswersBtn.style.display='block';
    submitAnswersBtn.disabled=true;
    submitAnswersBtn.style.opacity='0.6';

    startLoadingBar();
    playAudio(SOUND_PATHS.whistle);
    await updateUserUI();
  }

  async function endTrain(success, ticketNumber=null){
    stopLoadingBar();
    problemBoard.classList.add('hidden');
    submitAnswersBtn.style.display='none';

    if ((await getPot())>0){
      joinTrainBtn.style.display='block';
      joinTrainBtn.disabled=false;
      joinTrainBtn.style.opacity='1';
    } else {
      joinTrainBtn.style.display='block';
      joinTrainBtn.disabled=true;
      joinTrainBtn.style.opacity='0.5';
    }

    if (success){
      await adjustUserCash(REWARD_TO_USER);
      await adjustUserStars(STARS_PER_WIN);
      await adjustPot(-DEDUCT_PER_WIN);

      const dest = trainDestinationEl?.textContent||'your destination';
      const tnum = ticketNumber||'---';
      showPopup(`🎫 You’ve secured your ${dest} ticket number ${tnum}! Earned ₦${REWARD_TO_USER.toLocaleString()}`,4500);
      playAudio(SOUND_PATHS.ding);
      await updateUserUI();
    } else {
      showPopup('Train left! You got nothing 😢',2200);
      playAudio(SOUND_PATHS.depart);
    }

    if ((await getPot())<=0) handleStationClosed();
  }

  /* ---------------- submit answers ---------------- */
  submitAnswersBtn.addEventListener('click', async ()=>{
    if (!trainActive) return;
    const inputs = Array.from(document.querySelectorAll('.problemInput'));
    if (inputs.some(inp=>inp.value==='')){ showPopup("Finish all problems!",2400); playAudio(SOUND_PATHS.error); return; }

    let allCorrect=true;
    inputs.forEach((inp,i)=>{
      const val=parseInt(inp.value,10);
      if (isNaN(val) || val!==currentProblems[i].ans) allCorrect=false;
    });

    trainActive=false;
    stopLoadingBar();

    if (allCorrect){
      const answers=inputs.map(inp=>String(parseInt(inp.value,10)));
      const ticketNumber = answers.join('');
      await endTrain(true,ticketNumber);
    } else {
      await endTrain(false);
      showPopup("Some answers wrong — train left!",3000);
    }
  });

  /* ---------------- join modal ---------------- */
  joinTrainBtn.addEventListener('click', ()=>{
    if (joinTrainBtn.disabled) return;
    confirmModal.style.display='flex';
    playAudio(SOUND_PATHS.whistle);
  });
  confirmYes.addEventListener('click', ()=>{ confirmModal.style.display='none'; startTrain(); });
  confirmNo.addEventListener('click', ()=>{ confirmModal.style.display='none'; });

  /* ---------------- station closed ---------------- */
  let countdownTimer=null;
  function timeToNextMidnight(){
    const now=new Date();
    const tomorrow=new Date(now);
    tomorrow.setDate(now.getDate()+1);
    tomorrow.setHours(0,0,0,0);
    return Math.max(0,tomorrow-now);
  }
  function formatHMS(ms){
    const s=Math.floor(ms/1000);
    const hh=String(Math.floor(s/3600)).padStart(2,'0');
    const mm=String(Math.floor((s%3600)/60)).padStart(2,'0');
    const ss=String(s%60).padStart(2,'0');
    return `${hh}:${mm}:${ss}`;
  }

  function handleStationClosed(){
    closedOverlay.classList.remove('hidden');
    joinTrainBtn.disabled=true;
    joinTrainBtn.style.display='block';
    joinTrainBtn.style.opacity='0.5';
    if (countdownTimer) clearInterval(countdownTimer);

    function tick(){
      const ms=timeToNextMidnight();
      if (reopenCountdown) reopenCountdown.textContent=formatHMS(ms);
      if (ms<=0){
        clearInterval(countdownTimer);
        resetPotAndReopen();
      }
    }
    tick();
    countdownTimer=setInterval(tick,1000);
    playAudio(SOUND_PATHS.depart);
  }

  async function resetPotAndReopen(){
    await setDoc(await getDailyPotDocRef(), { amount: INITIAL_POT });
    closedOverlay.classList.add('hidden');
    joinTrainBtn.disabled=false;
    joinTrainBtn.style.opacity='1';
    setTrainTerminal();
    updatePotUI(await getPot());
    showPopup('🔁 Pot reset! Station reopened.',3000);
  }

  async function updatePotUI(pot){
    dailyPotEl.textContent = (pot??await getPot()).toLocaleString();
  }

  /* ---------------- init ---------------- */
  async function init(){
    onAuthStateChanged(auth, async (user)=>{
      if (user){
        currentUser=user;
        await initializeDailyPot();
        await updateUserUI();
        updatePotUI(await getPot());
      } else {
        showPopup("Not logged in — limited mode",2500);
      }
    });

    setTrainTerminal();
    setInterval(setTrainTerminal,60000);
    setInterval(updateTrainTime,1000);
    updateTrainTime();
    problemBoard.classList.add('hidden');
    submitAnswersBtn.style.display='none';

    const msToMid = timeToNextMidnight();
    setTimeout(()=> resetPotAndReopen(), msToMid+1000);
    setInterval(()=> resetPotAndReopen(), 60_000);
  }

  init();

  /* ---------------- expose debug ---------------- */
  window.moneyTrainFirebase = {
    simulateWin: async ()=>{
      trainActive=true;
      generateProblems();
      await endTrain(true,'TEST-TICKET');
    },
    getPot,
    getUserData: fetchUserData
  };

});