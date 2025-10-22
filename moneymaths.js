/* ---------------- Sample User Data ---------------- */
let currentUser = {
  uid: 'guest001',
  name: 'GUEST 0000',
  stars: 50,  // Start with some stars so users can join
  cash: 0
};

const starCost = 10; // Stars needed to join

document.getElementById('profileName').textContent = currentUser.name;
document.getElementById('starCount').textContent = currentUser.stars;
document.getElementById('cashCount').textContent = currentUser.cash;

/* ---------------- Elements ---------------- */
const joinTrainBtn = document.getElementById('joinTrainBtn');
const problemBoard = document.getElementById('problemBoard');
const loadingBar = document.getElementById('loadingBar');
const trainEmoji = document.getElementById('trainEmoji');
const starPopup = document.getElementById('starPopup');
const dailyPotEl = document.getElementById('dailyPot');

const NUM_BLOCKS = 8;
let currentProblems = [];
let loadingInterval;
let loadingProgress = 0;
let trainActive = false;

/* ---------------- Helpers ---------------- */
function showStarPopup(text){
  starPopup.textContent = text;
  starPopup.style.display = 'block';
  setTimeout(()=>{ starPopup.style.display = 'none'; }, 1500);
}

function generateProblems(){
  currentProblems = [];
  problemBoard.innerHTML = '';
  for(let i=0;i<NUM_BLOCKS;i++){
    let a = Math.floor(Math.random()*20)+1;
    let b = Math.floor(Math.random()*20)+1;
    // Ensure no negative results
    if(a < b){ [a,b] = [b,a]; }
    currentProblems.push({a,b,ans:a+b});
    
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'problemInput';
    input.placeholder = `${a} + ${b}`;
    problemBoard.appendChild(input);
  }
}

/* ---------------- Loading Bar ---------------- */
function startLoadingBar(){
  loadingProgress = 0;
  loadingBar.style.width = '0%';
  trainEmoji.style.left = '0px';
  loadingInterval = setInterval(()=>{
    loadingProgress++;
    loadingBar.style.width = `${(loadingProgress/39)*100}%`;
    trainEmoji.style.left = `${(loadingProgress/39)*100}%`;
    if(loadingProgress >= 39){
      clearInterval(loadingInterval);
      trainActive = false;
      endTrain(false); // Train left, player didn't finish
    }
  },1000); // 39 seconds total
}

/* ---------------- Train Logic ---------------- */
function startTrain(){
  if(currentUser.stars < starCost){
    showStarPopup("Not enough stars!");
    return;
  }
  currentUser.stars -= starCost;
  document.getElementById('starCount').textContent = currentUser.stars;

  generateProblems();
  problemBoard.style.display = 'flex';
  joinTrainBtn.textContent = 'Submit Answers';
  joinTrainBtn.style.background = 'linear-gradient(90deg,#00FF99,#00CCFF)';
  trainActive = true;
  startLoadingBar();
}

/* ---------------- End Train ---------------- */
function endTrain(success){
  problemBoard.style.display = 'none';
  joinTrainBtn.textContent = `Join Train (-${starCost}⭐)`;
  joinTrainBtn.style.background = 'linear-gradient(90deg,#FF1493,#FF8C00)';
  if(success){
    const rewardStars = 5 * NUM_BLOCKS;
    const rewardCash = 50 * NUM_BLOCKS;
    currentUser.stars += rewardStars;
    currentUser.cash += rewardCash;
    document.getElementById('starCount').textContent = currentUser.stars;
    document.getElementById('cashCount').textContent = currentUser.cash;
    dailyPotEl.textContent = parseInt(dailyPotEl.textContent) + rewardCash;
    showStarPopup(`+${rewardStars}⭐ +₦${rewardCash}`);
  } else {
    showStarPopup("Train left! You got nothing 😢");
  }
}

/* ---------------- Button Event ---------------- */
joinTrainBtn.addEventListener('click', ()=>{
  if(trainActive){
    // Validate answers
    const inputs = document.querySelectorAll('.problemInput');
    let correct = true;
    inputs.forEach((inp,i)=>{
      if(parseInt(inp.value) !== currentProblems[i].ans){
        correct = false;
      }
    });
    clearInterval(loadingInterval);
    trainActive = false;
    endTrain(correct);
  } else {
    startTrain();
  }
});
/* ---------------- Train Terminal Logic ---------------- */
const trainNames = [
  "Money Express",
  "Starliner 9000",
  "Frenzy Rail",
  "Lucky Cargo",
  "Fortune Flyer",
  "Crypto Cruiser",
  "Golden Dash",
  "Midnight Ride"
];
const destinations = [
  "Lagos",
  "Accra",
  "Nairobi",
  "Cape Town",
  "Johannesburg",
  "Abuja",
  "Kigali",
  "London",
  "Dubai",
  "New York"
];

function setTrainTerminal() {
  const name = trainNames[Math.floor(Math.random() * trainNames.length)];
  const dest = destinations[Math.floor(Math.random() * destinations.length)];
  const date = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  document.getElementById('trainName').textContent = name;
  document.getElementById('trainDate').textContent = date;
  document.getElementById('trainDestination').textContent = dest;
}

/* ⏰ Live Time Updater */
function updateTrainTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-GB', { hour12: false });
  const timeEl = document.getElementById('trainTime');
  if (timeEl) timeEl.textContent = timeStr;
}

/* Refresh name/destination every 60s */
setTrainTerminal();
setInterval(setTrainTerminal, 60000);
setInterval(updateTrainTime, 1000);
updateTrainTime();

/* ---------------- Confirmation Modal ---------------- */
const confirmModal = document.getElementById('confirmModal');
const confirmYes = document.getElementById('confirmYes');
const confirmNo = document.getElementById('confirmNo');

/* Make sure no duplicate listeners */
joinTrainBtn.replaceWith(joinTrainBtn.cloneNode(true));
const newJoinBtn = document.getElementById('joinTrainBtn');

/* Handle Join Train button */
newJoinBtn.addEventListener('click', () => {
  if (trainActive) {
    // If train already started, handle normally
    const inputs = document.querySelectorAll('.problemInput');
    let correct = true;
    inputs.forEach((inp, i) => {
      if (parseInt(inp.value) !== currentProblems[i].ans) correct = false;
    });
    clearInterval(loadingInterval);
    trainActive = false;
    endTrain(correct);
  } else {
    // Show confirmation modal first
    confirmModal.style.display = 'flex';
  }
});

/* Modal choices */
confirmYes.addEventListener('click', () => {
  confirmModal.style.display = 'none';
  startTrain(); // existing function
});

confirmNo.addEventListener('click', () => {
  confirmModal.style.display = 'none';
});