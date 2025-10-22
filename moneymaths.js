/* ---------------- User & Game Config ---------------- */
let currentUser = {
  uid: 'guest001',
  name: 'GUEST 0000',
  stars: 0,
  cash: 0,
  isAdmin: true // toggle admin rights
};

document.getElementById('profileName').textContent = currentUser.name;
document.getElementById('starCount').textContent = currentUser.stars;
document.getElementById('cashCount').textContent = currentUser.cash;

let heavyMoneyMode = false;
let sessionCount = 0;
let maxEntries = 53;
let currentEntries = 0;

/* ---------------- Maths Session Generator ---------------- */
function generateMathSession() {
  const ops = ['+', 'x']; // no subtraction
  const numbers = [];
  const answers = [];
  
  while(numbers.length < 8){
    let a = Math.floor(Math.random()*9)+1;
    let b = Math.floor(Math.random()*9)+1;
    
    if(a === b) b = a; // same number allowed
    let op = ops[Math.floor(Math.random()*ops.length)];
    
    numbers.push([a, op, b]);
    answers.push(op==='+' ? a+b : a*b);
  }
  
  // create display
  const boardEl = document.getElementById('mathBoard');
  boardEl.innerHTML = '';
  numbers.forEach(([a, op, b])=>{
    const line = document.createElement('div');
    line.textContent = ` ${a}\n${op}${b}`;
    line.style.whiteSpace = 'pre';
    boardEl.appendChild(line);
  });
  
  // create cumulative answer string (concatenation)
  const cumulative = answers.join('');
  
  return cumulative;
}

/* ---------------- Star popup ---------------- */
const starPopup = document.getElementById('starPopup');
function showStarPopup(text){
  starPopup.textContent = text;
  starPopup.style.display='block';
  setTimeout(()=>{starPopup.style.display='none';},1500);
}

/* ---------------- Buzz Submission ---------------- */
document.getElementById('buzzBtn').addEventListener('click', ()=>{
  const input = document.getElementById('bottomInput');
  const val = input.value.trim();
  
  if(!val){showStarPopup('Enter an answer!'); return;}
  
  if(currentEntries >= maxEntries){
    showStarPopup('This session is over! Wait for next round.');
    input.value='';
    return;
  }
  
  if(val === currentCumulative){
    currentEntries++;
    currentUser.stars += 5;
    currentUser.cash += heavyMoneyMode ? 200 : 50;
    document.getElementById('starCount').textContent=currentUser.stars;
    document.getElementById('cashCount').textContent=currentUser.cash;
    showStarPopup('Correct! ⭐');
  } else {
    showStarPopup('Wrong!');
  }
  input.value='';
});

/* ---------------- Rules Button ---------------- */
document.getElementById('rulesBtn').addEventListener('click', ()=>{
  alert("🎮 MONEY MATHS RULES:\n- Solve each vertical math in your head.\n- Concatenate the answers in order.\n- Enter full cumulative string.\n- Max 53 correct entries per session.\n- Heavy Money Mode (admin only) = bigger rewards!");
});

/* ---------------- Start New Session ---------------- */
let currentCumulative = generateMathSession();

function toggleHeavyMoneyMode(){
  if(currentUser.isAdmin){
    heavyMoneyMode = !heavyMoneyMode;
    alert(`Heavy Money Mode: ${heavyMoneyMode ? 'ON' : 'OFF'}`);
  }
}

// optional: admin can toggle by console
window.toggleHeavyMoneyMode = toggleHeavyMoneyMode;