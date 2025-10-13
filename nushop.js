/**
 * shop.js — Rewritten, modular, defensive version of your shop + host/VIP code
 * Usage: <script type="module" src="/assets/shop.js"></script>
 *
 * Notes:
 * - Uses Firebase v10 modular imports (same as you used).
 * - All DOM accesses are guarded so missing elements won't crash the script.
 * - Keeps same storage keys: 'vipUser' and 'hostUser'.
 * - Confetti is lazy-loaded.
 * - Uses runTransaction for atomic updates.
 */

/* ------------------ Firebase imports ------------------ */
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
  updateDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ------------------ Config ------------------ */
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

/* ------------------ DOM helpers & references ------------------ */
const $ = (id) => document.getElementById(id);
const qs = (sel) => document.querySelector(sel);

/* DOM map (guarded) */
const DOM = {
  username: $('username'),
  stars: $('stars-count'),
  cash: $('cash-count'),
  shopItems: $('shop-items'),
  hostTabs: $('hostTabs'),
  vipStat: $('vip-stat'),
  friendsStat: $('friends-stat'),
  badgesStat: $('badges-stat'),
  tabContent: $('tab-content'),
  ordersContent: $('orders-content'),
  ordersList: $('orders-list'),
  confirmModal: $('confirmModal'),
  confirmTitle: $('confirmTitle'),
  confirmText: $('confirmText'),
  confirmYes: $('confirmYes'),
  confirmNo: $('confirmNo'),
  imagePreview: $('imagePreview'),
  previewImg: $('previewImg'),
  rewardModal: $('rewardModal'),
  rewardTitle: $('rewardTitle'),
  rewardMessage: $('rewardMessage'),
  productModal: $('productModal'),
  productModalTitle: $('productModalTitle'),
  productModalDesc: $('productModalDesc'),
  closeProductModal: $('closeProductModal'),
  themeToggle: $('themeToggle'),
  shopSpinner: document.querySelector('.shop-spinner') || $('shopSpinner')
};

/* ------------------ Small utilities ------------------ */
const formatNumber = (n) => (n === undefined || n === null) ? '0' : new Intl.NumberFormat('en-NG').format(Number(n));
const parseNumberFromText = (text) => Number((text || '').replace(/[^\d\-]/g, '')) || 0;

