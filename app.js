// =====================================
// ELEMENTY DOM
// =====================================
const authView = document.getElementById("auth-view");
const appView = document.getElementById("app-view");

const loginCard = document.getElementById("login-card");
const loginForm = document.getElementById("login-form");
const loginUsername = document.getElementById("login-username");
const loginPassword = document.getElementById("login-password");
const pendingCatchesBody = document.getElementById("pending-catches-body");

const showRegisterBtn = document.getElementById("show-register");
const registerCard = document.getElementById("register-card");
const backToLoginBtn = document.getElementById("back-to-login");
const registerForm = document.getElementById("register-form");
const regUsername = document.getElementById("reg-username");
const regPassword = document.getElementById("reg-password");
const regToken = document.getElementById("reg-token");
const regDisplayId = document.getElementById("reg-displayid");

const currentUserLabel = document.getElementById("current-user-label");
const logoutBtn = document.getElementById("logout-btn");
const adminTab = document.getElementById("admin-tab");

const navButtons = document.querySelectorAll(".nav-btn[data-view]");
const viewSections = document.querySelectorAll(".view-section");

const catchForm = document.getElementById("catch-form");
const catchSpeciesSelect = document.getElementById("catch-species");
const catchLength = document.getElementById("catch-length");
const catchWeight = document.getElementById("catch-weight");
const catchDate = document.getElementById("catch-date");
const userCatchesBody = document.getElementById("user-catches-body");

const rankingBody = document.getElementById("ranking-body");

const speciesForm = document.getElementById("species-form");
const speciesNameInput = document.getElementById("species-name");
const speciesRarityInput = document.getElementById("species-rarity");
const speciesBody = document.getElementById("species-body");

const generateTokenBtn = document.getElementById("generate-token-btn");
const invitesBody = document.getElementById("invites-body");

// =====================================
// STAN
// =====================================
let currentUser = null;

// =====================================
// WIDOKI
// =====================================
function showAuth() {
  authView.hidden = false;
  appView.hidden = true;
}

function showApp() {
  authView.hidden = true; // ukryj logowanie
  appView.hidden = false; // pokaż aplikację

  currentUserLabel.textContent = `Zalogowano jako: ${
    currentUser.displayId || currentUser.username
  }`;
  adminTab.hidden = !currentUser.isAdmin;

  setActiveView("catches-view");
  loadSpecies();
  loadUserCatches();
  loadRanking();
  if (currentUser.isAdmin) {
    loadInvites();
  }
}

function setActiveView(id) {
  viewSections.forEach((sec) => {
    sec.hidden = sec.id !== id;
  });
}

