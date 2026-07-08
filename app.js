const DB_NAME = "trackedLogDB";
const DB_VERSION = 3;
const STORE_NAME = "entries";
const SETTINGS_STORE = "settings";
const LAST_BACKUP_KEY = "lastBackupAt";

const DEFAULT_SETTINGS = {
  workingDays: [1, 2, 3, 4, 5, 6],
  defaultMode: "one",
  roundOneName: "Round 1",
  roundTwoName: "Round 2"
};

let db;
let settings = { ...DEFAULT_SETTINGS };
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

const openSettingsBtn = $("openSettingsBtn");
const settingsSheet = $("settingsSheet");
const closeSettingsBtn = $("closeSettingsBtn");
const closeSettingsBackdrop = $("closeSettingsBackdrop");
const saveSettingsBtn = $("saveSettingsBtn");
const workdayPicker = $("workdayPicker");
const defaultMode = $("defaultMode");
const defaultRoundOneName = $("defaultRoundOneName");
const defaultRoundTwoName = $("defaultRoundTwoName");

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
const weekCompletion = $("weekCompletion");
const missedWorkdays = $("missedWorkdays");

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
      let entryStore;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        entryStore = database.createObjectStore(STORE_NAME, { keyPath: "id" });
      } else {
        entryStore = event.target.transaction.objectStore(STORE_NAME);
      }

      if (!entryStore.indexNames.contains("date")) entryStore.createIndex("date", "date", { unique: true });
      if (!entryStore.indexNames.contains("mode")) entryStore.createIndex("mode", "mode", { unique: false });

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
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains(SETTINGS_STORE)) return resolve();
    const tx = db.transaction(SETTINGS_STORE, "readwrite");
    tx.objectStore(SETTINGS_STORE).put({ key, value });
    tx.oncomplete = resolve;
    tx.onerror = () => resolve();
  });
}

function getSetting(key) {
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains(SETTINGS_STORE)) return resolve(null);
    const request = txStore(SETTINGS_STORE, "readonly").get(key);
    request.onsuccess = () => resolve(request.result ? request.result.value : null);
    request.onerror = () => resolve(null);
  });
}

async function loadSettings() {
  const saved = await getSetting("appSettings");
  settings = {
    ...DEFAULT_SETTINGS,
    ...(saved || {})
  };

  if (!Array.isArray(settings.workingDays) || settings.workingDays.length === 0) {
    settings.workingDays = [...DEFAULT_SETTINGS.workingDays];
  }
}

