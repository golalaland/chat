import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getFirestore, doc, getDoc, setDoc, updateDoc, runTransaction, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {

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
  const INITIAL_POT       = 1_000_000; // ₦1,000,000
  const DEDUCT_PER_WIN    = 1_000;     
  const REWARD_TO_USER    = 1_000;     
  const STARS_PER_WIN     = 5 * 8;     
  const NUM_BLOCKS        = 8;
  const STAR_COST         = 10;        

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
    error:  './sounds/error_bell.mp3',
    ambience: './sounds/train_ambience.mp3'
  };
  function playAudio(src, opts = {}) {
    if (!src) return;
    try {
      const a = new Audio(src);
      a.volume = opts.volume ?? 0.8;
      if (opts.loop) a.loop = true;
      a.play().catch(()=>{});
      return a;
    } catch (e) { }
  }

  /* ---------------- User & State ---------------- */
  const uid = localStorage.getItem('user_uid');
  if (!uid){
    alert("Please login in the chatroom first!");
    window.location.href = '/chatroom-login.html';
    return;
  }

  let currentProblems = [];
  let trainActive = false;
  let loadingInterval = null;
  let loadingProgress = 0;
  let trainAmbienceLoop = null;
  let countdownTimer = null;
  let popupTimeout = null;

  const userRef = doc(db, 'users', uid);
  const potRef = doc(db, 'global', 'moneyTrainPot');

  /* ---------------- Firestore helpers ---------------- */
  async function getUserData() {
    const snap = await getDoc(userRef);
    if (snap.exists()) return snap.data();
    // default values
    await setDoc(userRef, { stars: 50, cash: 0 });
    return { stars: 50, cash: 0 };
  }

  async function updateUserData(updates){
    await updateDoc(userRef, updates);
  }

  async function getPot(){
    const snap = await getDoc(potRef);
    if (!snap.exists()){
      await setDoc(potRef, { amount: INITIAL_POT, lastReset: new Date().toISOString().slice(0,10), halfAlertDate: '' });
      return INITIAL_POT;
    }
    return snap.data().amount;
  }

  async function updatePot(delta){
    // delta can be positive or negative
    return runTransaction(db, async (t) => {
      const snap = await t.get(potRef);
      if (!snap.exists()){
        t.set(potRef, { amount: INITIAL_POT, lastReset: new Date().toISOString().slice(0,10), halfAlertDate: '' });
        return INITIAL_POT;
      }
      let newPot = snap.data().amount + delta;
      newPot = Math.max(0, newPot);
      t.update(potRef, { amount: newPot });
      return newPot;
    });
  }

  async function resetPotAndReopen(){
    await setDoc(potRef, { amount: INITIAL_POT, lastReset: new Date().toISOString().slice(0,10), halfAlertDate: '' }, { merge:true });
    closedOverlay.classList.add('hidden');
    joinTrainBtn.disabled = false;
    joinTrainBtn.style.opacity = '1';
    setTrainTerminal();
    updatePotUI();
    showPopup('🔁 Pot reset! Station reopened.', 3000);
  }

  async function updatePotUI(){
    const pot = await getPot();
    if (dailyPotEl) dailyPotEl.textContent = pot.toLocaleString();
    if (pot <= 0) handleStationClosed();
    else {
      if (!closedOverlay.classList.contains('hidden')) {
        closedOverlay.classList.add('hidden');
        joinTrainBtn.disabled = false;
        joinTrainBtn.style.opacity = '1';
      }
    }
  }

  /* ---------------- Terminal helpers ---------------- */
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
  function showPopup(text, ms=1800){
    if (!popupEl) return;
    popupEl.textContent = text;
    popupEl.style.display = 'block';
    popupEl.style.opacity = '1';
    if (popupTimeout) clearTimeout(popupTimeout);
    popupTimeout = setTimeout(()=>{
      popupEl.style.opacity = '0';
      setTimeout(()=>{ popupEl.style.display = 'none'; }, 300);
    }, ms);
  }

  /* ---------------- Problems ---------------- */
  function generateProblems(){
    currentProblems = [];
    problemBoard.innerHTML = '';
    for (let i=0;i<NUM_BLOCKS;i++){
      let a = Math.floor(Math.random()*20)+1;
      let b = Math.floor(Math.random()*20)+1;
      if (a<b) [a,b]=[b,a];
      currentProblems.push({a,b,ans:a+b});

      const wrapper = document.createElement('div');
      wrapper.style.display='flex'; wrapper.style.flexDirection='column'; wrapper.style.alignItems='center'; wrapper.style.gap='6px'; wrapper.style.margin='6px';

      const label = document.createElement('div');
      label.textContent = `${a} + ${b}`;
      label.style.fontWeight='700'; label.style.fontSize='12px'; label.style.color='#fff';

      const input = document.createElement('input');
      input.type='number'; input.className='problemInput'; input.inputMode='numeric'; input.placeholder='?';
      input.style.width='60px'; input.style.padding='6px'; input.style.borderRadius='6px';
      input.style.border='1px solid rgba(255,255,255,0.12)'; input.style.background='#0e0e0e'; input.style.color='#fff'; input.style.textAlign='center';
      input.dataset.index=i;

      wrapper.appendChild(label); wrapper.appendChild(input); problemBoard.appendChild(wrapper);
    }

    submitAnswersBtn.style.display='block'; submitAnswersBtn.disabled=true; submitAnswersBtn.style.opacity='0.6';
    const inputs = problemBoard.querySelectorAll('.problemInput');
    function checkFilled(){
      const allFilled = Array.from(inputs).every(i=>i.value.trim()!=='');
      submitAnswersBtn.disabled = !allFilled;
      submitAnswersBtn.style.opacity = allFilled?'1':'0.6';
    }
    inputs.forEach(inp=>inp.addEventListener('input', checkFilled));
    checkFilled();
  }

  /* ---------------- Loading bar ---------------- */
  function startLoadingBar(){
    loadingContainer.style.display='block'; loadingProgress=0; loadingBar.style.width='0%'; trainEmoji.style.left='0px';
    playAudio(SOUND_PATHS.start, { loop:true });
    loadingInterval = setInterval(()=>{
      loadingProgress++;
      const percent=(loadingProgress/39)*100;
      loadingBar.style.width=`${percent}%`;
      trainEmoji.style.left=`calc(${percent}% - 12px)`;
      if (loadingProgress>=39){
        clearInterval(loadingInterval); loadingInterval=null;
        if (trainActive){ trainActive=false; stopLoadingBar(); playAudio(SOUND_PATHS.depart); endTrain(false); }
      }
    },1000);
  }

  function stopLoadingBar(){
    if (loadingInterval){ clearInterval(loadingInterval); loadingInterval=null; }
    loadingContainer.style.display='none'; loadingBar.style.width='0%'; trainEmoji.style.left='0px';
  }

  /* ---------------- Train ---------------- */
  async function startTrain(){
    const pot = await getPot();
    if (pot<=0){ showPopup('🚧 Station closed for today. Come back tomorrow.'); return; }

    const userData = await getUserData();
    if (userData.stars<STAR_COST){ showPopup('Not enough stars to join.'); return; }

    await updateUserData({ stars: userData.stars - STAR_COST });

    trainActive=true; joinTrainBtn.style.display='none';
    generateProblems(); problemBoard.classList.remove('hidden'); submitAnswersBtn.style.display='block'; submitAnswersBtn.disabled=true;
    startLoadingBar(); playAudio(SOUND_PATHS.whistle);
    updateProfileUI();
  }

  async function endTrain(success, ticketNumber=null){
    stopLoadingBar();
    problemBoard.classList.add('hidden'); submitAnswersBtn.style.display='none';

    if ((await getPot())>0){ joinTrainBtn.style.display='block'; joinTrainBtn.disabled=false; joinTrainBtn.style.opacity='1'; }
    else { joinTrainBtn.style.display='block'; joinTrainBtn.disabled=true; joinTrainBtn.style.opacity='0.5'; }

    if (success){
      const userData = await getUserData();
      await updateUserData({
        cash: (userData.cash || 0)+REWARD_TO_USER,
        stars: (userData.stars || 0)+STARS_PER_WIN
      });
      await updatePot(-DEDUCT_PER_WIN);

      const dest = trainDestinationEl?.textContent || 'your destination';
      const tnum = ticketNumber || '---';
      showPopup(`🎫 You’ve secured your ${dest} train ticket number ${tnum} — welcome aboard! You earned ₦${REWARD_TO_USER.toLocaleString()}!`, 4500);
      playAudio(SOUND_PATHS.ding);
      maybeShowHalfwayAlert();
      updatePotUI();
    } else { showPopup('Train left! You got nothing 😢', 2200); }
    updateProfileUI();
  }

  submitAnswersBtn.addEventListener('click', async ()=>{
    if (!trainActive) return;
    const inputs = Array.from(document.querySelectorAll('.problemInput'));
    if (inputs.some(i=>i.value==='')){ showPopup("You're not yet done hashing your train ticket — hurry!", 2400); playAudio(SOUND_PATHS.error); return; }
    let allCorrect=true;
    inputs.forEach((inp,i)=>{ if (parseInt(inp.value,10)!==currentProblems[i].ans) allCorrect=false; });
    trainActive=false; stopLoadingBar();
    if (allCorrect){ const ticketNumber = inputs.map(i=>String(parseInt(i.value,10))).join(''); await endTrain(true,ticketNumber); }
    else { showPopup("Some answers are incorrect — train left!",3000); playAudio(SOUND_PATHS.depart); await endTrain(false); }
  });

  joinTrainBtn.addEventListener('click', ()=>{ if (!joinTrainBtn.disabled){ confirmModal.style.display='flex'; playAudio(SOUND_PATHS.whistle); } });
  confirmYes.addEventListener('click', ()=>{ confirmModal.style.display='none'; startTrain(); });
  confirmNo.addEventListener('click', ()=>{ confirmModal.style.display='none'; });

  /* ---------------- UI update ---------------- */
  async function updateProfileUI(){
    const data = await getUserData();
    if (starCountEl) starCountEl.textContent = data.stars;
    if (cashCountEl) cashCountEl.textContent = (data.cash || 0).toLocaleString();
    if (profileNameEl) profileNameEl.textContent = profileNameEl.textContent || 'GUEST 0000';
  }

  function maybeShowHalfwayAlert(){ /* optional Firestore half alert logic; can be added if desired */ }

  function handleStationClosed(){
    closedOverlay.classList.remove('hidden'); joinTrainBtn.disabled=true; joinTrainBtn.style.opacity='0.5';
    if (countdownTimer) clearInterval(countdownTimer);
    function tick(){ const ms=timeToNextMidnight(); if (reopenCountdown) reopenCountdown.textContent=formatHMS(ms); if (ms<=0){ clearInterval(countdownTimer); resetPotAndReopen(); } }
    tick(); countdownTimer=setInterval(tick,1000); playAudio(SOUND_PATHS.depart);
  }

  function timeToNextMidnight(){ const now=new Date(); const tomorrow=new Date(now); tomorrow.setDate(now.getDate()+1); tomorrow.setHours(0,0,0,0); return Math.max(0,tomorrow-now); }
  function formatHMS(ms){ const s=Math.floor(ms/1000); const hh=String(Math.floor(s/3600)).padStart(2,'0'); const mm=String(Math.floor((s%3600)/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); return `${hh}:${mm}:${ss}`; }

  /* ---------------- Init ---------------- */
  async function init(){
    await updatePotUI(); setTrainTerminal(); setInterval(setTrainTerminal,60000); setInterval(updateTrainTime,1000); updateTrainTime();
    problemBoard.classList.add('hidden'); submitAnswersBtn.style.display='none';
    const msToMid = timeToNextMidnight();
    setTimeout(resetPotAndReopen,msToMid+1000); setInterval(async()=>{ const snap = await getPot(); if(snap<=0) resetPotAndReopen(); },60000);
    await updateProfileUI();
  }

  init();

});