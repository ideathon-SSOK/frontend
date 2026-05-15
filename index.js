/* ===== CONFIG ===== */
const BASE_URL  = 'http://localhost:8080';
const API_TEXT  = `${BASE_URL}/api/v1/literacy/analyze`;
const API_WORD  = `${BASE_URL}/api/v1/literacy/explain-word`;

/* ===== MODAL ===== */
function showModal(msg) {
  document.getElementById('modal-msg').textContent = msg;
  document.getElementById('modal-overlay').classList.add('show');
  document.getElementById('modal').classList.add('show');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
  document.getElementById('modal').classList.remove('show');
}

/* ===== STATE ===== */
let selectedLevel = null;
let activeWord    = null;
let screenHistory = ['screen-home'];

/* ===== NAVIGATION ===== */
function goToInput() {
  if (!selectedLevel) { showModal('설명 방식을 먼저 선택해주세요 !'); return; }
  document.getElementById('nav-level-badge').textContent = selectedLevel;
  goTo('screen-input');
}

function goTo(screenId) {
  const current = screenHistory[screenHistory.length - 1];
  if (current === screenId) return;

  const from = document.getElementById(current);
  const to   = document.getElementById(screenId);

  from.classList.remove('active');
  from.classList.add('slide-back');
  setTimeout(() => from.classList.remove('slide-back'), 300);

  to.classList.add('active');
  screenHistory.push(screenId);
}

function goBack() {
  if (screenHistory.length <= 1) return;
  const current = screenHistory.pop();
  const prev    = screenHistory[screenHistory.length - 1];

  const from = document.getElementById(current);
  const to   = document.getElementById(prev);

  from.classList.remove('active');
  to.classList.add('active');

  closePanel();
  closeWordSheet();
}

/* ===== LEVEL SELECT ===== */
function selectLevel(btn) {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  btn.classList.add('selected');
  selectedLevel = btn.dataset.level;
}

/* ===== RENDER WORDS ===== */
function renderWordsInto(text, container) {
  const tokens = text.split(/(\s+)/);
  container.innerHTML = tokens.map(token => {
    if (/^\s+$/.test(token)) return token.replace(/\n/g, '<br>');

    const match = token.match(/^([^a-zA-Z가-힣ㄱ-ㅎㅏ-ㅣ]*)([a-zA-Z가-힣ㄱ-ㅎㅏ-ㅣ][\w가-힣ㄱ-ㅎㅏ-ㅣ·-]*)([^a-zA-Z가-힣ㄱ-ㅎㅏ-ㅣ]*)$/);
    if (!match || !match[2]) return `<span>${token}</span>`;
    const [, pre, word, post] = match;
    return `${pre}<span class="word" data-word="${word}" onclick="onWordClick(this, event)">${word}</span>${post}`;
  }).join('');
}

function renderWords(text) {
  const container = document.getElementById('reader-text');
  renderWordsInto(text, container);
  container.addEventListener('mouseup',  handleDragSelect);
  container.addEventListener('touchend', handleDragSelect);
}

function renderTitle(title) {
  const titleEl = document.getElementById('reader-title');
  if (!titleEl) return;

  if (title) {
    titleEl.style.display = 'block';
    renderWordsInto(title, titleEl);
    titleEl.addEventListener('mouseup',  handleDragSelect);
    titleEl.addEventListener('touchend', handleDragSelect);
  } else {
    titleEl.style.display = 'none';
  }
}

/* ===== DRAG SELECT ===== */
function handleDragSelect() {
  const sel      = window.getSelection();
  const selected = sel?.toString().trim();
  if (!selected || selected.length <= 1) return;

  const readerText  = document.getElementById('reader-text');
  const readerTitle = document.getElementById('reader-title');
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);

  const inText  = readerText?.contains(range.commonAncestorContainer);
  const inTitle = readerTitle?.contains(range.commonAncestorContainer);
  if (!inText && !inTitle) return;

  sel.removeAllRanges();
  openWordSheet(selected.replace(/\s+/g, ' '));
}