/* Animate numeric text (stars/cash) */
const animateNumber = (el, from, to, duration = 600) => {
  if (!el) return;
  const start = performance.now();
  const step = (ts) => {
    const progress = Math.min((ts - start) / duration, 1);
    const value = Math.floor(from + (to - from) * progress);
    if (el === DOM.stars) el.textContent = `${formatNumber(value)} ⭐️`;
    else if (el === DOM.cash) el.textContent = `₦${formatNumber(value)}`;
    else el.textContent = formatNumber(value);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

/* ------------------ Spinner helpers ------------------ */
function showSpinner() {
  if (DOM.shopSpinner) DOM.shopSpinner.classList.add('active');
}
function hideSpinner() {
  if (DOM.shopSpinner) DOM.shopSpinner.classList.remove('active');
}

/* ------------------ Confetti (lazy load) ------------------ */
const triggerConfetti = () => {
  if (typeof window !== 'undefined' && window.__confettiLoaded) {
    try { window.confetti({ particleCount: 90, spread: 65, origin: { y: 0.6 } }); } catch (e) {}
    return;
  }
  if (typeof window === 'undefined') return;
  const s = document.createElement('script');
  s.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
  s.onload = () => { window.__confettiLoaded = true; try { window.confetti({ particleCount: 90, spread: 65, origin: { y: 0.6 } }); } catch (e) {} };
  s.onerror = () => { /* fail silently */ };
  document.body.appendChild(s);
};

/* ------------------ Product modal helpers ------------------ */
function openProductModal(product = {}) {
  if (!DOM.productModal || !DOM.productModalTitle || !DOM.productModalDesc) return;
  DOM.productModalTitle.textContent = product.name || 'Product';
  DOM.productModalDesc.textContent = product.description || product.desc || 'No description.';
  DOM.productModal.classList.remove('hidden');
}
function closeProductModal() {
  if (!DOM.productModal) return;
  DOM.productModal.classList.add('hidden');
}
/* close product modal handlers */
DOM.closeProductModal?.addEventListener('click', closeProductModal);
DOM.productModal?.addEventListener('click', (e) => {
  if (e.target === DOM.productModal) closeProductModal();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeProductModal(); });

/* ------------------ Generic modal helpers ------------------ */
let _themedTimeout = null;
const closeModal = () => {
  if (DOM.confirmModal) DOM.confirmModal.style.display = 'none';
  if (DOM.confirmYes) { DOM.confirmYes.onclick = null; DOM.confirmYes.style.display = ''; }
  if (DOM.confirmNo) { DOM.confirmNo.onclick = null; DOM.confirmNo.style.display = ''; }
  if (_themedTimeout) { clearTimeout(_themedTimeout); _themedTimeout = null; }
};

const showConfirmModal = (title = '', text = '', onYes) => {
  if (!DOM.confirmModal) return;
  if (DOM.confirmTitle) DOM.confirmTitle.textContent = title;
  if (DOM.confirmText) DOM.confirmText.textContent = text;
  if (DOM.confirmYes) DOM.confirmYes.style.display = '';
  if (DOM.confirmNo) DOM.confirmNo.style.display = '';
  DOM.confirmModal.style.display = 'flex';
  const cleanup = () => closeModal();
  if (DOM.confirmYes) DOM.confirmYes.onclick = async () => { cleanup(); if (onYes) await onYes(); };
  if (DOM.confirmNo) DOM.confirmNo.onclick = cleanup;
};

const showThemedMessage = (title = '', message = '', duration = 2000) => {
  if (!DOM.confirmModal) return;
  if (DOM.confirmTitle) DOM.confirmTitle.textContent = title;
  if (DOM.confirmText) DOM.confirmText.textContent = message;
  if (DOM.confirmYes) DOM.confirmYes.style.display = 'none';
  if (DOM.confirmNo) DOM.confirmNo.style.display = 'none';
  DOM.confirmModal.style.display = 'flex';
  if (_themedTimeout) clearTimeout(_themedTimeout);
  _themedTimeout = setTimeout(closeModal, duration);
};

/* ------------------ Reward modal ------------------ */
function showReward(message = '', title = '🎉 Reward Unlocked!') {
  if (!DOM.rewardModal) return;
  if (DOM.rewardTitle) DOM.rewardTitle.textContent = title;
  if (DOM.rewardMessage) DOM.rewardMessage.innerHTML = message;
  DOM.rewardModal.classList.remove('hidden');
  setTimeout(() => {
    DOM.rewardModal.classList.add('hidden');
  }, 4500);
}

/* ------------------ Image preview ------------------ */
const previewImage = (src) => {
  if (!DOM.imagePreview || !DOM.previewImg) return;
  DOM.previewImg.src = src || '';
  DOM.imagePreview.style.display = 'flex';
};
$('closePreview')?.addEventListener('click', () => {
  if (DOM.previewImg) DOM.previewImg.src = '';
  if (DOM.imagePreview) DOM.imagePreview.style.display = 'none';
});

/* ------------------ Current user state ------------------ */
let currentUser = null;

/* ------------------ Host stats update helper ------------------ */
const updateHostStats = async (newUser) => {
  if (!newUser || !newUser.invitedBy) return;
  const sanitizedId = String(newUser.invitedBy).replace(/[.#$[\]]/g, ',');
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
          vipName: newUser.vipName || ''
        });
      }
      const hostVIP = Number(hostData.hostVIP || 0);
      const newVIP = newUser.isVIP ? hostVIP + 1 : hostVIP;
      t.update(hostRef, { hostFriends: friends, hostVIP: newVIP });
    });
  } catch (err) {
    console.warn('updateHostStats error', err);
  }
};

