let currentUser = { uid:'guest001', name:'GUEST 0000', stars:100, cash:0 };
document.getElementById('profileName').textContent = currentUser.name;
document.getElementById('starCount').textContent = currentUser.stars;
document.getElementById('cashCount').textContent = currentUser.cash;

const MAX_ENTRIES = 53;
const BUZZ_COST = 5;
let REWARD_STARS = 20;
let REWARD_CASH = 50;
const SESSION_TIME = 60; 
let entriesCount = 0;
let currentSession = null;
let cooldownTimer = null;

const expressionsEl = document.getElementById('expressions');
const buzzInput = document.getElementById('buzzInput');
const messagesEl = document.getElementById('messages');
const starPopup = document.getElementById('starPopup');
const wordMarquee = document.getElementById('wordMarquee');
const countdownEl = document.getElementById('countdown');

let HARD_MODE = false;

function showStarPopup(text){
  starPopup.textContent = text;
  starPopup.style.display = "block";
  setTimeout(()=>starPopup.style.display="none",1500);
}

function getRandomInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

function generateSession(){
  let problems=[], cumulative=0;
  for(let i=0;i<8;i++){
    let a=getRandomInt(HARD_MODE?10:1, HARD_MODE?50:20);
    let b=getRandomInt(HARD_MODE?10:1, HARD_MODE?50:20);
    let op = Math.random()<0.5?"+":"-";

    if(op==="-" && b>a) [a,b] = [b,a]; 
    if(op==="-" && a===b) a++; 
    if(HARD_MODE && Math.random()<0.3) op="*";

    let answer;
    if(op==="+") answer=a+b;
    else if(op==="-") answer=a-b;
    else answer=a*b;

    cumulative+=answer;
    problems.push({expr:`${a} ${op} ${b}`, answer});
  }

  currentSession={problems, cumulative: cumulative.toString(), entries:0};
  entriesCount=0;

  // Right aligned
  expressionsEl.innerHTML = problems.map(p=>p.expr.padStart(7,' ')).join("<br>");
  countdownEl.style.display="block";

  let timer=SESSION_TIME;
  countdownEl.textContent=`Time left: ${timer}s`;
  clearInterval(cooldownTimer);
  cooldownTimer=setInterval(()=>{
    timer--;
    countdownEl.textContent=`Time left: ${timer}s`;
    if(timer<=0){
      clearInterval(cooldownTimer);
      startCooldown();
    }
  },1000);
}

function startCooldown(minutes=5){
  expressionsEl.innerHTML="";
  countdownEl.style.display="block";
  let timer=minutes*60;
  cooldownTimer=setInterval(()=>{
    timer--;
    const min=Math.floor(timer/60);
    const sec=timer%60;
    countdownEl.textContent=`Next session in ${min}:${sec<10?'0'+sec:sec}`;
    if(timer<=0){
      clearInterval(cooldownTimer);
      generateSession();
    }
  },1000);
}

function handleBuzz(){
  if(entriesCount>=MAX_ENTRIES){
    showStarPopup("Session full! Wait for next session.");
    return;
  }
  if(currentUser.stars<BUZZ_COST){
    showStarPopup("Not enough stars to buzz!");
    return;
  }

  const input=buzzInput.value.trim();
  if(!input){ showStarPopup("Enter cumulative answer!"); return; }

  currentUser.stars-=BUZZ_COST;
  entriesCount++;

  if(input===currentSession.cumulative){
    REWARD_STARS = HARD_MODE?50:20;
    REWARD_CASH = HARD_MODE?200:50;
    currentUser.stars+=REWARD_STARS;
    currentUser.cash+=REWARD_CASH;
    showStarPopup(`🎉 Correct! +${REWARD_STARS}⭐ & ₦${REWARD_CASH}`);
    const span=document.createElement("span");
    span.textContent=currentSession.problems.map(p=>p.expr).join(", ") + " = "+currentSession.cumulative;
    wordMarquee.appendChild(span);
  } else showStarPopup("❌ Wrong answer!");

  document.getElementById('starCount').textContent=currentUser.stars;
  document.getElementById('cashCount').textContent=currentUser.cash;

  const msg=document.createElement('div');
  msg.textContent=currentUser.name+": "+input + (input===currentSession.cumulative?" ✅":" ❌");
  messagesEl.appendChild(msg);
  messagesEl.scrollTop=messagesEl.scrollHeight;

  buzzInput.value="";
  if(entriesCount>=MAX_ENTRIES) startCooldown();
}

document.getElementById('buzzBtn').addEventListener('click',handleBuzz);
document.getElementById('rulesBtn').addEventListener('click',()=>{
  alert(`🎮 Money Maths Rules:
- 8 vertical math problems per session.
- Input cumulative answer in one go.
- Each buzz costs ${BUZZ_COST}⭐.
- Correct gives stars & cash.
- Max ${MAX_ENTRIES} correct entries per session.
- 60 seconds per session, new session after cooldown.
- Heavy Money mode increases difficulty & rewards.`);
});

document.getElementById('hardModeBtn').addEventListener('click',()=>{
  HARD_MODE=!HARD_MODE;
  alert(HARD_MODE?"💸 Heavy Money ON!":"💰 Heavy Money OFF!");
  generateSession();
});

generateSession();