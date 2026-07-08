const DB_NAME = "trackedLogDB";
const DB_VERSION = 1;
const STORE_NAME = "entries";
const SETTINGS_STORE = "settings";
const LAST_BACKUP_KEY = "lastBackupAt";

let db;
let mode = "one";
let editingId = null;
let selectedWeekDate = todayISO();

const $ = id => document.getElementById(id);

const openEntryBtn = $("openEntryBtn");
const fabBtn = $("fabBtn");
const entrySheet = $("entrySheet");
const closeSheetBtn = $("closeSheetBtn");
const closeSheetBackdrop = $("closeSheetBackdrop");
const sheetTitle = $("sheetTitle");

const entryDate = $("entryDate");
const oneRoundBtn = $("oneRoundBtn");
const twoRoundBtn = $("twoRoundBtn");
const roundTwoBox = $("roundTwoBox");

const roundOneName = $("roundOneName");
const roundOneTracked = $("roundOneTracked");
const roundTwoName = $("roundTwoName");
const roundTwoTracked = $("roundTwoTracked");
const notes = $("notes");

const saveBtn = $("saveBtn");
const clearFormBtn = $("clearFormBtn");
const historyList = $("historyList");
const historyFilter = $("historyFilter");

const headlineLabel = $("headlineLabel");
const headlineTotal = $("headlineTotal");
const headlineMessage = $("headlineMessage");
const insightsList = $("insightsList");

const weekTotal = $("weekTotal");
const weekAverage = $("weekAverage");
const weekAverageChange = $("weekAverageChange");
const bestDayEver = $("bestDayEver");
const oneRoundAverage = $("oneRoundAverage");
const twoRoundAverage = $("twoRoundAverage");
const daysLogged = $("daysLogged");
const loggingStreak = $("loggingStreak");

const highestOneRound = $("highestOneRound");
const highestTwoRound = $("highestTwoRound");
const bestWeek = $("bestWeek");
const lifetimeTotal = $("lifetimeTotal");

const prevWeekBtn = $("prevWeekBtn");
const nextWeekBtn = $("nextWeekBtn");
const weekTitle = $("weekTitle");
const weekRange = $("weekRange");

const exportBtn = $("exportBtn");
const importFile = $("importFile");
const backupStatus = $("backupStatus");
const toast = $("toast");

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(new Error("Database failed to open"));

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = event => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("date", "date", { unique: true });
        store.createIndex("mode", "mode", { unique: false });
      }

      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
    };
  });
}

function txStore(storeName, modeType) {
  return db.transaction(storeName, modeType).objectStore(storeName);
}

