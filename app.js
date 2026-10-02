// ==========================================
// СОСТОЯНИЕ
// ==========================================
let fullDatabase = [];
let filteredList = [];
let currentIndex = 0;
let currentMode = 'cards'; // 'cards' | 'quiz'

let learnedIds = new Set(JSON.parse(localStorage.getItem('learned_rcb_ids') || '[]'));

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

    // Разбиваем на строки, обрезаем пробелы по краям и отфильтровываем пустые строки
    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      throw new Error('Файл data/rcb.txt пуст');
    }

    // Если первая строка содержит заголовки (id|module|...), пропускаем её
    const hasHeader = lines[0].toLowerCase().startsWith('id|');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    // Парсим каждую строку по 8 колонкам с разделителем |
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
    applyFilters();
  } catch (err) {
    console.error('Ошибка загрузки данных:', err);
    if (counterEl) counterEl.innerText = 'Ошибка загрузки';
    if (questionEl) questionEl.innerText = 'Не удалось загрузить data/rcb.txt: ' + err.message;
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
    let matchStat = true;
    if (selectedStat === 'learned') matchStat = isLearned;
    if (selectedStat === 'unlearned') matchStat = !isLearned;

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

  if (counterEl) counterEl.innerText = `Вопрос ${currentPos} из ${total}`;
  if (scoreEl) scoreEl.innerText = `Изучено: ${learnedIds.size}`;

  if (progressEl) {
    const percent = total > 0 ? (currentPos / total) * 100 : 0;
    progressEl.style.width = `${percent}%`;
  }

  // Сброс переворота карточки на лицевую сторону
  const card = document.getElementById('flashcard');
  if (card) card.classList.remove('is-flipped');

  if (total === 0) {
    const qEl = document.getElementById('cQuestion');
    const aEl = document.getElementById('cAnswer');
    const quoteEl = document.getElementById('cLawQuote');
    const artEl = document.getElementById('cArticle');
    if (qEl) qEl.innerText = 'По выбранным фильтрам вопросов не найдено.';
    if (aEl) aEl.innerText = '—';
    if (artEl) artEl.innerText = '';
    if (quoteEl) quoteEl.style.display = 'none';
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
  const artEl = document.getElementById('cArticle');
  const aEl = document.getElementById('cAnswer');
  const quoteEl = document.getElementById('cLawQuote');

  const isLearned = learnedIds.has(item.id);
  const lvlClass = item.level == 1 ? 'badge-l1' : item.level == 2 ? 'badge-l2' : 'badge-l3';
  const lvlName = item.level == 1 ? 'Уровень 1' : item.level == 2 ? 'Уровень 2' : 'Уровень 3';

  if (badgeEl) {
    badgeEl.className = `badge ${lvlClass}`;
    badgeEl.innerText = `${lvlName} ${isLearned ? '✓' : ''}`;
  }
  if (numEl) numEl.innerText = `№ ${item.id}`;
  if (qEl) qEl.innerText = item.question;

  // Очищаем или скрываем поле статьи и цитаты закона
  if (artEl) artEl.innerText = '';
  if (aEl) aEl.innerText = item.answer;
  if (quoteEl) quoteEl.style.display = 'none';
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

  // Собираем варианты и перемешиваем их
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
    localStorage.setItem('learned_rcb_ids', JSON.stringify([...learnedIds]));
    if (expBox) {
      expBox.innerHTML = `<span style="color: var(--green, #2ecc71); font-weight: bold;">Верно!</span>`;
    }
  } else {
    selectedBtn.classList.add('wrong');
    allBtns.forEach(b => {
      if (b.innerText.trim() === item.answer.trim()) b.classList.add('correct');
    });
    if (expBox) {
      expBox.innerHTML = `<span style="color: var(--red, #e74c3c); font-weight: bold;">Неверно!</span> Правильный ответ подсвечен зеленым.`;
    }
  }

  if (expBox) expBox.style.display = 'block';
  if (nextBtn) nextBtn.style.display = 'block';

  const scoreEl = document.getElementById('scoreText');
  if (scoreEl) scoreEl.innerText = `Изучено: ${learnedIds.size}`;
}

window.nextQuizQuestion = function() {
  currentIndex++;
  renderCurrentView();
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
  } else {
    learnedIds.delete(item.id);
  }
  localStorage.setItem('learned_rcb_ids', JSON.stringify([...learnedIds]));

  const statusEl = document.getElementById('status-filter');
  const statVal = statusEl ? statusEl.value : 'all';

  if ((statVal === 'unlearned' && known) || (statVal === 'learned' && !known)) {
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

      // Поиск по фактическому ID в базе
      let idx = filteredList.findIndex(x => x.id === target);

      // Если не найден по ID, поиск по порядковому номеру фильтра
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

// Слушатель для селектора статуса
const statSelect = document.getElementById('status-filter');
if (statSelect) {
  statSelect.onchange = applyFilters;
}

// Запуск инициализации
setupGotoHandler();
initApp();
