<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>乂丨乂丨 Purchases Dashboard</title>
<style>
  body {
    font-family: Arial, sans-serif;
    background: #f5f5f5;
    margin: 0;
    padding: 1rem;
  }
  h1 { text-align: center; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
    background: #fff;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  }
  th, td {
    border: 1px solid #ddd;
    padding: 0.7rem;
    text-align: left;
  }
  th {
    background: #ff33cc;
    color: #fff;
  }
</style>
</head>
<body>

<h1>Live Purchases Dashboard</h1>
<table>
  <thead>
    <tr>
      <th>User</th>
      <th>Item</th>
      <th>Cost</th>
      <th>Time</th>
    </tr>
  </thead>
  <tbody id="purchase-list"></tbody>
</table>

<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
  import { getFirestore, collection, onSnapshot, orderBy, query } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

  const firebaseConfig = {
    apiKey: "AIzaSyDbKz4ef_eUDlCukjmnK38sOwueYuzqoao",
    authDomain: "metaverse-1010.firebaseapp.com",
    projectId: "metaverse-1010",
    storageBucket: "metaverse-1010.appspot.com",
    messagingSenderId: "1044064238233",
    appId: "1:1044064238233:web:2fbdfb811cb0a3ba349608"
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const listEl = document.getElementById("purchase-list");

  // Live listener on "purchases"
  const q = query(collection(db, "purchases"), orderBy("timestamp", "desc"));
  onSnapshot(q, snapshot => {
    listEl.innerHTML = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${data.chatId || data.userId}</td>
        <td>${data.itemName}</td>
        <td>${data.cost} ⭐️</td>
        <td>${data.timestamp?.toDate().toLocaleString() || ""}</td>
      `;
      listEl.appendChild(row);
    });
  });
</script>

</body>
</html>