function saveEntry(entry) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function getAllEntries() {
  return new Promise((resolve, reject) => {
    const request = txStore(STORE_NAME, "readonly").getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function deleteEntry(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function saveSetting(key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, "readwrite");
    tx.objectStore(SETTINGS_STORE).put({ key, value });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function getSetting(key) {
  return new Promise((resolve, reject) => {
    const request = txStore(SETTINGS_STORE, "readonly").get(key);
    request.onsuccess = () => resolve(request.result ? request.result.value : null);
    request.onerror = () => reject(request.error);
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function openSheet() {
  entrySheet.classList.remove("hidden");
  entrySheet.setAttribute("aria-hidden", "false");
  setTimeout(() => roundOneTracked.focus(), 120);
}

function closeSheet() {
  entrySheet.classList.add("hidden");
  entrySheet.setAttribute("aria-hidden", "true");
}

function setMode(newMode) {
  mode = newMode;

  oneRoundBtn.classList.toggle("active", mode === "one");
  twoRoundBtn.classList.toggle("active", mode === "two");
  roundTwoBox.classList.toggle("hidden", mode === "one");

  saveSetting("defaultMode", mode).catch(console.error);
}

function getStartOfWeek(dateString) {
  const date = new Date(dateString + "T00:00:00");
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);

  return date;
}

function getWeekKey(dateString) {
  return getStartOfWeek(dateString).toISOString().slice(0, 10);
}

function isSameWeek(dateString, referenceDateString) {
  return getWeekKey(dateString) === getWeekKey(referenceDateString);
}

function formatShortDate(date) {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });
}

function formatRangeDate(date) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short"
  });
}

function formatChange(change) {
  if (change > 0) return { text: `Up ${change}`, className: "good-text" };
  if (change < 0) return { text: `Down ${Math.abs(change)}`, className: "bad-text" };
  return { text: "No change", className: "" };
}

function average(entries) {
  if (!entries.length) return 0;
  return Math.round(entries.reduce((sum, entry) => sum + entry.totalTracked, 0) / entries.length);
}

function sum(entries) {
  return entries.reduce((total, entry) => total + entry.totalTracked, 0);
}

function updateWeekNav() {
  const start = getStartOfWeek(selectedWeekDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const todayStart = getStartOfWeek(todayISO());

  weekTitle.textContent =
    start.toDateString() === todayStart.toDateString()
      ? "This Week"
      : "Selected Week";

  weekRange.textContent = `${formatRangeDate(start)} - ${formatRangeDate(end)}`;
}

function changeWeek(amount) {
  const date = new Date(selectedWeekDate + "T00:00:00");
  date.setDate(date.getDate() + amount * 7);
  selectedWeekDate = date.toISOString().slice(0, 10);
  refreshUI();
}

function makeEntryFromForm() {
  const date = entryDate.value;
  const r1Name = roundOneName.value.trim() || "Round 1";
  const r1Tracked = Number(roundOneTracked.value) || 0;
  const r2Name = roundTwoName.value.trim() || "Round 2";
  const r2Tracked = mode === "two" ? Number(roundTwoTracked.value) || 0 : 0;

  if (!date) throw new Error("Pick a date first.");
  if (r1Tracked < 0 || r2Tracked < 0) throw new Error("Tracked items cannot be negative.");
  if (r1Tracked === 0 && r2Tracked === 0) throw new Error("Enter at least one tracked item count.");

  return {
    id: editingId || crypto.randomUUID(),
    date,
    mode,
    roundOneName: r1Name,
    roundOneTracked: r1Tracked,
    roundTwoName: mode === "two" ? r2Name : "",
    roundTwoTracked: r2Tracked,
    totalTracked: r1Tracked + r2Tracked,
    notes: notes.value.trim(),
    updatedAt: new Date().toISOString()
  };
}

async function handleSave() {
  try {
    const entry = makeEntryFromForm();

    await saveEntry(entry);
    await saveSetting("roundOneName", entry.roundOneName);
    if (entry.mode === "two") await saveSetting("roundTwoName", entry.roundTwoName);

    selectedWeekDate = entry.date;
    editingId = null;
    saveBtn.textContent = "Save Day";
    sheetTitle.textContent = "Add Day";

    await clearForm(false);
    await refreshUI();

    closeSheet();
    showToast("Day saved");
  } catch (error) {
    alert(error.message || "Could not save entry.");
  }
}

async function clearForm(resetDate = true) {
  if (resetDate) entryDate.value = todayISO();

  roundOneTracked.value = "";
  roundTwoTracked.value = "";
  notes.value = "";
  editingId = null;
  saveBtn.textContent = "Save Day";
  sheetTitle.textContent = "Add Day";

  const savedR1 = await getSetting("roundOneName");
  const savedR2 = await getSetting("roundTwoName");

  if (savedR1) roundOneName.value = savedR1;
  if (savedR2) roundTwoName.value = savedR2;
}

async function refreshUI() {
  const entries = await getAllEntries();
  const cleanEntries = entries
    .map(normaliseEntry)
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  renderDashboard(cleanEntries);
  renderHistory(cleanEntries);
  renderBackupStatus();
}

function normaliseEntry(entry) {
  if (!entry || !entry.date) return null;

  const roundOneTracked = Number(entry.roundOneTracked) || 0;
  const roundTwoTracked = Number(entry.roundTwoTracked) || 0;

  return {
    ...entry,
    mode: entry.mode === "two" ? "two" : "one",
    roundOneTracked,
    roundTwoTracked,
    totalTracked: Number(entry.totalTracked) || roundOneTracked + roundTwoTracked
  };
}

function renderDashboard(entries) {
  updateWeekNav();

  const today = todayISO();
  const todayEntry = entries.find(entry => entry.date === today);
  const selectedWeekEntries = entries.filter(entry => isSameWeek(entry.date, selectedWeekDate));

  renderHeadline(entries, todayEntry);
  renderInsights(entries, todayEntry, selectedWeekEntries);

  const thisWeekTotal = sum(selectedWeekEntries);
  const thisWeekAverage = average(selectedWeekEntries);

  const previousWeekDate = new Date(selectedWeekDate + "T00:00:00");
  previousWeekDate.setDate(previousWeekDate.getDate() - 7);
  const previousWeekEntries = entries.filter(entry => isSameWeek(entry.date, previousWeekDate.toISOString().slice(0, 10)));
  const previousAverage = average(previousWeekEntries);
  const averageDiff = previousAverage ? thisWeekAverage - previousAverage : null;

  weekTotal.textContent = thisWeekTotal;
  weekAverage.textContent = thisWeekAverage;

  weekAverageChange.className = "";
  if (averageDiff === null) {
    weekAverageChange.textContent = "—";
  } else {
    const result = formatChange(averageDiff);
    weekAverageChange.textContent = result.text;
    if (result.className) weekAverageChange.classList.add(result.className);
  }

  const bestDay = getHighest(entries);
  bestDayEver.textContent = bestDay ? bestDay.totalTracked : 0;

  const oneRoundWeek = selectedWeekEntries.filter(entry => entry.mode === "one");
  const twoRoundWeek = selectedWeekEntries.filter(entry => entry.mode === "two");

  oneRoundAverage.textContent = average(oneRoundWeek);
  twoRoundAverage.textContent = average(twoRoundWeek);

  daysLogged.textContent = entries.length;
  loggingStreak.textContent = `${calculateStreak(entries)}d`;

  const highestOne = getHighest(entries.filter(entry => entry.mode === "one"));
  const highestTwo = getHighest(entries.filter(entry => entry.mode === "two"));

  highestOneRound.textContent = highestOne ? `${highestOne.totalTracked}` : "0";
  highestTwoRound.textContent = highestTwo ? `${highestTwo.totalTracked}` : "0";

  const bestWeekData = getBestWeek(entries);
  bestWeek.textContent = bestWeekData ? `${bestWeekData.total}` : "0";

  lifetimeTotal.textContent = sum(entries);
}

function renderHeadline(entries, todayEntry) {
  headlineLabel.textContent = "Today";
  headlineTotal.textContent = todayEntry ? todayEntry.totalTracked : 0;

  if (!entries.length) {
    headlineMessage.textContent = "No entries yet. Tap + Add Day to start.";
    return;
  }

  if (!todayEntry) {
    const lastEntry = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    headlineMessage.textContent = `Last entry was ${lastEntry.totalTracked} on ${formatShortDate(new Date(lastEntry.date + "T00:00:00"))}.`;
    return;
  }

  const previousEntries = entries
    .filter(entry => entry.date < todayEntry.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!previousEntries.length) {
    headlineMessage.textContent = "First saved day. Now you have a baseline.";
    return;
  }

  const diff = todayEntry.totalTracked - previousEntries[0].totalTracked;
  headlineMessage.textContent = `${formatChange(diff).text} from your previous logged day.`;
}

function renderInsights(entries, todayEntry, selectedWeekEntries) {
  insightsList.innerHTML = "";

  if (!entries.length) {
    addInsight("Start logging", "Add your first day and the dashboard will start finding records and trends.", "");
    return;
  }

  const sortedOldest = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
  const highest = getHighest(entries);

  if (todayEntry && highest && todayEntry.id === highest.id && entries.length > 1) {
    addInsight("🏆 New highest day so far", `${todayEntry.totalTracked} tracked items is your best recorded day.`, "gold");
  } else if (highest) {
    addInsight("🏆 Highest day so far", `${highest.totalTracked} tracked items on ${formatShortDate(new Date(highest.date + "T00:00:00"))}.`, "gold");
  }

  if (todayEntry) {
    const sameWeekdayPast = entries
      .filter(entry => entry.date < todayEntry.date && new Date(entry.date + "T00:00:00").getDay() === new Date(todayEntry.date + "T00:00:00").getDay());

    const sameDayAvg = average(sameWeekdayPast);

    if (sameDayAvg) {
      const diff = todayEntry.totalTracked - sameDayAvg;
      const result = formatChange(diff);
      addInsight("Compared with this weekday average", `${result.text} versus your usual ${sameDayAvg}.`, diff >= 0 ? "good" : "bad");
    }
  }

  const selectedWeekAvg = average(selectedWeekEntries);
  const lastFourWeekAverage = getLastNWeeksAverage(entries, selectedWeekDate, 4);

  if (selectedWeekAvg && lastFourWeekAverage) {
    const diff = selectedWeekAvg - lastFourWeekAverage;
    const result = formatChange(diff);
    addInsight("Weekly trend", `${result.text} compared with your previous 4-week average of ${lastFourWeekAverage}.`, diff >= 0 ? "good" : "bad");
  }

  const streak = calculateStreak(entries);
  if (streak >= 3) {
    addInsight("🔥 Logging streak", `${streak} consecutive days logged up to your latest entry.`, "good");
  }

  const bestWeekData = getBestWeek(entries);
  if (bestWeekData) {
    const start = new Date(bestWeekData.week + "T00:00:00");
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    addInsight("Best week", `${bestWeekData.total} tracked items from ${formatRangeDate(start)} - ${formatRangeDate(end)}.`, "");
  }

  if (insightsList.children.length === 0) {
    addInsight("Keep collecting data", "After a few entries, this section will show records, streaks, weekday comparisons and trends.", "");
  }
}

function addInsight(title, message, type) {
  const div = document.createElement("div");
  div.className = `insight ${type || ""}`;
  div.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <p>${escapeHtml(message)}</p>
  `;
  insightsList.appendChild(div);
}

function getHighest(entries) {
  if (!entries.length) return null;
  return entries.reduce((best, entry) => entry.totalTracked > best.totalTracked ? entry : best, entries[0]);
}

function getBestWeek(entries) {
  if (!entries.length) return null;

  const weeks = new Map();

  for (const entry of entries) {
    const key = getWeekKey(entry.date);
    weeks.set(key, (weeks.get(key) || 0) + entry.totalTracked);
  }

  let best = null;

  for (const [week, total] of weeks.entries()) {
    if (!best || total > best.total) {
      best = { week, total };
    }
  }

  return best;
}

function getLastNWeeksAverage(entries, referenceDateString, numberOfWeeks) {
  const referenceStart = getStartOfWeek(referenceDateString);
  const weekTotals = [];

  for (let i = 1; i <= numberOfWeeks; i++) {
    const weekDate = new Date(referenceStart);
    weekDate.setDate(referenceStart.getDate() - i * 7);
    const key = weekDate.toISOString().slice(0, 10);
    const weekEntries = entries.filter(entry => isSameWeek(entry.date, key));

    if (weekEntries.length) {
      weekTotals.push(average(weekEntries));
    }
  }

  if (!weekTotals.length) return 0;

  return Math.round(weekTotals.reduce((total, value) => total + value, 0) / weekTotals.length);
}

function calculateStreak(entries) {
  if (!entries.length) return 0;

  const dates = new Set(entries.map(entry => entry.date));
  const sorted = [...dates].sort((a, b) => new Date(b) - new Date(a));
  let current = new Date(sorted[0] + "T00:00:00");
  let streak = 0;

  while (dates.has(current.toISOString().slice(0, 10))) {
    streak++;
    current.setDate(current.getDate() - 1);
  }

  return streak;
}

function renderHistory(entries) {
  const filter = historyFilter.value;
  let visibleEntries = [...entries];

  if (filter === "selected-week") {
    visibleEntries = visibleEntries.filter(entry => isSameWeek(entry.date, selectedWeekDate));
  }

  if (filter === "one" || filter === "two") {
    visibleEntries = visibleEntries.filter(entry => entry.mode === filter);
  }

  historyList.innerHTML = "";

  if (visibleEntries.length === 0) {
    historyList.innerHTML = "<p class='hint'>No entries found.</p>";
    return;
  }

  visibleEntries.forEach(entry => {
    const div = document.createElement("div");
    div.className = "entry";

    const dateObj = new Date(entry.date + "T00:00:00");
    const modeLabel = entry.mode === "two" ? "Two rounds" : "One round";

    div.innerHTML = `
      <div class="entry-top">
        <div>
          <div class="entry-date">${formatShortDate(dateObj)}</div>
          <small>${modeLabel}</small>
        </div>
        <div class="entry-total">${entry.totalTracked}</div>
      </div>

      <small>
        ${escapeHtml(entry.roundOneName)}: ${entry.roundOneTracked}
        ${entry.mode === "two" ? ` | ${escapeHtml(entry.roundTwoName)}: ${entry.roundTwoTracked}` : ""}
      </small>

      ${entry.notes ? `<p class="entry-note">${escapeHtml(entry.notes)}</p>` : ""}

      <div class="entry-actions">
        <button type="button" class="edit">Edit</button>
        <button type="button" class="delete">Delete</button>
      </div>
    `;

    div.querySelector(".edit").addEventListener("click", () => loadForEdit(entry));
    div.querySelector(".delete").addEventListener("click", async () => {
      if (confirm("Delete this entry?")) {
        await deleteEntry(entry.id);
        await refreshUI();
        showToast("Entry deleted");
      }
    });

    historyList.appendChild(div);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadForEdit(entry) {
  editingId = entry.id;
  entryDate.value = entry.date;
  selectedWeekDate = entry.date;

  setMode(entry.mode);

  roundOneName.value = entry.roundOneName || "";
  roundOneTracked.value = entry.roundOneTracked || "";
  roundTwoName.value = entry.roundTwoName || "";
  roundTwoTracked.value = entry.roundTwoTracked || "";
  notes.value = entry.notes || "";

  saveBtn.textContent = "Update Day";
  sheetTitle.textContent = "Edit Day";

  refreshUI();
  openSheet();
}

async function exportBackup() {
  const entries = await getAllEntries();

  const backup = {
    app: "Tracked Log",
    version: 2,
    exportedAt: new Date().toISOString(),
    entries
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `tracked-log-backup-${todayISO()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);

  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  renderBackupStatus();
  showToast("Backup exported");
}

function importBackup(file) {
  const reader = new FileReader();

  reader.onload = async event => {
    try {
      const backup = JSON.parse(event.target.result);

      if (!backup.entries || !Array.isArray(backup.entries)) {
        alert("Invalid backup file.");
        return;
      }

      for (const rawEntry of backup.entries) {
        const entry = normaliseEntry(rawEntry);

        if (entry && entry.id && entry.date) {
          await saveEntry({
            ...entry,
            updatedAt: entry.updatedAt || new Date().toISOString()
          });
        }
      }

      await refreshUI();
      showToast("Backup imported");
    } catch {
      alert("Could not import backup.");
    } finally {
      importFile.value = "";
    }
  };

  reader.readAsText(file);
}

function renderBackupStatus() {
  const last = localStorage.getItem(LAST_BACKUP_KEY);

  if (!last) {
    backupStatus.textContent = "No backup yet";
    return;
  }

  const diffMs = Date.now() - new Date(last).getTime();
  const diffHours = Math.floor(diffMs / 36e5);
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) backupStatus.textContent = "Backed up just now";
  else if (diffHours < 24) backupStatus.textContent = `Backed up ${diffHours}h ago`;
  else backupStatus.textContent = `Backed up ${diffDays}d ago`;
}

openEntryBtn.addEventListener("click", async () => {
  await clearForm(true);
  openSheet();
});

fabBtn.addEventListener("click", async () => {
  await clearForm(true);
  openSheet();
});

closeSheetBtn.addEventListener("click", closeSheet);
closeSheetBackdrop.addEventListener("click", closeSheet);

oneRoundBtn.addEventListener("click", () => setMode("one"));
twoRoundBtn.addEventListener("click", () => setMode("two"));

saveBtn.addEventListener("click", handleSave);

clearFormBtn.addEventListener("click", async () => {
  await clearForm(true);
  showToast("Form cleared");
});

entryDate.addEventListener("change", () => {
  selectedWeekDate = entryDate.value || todayISO();
  refreshUI();
});

prevWeekBtn.addEventListener("click", () => changeWeek(-1));
nextWeekBtn.addEventListener("click", () => changeWeek(1));

historyFilter.addEventListener("change", refreshUI);

exportBtn.addEventListener("click", exportBackup);

importFile.addEventListener("change", event => {
  const file = event.target.files[0];
  if (file) importBackup(file);
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeSheet();
});

async function init() {
  try {
    await openDB();

    entryDate.value = todayISO();

    const savedMode = await getSetting("defaultMode");
    const savedR1 = await getSetting("roundOneName");
    const savedR2 = await getSetting("roundTwoName");

    if (savedR1) roundOneName.value = savedR1;
    if (savedR2) roundTwoName.value = savedR2;

    setMode(savedMode === "two" ? "two" : "one");

    await refreshUI();
  } catch (error) {
    console.error(error);
    alert("The app could not start. Check that IndexedDB is available in this browser.");
  }
}

init();
