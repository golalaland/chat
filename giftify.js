// giftify.js
// Replaces "Badges" UI with Gifts-for-Hosts. Works with Firebase v10.
// Save as giftify.js and include as <script type="module" src="giftify.js"></script>

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, query, where, getDocs, addDoc, onSnapshot,
  doc, updateDoc, increment, getDoc, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* =========  CONFIG  =========
If you already initialize Firebase elsewhere, remove the init here and import `db` & `auth`.
*/
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
const auth = getAuth(app);

/* =========  STATE  ========= */
let currentUser = null;
let giftsCatalog = null; // array
let hostsList = null; // array of hosts
const DEFAULT_GIFT_PRICE = 100; // fallback price in stars

/* =========  AUTH  ========= */
onAuthStateChanged(auth, user => {
  currentUser = user;
  // re-render UI if needed
  renderGiftsTab(); // safe to call even if DOM not ready yet
});

/* =========  DOM HELPERS  ========= */
function $(sel) { return document.querySelector(sel); }
function $id(id) { return document.getElementById(id); }

function ensureBadgesTabExists() {
  // If your host-tabs exist, we'll replace the "Badges" tab content.
  const hostTabs = document.getElementById("hostTabs");
  if (!hostTabs) return;

  // Ensure there's a tab button for badges (it already exists in your markup)
  const badgeBtn = Array.from(hostTabs.querySelectorAll(".tab-btn")).find(btn => btn.dataset.tab === "badges");
  if (!badgeBtn) return;

  // Attach click handler to show Gifts view
  badgeBtn.onclick = (e) => {
    hostTabs.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    badgeBtn.classList.add("active");

    // hide other host tab contents (if any) and show our gifts content
    document.querySelectorAll(".tab-content").forEach(el => el.style.display = "none");
    renderGiftsTab();
  };
}

/* =========  UI RENDER  ========= */
function renderGiftsTab() {
  // Create or reuse a container for gifts
  let container = document.getElementById("giftsTabContent");
  if (!container) {
    // find where Badges content currently sits (you have a tab content area)
    const hostTabWrapper = document.createElement("div");
    hostTabWrapper.id = "giftsTabContent";
    hostTabWrapper.className = "tab-content";
    hostTabWrapper.style.display = "block";
    hostTabWrapper.innerHTML = `
      <h3 style="margin-bottom:12px;">🎁 Gifts</h3>
      <div id="giftsGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px;"></div>

      <div style="text-align:left;margin-bottom:8px;">
        <strong>Send a Gift to a Host</strong>
      </div>

      <div style="display:flex;gap:8px; margin-bottom:12px; align-items:center;">
        <select id="hostSelect" style="flex:1;padding:8px;border-radius:8px;border:1px solid #eee;"></select>
        <select id="giftSelect" style="width:160px;padding:8px;border-radius:8px;border:1px solid #eee;"></select>
        <button id="sendGiftBtn" class="themed-btn" style="padding:8px 12px;">Send</button>
      </div>

      <div id="giftsReceivedWrapper" style="text-align:left;">
        <strong>Gifts Received</strong>
        <div id="giftsReceived" style="margin-top:8px;"></div>
      </div>

      <div id="giftFeedback" style="margin-top:10px;color:#e74c3c;"></div>
    `;
    // append after host-tabs or to body if not found
    const hostTabs = document.getElementById("hostTabs");
    if (hostTabs && hostTabs.parentNode) hostTabs.parentNode.insertBefore(hostTabWrapper, hostTabs.nextSibling);
    else document.body.appendChild(hostTabWrapper);

    container = hostTabWrapper;
  } else {
    container.style.display = "block";
  }

  // Populate selects & grid
  loadGiftCatalog().then(() => {
    populateGiftGrid();
    populateGiftSelect();
    populateHostSelect();
    attachSendGiftHandler();
    listenForReceivedGifts();
  });
}

