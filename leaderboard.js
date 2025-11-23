const API_BASE = "";
const leaderboardEl = document.getElementById("leaderboard");
const usernameInput = document.getElementById("usernameInput");
const submitBtn = document.getElementById("submitBtn");
const submitMsg = document.getElementById("submitMsg");
const filterInput = document.getElementById("filterInput");
const expTab = document.getElementById("expTab");
const timeTab = document.getElementById("timeTab");

let currentTab = "exp";

function niceNum(n){ return n.toLocaleString(); }
function niceTime(t){ return (t||0) + "s"; }

async function fetchLeaderboard(){
  const res = await fetch(`${API_BASE}/scores`);
  return await res.json();
}

async function submitScore(){
  const username = usernameInput.value.trim();
  const exp = parseInt(localStorage.getItem("exp")||0);
  const time = parseInt(localStorage.getItem("time")||0);
  if(!username || username.length<3 || username.length>20){ submitMsg.innerText="Username 3–20 chars"; return;}
  if(exp<=0 && time<=0){ submitMsg.innerText="Earn EXP or TIME first"; return;}
  await fetch(`${API_BASE}/submit`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({username, exp, time})
  });
  submitMsg.innerText=`Saved! EXP:${niceNum(exp)} TIME:${niceTime(time)}`;
  renderLeaderboard();
}

async function renderLeaderboard(){
  let data = await fetchLeaderboard();
  const filter = (filterInput.value||"").toLowerCase();
  if(filter) data = data.filter(u=>u.username.toLowerCase().includes(filter));
  if(currentTab==="exp") data.sort((a,b)=>b.exp-a.exp);
  else data.sort((a,b)=>b.time-a.time);

  leaderboardEl.innerHTML="";
  for(let i=0;i<5;i++){
    const div = document.createElement("div");
    if(i<data.length){
      const u = data[i];
      div.innerHTML=`<strong>${i+1}. ${u.username}</strong> <span>${niceNum(u.exp)} EXP • ${niceTime(u.time)}</span>`;
    } else {
      div.innerHTML=`<strong>${i+1}. ---</strong> <span>0 EXP • 0s</span>`;
    }
    leaderboardEl.appendChild(div);
  }
}

submitBtn.onclick = submitScore;
filterInput.oninput = ()=>setTimeout(renderLeaderboard,200);

expTab.onclick = ()=>{
  currentTab="exp"; expTab.classList.add("active"); timeTab.classList.remove("active"); renderLeaderboard();
};
timeTab.onclick = ()=>{
  currentTab="time"; timeTab.classList.add("active"); expTab.classList.remove("active"); renderLeaderboard();
};

setInterval(renderLeaderboard,5000);
renderLeaderboard();
