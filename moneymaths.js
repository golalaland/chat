// Money Train + Firebase integration
// Cleaned and optimized single script

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

  /* ---------------- Config ---------------- */
  const INITIAL_POT       = 1_000_000; // $1,000,000
  const DEDUCT_PER_WIN    = 1_000;     
  const REWARD_TO_USER    = 1_000;     
  const STARS_PER_WIN     = 40;        
  const NUM_BLOCKS        = 8;
  const STAR_COST         = 10;        

  /* ---------------- Firebase ---------------- */
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

  /* ---------------- UI Elements ---------------- */
  const ui = {
    joinBtn: document.getElementById('joinTrainBtn'),
    confirmModal: document.getElementById('confirmModal'),
    confirmYes: document.getElementById('confirmYes'),
    confirmNo: document.getElementById('confirmNo'),
    loadingContainer: document.getElementById('loadingContainer'),
    loadingBar: document.getElementById('loadingBar'),
    trainEmoji: document.getElementById('trainEmoji'),
    problemBoard: document.getElementById('problemBoard'),
    submitBtn: document.getElementById('submitAnswers'),
    popup: document.getElementById('popup'),
    dailyPotEl: document.getElementById('dailyPot'),
    closedOverlay: document.getElementById('closedOverlay'),
    reopenCountdown: document.getElementById('reopenCountdown'),
    confirmText: document.getElementById('confirmText'),
    trainNameEl: document.getElementById('trainName'),
    trainDateEl: document.getElementById('trainDate'),
    trainTimeEl: document.getElementById('trainTime'),
    trainDestinationEl: document.getElementById('trainDestination'),
    profileNameEl: document.getElementById('profileName') || document.getElementById('username'),
    starCountEl: document.getElementById('starCount') || document.getElementById('stars-count'),
    cashCountEl: document.getElementById('cashCount') || document.getElementById('cash-count'),
    leaderboardBtn: document.getElementById('leaderboardBtn'),
    leaderboardPopup: document.getElementById('leaderboardPopup'),
    leaderboardList: document.getElementById('leaderboardList'),
    closeLeaderboard: document.getElementById('closeLeaderboard'),
    howToPlayBtn: document.getElementById('howToPlayBtn'),
    howToPlayModal: document.getElementById('howToPlayModal'),
    closeHowTo: document.getElementById('closeHowTo'),
    profilePanel: document.getElementById('profilePanel')
  };

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
    } catch(e){}
  }

  /* ---------------- Local State ---------------- */
  let loadingInterval = null;
  let loadingProgress = 0;
  let trainActive = false;
  let currentProblems = [];
  let countdownTimer = null;
  let popupTimeout = null;

  let currentUser = null;
  let currentUserUnsub = null;

  /* ---------------- Local Storage ---------------- */
  const KEY_POT = 'moneytrain_pot';
  const KEY_RESET_DAY = 'moneytrain_reset_day';
  const KEY_HALF_DAY = 'moneytrain_half_date';

  function getStoredPot(){ return parseInt(localStorage.getItem(KEY_POT) || '0',10); }
  function setStoredPot(v){ localStorage.setItem(KEY_POT, String(Math.max(0,Math.floor(v)))); updatePotUI(); }
  function getPotResetDay(){ return localStorage.getItem(KEY_RESET_DAY); }
  function setPotResetDay(d){ localStorage.setItem(KEY_RESET_DAY,d); }
  function getHalfAlertDate(){ return localStorage.getItem(KEY_HALF_DAY); }
  function setHalfAlertDate(d){ localStorage.setItem(KEY_HALF_DAY,d); }

  function initializePot(){
    const today = new Date().toISOString().slice(0,10);
    if (!getStoredPot() || getPotResetDay() !== today){
      setStoredPot(INITIAL_POT);
      setPotResetDay(today);
      setHalfAlertDate('');
    }
  }

  /* ---------------- Pot UI ---------------- */
  function updatePotUI(){
    const pot = getStoredPot() ?? INITIAL_POT;
    if (ui.dailyPotEl) ui.dailyPotEl.textContent = '$10,000';
    if (pot <= 0) handleStationClosed();
    else if(ui.closedOverlay && !ui.closedOverlay.classList.contains('hidden') && !isPastMidnightReset()){
      ui.closedOverlay.classList.add('hidden');
      if(ui.joinBtn){ ui.joinBtn.disabled=false; ui.joinBtn.style.opacity='1'; }
    }
  }

  /* ---------------- Train Terminal ---------------- */
  const trainNames = ["Money Express","Starliner 9000","Frenzy Rail","Lucky Cargo","Fortune Flyer","Crypto Cruiser","Golden Dash","Midnight Ride"];
  const destinations = ["Lagos","Accra","Nairobi","Cape Town","Johannesburg","Abuja","Kigali","London","Dubai","New York"];

  function setTrainTerminal(){
    if(trainActive) return;
    const name = trainNames[Math.floor(Math.random()*trainNames.length)];
    const dest = destinations[Math.floor(Math.random()*destinations.length)];
    const date = new Date().toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
    if(ui.trainNameEl) ui.trainNameEl.textContent=name;
    if(ui.trainDateEl) ui.trainDateEl.textContent=date;
    if(ui.trainDestinationEl) ui.trainDestinationEl.textContent=dest;
    if(ui.confirmText) ui.confirmText.innerHTML=`Join <strong>${name}</strong> train to → <strong>${dest}</strong>? Ready to play?`;
  }

  function updateTrainTime(){
    if(!ui.trainTimeEl) return;
    const now = new Date();
    ui.trainTimeEl.textContent = now.toLocaleTimeString('en-GB',{hour12:false});
  }

  /* ---------------- Popup ---------------- */
  function showPopup(text, ms=1800){
    if(!ui.popup) return;
    ui.popup.textContent=text;
    ui.popup.style.display='block';
    ui.popup.style.opacity='1';
    if(popupTimeout) clearTimeout(popupTimeout);
    popupTimeout = setTimeout(()=>{
      ui.popup.style.opacity='0';
      setTimeout(()=>{ ui.popup.style.display='none'; },300);
    }, ms);
  }

  /* ---------------- Halfway Alert ---------------- */
  function maybeShowHalfwayAlert(){
    const pot = getStoredPot() ?? INITIAL_POT;
    const half = Math.floor(INITIAL_POT/2);
    const today = new Date().toISOString().slice(0,10);
    if(pot<=half && getHalfAlertDate()!==today){
      setHalfAlertDate(today);
      showPopup('⚠️ Tickets are Halfway mined — daily reward is running low!',4000);
      const terminal = document.getElementById('trainTerminal');
      if(terminal){ terminal.style.boxShadow='0 0 30px rgba(255,165,0,0.28)'; setTimeout(()=>terminal.style.boxShadow='',2500);}
    }
  }

  /* ---------------- Station Closed / Reopen ---------------- */
  function timeToNextMidnight(){
    const now=new Date(),tomorrow=new Date(now);
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
    if(ui.closedOverlay) ui.closedOverlay.classList.remove('hidden');
    if(ui.joinBtn){ ui.joinBtn.disabled=true; ui.joinBtn.style.display='block'; ui.joinBtn.style.opacity='0.5'; }
    if(countdownTimer) clearInterval(countdownTimer);
    function tick(){
      const ms=timeToNextMidnight();
      if(ui.reopenCountdown) ui.reopenCountdown.textContent=formatHMS(ms);
      if(ms<=0){ clearInterval(countdownTimer); resetPotAndReopen(); }
    }
    tick();
    countdownTimer=setInterval(tick,1000);
    playAudio(SOUND_PATHS.depart);
  }

  function resetPotAndReopen(){
    setStoredPot(INITIAL_POT);
    setPotResetDay(new Date().toISOString().slice(0,10));
    setHalfAlertDate('');
    if(ui.closedOverlay) ui.closedOverlay.classList.add('hidden');
    if(ui.joinBtn){ ui.joinBtn.disabled=false; ui.joinBtn.style.opacity='1'; }
    setTrainTerminal();
    updatePotUI();
    showPopup('🔁 Pot reset! Station reopened.',3000);
  }

  function isPastMidnightReset(){ return getPotResetDay()!==new Date().toISOString().slice(0,10); }

  /* ---------------- Problems ---------------- */
  function generateProblems(){
    currentProblems=[];
    if(ui.problemBoard) ui.problemBoard.innerHTML='';
    for(let i=0;i<NUM_BLOCKS;i++){
      let a=Math.floor(Math.random()*20)+1;
      let b=Math.floor(Math.random()*20)+1;
      if(a<b)[a,b]=[b,a];
      currentProblems.push({a,b,ans:a+b});

      const wrapper=document.createElement('div');
      wrapper.style.display='flex';
      wrapper.style.flexDirection='column';
      wrapper.style.alignItems='center';
      wrapper.style.gap='6px';
      wrapper.style.margin='6px';

      const label=document.createElement('div');
      label.textContent=`${a} + ${b}`;
      label.style.fontWeight='700';
      label.style.fontSize='12px';
      label.style.color='#fff';

      const input=document.createElement('input');
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
      ui.problemBoard.appendChild(wrapper);
    }

    // enable submit only when all filled
    const inputs=ui.problemBoard.querySelectorAll('.problemInput');
    function checkFilled(){
      const allFilled=Array.from(inputs).every(i=>i.value.trim()!=='');
      if(ui.submitBtn){ ui.submitBtn.disabled=!allFilled; ui.submitBtn.style.opacity=allFilled?'1':'0.6'; }
    }
    inputs.forEach(inp=>inp.addEventListener('input',checkFilled));
    checkFilled();
  }

  /* ---------------- Loading Bar ---------------- */
  function startLoadingBar(){
    if(ui.loadingContainer) ui.loadingContainer.style.display='block';
    loadingProgress=0;
    if(ui.loadingBar) ui.loadingBar.style.width='0%';
    if(ui.trainEmoji) ui.trainEmoji.style.left='0px';
    playAudio(SOUND_PATHS.start,true);
    loadingInterval=setInterval(()=>{
      loadingProgress++;
      const percent=(loadingProgress/52)*100;
      if(ui.loadingBar) ui.loadingBar.style.width=`${percent}%`;
      if(ui.trainEmoji) ui.trainEmoji.style.left=`calc(${percent}% - 12px)`;
      if(loadingProgress>=52){
        clearInterval(loadingInterval);
        loadingInterval=null;
        if(trainActive){
          trainActive=false;
          stopLoadingBar();
          playAudio(SOUND_PATHS.depart);
          endTrain(false);
        }
      }
    },1000);
  }

  function stopLoadingBar(){
    if(loadingInterval){ clearInterval(loadingInterval); loadingInterval=null; }
    if(ui.loadingContainer) ui.loadingContainer.style.display='none';
  }

  /* ---------------- Star SVG ---------------- */
  function replaceStarsWithSVG(container, svgURL='images/star.svg'){
    if(!container) return;
    container.innerHTML=container.textContent.replace(/⭐/g,`<img src="${svgURL}" alt="⭐" style="width:1em;height:1em;vertical-align:text-bottom;">`);
  }

  /* ---------------- Give Win Rewards ---------------- */
  async function giveWinRewards(correctCount){
    const pot=getStoredPot();
    const winCash=REWARD_TO_USER*correctCount;
    const winStars=STARS_PER_WIN*correctCount;

    // Update UI
    if(ui.cashCountEl) ui.cashCountEl.textContent=`$${winCash}`;
    if(ui.starCountEl){
      const old=parseInt(ui.starCountEl.textContent.replace(/[^0-9]/g,''),10)||0;
      const newVal=old+winStars;
      ui.starCountEl.textContent=`${newVal} ⭐`;
      replaceStarsWithSVG(ui.starCountEl);
    }

    // Deduct pot
    setStoredPot(pot - (DEDUCT_PER_WIN*correctCount));

    maybeShowHalfwayAlert();

    // Firestore update (if logged in)
    if(currentUser?.uid){
      const userDocRef=doc(db,'users',currentUser.uid);
      try{
        await runTransaction(db,async t=>{
          const docSnap=await t.get(userDocRef);
          if(!docSnap.exists()) t.set(userDocRef,{stars:winStars,cash:winCash});
          else{
            const data=docSnap.data();
            t.update(userDocRef,{
              stars:(data.stars||0)+winStars,
              cash:(data.cash||0)+winCash
            });
          }
        });
      }catch(e){
        console.error('Firestore reward error',e);
      }
    }

    showPopup(`🎉 You won ${winCash}$ and ${winStars} ⭐!`,3000);
  }

  /* ---------------- End Train ---------------- */
  function endTrain(manual=false){
    stopLoadingBar();
    trainActive=false;
    const inputs=document.querySelectorAll('.problemInput');
    let correctCount=0;
    inputs.forEach((inp,i)=>{
      if(parseInt(inp.value,10)===currentProblems[i].ans) correctCount++;
    });
    giveWinRewards(correctCount);
    generateProblems();
  }

  /* ---------------- Event Handlers ---------------- */
  if(ui.joinBtn){
    ui.joinBtn.addEventListener('click',()=>{
      if(trainActive) return;
      trainActive=true;
      startLoadingBar();
      generateProblems();
      showPopup('🚂 Train started! Solve the problems!',2000);
    });
  }

  if(ui.submitBtn){
    ui.submitBtn.addEventListener('click',()=>{
      if(!trainActive) return;
      endTrain(true);
    });
  }

  if(ui.leaderboardBtn){
    ui.leaderboardBtn.addEventListener('click',()=>{ if(ui.leaderboardPopup) ui.leaderboardPopup.style.display='block'; });
  }
  if(ui.closeLeaderboard){
    ui.closeLeaderboard.addEventListener('click',()=>{ if(ui.leaderboardPopup) ui.leaderboardPopup.style.display='none'; });
  }

  if(ui.howToPlayBtn){
    ui.howToPlayBtn.addEventListener('click',()=>{ if(ui.howToPlayModal) ui.howToPlayModal.style.display='block'; });
  }
  if(ui.closeHowTo){
    ui.closeHowTo.addEventListener('click',()=>{ if(ui.howToPlayModal) ui.howToPlayModal.style.display='none'; });
  }

  /* ---------------- Profile Offset ---------------- */
  function updateProfileOffset(){
    if(!ui.profilePanel) return;
    const offset=window.scrollY||0;
    ui.profilePanel.style.transform=`translateY(${offset}px)`;
  }
  window.addEventListener('scroll',updateProfileOffset);

  /* ---------------- Init ---------------- */
  initializePot();
  setTrainTerminal();
  updatePotUI();
  setInterval(updateTrainTime,1000);
  maybeShowHalfwayAlert();
  updateProfileOffset();

});