/* =========  LOAD CATALOG & HOSTS  ========= */
async function loadGiftCatalog() {
  // Try to read from `/products` collection (if exists). Otherwise, use a hardcoded catalog.
  if (giftsCatalog) return giftsCatalog;

  try {
    const q = collection(db, "products");
    const snap = await getDocs(q);

    if (!snap.empty) {
      giftsCatalog = [];
      snap.forEach(s => {
        const d = s.data();
        giftsCatalog.push({
          id: s.id,
          name: d.name || d.title || "Gift",
          icon: d.icon || d.emoji || d.imageURL || "🎁",
          price: (d.price || d.priceStars || d.priceStars === 0) ? (d.price || d.priceStars) : DEFAULT_GIFT_PRICE,
          raw: d
        });
      });
      return giftsCatalog;
    }
  } catch (err) {
    console.warn("Could not load products collection (ok).", err);
  }

  // fallback static catalog
  giftsCatalog = [
    { id: "rose", name: "Rose", icon: "🌹", price: 100 },
    { id: "wine", name: "Wine", icon: "🍷", price: 350 },
    { id: "flowers", name: "Flowers", icon: "💐", price: 250 },
    { id: "champagne", name: "Champagne", icon: "🥂", price: 600 },
    { id: "crown", name: "Crown", icon: "👑", price: 1200 },
    { id: "diamond", name: "Diamond", icon: "💎", price: 2500 }
  ];
  return giftsCatalog;
}

async function populateHostSelect() {
  // load hosts from featuredHosts collection and fallback to users where isHost true
  if (hostsList) {
    fillHostSelect(hostsList);
    return hostsList;
  }

  try {
    const fh = collection(db, "featuredHosts");
    const fhSnap = await getDocs(fh);
    hostsList = [];
    if (!fhSnap.empty) {
      for (const docSnap of fhSnap.docs) {
        const d = docSnap.data();
        hostsList.push({
          id: docSnap.id,
          chatId: d.chatId || d.userId || d.displayName || `host-${docSnap.id}`,
          photo: d.popupPhoto || d.photoURL || d.avatar || "",
          userId: d.userId || null
        });
      }
    }
  } catch (err) {
    console.warn("featuredHosts read failed:", err);
  }

  // fallback: query users with isHost flag
  try {
    if (!hostsList || hostsList.length === 0) {
      const usersCol = collection(db, "users");
      const q = query(usersCol, where("isHost", "==", true));
      const usersSnap = await getDocs(q);
      hostsList = [];
      usersSnap.forEach(s => {
        const d = s.data();
        hostsList.push({ id: s.id, chatId: d.chatId || d.fullName || s.id, photo: d.photoURL || "" });
      });
    }
  } catch (err) {
    console.warn("users read fallback failed:", err);
  }

  fillHostSelect(hostsList || []);
  return hostsList;
}

function fillHostSelect(list) {
  const hostSelect = document.getElementById("hostSelect");
  if (!hostSelect) return;
  hostSelect.innerHTML = "";

  if (!list || list.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No hosts available";
    hostSelect.appendChild(opt);
    return;
  }

  list.forEach(h => {
    const opt = document.createElement("option");
    opt.value = h.id;
    opt.textContent = (h.chatId || h.name || h.id);
    hostSelect.appendChild(opt);
  });
}

/* =========  GIFT GRID & SELECT  ========= */
function populateGiftGrid() {
  const grid = document.getElementById("giftsGrid");
  if (!grid) return;
  grid.innerHTML = "";

  giftsCatalog.forEach(g => {
    const el = document.createElement("div");
    el.style = "background:#fff;border-radius:10px;padding:8px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.06);";
    el.innerHTML = `<div style="font-size:28px">${g.icon}</div>
                    <div style="font-weight:700;margin-top:6px">${g.name}</div>
                    <div style="color:#666;margin-top:4px"> ${g.price} ⭐</div>`;
    grid.appendChild(el);
  });
}

function populateGiftSelect() {
  const select = document.getElementById("giftSelect");
  if (!select) return;
  select.innerHTML = "";
  giftsCatalog.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.dataset.price = g.price;
    opt.textContent = `${g.icon} ${g.name} — ${g.price} ⭐`;
    select.appendChild(opt);
  });
}