// ====================================
// ŁADOWANIE ZGŁOSZEŃ
// ====================================
async function loadPendingCatches() {
  if (!currentUser?.isAdmin) return;

  const snap = await db
    .collection("catches")
    .where("approved", "==", false)
    .get();

  const speciesSnap = await db.collection("species").get();
  const speciesMap = {};
  speciesSnap.forEach((doc) => (speciesMap[doc.id] = doc.data().name));

  pendingCatchesBody.innerHTML = "";

  snap.forEach((doc) => {
    const c = doc.data();
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${c.date}</td>
      <td>${speciesMap[c.speciesId] || "?"}</td>
      <td>${c.length}</td>
      <td>${c.weight}</td>
      <td>${c.points}</td>
      <td><button class="btn primary approve-btn" data-id="${
        doc.id
      }">Zatwierdź</button></td
    `;

    pendingCatchesBody.appendChild(tr);
  });

  document.querySelectorAll(".approve-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      await db.collection("catches").doc(id).update({ approved: true });
      loadPendingCatches();
      loadRanking();
    });
  });
}

// =====================================
// LOGOWANIE / REJESTRACJA
// =====================================
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = loginUsername.value.trim();
  const password = loginPassword.value;

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const userDoc = await db.collection("users").doc(cred.user.uid).get();

    if (!userDoc.exists) {
      alert("Błąd: brak profilu użytkownika.");
      return;
    }

    currentUser = {
      uid: cred.user.uid,
      username: userDoc.data().username,
      displayId: userDoc.data().displayId,
      isAdmin: userDoc.data().isAdmin || false,
    };

    showApp();
  } catch (err) {
    alert("Nieprawidłowy login lub hasło.");
  }
});

showRegisterBtn.addEventListener("click", () => {
  registerCard.hidden = false;
  loginCard.hidden = true;
});

backToLoginBtn.addEventListener("click", () => {
  registerCard.hidden = true;
  loginCard.hidden = false;
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = regUsername.value.trim();
  const password = regPassword.value;
  const token = regToken.value.trim();

  if (!email || !password || !token) {
    alert("Uzupełnij wszystkie pola.");
    return;
  }

  try {
    const inviteDoc = await db.collection("invites").doc(token).get();

    if (!inviteDoc.exists) {
      alert("Nieprawidłowy token.");
      return;
    }

    if (inviteDoc.data().used) {
      alert("Ten token został już użyty.");
      return;
    }

    const cred = await auth.createUserWithEmailAndPassword(email, password);

    await db
      .collection("users")
      .doc(cred.user.uid)
      .set({
        username: email,
        displayId: regDisplayId.value.trim(),
        isAdmin: email === "admin@admin.pl",
      });

    await db.collection("invites").doc(token).update({
      used: true,
    });

    alert("Konto utworzone. Możesz się zalogować.");
    registerForm.reset();
    registerCard.hidden = true;
    loginCard.hidden = false;
  } catch (err) {
    alert("Błąd rejestracji: " + err.message);
  }
});

// =====================================
// WYLOGOWANIE
// =====================================
logoutBtn.addEventListener("click", async () => {
  await auth.signOut();
  currentUser = null;
  showAuth();
});

// =====================================
// NAWIGACJA
// =====================================
navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    setActiveView(btn.dataset.view);
    if (btn.dataset.view === "ranking-view") loadRanking();
    if (btn.dataset.view === "admin-view" && currentUser?.isAdmin) {
      loadInvites();
      loadSpecies();
      loadPendingCatches();
    }
    if (btn.dataset.view === "users-view") loadUsers();
  });
});

// =====================================
// GATUNKI
// =====================================
async function loadSpecies() {
  const snap = await db.collection("species").get();
  const species = [];

  snap.forEach((doc) => {
    species.push({ id: doc.id, ...doc.data() });
  });

  catchSpeciesSelect.innerHTML = "";
  speciesBody.innerHTML = "";

  species.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.name} (+${s.rarityPoints} pkt)`;
    catchSpeciesSelect.appendChild(opt);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.name}</td>
      <td>${s.rarityPoints}</td>
    `;
    speciesBody.appendChild(tr);
  });
}

speciesForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser?.isAdmin) {
    alert("Tylko admin może dodawać gatunki.");
    return;
  }

  const name = speciesNameInput.value.trim();
  const rarity = Number(speciesRarityInput.value);

  if (!name || Number.isNaN(rarity)) {
    alert("Podaj poprawne dane gatunku.");
    return;
  }

  await db.collection("species").add({
    name,
    rarityPoints: rarity,
  });

  speciesForm.reset();
  loadSpecies();
});

// =====================================
// ZGŁOSZENIA
// =====================================
catchForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const speciesId = catchSpeciesSelect.value;
  const length = Number(catchLength.value);
  const weight = Number(catchWeight.value);
  const date = catchDate.value;

  if (!speciesId || !date || Number.isNaN(length) || Number.isNaN(weight)) {
    alert("Uzupełnij poprawnie wszystkie pola.");
    return;
  }

  const spDoc = await db.collection("species").doc(speciesId).get();
  const sp = spDoc.data();

  const points = Math.round(sp.rarityPoints + length);

  await db.collection("catches").add({
    userId: currentUser.uid,
    speciesId,
    length,
    weight,
    date,
    points,
    approved: false,
  });

  catchForm.reset();
  loadUserCatches();
  loadRanking();
});

async function loadUserCatches() {
  if (!currentUser) return;

  const snap = await db
    .collection("catches")
    .where("userId", "==", currentUser.uid)

    .get();

  const speciesSnap = await db.collection("species").get();
  const speciesMap = {};
  speciesSnap.forEach((doc) => (speciesMap[doc.id] = doc.data().name));

  userCatchesBody.innerHTML = "";

  snap.forEach((doc) => {
    const c = doc.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.date}</td>
      <td>${speciesMap[c.speciesId] || "?"}</td>
      <td>${c.length.toFixed(1)}</td>
      <td>${c.weight.toFixed(2)}</td>
      <td>${c.points}</td>
      <td>${c.approved ? "✔️" : "⏳"}</td>
    `;
    userCatchesBody.appendChild(tr);
  });
}

