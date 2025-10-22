const onlineCountEl = document.getElementById('onlineCount');
let count = 100; // starting number

// Animate number change
function animateCount(newCount) {
  const duration = 1000; // animation duration in ms
  const start = count;
  const diff = newCount - start;
  const startTime = performance.now();

  function update(time) {
    const elapsed = time - startTime;
    const progress = Math.min(elapsed / duration, 1);
    onlineCountEl.textContent = Math.floor(start + diff * progress);

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      count = newCount; // update the count after animation
    }
  }

  requestAnimationFrame(update);
}

// Increase +5 every 60 seconds
setInterval(() => {
  animateCount(count + 5);
}, 60000);

// Decrease -10 every 300 seconds
setInterval(() => {
  animateCount(Math.max(count - 10, 0));
}, 300000);