import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  collection,
  getDocs,
  runTransaction,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ------------------ Firebase ------------------ */
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

/* ------------------ DOM references ------------------ */
const DOM = {
  username: document.getElementById('username'),
  stars: document.getElementById('stars-count'),
  cash: document.getElementById('cash-count'),
  shopItems: document.getElementById('shop-items'),
  hostTabs: document.getElementById('hostTabs'),
  vipStat: document.getElementById('vip-stat'),
  friendsStat: document.getElementById('friends-stat'),
  badgesStat: document.getElementById('badges-stat'),
  tabContent: document.getElementById('tab-content'),
  ordersContent: document.getElementById('orders-content'),
  ordersList: document.getElementById('orders-list'),
  confirmModal: document.getElementById('confirmModal'),
  confirmTitle: document.getElementById('confirmTitle'),
  confirmText: document.getElementById('confirmText'),
  confirmYes: document.getElementById('confirmYes'),
  confirmNo: document.getElementById('confirmNo'),
  imagePreview: document.getElementById('imagePreview'),
  previewImg: document.getElementById('previewImg'),
  rewardModal: document.getElementById('rewardModal'),
  rewardTitle: document.getElementById('rewardTitle'),
  rewardMessage: document.getElementById('rewardMessage'),
  pageLoader: document.getElementById('page-loader') // central spinner container
};

