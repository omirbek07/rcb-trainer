// ==========================================
// СОСТОЯНИЕ
// ==========================================
let fullDatabase = [];
let filteredList = [];
let currentIndex = 0;
let currentMode = 'cards'; // 'cards' | 'quiz'

let learnedIds = new Set(JSON.parse(localStorage.getItem('learned_rcb_ids') || '[]'));
let mistakeIds = new Set(JSON.parse(localStorage.getItem('mistakes_rcb_ids') || '[]'));

// ==========================================
// ИНИЦИАЛИЗАЦИЯ И ЗАГРУЗКА ИЗ TXT
// ==========================================
async function initApp() {
  const counterEl = document.getElementById('counterText');
  const questionEl = document.getElementById('cQuestion');

  try {
    const res = await fetch('data/rcb.txt');
    if (!res.ok) throw new Error(`HTTP ${res.status}: файл data/rcb.txt не найден`);

    const text = await res.text();

    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      throw new Error('Файл data/rcb.txt пуст');
    }

    const hasHeader = lines[0].toLowerCase().startsWith('id|');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    fullDatabase = dataLines.map((line, index) => {
      const parts = line.split('|');
      return {
        id: parseInt(parts[0], 10) || (index + 1),
        module: parts[1] || 'rcb',
        level: parseInt(parts[2], 10) || 1,
        question: parts[3] || '',
        answer: parts[4] || '',
        distractors: [parts[5], parts[6], parts[7]].filter(Boolean)
      };
    });

    console.log(`Загружено вопросов из data/rcb.txt: ${fullDatabase.length}`);
    updateStatusOptionLabels();
    applyFilters();
  } catch (err) {
    console.error('Ошибка загрузки данных:', err);
    if (counterEl) counterEl.innerText = 'Ошибка загрузки';
    if (questionEl) questionEl.innerText = 'Не удалось загрузить data/rcb.txt: ' + err.message;
  }
}

// Обновление счетчика в самом селекторе
function updateStatusOptionLabels() {
  const statEl = document.getElementById('status-filter');
  if (!statEl) return;

  const mistakesOpt = statEl.querySelector('option[value="mistakes"]');
  if (mistakesOpt) {
    mistakesOpt.innerText = `⚠️ Ошибки (${mistakeIds.size})`;
  }
}

// ==========================================
// РЕЖИМЫ (КАРТОЧКИ / ТЕСТ)
// ==========================================
window.setMode = function(mode) {
  currentMode = mode;

  const btnCards = document.getElementById('btnModeCards');
  const btnQuiz = document.getElementById('btnModeQuiz');
  const secCards = document.getElementById('cardsSection');
  const secQuiz = document.getElementById('quizSection');

  if (btnCards) btnCards.classList.toggle('active', mode === 'cards');
  if (btnQuiz) btnQuiz.classList.toggle('active', mode === 'quiz');

  if (secCards) secCards.style.display = mode === 'cards' ? 'flex' : 'none';
  if (secQuiz) secQuiz.style.display = mode === 'quiz' ? 'flex' : 'none';

  renderCurrentView();
};

// ==========================================
// ФИЛЬТРАЦИЯ
// ==========================================
window.applyFilters = function() {
  const modEl = document.getElementById('moduleSelect');
  const lvlEl = document.getElementById('levelSelect');
  const statEl = document.getElementById('status-filter');

  const selectedMod = modEl ? modEl.value : 'all';
  const selectedLvl = lvlEl ? lvlEl.value : 'all';
  const selectedStat = statEl ? statEl.value : 'all';

  filteredList = fullDatabase.filter(item => {
    const matchMod = (selectedMod === 'all' || item.module === selectedMod);
    const matchLvl = (selectedLvl === 'all' || String(item.level) === String(selectedLvl));

    const isLearned = learnedIds.has(item.id);
    const isMistake = mistakeIds.has(item.id);

    let matchStat = true;
    if (selectedStat === 'learned') matchStat = isLearned;
    if (selectedStat === 'unlearned') matchStat = !isLearned;
    if (selectedStat === 'mistakes') matchStat = isMistake;

    return matchMod && matchLvl && matchStat;
  });

  currentIndex = 0;
  renderCurrentView();
};