/* ===== WORD CLICK ===== */
function onWordClick(el, e) {
  if (e) e.stopPropagation();
  const sel = window.getSelection();
  if (sel && sel.toString().trim().length > 1) return;

  document.querySelectorAll('.word').forEach(w => w.classList.remove('active'));
  el.classList.add('active');
  openWordSheet(el.dataset.word);
}

/* ===== WORD SHEET ===== */
async function openWordSheet(word) {
  if (!selectedLevel) { showModal('설명 방식을 선택해주세요!'); return; }
  activeWord = word;

  document.getElementById('sheet-word').textContent  = word;
  document.getElementById('sheet-meaning').innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span>';
  document.getElementById('sheet-context').innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span>';

  document.getElementById('word-overlay').classList.add('show');
  document.getElementById('word-sheet').classList.add('show');

  const contextText = document.getElementById('input').value.trim();

  try {
    const res = await fetch(API_WORD, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word,
        contextText,
        targetLevel: selectedLevel
      })
    });

    if (activeWord !== word) return;

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = `오류 ${res.status}: ${err.message || res.statusText}`;
      document.getElementById('sheet-meaning').textContent = msg;
      document.getElementById('sheet-context').textContent = '';
      return;
    }

    const data = await res.json();
    const fullText = data.result ?? data.content ?? JSON.stringify(data);
    document.getElementById('sheet-meaning').textContent = fullText;

    const contextEl      = document.getElementById('sheet-context');
    const contextSection = contextEl.closest('.word-section');
    if (data.context) {
      contextEl.textContent = data.context;
      if (contextSection) contextSection.style.display = '';
    } else {
      if (contextSection) contextSection.style.display = 'none';
    }

  } catch (e) {
    if (activeWord !== word) return;
    document.getElementById('sheet-meaning').textContent = `네트워크 오류: ${e.message}`;
    document.getElementById('sheet-context').textContent = '';
  }
}

function closeWordSheet() {
  document.getElementById('word-overlay').classList.remove('show');
  document.getElementById('word-sheet').classList.remove('show');
  document.querySelectorAll('.word').forEach(w => w.classList.remove('active'));
  activeWord = null;
}

/* ===== ANALYZE FULL TEXT ===== */
async function analyzeText() {
  if (!selectedLevel) { showModal('설명 방식을 선택해주세요!'); return; }
  const text  = document.getElementById('input').value.trim();
  const title = document.getElementById('input-title')?.value.trim() || '';
  if (!title) { showToast('제목을 입력해주세요'); return; }
  if (!text)  { showToast('글을 입력해주세요'); return; }

  goTo('screen-reader');
  renderTitle(title);
  renderWords(text);
  loadFullAnalysis(title, text);
}

async function loadFullAnalysis(title, text) {
  const body = document.getElementById('analysis-body');
  body.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span> 분석 중...';

  try {
    const res = await fetch(API_TEXT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        text,
        targetLevel: selectedLevel
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      body.textContent = `오류 ${res.status}: ${err.message || res.statusText}`;
      return;
    }

    const data = await res.json();
    body.textContent = data.result ?? data.content ?? JSON.stringify(data);

  } catch (e) {
    body.textContent = `네트워크 오류: ${e.message}`;
  }
}

/* ===== FULL ANALYSIS PANEL ===== */
function showFullAnalysis() {
  document.getElementById('panel-overlay').classList.add('show');
  document.getElementById('analysis-panel').classList.add('show');
}

function closePanel() {
  document.getElementById('panel-overlay').classList.remove('show');
  document.getElementById('analysis-panel').classList.remove('show');
}

/* ===== TEXTAREA 활성화 감지 ===== */
document.addEventListener('DOMContentLoaded', () => {
  const textarea  = document.getElementById('input');
  const titleInput = document.getElementById('input-title');
  const btnNext   = document.getElementById('btn-next');

  const syncBtn = () => {
    const title = titleInput?.value.trim() || '';
    const text  = textarea.value.trim();
    btnNext.classList.toggle('disabled-look', !title || !text);
  };
  syncBtn();
  textarea.addEventListener('input', syncBtn);
  titleInput?.addEventListener('input', syncBtn);
});

/* ===== TOAST ===== */
let toastTimer = null;

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

function showComingSoon(name) {
  showToast(`${name} 페이지 준비중이에요 🙂`);
}