<!-- Firebase SDK (compat) -->
<script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js"></script>

<script>
/*
  IMPORTANT:
  - Replace firebaseConfig with your project's config (apiKey, authDomain, projectId, etc.)
  - This approach uses client SDK directly. For production, adding server-side / Render API
    with Admin SDK is recommended to keep rules secure.
*/

// --------- FIREBASE CONFIG (REPLACE THESE VALUES) ----------
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  // ... other config fields
};
// ----------------------------------------------------------
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Simple client-side profanity filter (expand as needed)
const profanity = [
  "badword1","badword2","fuck","shit","bitch","asshole" // replace / expand as desired
];
function containsProfanity(name){
  const lower = name.toLowerCase();
  return profanity.some(w => lower.includes(w));
}

// ---- Helpers
const localExpKey = "exp"; // site stores exp in localStorage under "exp"
function readLocalExp(){
  const raw = localStorage.getItem(localExpKey);
  const n = parseInt(raw||"0",10);
  return Number.isNaN(n) ? 0 : n;
}

function niceNum(n){
  return n.toLocaleString();
}

// ---- UI refs
const localExpDisplay = document.getElementById("localExpDisplay");
const usernameInput = document.getElementById("usernameInput");
const submitBtn = document.getElementById("submitBtn");
const submitMsg = document.getElementById("submitMsg");
const leaderboardEl = document.getElementById("leaderboard");
const refreshBtn = document.getElementById("refreshBtn");
const filterInput = document.getElementById("filterInput");

// show local exp
function refreshLocalExpUI(){
  const e = readLocalExp();
  localExpDisplay.innerText = `${niceNum(e)} EXP`;
}
refreshLocalExpUI();

// ---- Submit flow
let busy = false;
submitBtn.addEventListener("click", async () => {
  if (busy) return;
  submitMsg.className = "small";
  submitMsg.innerText = "";
  const rawName = (usernameInput.value||"").trim();
  if (!rawName){
    submitMsg.className = "small error";
    submitMsg.innerText = "Enter a username.";
    return;
  }
  if (rawName.length < 3 || rawName.length > 20){
    submitMsg.className = "small error";
    submitMsg.innerText = "Username must be 3–20 chars.";
    return;
  }
  if (containsProfanity(rawName)){
    submitMsg.className = "small error";
    submitMsg.innerText = "Username contains banned words.";
    return;
  }

  const expValue = readLocalExp();
  if (expValue <= 0){
    submitMsg.className = "small error";
    submitMsg.innerText = "You have 0 EXP — earn some first.";
    return;
  }

  busy = true;
  submitBtn.disabled = true;
  submitMsg.className = "small muted";
  submitMsg.innerText = "Submitting…";

  try {
    // Add submission document (we accept duplicates; leaderboard will dedupe)
    await db.collection("leaders").add({
      username: rawName,
      exp: expValue,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    submitMsg.className = "small success";
    submitMsg.innerText = `Submitted ${niceNum(expValue)} EXP for ${rawName}.`;
    // refresh leaderboard
    await loadLeaderboard();
  } catch (err) {
    console.error(err);
    submitMsg.className = "small error";
    submitMsg.innerText = "Submit failed. Check console.";
  } finally {
    busy = false;
    submitBtn.disabled = false;
  }
});

// ---- Leaderboard logic
// We'll query a reasonable number of top submissions, then aggregate highest per username client-side.
// This avoids complicated server-side aggregation and works fine for a top-5 board.
async function loadLeaderboard(){
  leaderboardEl.innerHTML = `<div class="muted">Loading leaderboard…</div>`;
  const filter = (filterInput.value||"").trim().toLowerCase();

  try {
    // fetch top N submissions by exp (desc). Increase limit if you have many duplicates.
    const LIMIT = 80;
    const snapshot = await db.collection("leaders")
      .orderBy("exp","desc")
      .limit(LIMIT)
      .get();

    // aggregate to highest per username
    const byUser = {};
    snapshot.forEach(doc=>{
      const data = doc.data();
      const uname = (data.username||"").trim();
      const exp = Number(data.exp||0);
      if (!uname) return;
      const key = uname.toLowerCase();
      if (!byUser[key] || byUser[key].exp < exp) {
        byUser[key] = { username: uname, exp: exp, ts: data.createdAt ? data.createdAt.toDate() : null };
      }
    });

    // convert to array and sort by exp desc
    let arr = Object.values(byUser).sort((a,b)=>b.exp - a.exp);

    // apply filter if provided (username contains)
    if (filter) {
      arr = arr.filter(item => item.username.toLowerCase().includes(filter));
    }

    // pick top 5 to display
    const top = arr.slice(0,5);

    if (top.length === 0){
      leaderboardEl.innerHTML = `<div class="muted">No scores yet${filter? " matching filter": ""}.</div>`;
      return;
    }

    // render
    leaderboardEl.innerHTML = "";
    top.forEach((u, idx) => {
      const row = document.createElement("div");
      row.className = "leader-row";
      row.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center">
          <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(90deg,#00c6ff,#7d3cff);display:flex;align-items:center;justify-content:center;font-weight:800">${idx+1}</div>
          <div>
            <div style="font-weight:700">${escapeHtml(u.username)}</div>
            <div class="small">${u.ts ? formatDate(u.ts) : ""}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:800">${niceNum(u.exp)} EXP</div>
        </div>`;
      leaderboardEl.appendChild(row);
    });

  } catch (err){
    console.error(err);
    leaderboardEl.innerHTML = `<div class="error small">Failed to load leaderboard — check console.</div>`;
  }
}

// small helpers
function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function formatDate(d){
  try{
    return d.toLocaleString();
  }catch(e){ return "" }
}

// refresh controls
refreshBtn.addEventListener("click", loadLeaderboard);
filterInput.addEventListener("input", () => {
  // small debounce
  if (window._leaderFilterTimer) clearTimeout(window._leaderFilterTimer);
  window._leaderFilterTimer = setTimeout(loadLeaderboard, 300);
});

// initial load
loadLeaderboard();
refreshLocalExpUI();

// OPTIONAL: poll leaderboard every 20s
setInterval(loadLeaderboard, 20_000);

