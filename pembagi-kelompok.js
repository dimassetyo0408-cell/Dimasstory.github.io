const root = document.documentElement;
const themeBtn = document.getElementById('themeBtn');
const namesEl = document.getElementById('names');
const countEl = document.getElementById('count');
const exampleBtn = document.getElementById('exampleBtn');
const modeEl = document.getElementById('mode');
const amountEl = document.getElementById('amount');
const amountLabelEl = document.getElementById('amountLabel');
const leaderEl = document.getElementById('leader');
const shuffleBtn = document.getElementById('shuffleBtn');
const copyBtn = document.getElementById('copyBtn');
const resetBtn = document.getElementById('resetBtn');
const errorEl = document.getElementById('error');
const resultSection = document.getElementById('resultSection');
const groupsEl = document.getElementById('groups');
const summaryEl = document.getElementById('summary');
const toastEl = document.getElementById('toast');

const STORAGE_KEY = 'pembagi-kelompok-v1';
const THEME_KEY = 'theme';
const PALETTE = ['#ffd84a', '#ff7ab8', '#5ee0ff', '#5ef0a5', '#ffa24a', '#b99cff'];
const EXAMPLE_NAMES = ['Andi', 'Budi', 'Citra', 'Dewi', 'Eka', 'Fajar', 'Gita', 'Hana', 'Indra', 'Joko'];
let lastResult = [];

/* ===== Tema terang / gelap ===== */
function applyTheme(theme) {
  if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    root.removeAttribute('data-theme');
  }
  themeBtn.textContent = theme === 'light' ? '🌙' : '☀️';
}

themeBtn.addEventListener('click', function () {
  const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
});

try {
  applyTheme(localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark');
} catch (e) {
  applyTheme('dark');
}

/* ===== Fungsi bantu ===== */
function parseNames(text) {
  const seen = new Set();
  const result = [];
  text.split(/[\n,;]+/).forEach(function (raw) {
    const name = raw.trim().replace(/\s+/g, ' ');
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(name);
  });
  return result;
}

// Fisher-Yates shuffle
function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

// Bagi n orang ke k kelompok sebisa mungkin merata
function splitEvenly(people, k) {
  const base = Math.floor(people.length / k);
  const extra = people.length % k;
  const groups = [];
  let cursor = 0;
  for (let i = 0; i < k; i++) {
    const size = base + (i < extra ? 1 : 0);
    groups.push(people.slice(cursor, cursor + size));
    cursor += size;
  }
  return groups;
}

function showError(msg) { errorEl.textContent = msg || ''; }

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
}

/* ===== Simpan dan muat ===== */
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      names: namesEl.value,
      mode: modeEl.value,
      amount: amountEl.value,
      leader: leaderEl.checked
    }));
  } catch (e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.names === 'string') namesEl.value = s.names;
    if (s.mode === 'groups' || s.mode === 'size') modeEl.value = s.mode;
    if (s.amount) amountEl.value = s.amount;
    leaderEl.checked = !!s.leader;
  } catch (e) {}
}

/* ===== Tampilan ===== */
function updateCount() { countEl.textContent = parseNames(namesEl.value).length; }

function updateModeLabel() {
  amountLabelEl.textContent = modeEl.value === 'groups' ? 'Jumlah kelompok' : 'Anggota per kelompok';
}

function render(groups) {
  groupsEl.innerHTML = '';
  groups.forEach(function (g, idx) {
    const card = document.createElement('div');
    card.className = 'group-card enter';
    card.style.setProperty('--c', PALETTE[idx % PALETTE.length]);
    card.style.setProperty('--i', idx);

    const title = document.createElement('h3');
    title.textContent = 'Kelompok ' + (idx + 1);
    const small = document.createElement('small');
    small.textContent = g.members.length + ' orang';
    title.appendChild(small);
    card.appendChild(title);

    const ol = document.createElement('ol');
    g.members.forEach(function (name, i) {
      const li = document.createElement('li');
      li.textContent = name; // textContent: aman dari injeksi HTML
      if (i === g.leaderIndex) {
        li.className = 'leader';
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = '★ ketua';
        li.appendChild(badge);
      }
      ol.appendChild(li);
    });
    card.appendChild(ol);
    groupsEl.appendChild(card);
  });

  const total = groups.reduce(function (sum, g) { return sum + g.members.length; }, 0);
  summaryEl.textContent = groups.length + ' kelompok · ' + total + ' orang';
  resultSection.hidden = false;
  copyBtn.disabled = false;
}

function toText(groups) {
  return groups.map(function (g, idx) {
    const lines = g.members.map(function (name, i) {
      return (i + 1) + '. ' + name + (i === g.leaderIndex ? ' (ketua)' : '');
    });
    return 'Kelompok ' + (idx + 1) + ':\n' + lines.join('\n');
  }).join('\n\n');
}

/* ===== Aksi ===== */
function doShuffle() {
  showError('');
  const people = parseNames(namesEl.value);
  const amount = parseInt(amountEl.value, 10);

  if (people.length < 2) { showError('Masukkan minimal 2 nama dulu.'); return; }
  if (!Number.isInteger(amount) || amount < 1) { showError('Jumlah harus berupa angka 1 atau lebih.'); return; }

  let k;
  if (modeEl.value === 'groups') {
    k = amount;
    if (k > people.length) {
      showError('Jumlah kelompok (' + k + ') tidak boleh lebih banyak dari jumlah nama (' + people.length + ').');
      return;
    }
  } else {
    if (amount > people.length) {
      showError('Anggota per kelompok (' + amount + ') tidak boleh lebih banyak dari jumlah nama (' + people.length + ').');
      return;
    }
    k = Math.ceil(people.length / amount);
  }

  const groups = splitEvenly(shuffle(people), k).map(function (members) {
    return {
      members: members,
      leaderIndex: leaderEl.checked ? Math.floor(Math.random() * members.length) : -1
    };
  });

  lastResult = groups;
  render(groups);
  saveState();
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function copyResult() {
  if (!lastResult.length) return;
  const text = toText(lastResult);
  try {
    await navigator.clipboard.writeText(text);
    showToast('Hasil disalin ✔');
  } catch (e) {
    const temp = document.createElement('textarea');
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    try { document.execCommand('copy'); showToast('Hasil disalin ✔'); }
    catch (err) { showToast('Gagal menyalin, salin manual ya'); }
    document.body.removeChild(temp);
  }
}

function fillExample() {
  namesEl.value = EXAMPLE_NAMES.join('\n');
  updateCount();
  saveState();
  showError('');
}

function resetAll() {
  namesEl.value = '';
  amountEl.value = 3;
  modeEl.value = 'groups';
  leaderEl.checked = false;
  lastResult = [];
  groupsEl.innerHTML = '';
  resultSection.hidden = true;
  copyBtn.disabled = true;
  showError('');
  updateCount();
  updateModeLabel();
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

namesEl.addEventListener('input', function () { updateCount(); saveState(); });
modeEl.addEventListener('change', function () { updateModeLabel(); saveState(); });
amountEl.addEventListener('input', saveState);
leaderEl.addEventListener('change', saveState);
exampleBtn.addEventListener('click', fillExample);
shuffleBtn.addEventListener('click', doShuffle);
copyBtn.addEventListener('click', copyResult);
resetBtn.addEventListener('click', resetAll);

loadState();
updateCount();
updateModeLabel();
