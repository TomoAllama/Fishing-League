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

// powiadomienia
const notifForm = document.getElementById("notif-form");

// =====================================
// STAN
// =====================================
let currentUser = null;
let weatherWidgetLoaded = false;
let notificationsWidgetLoaded = false;
let hasNewNotifications = false;
let notifications = [];
let openedProfileUid = null;

// =====================================
// FORMAT DATY
// =====================================

function formatDate(dateString) {
  const d = new Date(dateString);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

// =====================================
// WIDOKI
// =====================================
function showAuth() {
  authView.hidden = false;
  appView.hidden = true;
}

function showApp() {
  authView.hidden = true;
  appView.hidden = false;

  currentUserLabel.textContent = `Zalogowano jako: ${
    currentUser.displayId || currentUser.username
  }`;
  adminTab.hidden = !currentUser.isAdmin;

  setActiveView("ranking-view");
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

// opcjonalne, jeśli gdzieś używasz showView w HTML
function showView(viewId) {
  setActiveView(viewId);

  if (viewId === "info-view") {
    // jeśli masz te funkcje gdzieś indziej
    if (typeof loadWeather === "function") loadWeather();
    if (typeof loadMoon === "function") loadMoon();
    if (typeof loadFishActivity === "function") loadFishActivity();
  }

  if (viewId === "notifications-view") {
    hasNewNotifications = false;
    updateBellIcon();
    loadNotificationsWidget();
  }
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
      <td>
        <div class="action-buttons">
          <button class="approve-btn" data-id="${doc.id}">
            <span class="material-icons approve-icon">thumb_up</span>
          </button>
      
          <button class="reject-btn delete-catch-btn" data-id="${doc.id}">
            <span class="material-icons delete-icon">delete</span>
          </button>

        </div>
      </td>
    `;

    pendingCatchesBody.appendChild(tr);
  });

  document.querySelectorAll(".approve-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      await db.collection("catches").doc(id).update({ approved: true });
      loadPendingCatches();
      loadRanking();
      loadUserCatches();
    });
  });
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".delete-catch-btn");
  if (!btn) return;

  const id = btn.dataset.id;

  if (!confirm("Na pewno usunąć zgłoszenie?")) return;

  await db.collection("catches").doc(id).delete();

  // odświeżanie wszystkich miejsc, gdzie zgłoszenia mogą się pojawić
  loadPendingCatches();
  loadUserCatches();
  loadRanking();

  if (openedProfileUid) {
    openUserProfile(openedProfileUid);
  }

  // jeśli jesteśmy w profilu użytkownika – odśwież profil
  const profileView = document.getElementById("profile-view");
  if (!profileView.hidden) {
    const uid = document.querySelector(".user-card.active")?.dataset.uid;
    if (uid) openUserProfile(uid);
  }
});

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

// GŁÓWNE PRZYCISKI NAWIGACJI
navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const view = btn.dataset.view;
    setActiveView(view);

    if (view === "ranking-view") loadRanking();

    if (view === "admin-view" && currentUser?.isAdmin) {
      loadInvites();
      loadSpecies();
      loadPendingCatches();
    }

    if (view === "users-view") loadUsers();

    if (view === "weather-widget-view") loadWeatherWidget();

    if (view === "notifications-view") {
      hasNewNotifications = false;
      updateBellIcon();
      loadNotificationsWidget();
    }
  });
});

// PŁYWAJĄCE PRZYCISKI (nav-circle)
document.querySelectorAll(".nav-circle[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!currentUser) return;

    const view = btn.dataset.view;
    setActiveView(view);

    if (view === "weather-widget-view") loadWeatherWidget();

    if (view === "notifications-view") {
      hasNewNotifications = false;
      updateBellIcon();
      loadNotificationsWidget();
    }
  });
});

// =====================================
// ZAKŁADKI W PANELU ADMINA (TOKENS / SPECIES)
// =====================================
const adminTabs = document.querySelectorAll(".folder-btn");

adminTabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    const group = btn.dataset.group;
    const target = btn.dataset.target;

    adminTabs.forEach((b) => {
      if (b.dataset.group === group) {
        b.classList.toggle("active", b === btn);
      }
    });

    document
      .querySelectorAll(`.tab-section[data-group="${group}"]`)
      .forEach((sec) => {
        sec.hidden = sec.id !== target;
      });
  });
});

// ===============================
// POWIADOMIENIA – STAN I IKONA
// ===============================
function updateBellIcon() {
  const bell = document.getElementById("bell-icon");
  if (!bell) return;
  bell.classList.remove("new", "read");
  bell.classList.add(hasNewNotifications ? "new" : "read");
}

updateBellIcon();

// ===============================
// POWIADOMIENIA – FIRESTORE
// ===============================
async function loadNotifications() {
  const snap = await db
    .collection("notifications")
    .orderBy("date", "desc")
    .get();

  notifications = [];
  snap.forEach((doc) => {
    notifications.push({ id: doc.id, ...doc.data() });
  });

  renderNotifications();
}

function loadNotificationsWidget() {
  if (!notificationsWidgetLoaded) {
    notificationsWidgetLoaded = true;

    if (currentUser?.isAdmin) {
      const panel = document.getElementById("notif-admin-panel");
      if (panel) panel.hidden = false;
    }
  }

  loadNotifications();
}

// formularz dodawania powiadomień (admin)
if (notifForm) {
  notifForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("notif-title").value.trim();
    const body = document.getElementById("notif-body").value.trim();

    if (!title || !body) return;

    await db.collection("notifications").add({
      title,
      body,
      date: new Date().toISOString(),
    });

    hasNewNotifications = true;
    updateBellIcon();

    notifForm.reset();
    loadNotifications();
  });
}

// ===============================
// POWIADOMIENIA – RENDER
// ===============================
function renderNotifications() {
  const list = document.getElementById("notifications-list");
  if (!list) return;

  list.innerHTML = "";

  notifications.forEach((n) => {
    const item = document.createElement("div");
    item.classList.add("notif-item");
    item.innerHTML = `
      <h3>${n.title}</h3>
      <p class="notif-date">${formatDate(n.date)}</p>
    `;
    item.addEventListener("click", () => openNotification(n.id));
    list.appendChild(item);
  });
}

function openNotification(id) {
  const notif = notifications.find((n) => n.id === id);
  if (!notif) return;

  const list = document.getElementById("notifications-list");
  if (!list) return;

  list.innerHTML = `
    <div class="notif-details">
      <h3>${notif.title}</h3>
      <p class="notif-date">${formatDate(notif.date)}</p>
      <p>${notif.body}</p>

      <div class="notif-actions">
        <span id="delete-notif" class="material-icons">delete</span>
        <button id="back-to-list">Powrót</button>
      </div>
    </div>
  `;

  document
    .getElementById("delete-notif")
    .addEventListener("click", async () => {
      await db.collection("notifications").doc(id).delete();
      notifications = notifications.filter((n) => n.id !== id);
      renderNotifications();
    });

  document.getElementById("back-to-list").addEventListener("click", () => {
    renderNotifications();
  });
}

// ===============================
// WIDŻET POGODA
// ===============================
function loadWeatherWidget() {
  if (weatherWidgetLoaded) return;
  weatherWidgetLoaded = true;

  const API_KEY = "c13a9d52a5f94490b54121129260102";
  const CITY = "Boleslawiec";

  fetch(
    `https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${CITY}&days=1&aqi=no&alerts=no`
  )
    .then((res) => res.json())
    .then((data) => {
      if (!data || !data.forecast) {
        console.error("Błąd API:", data);
        return;
      }

      const c = data.current;
      const astro = data.forecast.forecastday[0].astro;

      const weatherIcons = {
        1000: "☀️",
        1003: "🌤️",
        1006: "☁️",
        1009: "🌥️",
        1030: "🌫️",
        1063: "🌦️",
        1180: "🌧️",
        1195: "🌧️",
        1210: "🌨️",
        1225: "❄️",
        1276: "⛈️",
      };

      const weatherIcon = weatherIcons[c.condition.code] || "🌡️";
      document.getElementById("w-icon").textContent = weatherIcon;

      const moonIcons = {
        "New Moon": "🌑",
        "Waxing Crescent": "🌒",
        "First Quarter": "🌓",
        "Waxing Gibbous": "🌔",
        "Full Moon": "🌕",
        "Waning Gibbous": "🌖",
        "Last Quarter": "🌗",
        "Waning Crescent": "🌘",
      };

      const moonIcon = moonIcons[astro.moon_phase] || "🌙";
      document.getElementById("w-moon-icon").textContent = moonIcon;

      document.getElementById("w-temp").textContent = c.temp_c + "°C";
      document.getElementById("w-feels").textContent = c.feelslike_c + "°C";
      document.getElementById("w-wind").textContent = c.wind_kph + " km/h";
      document.getElementById("w-winddir").textContent = c.wind_dir;
      document.getElementById("w-pressure").textContent =
        c.pressure_mb + " hPa";
      document.getElementById("w-humidity").textContent = c.humidity + "%";
      document.getElementById("w-cloud").textContent = c.cloud + "%";
      document.getElementById("w-visibility").textContent = c.vis_km + " km";
      document.getElementById("w-dew").textContent = c.dewpoint_c + "°C";

      const moonPhasePL = {
        "New Moon": "Nów",
        "Waxing Crescent": "Przybywający sierp",
        "First Quarter": "Pierwsza kwadra",
        "Waxing Gibbous": "Przybywający garb",
        "Full Moon": "Pełnia",
        "Waning Gibbous": "Ubywający garb",
        "Last Quarter": "Ostatnia kwadra",
        "Waning Crescent": "Ubywający sierp",
      };

      document.getElementById("w-moon").textContent =
        moonPhasePL[astro.moon_phase] || astro.moon_phase;

      document.getElementById("w-fish").textContent = fishActivity(c, astro);

      drawWeatherHourlyChart(data.forecast.forecastday[0].hour);
    })
    .catch((err) => {
      console.error("Błąd pobierania danych pogodowych:", err);
    });
}

// =====================================
// ALGORYTM AKTYWNOŚCI RYB
// =====================================
function fishActivity(c, astro) {
  let score = 0;

  if (astro.moon_illumination > 60) score++;
  if (c.wind_kph < 15) score++;
  if (c.pressure_mb > 1010) score++;
  if (c.cloud < 60) score++;

  return "★".repeat(score) + "☆".repeat(4 - score);
}

// =====================================
// WYKRES TEMPERATURY
// =====================================
function drawWeatherHourlyChart(hours) {
  const ctx = document.getElementById("w-hourly-chart");

  new Chart(ctx, {
    type: "line",
    data: {
      labels: hours.map((h) => h.time.split(" ")[1]),
      datasets: [
        {
          label: "Temp °C",
          data: hours.map((h) => h.temp_c),
          borderColor: "#f4c542",
          backgroundColor: "transparent",
          borderWidth: 2,
          tension: 0.3,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#888" } },
        y: { ticks: { color: "#888" } },
      },
    },
  });
}

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
      <td>
  ${
    c.approved
      ? `<span class="material-icons approve-icon">thumb_up</span>`
      : `<span class="material-icons pending-icon">hourglass_empty</span>`
  }
</td>

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

  const usedBody = document.getElementById("used-invites-body");
  usedBody.innerHTML = "";

  const baseUrl = window.location.origin + window.location.pathname;

  snap.forEach((doc) => {
    const data = doc.data();
    const token = doc.id;
    const link = `${baseUrl}?invite=${token}`;

    if (data.used) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${token}</td>
        <td>${data.createdAt ? formatDate(data.createdAt) : "-"}</td>

      `;
      usedBody.appendChild(tr);
      return;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${token}</td>
      <td>nie</td>
      <td>
        <button class="copy-btn btn primary" data-link="${link}">Kopiuj link</button>
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
  openedProfileUid = uid;

  const userDoc = await db.collection("users").doc(uid).get();
  const user = userDoc.data();

  const catchesSnap = await db.collection("catches").get();
  const speciesSnap = await db.collection("species").get();

  const speciesMap = {};
  speciesSnap.forEach((doc) => (speciesMap[doc.id] = doc.data().name));

  const catches = [];
  catchesSnap.forEach((doc) => {
    const c = doc.data();
    if (c.userId === uid && c.approved) {
      catches.push({ id: doc.id, ...c });
    }
  });

  const totalPoints = catches.reduce((sum, c) => sum + c.points, 0);
  const count = catches.length;

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
      ${
        currentUser?.isAdmin
          ? `<td>
          <button class="delete-catch-btn" data-id="${c.id}">
            <span class="material-icons delete-icon">delete</span>
          </button>
        </td>
        `
          : ""
      }
    `;

    tbody.appendChild(tr);

    if (currentUser?.isAdmin) {
    }
  });

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
