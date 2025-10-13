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

/* ---------------- Spinner Helpers ---------------- */
function showSpinner() {
  const spinner = document.querySelector('.shop-spinner') || document.getElementById('shopSpinner');
  if (spinner) spinner.classList.add('active');
}
function hideSpinner() {
  const spinner = document.querySelector('.shop-spinner') || document.getElementById('shopSpinner');
  if (spinner) spinner.classList.remove('active');
}

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
  vipTicketButton: document.getElementById('vipTicketButton'),
  vipHostName: document.getElementById('vipHostName')
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

/* ------------------ Confetti ------------------ */
const triggerConfetti = () => {
  if (window.__confettiLoaded) return confetti({ particleCount: 90, spread: 65, origin: { y: 0.6 } });
  const s = document.createElement('script');
  s.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
  s.onload = () => { window.__confettiLoaded = true; triggerConfetti(); };
  document.body.appendChild(s);
};

/* ------------------ Reward modal ------------------ */
function showReward(message, title = "🎉 Reward Unlocked!") {
  if (!DOM.rewardModal) return;
  DOM.rewardTitle.textContent = title;
  DOM.rewardMessage.innerHTML = message; // bold friend names
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

/* ------------------ Current user ------------------ */
let currentUser = null;

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
          giftShown: false,
          bonus: 200
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

/* ------------------ Load current user + Firestore ------------------ */
const loadCurrentUser = async () => {
  showSpinner();
  try {
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

    // Show VIP ticket if applicable
    if (currentUser.isVIP && currentUser.hostName) {
      if (DOM.vipHostName) DOM.vipHostName.textContent = currentUser.hostName;
      if (DOM.vipTicketButton) DOM.vipTicketButton.style.display = "flex";
    }

    // Real-time listener for rewards & UI updates
    onSnapshot(userRef, async docSnap => {
      const data = docSnap.data();
      if (!data) return;
      currentUser = { uid, ...data };

      if (DOM.username) DOM.username.textContent = currentUser.chatId || vip.displayName || vip.email || 'Guest';
      if (DOM.stars) DOM.stars.textContent = `${formatNumber(currentUser.stars)} ⭐️`;
      if (DOM.cash) DOM.cash.textContent = `₦${formatNumber(currentUser.cash)}`;
      if (DOM.hostTabs) DOM.hostTabs.style.display = currentUser.isHost ? '' : 'none';
      updateHostPanels();
      renderShop().catch(console.error);

      // Invitee reward
      try {
        if (data.invitedBy && data.inviteeGiftShown !== true) {
          let inviterName = data.invitedBy;
          try {
            const invRef = doc(db, 'users', String(data.invitedBy).replace(/[.#$[\]]/g, ','));
            const invSnap = await getDoc(invRef);
            if (invSnap.exists()) {
              const invData = invSnap.data();
              inviterName = invData.chatId || (invData.email ? invData.email.split('@')[0] : inviterName);
            }
          } catch {}
          showReward(`You’ve been gifted +50 stars ⭐️ for joining <strong>${inviterName}</strong>’s Tab.`, '⭐ Congratulations!⭐️');
          try { await updateDoc(userRef, { inviteeGiftShown: true }); } catch {}
        }
      } catch (e) { console.error(e); }

      // Inviter reward
      try {
        const friendsArr = Array.isArray(data.hostFriends) ? data.hostFriends : [];
        const pending = friendsArr.find(f => !f.giftShown && f.email);
        if (pending) {
          const friendName = pending.chatId || (pending.email ? pending.email.split('@')[0] : 'Friend');
          const bonus = pending.bonus || 200;
          showReward(`You’ve been gifted +${bonus} stars ⭐️, <strong>${friendName}</strong> just joined your Tab.`, '⭐ Congratulations!⭐️');
          const updated = friendsArr.map(f => f.email === pending.email ? { ...f, giftShown: true } : f);
          try { await updateDoc(userRef, { hostFriends: updated }); } catch {}
        }
      } catch (e) { console.error(e); }
    });

  } catch (e) { console.error(e); }
  finally { hideSpinner(); }
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

const renderTabContent = (type) => {
  if (!DOM.tabContent) return;
  DOM.tabContent.innerHTML = '';
  if (!currentUser?.isHost) return;

  if (type === 'vip') {
    const vipCount = currentUser.hostVIP || 0;
    DOM.tabContent.innerHTML = `
      <div class="stat-block" style="margin-bottom:12px;">
        <div class="stat-value" id="vip-stat">${formatNumber(vipCount)}</div>
        <div class="stat-label">VIPs Signed Up</div>
      </div>
    `;
  } else if (type === 'friends') {
    renderFriendsList(DOM.tabContent, currentUser.hostFriends || []);
    const btn = document.createElement('button');
    btn.id = 'inviteFriendsBtn';
    btn.className = 'themed-btn';
    btn.textContent = 'Invite Friends';
    DOM.tabContent.appendChild(btn);
    btn.addEventListener('click', () => {
      const message = `Hey! I'm hosting on xixi live. Join my tab and let's win together! Sign up using my link: `;
      const link = `https://golalaland.github.io/chat/payments.html?ref=${encodeURIComponent(currentUser.uid)}`;
      navigator.clipboard.writeText(message + link).then(
        () => showThemedMessage('Copied!', 'Invite message copied.', 1500),
        () => showThemedMessage('Error', 'Failed to copy invite.', 1800)
      );
    });
  } else if (type === 'badges') {
    const badgeImg = currentUser.hostBadgeImg || 'https://www.svgrepo.com/show/492657/crown.svg';
    DOM.tabContent.innerHTML = `
      <div class="stat-block">
        <img src="${badgeImg}" style="width:100px;height:100px;">
        <div class="stat-value">${currentUser.hostBadge || 'Gold'}</div>
        <div class="stat-label">Badge Status</div>
      </div>
    `;
  }
};

function renderFriendsList(container, friends) {
  container.innerHTML = '';
  if (!friends || friends.length === 0) return container.innerHTML = `<div class="muted">No friends yet 😔</div>`;

  const sorted = friends.slice().sort((a, b) => {
    if (a.isVIP && !b.isVIP) return -1;
    if (!a.isVIP && b.isVIP) return 1;
    if (a.isHost && !b.isHost) return -1;
    if (!a.isHost && b.isHost) return 1;
    return 0;
  });

  const list = document.createElement('div'); list.className = 'friends-list';
  sorted.forEach(f => {
    const name = f.chatId || (f.email ? f.email.split('@')[0] : 'Guest');
    const handle = '@' + (f.chatIdLower || (name.toLowerCase().replace(/\s+/g, '')));
    let iconSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#999"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"/></svg>`;
    let color = '#444';
    if (f.isVIP) { iconSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#c9a033"><path d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.782 1.4 8.172L12 18.896l-7.334 3.85 1.4-8.172L.132 9.211l8.2-1.193L12 .587z"/></svg>`; color = '#c9a033'; }
    else if (f.isHost) { iconSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#ff66cc"><path d="M12 2v4l3 2-3 2v4l8-6-8-6zm-2 8l-8 6 8 6v-4l-3-2 3-2v-4z"/></svg>`; color = '#ff66cc'; }

    const card = document.createElement('div'); card.className = 'friend-card';
    card.innerHTML = `<div style="display:flex;align-items:center;gap:8px;">${iconSVG}<div><div style="font-weight:600;color:${color};">${name}</div><div style="font-size:0.85rem;color:#888;">${handle}</div></div></div>`;
    list.appendChild(card);
  });
  container.appendChild(list);
}

/* ------------------ Host tabs click ------------------ */
DOM.hostTabs?.addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn'); if (!btn) return;
  DOM.hostTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTabContent(btn.dataset.tab);
});

/* ------------------ User tabs ------------------ */
const userTabs = document.getElementById('userTabs');
userTabs?.addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn'); if (!btn) return;
  userTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (btn.dataset.tab === 'shop') {
    DOM.shopItems.style.display = 'grid'; DOM.ordersContent.style.display = 'none';
  } else { DOM.shopItems.style.display = 'none'; DOM.ordersContent.style.display = 'block'; renderMyOrders(); }
});

/* ------------------ Orders ------------------ */
const renderMyOrders = async () => {
  const ordersList = DOM.ordersList; if (!ordersList) return;
  showSpinner(); ordersList.innerHTML = '<div style="text-align:center;color:#555;">Loading orders...</div>';
  if (!currentUser) { ordersList.innerHTML = '<div style="text-align:center;color:#555;">Not logged in.</div>'; hideSpinner(); return; }

  try {
    const purchasesRef = collection(db, 'purchases');
    const snap = await getDocs(purchasesRef);
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => o.userId === currentUser.uid);
    if (orders.length === 0) { ordersList.innerHTML = '<div style="text-align:center;color:#555;">No orders yet..hmmmmm! 🤔</div>'; return; }
    orders.sort((a, b) => {
      const ta = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
      const tb = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
      return tb - ta;
    });
    ordersList.innerHTML = '';
    orders.forEach(order => {
      const block = document.createElement('div'); block.className = 'stat-block';
      const dateText = order.timestamp?.toDate ? order.timestamp.toDate().toLocaleString() : '';
      block.innerHTML = `
        <div class="stat-value">${order.productName || 'Unnamed'}</div>
        <div class="stat-label">${order.cost || 0} ⭐${order.cashReward ? ' - ₦' + Number(order.cashReward).toLocaleString() : ''}</div>
        ${dateText ? `<div class="muted">${dateText}</div>` : ''}
      `;
      ordersList.appendChild(block);
    });
  } catch (e) { console.error(e); ordersList.innerHTML = '<div style="text-align:center;color:#ccc;">Failed to load orders.</div>'; }
  finally { hideSpinner(); }
};

/* ------------------ Shop ------------------ */
const createProductCard = (product) => {
  const card = document.createElement('div'); card.className = 'product-card';
  const img = document.createElement('img'); img.src = product.img || 'https://via.placeholder.com/300'; img.alt = product.name || 'Item';
  img.addEventListener('click', () => previewImage(img.src));
  const badge = document.createElement('span'); badge.className = 'availability-badge';
  const avail = Number(product.available) || 0; badge.textContent = avail > 0 ? `${avail} Left` : 'Sold Out'; if (avail <= 0) badge.style.background = '#666';
  const title = document.createElement('h3'); title.textContent = product.name || 'Unnamed'; title.className = 'product-title'; title.style.cursor = 'pointer'; title.addEventListener('click', () => openProductModal(product));
  const price = document.createElement('div'); price.className = 'price'; price.textContent = `${Number(product.cost) || 0} ⭐`;
  const btn = document.createElement('button'); btn.className = 'buy-btn'; btn.textContent = product.hostOnly ? (currentUser?.isHost ? 'Redeem' : 'Host Only') : 'Redeem';
  if (avail <= 0 || (product.hostOnly && currentUser && !currentUser.isHost) || (product.name?.toLowerCase() === 'redeem cash balance' && currentUser && Number(currentUser.cash) <= 0)) btn.disabled = true;
  btn.addEventListener('click', () => redeemProduct(product));
  card.append(badge, img, title, price, btn);
  return card;
};

/* ------------------ Redeem product ------------------ */
const redeemProduct = async (product) => {
  if (!currentUser) return showThemedMessage('Not Logged In', 'Please sign in to redeem items.');
  if (currentUser.stars < product.cost) return showThemedMessage('Not Enough Stars', 'You do not have enough stars.');
  if (product.available <= 0) return showThemedMessage('Sold Out', 'This item is no longer available.');
  if (product.name?.toLowerCase() === 'redeem cash balance' && Number(currentUser.cash) <= 0) return showThemedMessage('No Cash', 'You have no cash to redeem');

  showConfirmModal('Confirm Redemption', `Redeem "${product.name}" for ${product.cost} ⭐?`, async () => {
    showSpinner();
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const productRef = doc(db, 'shopItems', String(product.id));
      let newStars = 0, newCash = 0, redeemedCash = 0;

      await runTransaction(db, async (t) => {
        const [uSnap, pSnap] = await Promise.all([t.get(userRef), t.get(productRef)]);
        if (!uSnap.exists()) throw new Error('User not found');
        if (!pSnap.exists()) throw new Error('Product not found');
        const uData = uSnap.data(), pData = pSnap.data();
        const cost = Number(pData.cost) || 0, available = Number(pData.available) || 0;
        if (Number(uData.stars) < cost) throw new Error('Not enough stars');
        if (available <= 0) throw new Error('Out of stock');
        newStars = Number(uData.stars) - cost;
        if (pData.name?.toLowerCase() === 'redeem cash balance') { redeemedCash = Number(uData.cash) || 0; newCash = 0; }
        else { newCash = Number(uData.cash || 0) + Number(pData.cashReward || 0); }
        t.update(userRef, { stars: newStars, cash: newCash });
        t.update(productRef, { available: available - 1 });
        const purchasesCol = collection(db, 'purchases');
        t.set(doc(purchasesCol), {
          userId: currentUser.uid,
          email: uData.email || '',
          phone: uData.phone || '',
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
    } catch (e) { console.error(e); showThemedMessage('Redemption Failed', e.message || 'Try again'); }
    finally { hideSpinner(); }
  });
};

/* ------------------ Render shop ------------------ */
const renderShop = async () => {
  if (!DOM.shopItems) return;
  showSpinner(); DOM.shopItems.innerHTML = '';
  try {
    const shopSnap = await getDocs(collection(db, 'shopItems'));
    if (shopSnap.empty) { DOM.shopItems.innerHTML = '<div style="text-align:center;color:#555;">No items found</div>'; return; }
    let delay = 0; DOM.shopItems.innerHTML = '';
    shopSnap.forEach(docSnap => {
      const data = docSnap.data() || {};
      const product = { id: docSnap.id, name: data.name || '', img: data.img || '', cost: data.cost || 0, available: data.available || 0, hostOnly: data.hostOnly || false, cashReward: data.cashReward || 0, description: data.description || data.desc || '' };
      const card = createProductCard(product);
      card.style.opacity = '0'; card.style.animation = `fadeInUp 0.35s forwards`; card.style.animationDelay = `${delay}s`; delay += 0.05;
      DOM.shopItems.appendChild(card);
    });
  } catch (e) { console.error(e); DOM.shopItems.innerHTML = '<div style="text-align:center;color:#ccc;">Failed to load shop</div>'; }
  finally { hideSpinner(); }
};

/* ------------------ Theme toggle ------------------ */
(function () {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') document.body.classList.add('dark');
  else if (savedTheme === 'light') document.body.classList.add('light-mode-forced');
  else if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.body.classList.add('dark');
  btn.textContent = document.body.classList.contains('dark') ? '🌙' : '☀️';
  btn.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    document.body.classList.toggle('light-mode-forced', !isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    btn.textContent = isDark ? '🌙' : '☀️';
  });
})();

/* ------------------ Product modal ------------------ */
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("productModal");
  const modalClose = document.getElementById("closeProductModal");
  modalClose?.addEventListener("click", () => { modal?.classList.add("hidden"); });
  modal?.addEventListener("click", (e) => { if (e.target === modal) modal.classList.add("hidden"); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal?.classList.add('hidden'); });
});

/* ------------------ Init ------------------ */
window.addEventListener('DOMContentLoaded', () => { loadCurrentUser().catch(console.error); });