/* =========  SEND GIFT  ========= */
function attachSendGiftHandler() {
  const btn = document.getElementById("sendGiftBtn");
  if (!btn) return;
  btn.onclick = async () => {
    if (!currentUser) {
      showFeedback("Sign in to send gifts.");
      return;
    }
    const hostSelect = document.getElementById("hostSelect");
    const giftSelect = document.getElementById("giftSelect");
    if (!hostSelect || !giftSelect) return;

    const hostId = hostSelect.value;
    const giftId = giftSelect.value;
    const gift = giftsCatalog.find(g => g.id === giftId);
    if (!gift) return showFeedback("Choose a gift.");

    try {
      // load sender stars
      const senderRef = doc(db, "users", currentUser.uid);
      const senderSnap = await getDoc(senderRef);
      const senderData = senderSnap.exists() ? senderSnap.data() : {};
      const stars = (senderData.stars || 0);

      if (stars < gift.price) {
        return showFeedback(`Not enough stars. You have ${stars} ⭐ but the gift costs ${gift.price} ⭐`);
      }

      // Create hostGifts record
      const payload = {
        fromUid: currentUser.uid,
        toHostId: hostId,
        productId: gift.id,
        productName: gift.name,
        productIcon: gift.icon,
        priceStars: gift.price,
        timestamp: new Date()
      };

      // Optionally: deduct stars and increment host star tally (atomicity is limited without cloud function)
      // We'll do parallel updates: addDoc + update sender + increment host (if user record exists)
      const hostGiftsCol = collection(db, "hostGifts");
      await addDoc(hostGiftsCol, {
        ...payload,
        timestamp: new Date()
      });

      // Deduct stars from sender
      await updateDoc(senderRef, { stars: increment(-gift.price), starsGifted: increment(gift.price) });

      // Try to increment host totals (if host has a users doc)
      try {
        const hostUserRef = doc(db, "users", hostId);
        const hostSnap = await getDoc(hostUserRef);
        if (hostSnap.exists()) {
          await updateDoc(hostUserRef, { stars: increment(gift.price), giftsReceived: increment(1) });
        } else {
          // Try incrementing featuredHosts
          const hostFeatRef = doc(db, "featuredHosts", hostId);
          await updateDoc(hostFeatRef, { stars: increment(gift.price), starsGifted: increment(gift.price) }).catch(()=>{});
        }
      } catch (e) {
        console.warn("Could not update host profile counts (non-fatal).", e);
      }

      showFeedback(`Sent ${gift.icon} ${gift.name} to host!`, "success");
      // Refresh received gifts view if the current user is viewing their own profile
      listenForReceivedGifts(true);
    } catch (err) {
      console.error("send gift failed:", err);
      showFeedback("Something went wrong sending gift.");
    }
  };
}

/* =========  SHOW FEEDBACK  ========= */
function showFeedback(text, type="error") {
  const el = document.getElementById("giftFeedback");
  if (!el) return;
  el.style.color = type === "success" ? "#16a34a" : "#e74c3c";
  el.innerText = text;
  setTimeout(() => { if (el) el.innerText = ""; }, 4000);
}

/* =========  LISTEN FOR RECEIVED GIFTS  ========= */
let receivedUnsub = null;
async function listenForReceivedGifts(forceRefresh=false) {
  const wrapper = document.getElementById("giftsReceived");
  if (!wrapper) return;

  // We'll show aggregated gifts for the currently selected host in hostSelect
  const hostSelect = document.getElementById("hostSelect");
  const selectedHostId = hostSelect ? hostSelect.value : null;
  if (!selectedHostId) {
    wrapper.innerHTML = `<div class="muted">Select a host to see gifts received.</div>`;
    return;
  }

  // Unsubscribe previous snapshot
  if (receivedUnsub && !forceRefresh) return; // already listening
  if (receivedUnsub && forceRefresh) { receivedUnsub(); receivedUnsub = null; }

  const hg = collection(db, "hostGifts");
  const q = query(hg, where("toHostId", "==", selectedHostId), orderBy("timestamp", "desc"));

  // Real-time listener (updates if new gifts arrive)
  receivedUnsub = onSnapshot(q, snapshot => {
    const map = {};
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      const key = d.productId || d.productName || "gift";
      if (!map[key]) map[key] = { icon: d.productIcon || "🎁", name: d.productName || key, count: 0 };
      map[key].count++;
    });

    const arr = Object.values(map);
    if (arr.length === 0) {
      wrapper.innerHTML = `<div class="muted">No gifts yet.</div>`;
      return;
    }

    wrapper.innerHTML = arr.map(g => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px dashed #eee;">
        <div style="font-size:22px">${g.icon}</div>
        <div>
          <div style="font-weight:700">${g.name}</div>
          <div class="muted">Received ×${g.count}</div>
        </div>
      </div>
    `).join("");
  }, err => {
    console.error("received gifts snapshot:", err);
    wrapper.innerHTML = `<div class="muted">Could not load gifts.</div>`;
  });
}

/* =========  BOOTSTRAP ========= */
function init() {
  ensureBadgesTabExists();
  // If user clicked badges before script loaded, programmatically render:
  // If there's already an "active" badges tab, render
  const hostTabs = document.getElementById("hostTabs");
  if (hostTabs) {
    const active = hostTabs.querySelector(".tab-btn.active");
    if (active && active.dataset.tab === "badges") renderGiftsTab();
  }
}
init();

/* =========  OPTIONAL: expose helpers for debugging ========= */
window.__giftify = {
  loadGiftCatalog,
  populateHostSelect,
  renderGiftsTab
};