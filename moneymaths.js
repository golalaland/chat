/* ---------------- Sample User Data ---------------- */
let currentUser = {
  uid: 'guest001',
  name: 'GUEST 0000',
  stars: 50,  // <-- Give some starting stars
  cash: 0
};

// DOM references
const profileName = document.getElementById('profileName');
const starCount = document.getElementById('starCount');
const cashCount = document.getElementById('cashCount');
const joinTrainBtn = document.getElementById('joinTrainBtn');
const problemBoard = document.getElementById('problemBoard');
const problemBlocksEl = document.getElementById('problemBlocks');
const loadingBar = document.getElementById('loadingBar');
const solveBtn = document.getElementById('solveBtn');
const starPopup = document.getElementById('starPopup');
const messagesEl = document.getElementById('messages');

// Entry cost
const entryCost = 10;
const totalBlocks = 8;

// Update profile display
function updateProfile() {
  profileName.textContent = currentUser.name;
  starCount.textContent = currentUser.stars;
  cashCount.textContent = currentUser.cash;
}
updateProfile();

// Star popup
function showStarPopup(text) {
  starPopup.textContent = text;
  starPopup.style.display = "block";
  setTimeout(()=>{starPopup.style.display="none";},1500);
}

/* ---------------- Join Train Logic ---------------- */
joinTrainBtn.addEventListener('click', ()=>{
  if(currentUser.stars < entryCost){
    showStarPopup("Not enough stars!");
    return;
  }

  currentUser.stars -= entryCost;
  updateProfile();

  // Show problem board
  problemBoard.style.display = 'block';
  generateProblems();
  startLoadingBar();
});

/* ---------------- Generate 8 Problem Blocks ---------------- */
function generateProblems(){
  problemBlocksEl.innerHTML = '';
  for(let i=0; i<totalBlocks; i++){
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'problemInput';
    input.dataset.answer = Math.floor(Math.random()*10 + 1); // random 1-10
    input.placeholder = '?';
    problemBlocksEl.appendChild(input);
  }
}

/* ---------------- Loading Bar ---------------- */
function startLoadingBar(){
  loadingBar.style.width = '0%';
  let progress = 0;
  const interval = setInterval(()=>{
    progress += 100/39; // completes in ~39 sec
    if(progress >= 100){
      progress = 100;
      clearInterval(interval);
      checkIncomplete();
    }
    loadingBar.style.width = progress + '%';
  }, 1000);
}

// Check if user didn't complete before train leaves
function checkIncomplete(){
  const inputs = document.querySelectorAll('.problemInput');
  let allFilled = Array.from(inputs).every(input=>input.value.trim() !== '');
  if(!allFilled){
    showStarPopup("Train has left! You get nothing!");
    problemBoard.style.display = 'none';
  }
}

/* ---------------- Solve Button ---------------- */
solveBtn.addEventListener('click', ()=>{
  const inputs = document.querySelectorAll('.problemInput');
  let correct = true;

  inputs.forEach(input=>{
    if(input.value.trim() !== input.dataset.answer){
      correct = false;
    }
  });

  if(correct){
    const rewardStars = 20;
    const rewardCash = 200;
    currentUser.stars += rewardStars;
    currentUser.cash += rewardCash;
    showStarPopup(`+${rewardStars}⭐ +₦${rewardCash}`);
    updateProfile();
  } else {
    showStarPopup("Incorrect! Try again next train!");
  }

  problemBoard.style.display = 'none';
});