/* ------------------ Load current user ------------------ */
const loadCurrentUser = async () => {
  showSpinner();
  try {
    const vipRaw = localStorage.getItem('vipUser');
    const hostRaw = localStorage.getItem('hostUser');
    const storedUser = vipRaw ? JSON.parse(vipRaw) : hostRaw ? JSON.parse(hostRaw) : null;

    // reset UI
    if (DOM.username) DOM.username.textContent = '******';
    if (DOM.stars) DOM.stars.textContent = `0 ⭐️`;
    if (DOM.cash) DOM.cash.textContent = `₦0`;
    if (DOM.hostTabs) DOM.hostTabs.style.display = 'none';
    await renderShop();

    if (!storedUser?.email) {
      currentUser = null;
      return;
    }

    const uid = String(storedUser.email).replace(/[.#$[\]]/g, ',');
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // fallback minimal user
      currentUser = {
        uid,
        stars: 0,
        cash: 0,
        isHost: false,
        chatId: storedUser.displayName || storedUser.email.split('@')[0] || 'Guest',
        email: storedUser.email || ''
      };
      if (DOM.username) DOM.username.textContent = currentUser.chatId;
      return;
    }

    const data = snap.data() || {};
    currentUser = {
      uid,
      ...data,
      vipName: storedUser.vipName || data.vipName || data.chatId || ''
    };

    if (DOM.username) DOM.username.textContent = currentUser.chatId || 'Guest';
    if (DOM.stars) DOM.stars.textContent = `${formatNumber(currentUser.stars)} ⭐️`;
    if (DOM.cash) DOM.cash.textContent = `₦${formatNumber(currentUser.cash)}`;
    if (DOM.hostTabs) DOM.hostTabs.style.display = currentUser.isHost ? '' : 'none';

    // If invited, update host stats
    if (currentUser?.invitedBy) {
      await updateHostStats({
        email: currentUser.email || '',
        chatId: currentUser.chatId || '',
        vipName: currentUser.vipName || currentUser.chatId || '',
        isVIP: !!currentUser.isVIP,
        isHost: !!currentUser.isHost,
        invitedBy: currentUser.invitedBy
      });
    }

    // setup VIP/Host features (safely)
    try {
      if (currentUser.isVIP) setupVIPButton?.();
      else if (currentUser.isHost) setupHostGiftListener?.();
    } catch (e) { console.warn('VIP/Host init failed', e); }

    // persist vipName locally
    if (currentUser.isVIP) {
      const storedVIP = JSON.parse(localStorage.getItem('vipUser') || '{}');
      storedVIP.vipName = currentUser.vipName;
      localStorage.setItem('vipUser', JSON.stringify(storedVIP));
    }

    // subscribe to realtime updates
    onSnapshot(userRef, async (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data() || {};
      currentUser = { uid, ...data };

      // update UI live
      if (DOM.username) DOM.username.textContent = currentUser.chatId || 'Guest';
      if (DOM.stars) DOM.stars.textContent = `${formatNumber(currentUser.stars)} ⭐️`;
      if (DOM.cash) DOM.cash.textContent = `₦${formatNumber(currentUser.cash)}`;
      if (DOM.hostTabs) DOM.hostTabs.style.display = currentUser.isHost ? '' : 'none';
      updateHostPanels();
      await renderShop();

      // reward flows (invitee, inviter, gifted)
      try {
        // invitee reward
        if ((data.invitedBy || data.hostName) && data.inviteeGiftShown !== true) {
          let inviterName = data.hostName || data.invitedBy;
          try {
            const invRef = doc(db, 'users', String(data.invitedBy).replace(/[.#$[\]]/g, ','));
            const invSnap = await getDoc(invRef);
            if (invSnap.exists()) {
              const invData = invSnap.data();
              inviterName = invData.chatId || invData.hostName || (invData.email ? invData.email.split('@')[0] : inviterName);
            }
          } catch (err) { console.warn('Could not fetch inviter details:', err); }
          const inviteeStars = data.inviteeGiftStars || 50;
          showReward(`You’ve been gifted +${inviteeStars}⭐️ for joining <b>${inviterName}</b>’s VIP Tab.`, '⭐ Congratulations! ⭐️');
          try { await updateDoc(doc(db, 'users', currentUser.uid), { inviteeGiftShown: true }); } catch (e) {}
        }

        // inviter reward
        const friendsArr = Array.isArray(data.hostFriends) ? data.hostFriends : [];
        const pending = friendsArr.find(f => !f.giftShown && f.email);
        if (pending) {
          const friendName = pending.vipName || pending.chatId || (pending.email ? pending.email.split('@')[0] : 'Friend');
          const inviterStars = pending.giftStars || 200;
          showReward(`You’ve been gifted +${inviterStars}⭐️, <b>${friendName}</b> just joined your Tab.`, '⭐ Congratulations! ⭐️');
          const updated = friendsArr.map(f => f.email === pending.email ? { ...f, giftShown: true } : f);
          try { await updateDoc(doc(db, 'users', currentUser.uid), { hostFriends: updated }); } catch (e) {}
        }

        // gifted by VIP
        if (data.giftedByVIP && !data.giftReceivedShown) {
          const vipName = data.giftedByVIP;
          const productName = data.giftedProduct || 'Gifted Item';
          showReward(`You’ve received <b>${productName}</b> from <b>${vipName}</b>!`, '🎁 Gift Received!');
          try { await updateDoc(doc(db, 'users', currentUser.uid), { giftReceivedShown: true }); } catch (e) {}
        }
      } catch (e) { console.error('Reward flow error', e); }
    });

  } catch (err) {
    console.error('loadCurrentUser error', err);
  } finally {
    hideSpinner();
  }
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
      const message = `Hey! I'm hosting on xixi live, join my tab and let’s win together 🎉 Sign up using my link: `;
      const link = `https://golalaland.github.io/chat/ref.html?ref=${encodeURIComponent(currentUser.uid)}`;
      const fullText = message + link;
      navigator.clipboard.writeText(fullText)
        .then(() => showThemedMessage('Copied!', 'Invite message copied.', 1500))
        .catch(() => showThemedMessage('Error', 'Failed to copy invite.', 1800));
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

/* ------------------ Friends list render ------------------ */
function renderFriendsList(container, friends) {
  container.innerHTML = '';
  if (!friends || friends.length === 0) {
    container.innerHTML = `<div class="muted">No friends yet 😔</div>`;
    return;
  }

  const sorted = friends.slice().sort((a, b) => {
    if (a.isVIP && !b.isVIP) return -1;
    if (!a.isVIP && b.isVIP) return 1;
    if (a.isHost && !b.isHost) return -1;
    if (!a.isHost && b.isHost) return 1;
    return 0;
  });

  const list = document.createElement('div');
  list.className = 'friends-list';
  sorted.forEach(f => {
    const name = f.chatId || (f.email ? f.email.split('@')[0] : 'Guest');
    const handle = '@' + (f.chatIdLower || (name.toLowerCase().replace(/\s+/g, '')));
    let iconSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#999"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"/></svg>`;
    let color = '#444';
    if (f.isVIP) { iconSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#c9a033"><path d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.782 1.4 8.172L12 18.896l-7.334 3.85 1.4-8.172L.132 9.211l8.2-1.193L12 .587z"/></svg>`; color = '#c9a033'; }
    else if (f.isHost) { iconSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#ff66cc"><path d="M12 2v4l3 2-3 2v4l8-6-8-6zm-2 8l-8 6 8 6v-4l-3-2 3-2v-4z"/></svg>`; color = '#ff66cc'; }

    const card = document.createElement('div');
    card.className = 'friend-card';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        ${iconSVG}
        <div>
          <div style="font-weight:600;color:${color};">${name}</div>
          <div style="font-size:0.85rem;color:#888;">${handle}</div>
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  container.appendChild(list);
}

/* ------------------ Host tab click handlers ------------------ */
DOM.hostTabs?.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const type = btn.dataset.tab;
  renderTabContent(type);
});

/* ------------------ User tabs (Shop / Orders) ------------------ */
const userTabs = $('userTabs');
userTabs?.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  userTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (btn.dataset.tab === 'shop') {
    if (DOM.shopItems) DOM.shopItems.style.display = 'grid';
    if (DOM.ordersContent) DOM.ordersContent.style.display = 'none';
  } else {
    if (DOM.shopItems) DOM.shopItems.style.display = 'none';
    if (DOM.ordersContent) DOM.ordersContent.style.display = 'block';
    renderMyOrders();
  }
});

/* ------------------ Orders rendering ------------------ */
const renderMyOrders = async () => {
  if (!DOM.ordersList) return;
  showSpinner();
  DOM.ordersList.innerHTML = '<div style="text-align:center;color:#555;">Loading orders...</div>';
  if (!currentUser) { DOM.ordersList.innerHTML = '<div style="text-align:center;color:#555;">Not logged in.</div>'; hideSpinner(); return; }

  try {
    const purchasesRef = collection(db, 'purchases');
    const snap = await getDocs(purchasesRef);
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => o.userId === currentUser.uid);
    if (orders.length === 0) { DOM.ordersList.innerHTML = '<div style="text-align:center;color:#555;">No orders yet..hmmmmm! 🤔</div>'; return; }
    orders.sort((a, b) => {
      const ta = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
      const tb = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
      return tb - ta;
    });
    DOM.ordersList.innerHTML = '';
    orders.forEach(order => {
      const block = document.createElement('div'); block.className = 'stat-block';
      const dateText = order.timestamp?.toDate ? order.timestamp.toDate().toLocaleString() : '';
      block.innerHTML = `
        <div class="stat-value">${order.productName || 'Unnamed'}</div>
        <div class="stat-label">${order.cost || 0} ⭐${order.cashReward ? ' - ₦' + Number(order.cashReward).toLocaleString() : ''}</div>
        ${dateText ? `<div class="muted">${dateText}</div>` : ''}
      `;
      DOM.ordersList.appendChild(block);
    });
  } catch (e) {
    console.error('renderMyOrders error', e);
    DOM.ordersList.innerHTML = '<div style="text-align:center;color:#ccc;">Failed to load orders.</div>';
  } finally {
    hideSpinner();
  }
};

/* ------------------ Shop rendering + product card creation ------------------ */
const createProductCard = (product) => {
  // product expected fields: id, name, img, cost, available, hostOnly, cashReward, description
  if (!product) return null;
  if (product.hostOnly && !currentUser?.isHost) return null;

  const avail = Number(product.available || 0);

  const card = document.createElement('div');
  card.className = 'product-card';

  // availability badge
  const badge = document.createElement('span');
  badge.className = 'availability-badge';
  badge.textContent = avail > 0 ? `${avail} Left` : 'Sold Out';
  if (avail <= 0) badge.style.background = '#666';

  // image
  const img = document.createElement('img');
  img.src = product.img || 'https://via.placeholder.com/300';
  img.alt = product.name || 'Item';
  img.addEventListener('click', () => previewImage(img.src));

  // title
  const title = document.createElement('h3');
  title.textContent = product.name || 'Unnamed';
  title.className = 'product-title';
  title.style.cursor = 'pointer';
  title.addEventListener('click', () => openProductModal(product));

  // price
  const price = document.createElement('div');
  price.className = 'price';
  price.textContent = `${Number(product.cost) || 0} ⭐`;

  // redeem button
  const btn = document.createElement('button');
  btn.className = 'buy-btn';
  btn.textContent = 'Redeem';
  btn.disabled = avail <= 0 || (product.name?.toLowerCase() === 'redeem cash balance' && Number(currentUser?.cash || 0) <= 0);

  btn.addEventListener('click', () => {
    if (currentUser?.isVIP && product.hostOnly) {
      // gift to host flow (only gift their host)
      if (!currentUser.invitedBy && !currentUser.hostId) return showThemedMessage('No host', 'No host found to gift.', 1800);
      const hostId = currentUser.invitedBy || currentUser.hostId;
      // attempt redeem as gift
      redeemGiftToHost(product, hostId).catch(err => showThemedMessage('Error', err.message || 'Gift failed'));
    } else {
      redeemProduct(product).catch(err => showThemedMessage('Error', err.message || 'Redeem failed'));
    }
  });

  card.append(badge, img, title, price, btn);
  return card;
};

const renderShop = async () => {
  if (!DOM.shopItems) return;
  showSpinner();
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
      const data = docSnap.data() || {};
      const product = {
        id: docSnap.id,
        name: data.name || '',
        img: data.img || '',
        cost: data.cost || 0,
        available: data.available || 0,
        hostOnly: data.hostOnly || false,
        cashReward: data.cashReward || 0,
        description: data.description || data.desc || ''
      };

      const card = createProductCard(product);
      if (!card) return;

      card.style.opacity = '0';
      card.style.animation = `fadeInUp 0.35s forwards`;
      card.style.animationDelay = `${delay}s`;
      delay += 0.05;
      DOM.shopItems.appendChild(card);
    });

    if (!DOM.shopItems.hasChildNodes()) {
      DOM.shopItems.innerHTML = '<div style="text-align:center;color:#555;">No items available</div>';
    }

  } catch (err) {
    console.error('renderShop error', err);
    DOM.shopItems.innerHTML = '<div style="text-align:center;color:#ccc;">Failed to load shop</div>';
  } finally {
    hideSpinner();
  }
};

/* ------------------ Redeem product flow ------------------ */
const redeemProduct = async (product) => {
  if (!currentUser) return showThemedMessage('Error', 'User not loaded');
  if (!product) return showThemedMessage('Error', 'Invalid product');

  showConfirmModal(`"${product.name}" costs ${product.cost} ⭐`, `Are you sure you want to redeem "${product.name}"?`, async () => {
    showSpinner();
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const productRef = doc(db, 'shopItems', String(product.id));
      let newStars = 0, newCash = 0, redeemedCash = 0;

      await runTransaction(db, async (t) => {
        const [uSnap, pSnap] = await Promise.all([t.get(userRef), t.get(productRef)]);
        if (!uSnap.exists()) throw new Error('User not found');
        if (!pSnap.exists()) throw new Error('Product not found');

        const uData = uSnap.data() || {};
        const pData = pSnap.data() || {};
        const cost = Number(pData.cost || 0);
        const available = Number(pData.available || 0);

        if (Number(uData.stars) < cost) throw new Error('Not enough stars');
        if (available <= 0) throw new Error('Out of stock');

        newStars = Number(uData.stars) - cost;
        if (pData.name?.toLowerCase() === 'redeem cash balance') {
          redeemedCash = Number(uData.cash || 0);
          newCash = 0;
        } else {
          newCash = Number(uData.cash || 0) + Number(pData.cashReward || 0);
        }

        t.update(userRef, { stars: newStars, cash: newCash });
        t.update(productRef, { available: available - 1 });
        t.set(doc(collection(db, 'purchases')), {
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

      const prevStars = parseNumberFromText(DOM.stars?.textContent);
      const prevCash = parseNumberFromText(DOM.cash?.textContent);
      currentUser.stars = newStars;
      currentUser.cash = newCash;
      animateNumber(DOM.stars, prevStars, newStars);
      animateNumber(DOM.cash, prevCash, newCash);

      await renderShop();
      triggerConfetti();

      if (redeemedCash > 0) showThemedMessage('Cash Redeemed', `You redeemed ₦${redeemedCash.toLocaleString()}`, 3000);
      else if (Number(product.cashReward) > 0) showThemedMessage('Redemption Success', `"${product.name}" redeemed and received ₦${Number(product.cashReward).toLocaleString()}`, 2500);
      else showThemedMessage('Redemption Success', `"${product.name}" redeemed!`, 2000);

    } catch (err) {
      console.error('redeemProduct error', err);
      showThemedMessage('Redemption Failed', err.message || 'Try again');
    } finally {
      hideSpinner();
    }
  });
};

/* ------------------ Redeem gift (claim for yourself) ------------------ */
const redeemGift = async (gift) => {
  if (!currentUser) return showThemedMessage('Error', 'User not loaded');
  if (!gift) return showThemedMessage('Error', 'Invalid gift');

  showConfirmModal(`Claim gift "${gift.name}"?`, `Are you sure you want to claim this gift?`, async () => {
    showSpinner();
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const giftRef = doc(db, 'gifts', String(gift.id));

      await runTransaction(db, async (t) => {
        const [uSnap, gSnap] = await Promise.all([t.get(userRef), t.get(giftRef)]);
        if (!uSnap.exists()) throw new Error('User not found');
        if (!gSnap.exists()) throw new Error('Gift not found');

        const uData = uSnap.data() || {};
        const gData = gSnap.data() || {};
        const available = Number(gData.available || 0);
        if (available <= 0) throw new Error('Gift out of stock');

        t.update(giftRef, { available: available - 1 });
        t.set(doc(collection(db, 'giftClaims')), {
          userId: currentUser.uid,
          email: uData.email || '',
          giftId: String(gData.id),
          giftName: gData.name,
          timestamp: serverTimestamp()
        });
      });

      await renderGifts?.();
      triggerConfetti();
      showThemedMessage('Gift Claimed', `"${gift.name}" successfully claimed!`, 2500);
    } catch (err) {
      console.error('redeemGift error', err);
      showThemedMessage('Gift Claim Failed', err.message || 'Try again');
    } finally {
      hideSpinner();
    }
  });
};

/* ------------------ Redeem gift to host (VIP gift flow) ------------------ */
const redeemGiftToHost = async (product, hostId) => {
  if (!currentUser) return showThemedMessage('Error', 'User not loaded');
  if (!product) return showThemedMessage('Error', 'Invalid gift');

  showConfirmModal(`Send "${product.name}" to your host?`, `This will gift "${product.name}" to the host that invited you. Continue?`, async () => {
    showSpinner();
    try {
      const hostRef = doc(db, 'users', String(hostId).replace(/[.#$[\]]/g, ','));
      const productRef = doc(db, 'shopItems', String(product.id));
      await runTransaction(db, async (t) => {
        const [hSnap, pSnap] = await Promise.all([t.get(hostRef), t.get(productRef)]);
        if (!hSnap.exists()) throw new Error('Host not found');
        if (!pSnap.exists()) throw new Error('Product not found');
        const pData = pSnap.data() || {};
        const available = Number(pData.available || 0);
        if (available <= 0) throw new Error('Out of stock');
        // reduce availability and record gift
        t.update(productRef, { available: available - 1 });
        t.set(doc(collection(db, 'hostGifts')), {
          fromVIP: currentUser.uid,
          toHost: hostRef.id,
          productId: product.id,
          productName: product.name,
          timestamp: serverTimestamp()
        });
      });

      await renderShop();
      triggerConfetti();
      showThemedMessage('Gift Sent', `"${product.name}" sent to host!`, 2200);
    } catch (err) {
      console.error('redeemGiftToHost error', err);
      showThemedMessage('Gift Failed', err.message || 'Try again');
    } finally {
      hideSpinner();
    }
  });
};

/* ------------------ Optional renderGifts placeholder ------------------ */
async function renderGifts() {
  // placeholder: implement if you have a gifts UI like shopItems
  return;
}

/* ------------------ Theme toggle — safe init ------------------ */
(function initThemeToggle() {
  const btn = DOM.themeToggle;
  if (!btn) return;
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') document.body.classList.add('dark');
  else if (savedTheme === 'light') document.body.classList.add('light-mode-forced');
  else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) document.body.classList.add('dark');
  btn.textContent = document.body.classList.contains('dark') ? '🌙' : '☀️';
  btn.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    document.body.classList.toggle('light-mode-forced', !isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    btn.textContent = isDark ? '🌙' : '☀️';
  });
})();

/* ------------------ Product name click binding (legacy support) ------------------ */
document.querySelectorAll('.product-card h3').forEach(nameEl => {
  nameEl.addEventListener('click', () => {
    const card = nameEl.closest('.product-card');
    if (!card) return;
    const product = {
      name: card.querySelector('h3')?.textContent || '',
      description: card.dataset?.desc || 'No description available.'
    };
    openProductModal(product);
  });
});

/* ------------------ DOM ready initializers ------------------ */
document.addEventListener('DOMContentLoaded', () => {
  // product modal close via overlay handled above.
  // optionally safe-init other UI bits here
  if (DOM.hostTabs) updateHostPanels();
});

/* ------------------ SAFE INIT ------------------ */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadCurrentUser();
    console.log('✅ User data + listeners initialized');
  } catch (err) {
    console.error('Init error:', err);
  }
});