// ==========================================
// ОТРИСОВКА ЭКРАНА
// ==========================================
function renderCurrentView() {
  const total = filteredList.length;
  const currentPos = total > 0 ? currentIndex + 1 : 0;

  const counterEl = document.getElementById('counterText');
  const scoreEl = document.getElementById('scoreText');
  const progressEl = document.getElementById('progressFill');

  const statusEl = document.getElementById('status-filter');
  const isMistakeMode = statusEl && statusEl.value === 'mistakes';

  if (counterEl) {
    counterEl.innerText = isMistakeMode
      ? `Ошибки: ${currentPos} из ${total}`
      : `Вопрос ${currentPos} из ${total}`;
  }
  
  if (scoreEl) {
    scoreEl.innerText = `Изучено: ${learnedIds.size} | Ошибок: ${mistakeIds.size}`;
  }

  if (progressEl) {
    const percent = total > 0 ? (currentPos / total) * 100 : 0;
    progressEl.style.width = `${percent}%`;
  }

  const card = document.getElementById('flashcard');
  if (card) card.classList.remove('is-flipped');

  if (total === 0) {
    const qEl = document.getElementById('cQuestion');
    const aEl = document.getElementById('cAnswer');
    const quizText = document.getElementById('quizQuestionText');
    const grid = document.getElementById('optionsGrid');
    const expBox = document.getElementById('quizExplanation');
    const nextBtn = document.getElementById('btnNextQuiz');

    const emptyMsg = isMistakeMode
      ? '🎉 В списке ошибок пусто! Все вопросы закрыты верно.'
      : 'По выбранным фильтрам вопросов не найдено.';

    if (qEl) qEl.innerText = emptyMsg;
    if (aEl) aEl.innerText = '—';
    if (quizText) quizText.innerText = emptyMsg;
    if (grid) grid.innerHTML = '';
    if (expBox) expBox.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    return;
  }

  if (currentIndex >= total) currentIndex = 0;
  if (currentIndex < 0) currentIndex = total - 1;

  const currentItem = filteredList[currentIndex];

  if (currentMode === 'cards') {
    renderCard(currentItem);
  } else {
    renderQuiz(currentItem);
  }
}

// 1. Отрисовка карточки
function renderCard(item) {
  const badgeEl = document.getElementById('cBadge');
  const numEl = document.getElementById('cNumber');
  const qEl = document.getElementById('cQuestion');
  const aEl = document.getElementById('cAnswer');

  const isLearned = learnedIds.has(item.id);
  const isMistake = mistakeIds.has(item.id);

  const lvlClass = item.level == 1 ? 'badge-l1' : item.level == 2 ? 'badge-l2' : 'badge-l3';
  const lvlName = item.level == 1 ? 'Уровень 1' : item.level == 2 ? 'Уровень 2' : 'Уровень 3';

  if (badgeEl) {
    badgeEl.className = `badge ${lvlClass}`;
    badgeEl.innerText = `${lvlName} ${isLearned ? '✓' : ''} ${isMistake ? '⚠️' : ''}`;
  }
  if (numEl) numEl.innerText = `№ ${item.id}`;
  if (qEl) qEl.innerText = item.question;
  if (aEl) aEl.innerText = item.answer;
}

// 2. Отрисовка теста
function renderQuiz(item) {
  const qBadge = document.getElementById('qBadge');
  const qNum = document.getElementById('qNumber');
  const qText = document.getElementById('quizQuestionText');
  const expBox = document.getElementById('quizExplanation');
  const nextBtn = document.getElementById('btnNextQuiz');
  const grid = document.getElementById('optionsGrid');

  const lvlClass = item.level == 1 ? 'badge-l1' : item.level == 2 ? 'badge-l2' : 'badge-l3';
  const lvlName = item.level == 1 ? 'Уровень 1' : item.level == 2 ? 'Уровень 2' : 'Уровень 3';

  if (qBadge) {
    qBadge.className = `badge ${lvlClass}`;
    qBadge.innerText = lvlName;
  }
  if (qNum) qNum.innerText = `Тест № ${item.id}`;
  if (qText) qText.innerText = item.question;

  if (expBox) expBox.style.display = 'none';
  if (nextBtn) nextBtn.style.display = 'none';

  const options = [
    { text: item.answer, isCorrect: true },
    ...(item.distractors || []).map(d => ({ text: d, isCorrect: false }))
  ].sort(() => Math.random() - 0.5);

  if (grid) {
    grid.innerHTML = '';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.innerText = opt.text;
      btn.onclick = () => handleQuizOption(btn, opt.isCorrect, item);
      grid.appendChild(btn);
    });
  }
}