async function persistSettings() {
  await saveSetting("appSettings", settings);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
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

function openSettings() {
  renderSettingsForm();
  settingsSheet.classList.remove("hidden");
  settingsSheet.setAttribute("aria-hidden", "false");
}

function closeSettings() {
  settingsSheet.classList.add("hidden");
  settingsSheet.setAttribute("aria-hidden", "true");
}

function setMode(newMode, saveAsDefault = false) {
  mode = newMode === "two" ? "two" : "one";
  oneRoundBtn.classList.toggle("active", mode === "one");
  twoRoundBtn.classList.toggle("active", mode === "two");
  roundTwoBox.classList.toggle("hidden", mode === "one");

  if (saveAsDefault) {
    settings.defaultMode = mode;
    persistSettings().catch(console.error);
  }
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

function isWorkingDay(dateString) {
  const day = new Date(dateString + "T00:00:00").getDay();
  return settings.workingDays.includes(day);
}

function formatShortDate(date) {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatRangeDate(date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
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

  weekTitle.textContent = start.toDateString() === todayStart.toDateString() ? "This Week" : "Selected Week";
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

  roundOneName.value = settings.roundOneName || "Round 1";
  roundTwoName.value = settings.roundTwoName || "Round 2";
  roundOneTracked.value = "";
  roundTwoTracked.value = "";
  notes.value = "";

  editingId = null;
  saveBtn.textContent = "Save Day";
  sheetTitle.textContent = "Add Day";
  setMode(settings.defaultMode);
}

async function refreshUI() {
  const entries = await getAllEntries();
  const cleanEntries = entries.map(normaliseEntry).filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date));
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
  const selectedWeekWorkingEntries = selectedWeekEntries.filter(entry => isWorkingDay(entry.date));

  renderHeadline(entries, todayEntry);
  renderInsights(entries, todayEntry, selectedWeekEntries);

  const thisWeekTotal = sum(selectedWeekEntries);
  const thisWeekAverage = average(selectedWeekWorkingEntries.length ? selectedWeekWorkingEntries : selectedWeekEntries);

  const previousWeekDate = new Date(selectedWeekDate + "T00:00:00");
  previousWeekDate.setDate(previousWeekDate.getDate() - 7);
  const previousWeekEntries = entries.filter(entry => isSameWeek(entry.date, previousWeekDate.toISOString().slice(0, 10)) && isWorkingDay(entry.date));
  const previousAverage = average(previousWeekEntries);
  const averageDiff = previousAverage ? thisWeekAverage - previousAverage : null;

  weekTotal.textContent = thisWeekTotal;
  weekAverage.textContent = thisWeekAverage;

  weekAverageChange.className = "";
  if (averageDiff === null) weekAverageChange.textContent = "—";
  else {
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

  const workdayEntries = entries.filter(entry => isWorkingDay(entry.date));
  daysLogged.textContent = workdayEntries.length;
  loggingStreak.textContent = `${calculateWorkdayStreak(entries)}d`;

  const completion = getWeekCompletion(entries, selectedWeekDate);
  weekCompletion.textContent = `${completion.logged}/${completion.expected}`;
  missedWorkdays.textContent = calculateMissedWorkdays(entries);

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

  if (!isWorkingDay(todayISO())) {
    headlineMessage.textContent = "Today is not in your selected working days, so it will not break your streak.";
    return;
  }

  if (!todayEntry) {
    const lastEntry = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    headlineMessage.textContent = `Last entry was ${lastEntry.totalTracked} on ${formatShortDate(new Date(lastEntry.date + "T00:00:00"))}.`;
    return;
  }

  const previousEntries = entries.filter(entry => entry.date < todayEntry.date).sort((a, b) => new Date(b.date) - new Date(a.date));

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

  const highest = getHighest(entries);

  if (todayEntry && highest && todayEntry.id === highest.id && entries.length > 1) {
    addInsight("🏆 New highest day so far", `${todayEntry.totalTracked} tracked items is your best recorded day.`, "gold");
  } else if (highest) {
    addInsight("🏆 Highest day so far", `${highest.totalTracked} tracked items on ${formatShortDate(new Date(highest.date + "T00:00:00"))}.`, "gold");
  }

  const completion = getWeekCompletion(entries, selectedWeekDate);
  addInsight("Workday completion", `${completion.logged} of ${completion.expected} expected workdays logged for this selected week.`, completion.logged === completion.expected && completion.expected > 0 ? "good" : "");

  if (!isWorkingDay(todayISO())) {
    addInsight("Rest day ignored", "Today is not selected as a working day, so missing it will not break your streak.", "good");
  }

  if (todayEntry) {
    const sameWeekdayPast = entries.filter(entry =>
      entry.date < todayEntry.date &&
      new Date(entry.date + "T00:00:00").getDay() === new Date(todayEntry.date + "T00:00:00").getDay()
    );
    const sameDayAvg = average(sameWeekdayPast);

    if (sameDayAvg) {
      const diff = todayEntry.totalTracked - sameDayAvg;
      const result = formatChange(diff);
      addInsight("Compared with this weekday average", `${result.text} versus your usual ${sameDayAvg}.`, diff >= 0 ? "good" : "bad");
    }
  }

  const selectedWeekAvg = average(selectedWeekEntries.filter(entry => isWorkingDay(entry.date)));
  const lastFourWeekAverage = getLastNWeeksAverage(entries, selectedWeekDate, 4);

  if (selectedWeekAvg && lastFourWeekAverage) {
    const diff = selectedWeekAvg - lastFourWeekAverage;
    const result = formatChange(diff);
    addInsight("Weekly trend", `${result.text} compared with your previous 4-week workday average of ${lastFourWeekAverage}.`, diff >= 0 ? "good" : "bad");
  }

  const streak = calculateWorkdayStreak(entries);
  if (streak >= 3) addInsight("🔥 Workday streak", `${streak} consecutive scheduled workdays logged up to your latest working-day entry.`, "good");

  const bestWeekData = getBestWeek(entries);
  if (bestWeekData) {
    const start = new Date(bestWeekData.week + "T00:00:00");
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    addInsight("Best week", `${bestWeekData.total} tracked items from ${formatRangeDate(start)} - ${formatRangeDate(end)}.`, "");
  }
}

function addInsight(title, message, type) {
  const div = document.createElement("div");
  div.className = `insight ${type || ""}`;
  div.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p>`;
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
    if (!best || total > best.total) best = { week, total };
  }
  return best;
}

function getLastNWeeksAverage(entries, referenceDateString, numberOfWeeks) {
  const referenceStart = getStartOfWeek(referenceDateString);
  const weekAverages = [];

  for (let i = 1; i <= numberOfWeeks; i++) {
    const weekDate = new Date(referenceStart);
    weekDate.setDate(referenceStart.getDate() - i * 7);
    const key = weekDate.toISOString().slice(0, 10);
    const weekEntries = entries.filter(entry => isSameWeek(entry.date, key) && isWorkingDay(entry.date));
    if (weekEntries.length) weekAverages.push(average(weekEntries));
  }

  if (!weekAverages.length) return 0;
  return Math.round(weekAverages.reduce((total, value) => total + value, 0) / weekAverages.length);
}

function calculateWorkdayStreak(entries) {
  const loggedDates = new Set(entries.filter(entry => isWorkingDay(entry.date)).map(entry => entry.date));
  if (!loggedDates.size) return 0;

  const latestLogged = [...loggedDates].sort((a, b) => new Date(b) - new Date(a))[0];
  let cursor = new Date(latestLogged + "T00:00:00");
  let streak = 0;

  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (isWorkingDay(iso)) {
      if (!loggedDates.has(iso)) break;
      streak++;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getExpectedWorkdaysForWeek(referenceDateString) {
  const start = getStartOfWeek(referenceDateString);
  const today = new Date(todayISO() + "T00:00:00");
  const days = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    if (date > today) continue;
    const iso = date.toISOString().slice(0, 10);
    if (isWorkingDay(iso)) days.push(iso);
  }

  return days;
}

function getWeekCompletion(entries, referenceDateString) {
  const expected = getExpectedWorkdaysForWeek(referenceDateString);
  const loggedDates = new Set(entries.map(entry => entry.date));
  const logged = expected.filter(date => loggedDates.has(date)).length;
  return { expected: expected.length, logged };
}

function calculateMissedWorkdays(entries) {
  const workdayEntries = entries.filter(entry => isWorkingDay(entry.date));
  if (!workdayEntries.length) return 0;

  const loggedDates = new Set(entries.map(entry => entry.date));
  const firstDate = new Date(workdayEntries.sort((a, b) => new Date(a.date) - new Date(b.date))[0].date + "T00:00:00");
  const today = new Date(todayISO() + "T00:00:00");
  let missed = 0;
  const cursor = new Date(firstDate);

  while (cursor <= today) {
    const iso = cursor.toISOString().slice(0, 10);
    if (isWorkingDay(iso) && !loggedDates.has(iso)) missed++;
    cursor.setDate(cursor.getDate() + 1);
  }

  return missed;
}

function renderHistory(entries) {
  const filter = historyFilter.value;
  let visibleEntries = [...entries];

  if (filter === "selected-week") visibleEntries = visibleEntries.filter(entry => isSameWeek(entry.date, selectedWeekDate));
  if (filter === "one" || filter === "two") visibleEntries = visibleEntries.filter(entry => entry.mode === filter);

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
    const workdayNote = isWorkingDay(entry.date) ? "" : " • Non-working day";

    div.innerHTML = `
      <div class="entry-top">
        <div>
          <div class="entry-date">${formatShortDate(dateObj)}</div>
          <small>${modeLabel}${workdayNote}</small>
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

function renderSettingsForm() {
  defaultMode.value = settings.defaultMode;
  defaultRoundOneName.value = settings.roundOneName;
  defaultRoundTwoName.value = settings.roundTwoName;

  workdayPicker.querySelectorAll("input[type='checkbox']").forEach(input => {
    input.checked = settings.workingDays.includes(Number(input.value));
  });
}

async function saveSettingsFromForm() {
  const checkedDays = [...workdayPicker.querySelectorAll("input[type='checkbox']:checked")].map(input => Number(input.value));

  if (!checkedDays.length) {
    alert("Pick at least one working day.");
    return;
  }

  settings = {
    workingDays: checkedDays,
    defaultMode: defaultMode.value === "two" ? "two" : "one",
    roundOneName: defaultRoundOneName.value.trim() || "Round 1",
    roundTwoName: defaultRoundTwoName.value.trim() || "Round 2"
  };

  await persistSettings();
  await clearForm(false);
  await refreshUI();

  closeSettings();
  showToast("Settings saved");
}

async function exportBackup() {
  const entries = await getAllEntries();
  const backup = {
    app: "Tracked Log",
    version: 3,
    exportedAt: new Date().toISOString(),
    settings,
    entries
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
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

      if (backup.settings) {
        settings = { ...DEFAULT_SETTINGS, ...backup.settings };
        await persistSettings();
      }

      for (const rawEntry of backup.entries) {
        const entry = normaliseEntry(rawEntry);
        if (entry && entry.id && entry.date) {
          await saveEntry({ ...entry, updatedAt: entry.updatedAt || new Date().toISOString() });
        }
      }

      await clearForm(false);
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

openEntryBtn.addEventListener("click", async () => { await clearForm(true); openSheet(); });
fabBtn.addEventListener("click", async () => { await clearForm(true); openSheet(); });
closeSheetBtn.addEventListener("click", closeSheet);
closeSheetBackdrop.addEventListener("click", closeSheet);

openSettingsBtn.addEventListener("click", openSettings);
closeSettingsBtn.addEventListener("click", closeSettings);
closeSettingsBackdrop.addEventListener("click", closeSettings);
saveSettingsBtn.addEventListener("click", saveSettingsFromForm);

oneRoundBtn.addEventListener("click", () => setMode("one"));
twoRoundBtn.addEventListener("click", () => setMode("two"));
saveBtn.addEventListener("click", handleSave);
clearFormBtn.addEventListener("click", async () => { await clearForm(true); showToast("Form cleared"); });

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
  if (event.key === "Escape") {
    closeSheet();
    closeSettings();
  }
});

async function init() {
  try {
    await openDB();
    await loadSettings();
    entryDate.value = todayISO();
    await clearForm(false);
    await refreshUI();
  } catch (error) {
    console.error(error);
    alert("The app could not start. Check that IndexedDB is available in this browser.");
  }
}

init();
