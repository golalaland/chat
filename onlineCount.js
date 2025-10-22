let onlineCount = 503; // starting number
const onlineEl = document.getElementById("onlineCount");

function updateDisplay() {
  onlineEl.textContent = onlineCount;
}

// Increase by 5 every 60 seconds
setInterval(() => {
  onlineCount += 5;
  updateDisplay();
}, 60000); // 60,000ms = 60s

// Decrease by 10 every 300 seconds
setInterval(() => {
  onlineCount = Math.max(0, onlineCount - 10); // never go below 0
  updateDisplay();
}, 300000); // 300,000ms = 5min

// Optional: allow manual adjustment
window.adjustOnlineCount = (num) => {
  onlineCount = Math.max(0, num);
  updateDisplay();
};

// Initial display
updateDisplay();