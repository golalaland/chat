const onlineCountEl = document.getElementById("onlineCount");

// Initial count
let onlineCount = 0;
onlineCountEl.textContent = onlineCount;

// Function to update count manually
function setOnlineCount(count) {
  onlineCount = count;
  onlineCountEl.textContent = onlineCount;
}

// Optional: simulate live increment
setInterval(() => {
  onlineCount++;
  onlineCountEl.textContent = onlineCount;
}, 5000); // increments every 5 seconds