/* ------------------ Utilities ------------------ */
const formatNumber = n => n ? new Intl.NumberFormat('en-NG').format(Number(n)) : '0';
const parseNumberFromText = text => Number((text || '').replace(/[^\d\-]/g, '')) || 0;
const animateNumber = (el, from, to, duration = 600) => {
  const start = performance.now();
  const step = (ts) => {
    const progress = Math.min((ts - start) / duration, 1);
    const value = Math.floor(from + (to - from) * progress);
    if (el === DOM.stars) el.textContent = `${formatNumber(value)} ⭐️`;
    else if (el === DOM.cash) el.textContent = `₦${formatNumber(value)}`;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

/* ------------------ Loader ------------------ */
const showLoader = () => {
  if (DOM.pageLoader) DOM.pageLoader.classList.remove('hidden');
};
const hideLoader = () => {
  if (DOM.pageLoader) DOM.pageLoader.classList.add('hidden');
};

/* ------------------ Confetti (lazy load) ------------------ */
const triggerConfetti = () => {
  if (window.__confettiLoaded) return confetti({ particleCount: 90, spread: 65, origin: { y: 0.6 } });
  const s = document.createElement('script');
  s.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
  s.onload = () => { window.__confettiLoaded = true; triggerConfetti(); };
  document.body.appendChild(s);
};

/* ------------------ Modal helpers ------------------ */
let _themedTimeout = null;
const closeModal = () => {
  if (DOM.confirmModal) DOM.confirmModal.style.display = 'none';
  if (DOM.confirmYes) DOM.confirmYes.onclick = null;
  if (DOM.confirmNo) DOM.confirmNo.onclick = null;
  if (DOM.confirmYes) DOM.confirmYes.style.display = '';
  if (DOM.confirmNo) DOM.confirmNo.style.display = '';
  if (_themedTimeout) { clearTimeout(_themedTimeout); _themedTimeout = null; }
};
const showConfirmModal = (title, text, onYes) => {
  if (!DOM.confirmModal) return;
  if (_themedTimeout) { clearTimeout(_themedTimeout); _themedTimeout = null; }
  DOM.confirmTitle.textContent = title;
  DOM.confirmText.textContent = text;
  DOM.confirmYes.style.display = '';
  DOM.confirmNo.style.display = '';
  DOM.confirmModal.style.display = 'flex';
  const cleanup = () => closeModal();
  DOM.confirmYes.onclick = async () => { cleanup(); if (onYes) await onYes(); };
  DOM.confirmNo.onclick = cleanup;
};
const showThemedMessage = (title, message, duration = 2000) => {
  if (!DOM.confirmModal) return;
  DOM.confirmTitle.textContent = title;
  DOM.confirmText.textContent = message;
  DOM.confirmYes.style.display = 'none';
  DOM.confirmNo.style.display = 'none';
  DOM.confirmModal.style.display = 'flex';
  if (_themedTimeout) clearTimeout(_themedTimeout);
  _themedTimeout = setTimeout(() => closeModal(), duration);
};

/* ------------------ Reward modal ------------------ */
function showReward(message, title = "🎉 Reward Unlocked!") {
  if (!DOM.rewardModal) return;
  DOM.rewardTitle.textContent = title;
  DOM.rewardMessage.textContent = message;
  DOM.rewardModal.classList.remove('hidden');
  setTimeout(() => { DOM.rewardModal.classList.add('hidden'); }, 4500);
}

/* ------------------ Image preview ------------------ */
const previewImage = (src) => {
  if (!DOM.imagePreview) return;
  DOM.previewImg.src = src;
  DOM.imagePreview.style.display = 'flex';
};
document.getElementById('closePreview')?.addEventListener('click', () => {
  DOM.previewImg.src = '';
  DOM.imagePreview.style.display = 'none';
});

/* ------------------ Host stats updater ------------------ */
const updateHostStats = async (newUser) => {
  const referrerId = newUser.invitedBy;
  if (!referrerId) return;
  const sanitizedId = String(referrerId).replace(/[.#$[\]]/g, ',');
  const hostRef = doc(db, 'users', sanitizedId);

  try {
    await runTransaction(db, async (t) => {
      const hostSnap = await t.get(hostRef);
      if (!hostSnap.exists()) return;
      const hostData = hostSnap.data() || {};
      const friends = Array.isArray(hostData.hostFriends) ? hostData.hostFriends.slice() : [];
      if (!friends.find(f => f.email === newUser.email)) {
        friends.push({
          email: newUser.email,
          chatId: newUser.chatId || '',
          chatIdLower: (newUser.chatId || '').toLowerCase(),
          isVIP: !!newUser.isVIP,
          isHost: !!newUser.isHost,
          giftShown: false
        });
      }
      const hostVIP = hostData.hostVIP || 0;
      const newVIP = newUser.isVIP ? hostVIP + 1 : hostVIP;
      t.update(hostRef, { hostFriends: friends, hostVIP: newVIP });
    });
  } catch (err) {
    console.error('Failed to update host stats:', err);
  }
};

/* ------------------ Current user ------------------ */
let currentUser = null;

/* ------------------ Load user ------------------ */
const loadCurrentUser = async () => {
  const vipRaw = localStorage.getItem('vipUser');
  const vip = vipRaw ? JSON.parse(vipRaw) : null;

  if (DOM.username) DOM.username.textContent = '******';
  if (DOM.stars) DOM.stars.textContent = `0 ⭐️`;
  if (DOM.cash) DOM.cash.textContent = `₦0`;

  await renderShop();

  if (!vip?.email) { currentUser = null; if (DOM.hostTabs) DOM.hostTabs.style.display = 'none'; return; }

  const uid = String(vip.email).replace(/[.#$[\]]/g, ',');
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    currentUser = { uid, stars: 0, cash: 0, isHost: false };
    if (DOM.username) DOM.username.textContent = vip.displayName || vip.email || 'Guest';
    if (DOM.hostTabs) DOM.hostTabs.style.display = 'none';
    return;
  }

  currentUser = { uid, ...snap.data() };

  if (DOM.username) DOM.username.textContent = currentUser.chatId || vip.displayName || vip.email || 'Guest';
  if (DOM.stars) DOM.stars.textContent = `${formatNumber(currentUser.stars)} ⭐️`;
  if (DOM.cash) DOM.cash.textContent = `₦${formatNumber(currentUser.cash)}`;
  if (DOM.hostTabs) DOM.hostTabs.style.display = currentUser.isHost ? '' : 'none';
  updateHostPanels();

  if (currentUser) {
    await updateHostStats({
      email: currentUser.email || '',
      chatId: currentUser.chatId || '',
      isVIP: currentUser.isVIP || false,
      isHost: currentUser.isHost || false,
      invitedBy: currentUser.invitedBy || null
    });
  }

  onSnapshot(userRef, async docSnap => {
    const data = docSnap.data();
    if (!data) return;
    currentUser = { uid, ...data };

    if (DOM.username) DOM.username.textContent = currentUser.chatId || vip.displayName || vip.email || 'Guest';
    if (DOM.stars) DOM.stars.textContent = `${formatNumber(currentUser.stars)} ⭐️`;
    if (DOM.cash) DOM.cash.textContent = `₦${formatNumber(currentUser.cash)}`;
    if (DOM.hostTabs) DOM.hostTabs.style.display = currentUser.isHost ? '' : 'none';
    updateHostPanels();
    renderShop().catch(err => console.error(err));
  });
};

/* ------------------ Host panels ------------------ */
const updateHostPanels = () => {
  if (!currentUser?.isHost) {
    if (DOM.hostTabs) DOM.hostTabs.style.display = 'none';
    if (DOM.tabContent) DOM.tabContent.style.display = 'none';
    return;
  }
  if (DOM.hostTabs) DOM.hostTabs.style.display = '';
  if (DOM.tabContent) DOM.tabContent.style.display = '';
  renderTabContent('vip');
};

/* ------------------ Redeem product (with central spinner) ------------------ */
const redeemProduct = async (product) => {
  if (!currentUser) return showThemedMessage('Not Logged In', 'Please sign in to redeem items.');
  if (currentUser.stars < product.cost) return showThemedMessage('Not Enough Stars', 'You do not have enough stars.');
  if (product.available <= 0) return showThemedMessage('Sold Out', 'This item is no longer available.');
  if (product.name?.toLowerCase() === 'redeem cash balance' && Number(currentUser.cash) <= 0) return showThemedMessage('No Cash', 'You have no cash to redeem');

  showLoader(); // ← central spinner appears immediately

  try {
    const userRef = doc(db, 'users', currentUser.uid);
    const productRef = doc(db, 'shopItems', String(product.id));
    let newStars = 0, newCash = 0, redeemedCash = 0;

    await runTransaction(db, async (t) => {
      const [uSnap, pSnap] = await Promise.all([t.get(userRef), t.get(productRef)]);
      if (!uSnap.exists()) throw new Error('User not found');
      if (!pSnap.exists()) throw new Error('Product not found');
      const uData = uSnap.data(), pData = pSnap.data();
      const cost = Number(pData.cost) || 0;
      const available = Number(pData.available) || 0;
      if (Number(uData.stars) < cost) throw new Error('Not enough stars');
      if (available <= 0) throw new Error('Out of stock');

      newStars = Number(uData.stars) - cost;
      if (pData.name?.toLowerCase() === 'redeem cash balance') {
        redeemedCash = Number(uData.cash) || 0;
        newCash = 0;
      } else {
        newCash = Number(uData.cash || 0) + Number(pData.cashReward || 0);
      }

      t.update(userRef, { stars: newStars, cash: newCash });
      t.update(productRef, { available: available - 1 });
      const purchasesCol = collection(db, 'purchases');
      t.set(doc(purchasesCol), {
        userId: currentUser.uid,
        email: uData.email || '',
        productId: String(pData.id),
        productName: pData.name,
        cost,
        cashReward: Number(pData.cashReward || 0),
        redeemedCash,
        timestamp: serverTimestamp()
      });
    });

    const prevStars = parseNumberFromText(DOM.stars.textContent);
    const prevCash = parseNumberFromText(DOM.cash.textContent);
    currentUser.stars = newStars; currentUser.cash = newCash;
    animateNumber(DOM.stars, prevStars, newStars);
    animateNumber(DOM.cash, prevCash, newCash);
    await renderShop();
    triggerConfetti();
    if (redeemedCash > 0) showThemedMessage('Cash Redeemed', `You redeemed ₦${redeemedCash.toLocaleString()}`, 3000);
    else if (Number(product.cashReward) > 0) showThemedMessage('Redemption Success', `"${product.name}" redeemed and received ₦${Number(product.cashReward).toLocaleString()}`, 2500);
    else showThemedMessage('Redemption Success', `"${product.name}" redeemed!`, 2000);

  } catch (e) {
    console.error(e);
    showThemedMessage('Redemption Failed', e.message || 'Try again');
  } finally {
    hideLoader(); // ← spinner disappears
  }
};

/* ------------------ Render shop (unchanged) ------------------ */
const renderShop = async () => {
  if (!DOM.shopItems) return;
  showLoader();
  DOM.shopItems.innerHTML = '';

  try {
    const shopSnap = await getDocs(collection(db, 'shopItems'));
    if (shopSnap.empty) {
      DOM.shopItems.innerHTML = '<div style="text-align:center;color:#555;">No items found</div>';
      return;
    }

    let delay = 0;
    DOM.shopItems.innerHTML = '';
    shopSnap.forEach(docSnap => {
      const product = docSnap.data();
      product.id = docSnap.id;
      const card = createProductCard(product);
      card.style.opacity = '0';
      card.style.animation = `fadeInUp 0.35s forwards`;
      card.style.animationDelay = `${delay}s`;
      delay += 0.05;
      DOM.shopItems.appendChild(card);
    });
  } catch (e) {
    console.error(e);
    DOM.shopItems.innerHTML = '<div style="text-align:center;color:#ccc;">Failed to load shop</div>';
  } finally {
    hideLoader();
  }
};

/* ------------------ Init ------------------ */
window.addEventListener('DOMContentLoaded', () => {
  loadCurrentUser().catch(err => console.error(err));
});