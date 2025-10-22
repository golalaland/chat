/* ---------------- Sample User Data ---------------- */
let currentUser = {
  uid: 'guest001',
  name: 'GUEST 0000',
  stars: 50,
  cash: 0
};

const starCost = 10; // (Still used internally, but not displayed)

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
const confirmModal = document.getElementById('confirmModal');
const confirmYes = document.getElementById('confirmYes');
const confirmNo = document.getElementById('confirmNo');

const NUM_BLOCKS = 8;
let currentProblems = [];
let loadingInterval;
let loadingProgress = 0;
let trainActive = false;

/* ---------------- Helpers ---------------- */
function showStarPopup(text) {
  starPopup.textContent = text;
  starPopup.style.display = 'block';
  setTimeout(() => { starPopup.style.display = 'none'; }, 1500);
}

function generateProblems() {
  currentProblems = [];
  problemBoard.innerHTML = '';
  for (let i = 0; i < NUM_BLOCKS; i++) {
    let a = Math.floor(Math.random() * 20) + 1;
    let b = Math.floor(Math.random() * 20) + 1;
    if (a < b) [a, b] = [b, a];
    currentProblems.push({ a, b, ans: a + b });

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'problemInput';
    input.placeholder = `${a} + ${b}`;
    problemBoard.appendChild(input);
  }
}

/* ---------------- Loading Bar ---------------- */
function startLoadingBar() {
  loadingProgress = 0;
  loadingBar.style.width = '0%';
  trainEmoji.style.left = '0px';
  loadingInterval = setInterval(() => {
    loadingProgress++;
    const percent = (loadingProgress / 39) * 100;
    loadingBar.style.width = `${percent}%`;
    trainEmoji.style.left = `${percent}%`;
    if (loadingProgress >= 39) {
      clearInterval(loadingInterval);
      trainActive = false;
      endTrain(false);
    }
  }, 1000);
}

/* ---------------- Train Logic ---------------- */
function startTrain() {
  if (currentUser.stars < starCost) {
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
function endTrain(success) {
  problemBoard.style.display = 'none';
  joinTrainBtn.textContent = 'Join Train';
  joinTrainBtn.style.background = 'linear-gradient(90deg,#FF1493,#FF8C00)';
  if (success) {
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

/* ---------------- Button + Modal Logic ---------------- */
joinTrainBtn.addEventListener('click', () => {
  if (trainActive) {
    const inputs = document.querySelectorAll('.problemInput');
    let correct = true;
    inputs.forEach((inp, i) => {
      if (parseInt(inp.value) !== currentProblems[i].ans) correct = false;
    });
    clearInterval(loadingInterval);
    trainActive = false;
    endTrain(correct);
  } else {
    confirmModal.style.display = 'flex';
  }
});

confirmYes.addEventListener('click', () => {
  confirmModal.style.display = 'none';
  startTrain();
});

confirmNo.addEventListener('click', () => {
  confirmModal.style.display = 'none';
});

/* ---------------- Train Terminal Logic ---------------- */
const trainNames = [
  "Money Express", "Starliner 9000", "Frenzy Rail", "Lucky Cargo",
  "Fortune Flyer", "Crypto Cruiser", "Golden Dash", "Midnight Ride"
];
const destinations = [
  "Lagos", "Accra", "Nairobi", "Cape Town", "Johannesburg",
  "Abuja", "Kigali", "London", "Dubai", "New York"
];

function setTrainTerminal() {
  const name = trainNames[Math.floor(Math.random() * trainNames.length)];
  const dest = destinations[Math.floor(Math.random() * destinations.length)];
  const date = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
  });
  document.getElementById('trainName').textContent = name;
  document.getElementById('trainDate').textContent = date;
  document.getElementById('trainDestination').textContent = dest;
}

/* ⏰ Live Time Updater */
function updateTrainTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-GB', { hour12: false });
  document.getElementById('trainTime').textContent = timeStr;
}

/* Run Terminal + Time Updates */
setTrainTerminal();
setInterval(setTrainTerminal, 60000);
setInterval(updateTrainTime, 1000);
updateTrainTime();