function handleQuizOption(selectedBtn, isCorrect, item) {
  const allBtns = document.querySelectorAll('.option-btn');
  allBtns.forEach(b => b.disabled = true);

  const expBox = document.getElementById('quizExplanation');
  const nextBtn = document.getElementById('btnNextQuiz');

  if (isCorrect) {
    selectedBtn.classList.add('correct');
    learnedIds.add(item.id);

    // Если ответили правильно — удаляем из списка ошибок
    if (mistakeIds.has(item.id)) {
      mistakeIds.delete(item.id);
      localStorage.setItem('mistakes_rcb_ids', JSON.stringify([...mistakeIds]));
    }

    localStorage.setItem('learned_rcb_ids', JSON.stringify([...learnedIds]));

    if (expBox) {
      expBox.innerHTML = `<span style="color: var(--green, #2ecc71); font-weight: bold;">Верно!</span>`;
    }
  } else {
    selectedBtn.classList.add('wrong');
    allBtns.forEach(b => {
      if (b.innerText.trim() === item.answer.trim()) b.classList.add('correct');
    });

    // Добавляем в список ошибок
    mistakeIds.add(item.id);
    localStorage.setItem('mistakes_rcb_ids', JSON.stringify([...mistakeIds]));

    if (expBox) {
      expBox.innerHTML = `<span style="color: var(--red, #e74c3c); font-weight: bold;">Неверно!</span> Добавлено в библиотеку ошибок. Правильный ответ подсвечен зеленым.`;
    }
  }

  updateStatusOptionLabels();

  if (expBox) expBox.style.display = 'block';
  if (nextBtn) nextBtn.style.display = 'block';

  const scoreEl = document.getElementById('scoreText');
  if (scoreEl) scoreEl.innerText = `Изучено: ${learnedIds.size} | Ошибок: ${mistakeIds.size}`;
}

window.nextQuizQuestion = function() {
  const statusEl = document.getElementById('status-filter');
  // Если мы были в режиме ошибок и исправили вопрос, обновляем фильтр
  if (statusEl && statusEl.value === 'mistakes') {
    applyFilters();
  } else {
    currentIndex++;
    renderCurrentView();
  }
};

// ==========================================
// ПЕРЕВОРОТ И ДЕЙСТВИЯ КАРТОЧКИ
// ==========================================
window.flipCard = function() {
  const card = document.getElementById('flashcard');
  if (card) {
    card.classList.toggle('is-flipped');
  }
};

window.cardAction = function(known) {
  if (filteredList.length === 0) return;
  const item = filteredList[currentIndex];

  if (known) {
    learnedIds.add(item.id);
    mistakeIds.delete(item.id);
  } else {
    learnedIds.delete(item.id);
    mistakeIds.add(item.id);
  }

  localStorage.setItem('learned_rcb_ids', JSON.stringify([...learnedIds]));
  localStorage.setItem('mistakes_rcb_ids', JSON.stringify([...mistakeIds]));
  updateStatusOptionLabels();

  const statusEl = document.getElementById('status-filter');
  const statVal = statusEl ? statusEl.value : 'all';

  if (
    (statVal === 'unlearned' && known) ||
    (statVal === 'learned' && !known) ||
    (statVal === 'mistakes' && known)
  ) {
    applyFilters();
  } else {
    currentIndex++;
    renderCurrentView();
  }
};

// ==========================================
// БЫСТРЫЙ ПЕРЕХОД К №
// ==========================================
function setupGotoHandler() {
  const btn = document.getElementById('goto-btn');
  const input = document.getElementById('goto-input');

  if (btn && input) {
    btn.onclick = () => {
      const target = parseInt(input.value, 10);
      if (!target) return;

      let idx = filteredList.findIndex(x => x.id === target);

      if (idx === -1 && target >= 1 && target <= filteredList.length) {
        idx = target - 1;
      }

      if (idx !== -1) {
        currentIndex = idx;
        renderCurrentView();
      } else {
        alert(`Вопрос №${target} не найден в текущей выборке.`);
      }

      input.value = '';
    };
  }
}

// Запуск при инициализации
setupGotoHandler();
initApp();