// =====================================
// RANKING
// =====================================
async function loadRanking() {
  const usersSnap = await db.collection("users").get();
  const catchesSnap = await db.collection("catches").get();

  const users = [];
  usersSnap.forEach((doc) => users.push({ id: doc.id, ...doc.data() }));

  const catches = [];
  catchesSnap.forEach((doc) => {
    const c = doc.data();
    if (c.approved) catches.push(c);
  });

  const byUser = new Map();
  catches.forEach((c) => {
    if (!byUser.has(c.userId)) {
      byUser.set(c.userId, { total: 0, count: 0 });
    }
    const entry = byUser.get(c.userId);
    entry.total += c.points;
    entry.count += 1;
  });

  const rows = users
    .map((u) => {
      const stats = byUser.get(u.id) || { total: 0, count: 0 };
      return {
        displayId: u.displayId,
        username: u.username,
        total: stats.total,
        count: stats.count,
      };
    })
    .sort((a, b) => b.total - a.total);

  rankingBody.innerHTML = "";

  rows.forEach((r, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${r.displayId}</td>
      <td>${r.total}</td>
      <td>${r.count}</td>
    `;
    rankingBody.appendChild(tr);
  });
}

// =====================================
// TOKENY ZAPROSZEŃ
// =====================================
function generateRandomToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

async function generateToken() {
  const token = generateRandomToken();

  await db.collection("invites").doc(token).set({
    used: false,
    createdAt: new Date().toISOString(),
  });

  alert("Nowy token: " + token);
  loadInvites();
}

generateTokenBtn.addEventListener("click", () => {
  if (!currentUser?.isAdmin) {
    alert("Tylko admin może generować tokeny.");
    return;
  }
  generateToken();
});

async function loadInvites() {
  const snap = await db.collection("invites").get();
  invitesBody.innerHTML = "";

  const baseUrl = window.location.origin + window.location.pathname;

  snap.forEach((doc) => {
    const data = doc.data();
    const token = doc.id;
    const link = `${baseUrl}?invite=${token}`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${token}</td>
      <td>${data.used ? "tak" : "nie"}</td>
      <td>
        <button class="btn primary" data-link="${link}">Kopiuj link</button>
      </td>
    `;
    invitesBody.appendChild(tr);
  });

  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(btn.dataset.link);
      alert("Skopiowano link:\n" + btn.dataset.link);
    });
  });
}

// =====================================
// OBSŁUGA LINKÓW ZAPROSZEŃ
// =====================================
function handleInviteFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const invite = params.get("invite");

  if (!invite) return;

  regToken.value = invite;
  registerCard.hidden = false;
  loginCard.hidden = true;

  window.history.replaceState({}, document.title, window.location.pathname);
}

// =====================================
// UCZESTNICY
// =====================================
async function loadUsers() {
  const usersSnap = await db.collection("users").get();
  const grid = document.getElementById("users-grid");
  grid.innerHTML = "";

  usersSnap.forEach((doc) => {
    const u = doc.data();

    const div = document.createElement("div");
    div.className = "user-card";
    div.dataset.uid = doc.id;

    div.innerHTML = `
      <div class="user-card-name">${u.displayId}</div>
    `;

    div.addEventListener("click", () => openUserProfile(doc.id));

    grid.appendChild(div);
  });
}

async function openUserProfile(uid) {
  // pobieramy użytkownika
  const userDoc = await db.collection("users").doc(uid).get();
  const user = userDoc.data();

  // pobieramy wszystkie zgłoszenia
  const catchesSnap = await db.collection("catches").get();
  const speciesSnap = await db.collection("species").get();

  const speciesMap = {};
  speciesSnap.forEach((doc) => (speciesMap[doc.id] = doc.data().name));

  const catches = [];
  catchesSnap.forEach((doc) => {
    const c = doc.data();
    if (c.userId === uid && c.approved) catches.push(c);
  });

  // liczymy punkty i zgłoszenia
  const totalPoints = catches.reduce((sum, c) => sum + c.points, 0);
  const count = catches.length;

  // ranking
  const rankingSnap = await db.collection("catches").get();
  const totals = {};

  rankingSnap.forEach((doc) => {
    const c = doc.data();
    if (c.approved) {
      totals[c.userId] = (totals[c.userId] || 0) + c.points;
    }
  });

  const sorted = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map((e) => e[0]);

  const rank = sorted.indexOf(uid) + 1;

  // wypełniamy widok
  document.getElementById("profile-name").textContent = user.displayId;
  document.getElementById("profile-rank").textContent = rank || "-";
  document.getElementById("profile-points").textContent = totalPoints;
  document.getElementById("profile-count").textContent = count;

  const tbody = document.getElementById("profile-catches");
  tbody.innerHTML = "";

  catches.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.date}</td>
      <td>${speciesMap[c.speciesId]}</td>
      <td>${c.length}</td>
      <td>${c.weight}</td>
      <td>${c.points}</td>
    `;
    tbody.appendChild(tr);
  });

  // przełączamy widok
  setActiveView("profile-view");
}

// =====================================
// START – NASŁUCH STANU AUTH
// =====================================
auth.onAuthStateChanged(async (user) => {
  if (user) {
    const userDoc = await db.collection("users").doc(user.uid).get();

    if (userDoc.exists) {
      currentUser = {
        uid: user.uid,
        username: userDoc.data().username,
        displayId: userDoc.data().displayId,
        isAdmin: userDoc.data().isAdmin || false,
      };

      showApp();
      return;
    }
  }

  currentUser = null;
  showAuth();
  handleInviteFromUrl();
});
