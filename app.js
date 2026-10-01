// ==========================================
// СОСТОЯНИЕ ТРЕНАЖЕРА
// ==========================================
let fullDatabase = [];
let filteredList = [];
let currentIndex = 0;
let currentMode = 'cards'; // 'cards' | 'quiz'

// Изученные вопросы (сохраняются в памяти браузера)
let learnedIds = new Set(JSON.parse(localStorage.getItem('learned_rcb_ids') || '[]'));

// ==========================================
// ИНИЦИАЛИЗАЦИЯ И ЗАГРУЗКА ДАННЫХ
// ==========================================
async function initApp() {
  try {
    const res = await fetch('data/rcb.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}: Файл data/rcb.json не найден`);
    fullDatabase = await res.json();
    applyFilters();
  } catch (err) {
    console.error('Ошибка инициализации:', err);
    document.getElementById('counterText').innerText = 'Ошибка загрузки базы';
    document.getElementById('cQuestion').innerText = 'Не удалось загрузить data/rcb.json. Проверьте синтаксис JSON.';
  }
}

// ==========================================
// ПЕРЕКЛЮЧЕНИЕ РЕЖИМОВ (КАРТОЧКИ / ТЕСТЫ)
// ==========================================
window.setMode = function(mode) {
  currentMode = mode;
  document.getElementById('btnModeCards').classList.toggle('active', mode === 'cards');
  document.getElementById('btnModeQuiz').classList.toggle('active', mode === 'quiz');

  document.getElementById('cardsSection').style.display = mode === 'cards' ? 'block' : 'none';
  document.getElementById('quizSection').style.display = mode === 'quiz' ? 'block' : 'none';

  renderCurrentView();
};

// ==========================================
// ФИЛЬТРАЦИЯ ВОПРОСОВ
// ==========================================
window.applyFilters = function() {
  const modVal = document.getElementById('moduleSelect').value;
  const lvlVal = document.getElementById('levelSelect').value;
  const statusEl = document.getElementById('status-filter');
  const statVal = statusEl ? statusEl.value : 'all';

  filteredList = fullDatabase.filter(item => {
    const matchMod = (modVal === 'all' || item.module === modVal);
    const matchLvl = (lvlVal === 'all' || String(item.level) === String(lvlVal));

    const isLearned = learnedIds.has(item.id);
    let matchStat = true;
    if (statVal === 'learned') matchStat = isLearned;
    if (statVal === 'unlearned') matchStat = !isLearned;

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

  // Обновление счетчиков
  document.getElementById('counterText').innerText = `Вопрос ${currentPos} из ${total}`;
  document.getElementById('scoreText').innerText = `Изучено: ${learnedIds.size}`;

  // Прогресс-бар
  const fillEl = document.getElementById('progressFill');
  if (fillEl) {
    const percent = total > 0 ? (currentPos / total) * 100 : 0;
    fillEl.style.width = `${percent}%`;
  }

  // Сброс переворота карточки
  const card = document.getElementById('flashcard');
  if (card) card.classList.remove('flipped');

  if (total === 0) {
    document.getElementById('cQuestion').innerText = 'По выбранным фильтрам вопросов не найдено.';
    document.getElementById('cAnswer').innerText = '—';
    document.getElementById('cLawQuote').style.display = 'none';
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

// 1. Отрисовка режима "Карточки"
function renderCard(item) {
  const isLearned = learnedIds.has(item.id);
  const lvlText = item.level === 1 ? '🟢 Уровень 1' : item.level === 2 ? '🟡 Уровень 2' : '🔴 Уровень 3';

  document.getElementById('cBadge').innerText = `${lvlText} ${isLearned ? '✓ Изучено' : ''}`;
  document.getElementById('cNumber').innerText = `№ ${item.id}`;
  document.getElementById('cQuestion').innerText = item.question;

  document.getElementById('cArticle').innerText = item.lawArticle || '';
  document.getElementById('cAnswer').innerText = item.answer;

  const quoteBox = document.getElementById('cLawQuote');
  const cleanQuote = item.lawQuote ? item.lawQuote.replace(/\[span_\d+\]|\(start_span\)|\(end_span\)/g, '').trim() : '';

  // Не дублируем цитату, если ответ полностью повторяет её текст
  if (cleanQuote && cleanQuote !== item.answer.trim()) {
    quoteBox.innerText = cleanQuote;
    quoteBox.style.display = 'block';
  } else {
    quoteBox.style.display = 'none';
  }
}

// 2. Отрисовка режима "Тестирование"
function renderQuiz(item) {
  const lvlText = item.level === 1 ? '🟢 Уровень 1' : item.level === 2 ? '🟡 Уровень 2' : '🔴 Уровень 3';
  document.getElementById('qBadge').innerText = lvlText;
  document.getElementById('qNumber').innerText = `Тест № ${item.id}`;
  document.getElementById('quizQuestionText').innerText = item.question;

  const expBox = document.getElementById('quizExplanation');
  const nextBtn = document.getElementById('btnNextQuiz');
  expBox.style.display = 'none';
  nextBtn.style.display = 'none';

  // Собираем варианты ответов и перемешиваем
  const options = [
    { text: item.answer, isCorrect: true },
    ...(item.distractors || []).map(d => ({ text: d, isCorrect: false }))
  ].sort(() => Math.random() - 0.5);

  const grid = document.getElementById('optionsGrid');
  grid.innerHTML = '';

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerText = opt.text;
    btn.onclick = () => selectOption(btn, opt.isCorrect, item);
    grid.appendChild(btn);
  });
}

function selectOption(btn, isCorrect, item) {
  const allBtns = document.querySelectorAll('.option-btn');
  allBtns.forEach(b => b.disabled = true);

  const expBox = document.getElementById('quizExplanation');
  const nextBtn = document.getElementById('btnNextQuiz');

  if (isCorrect) {
    btn.classList.add('correct');
    learnedIds.add(item.id);
    localStorage.setItem('learned_rcb_ids', JSON.stringify([...learnedIds]));
    expBox.innerHTML = `<span style="color: #22c55e; font-weight: bold;">Верно!</span> ${item.lawArticle || ''}`;
  } else {
    btn.classList.add('wrong');
    allBtns.forEach(b => {
      if (b.innerText.trim() === item.answer.trim()) b.classList.add('correct');
    });
    expBox.innerHTML = `<span style="color: #ef4444; font-weight: bold;">Неверно!</span> Правильный ответ указан зеленым. <br><small>${item.lawArticle || ''}</small>`;
  }

  expBox.style.display = 'block';
  nextBtn.style.display = 'inline-block';
  document.getElementById('scoreText').innerText = `Изучено: ${learnedIds.size}`;
}

window.nextQuizQuestion = function() {
  currentIndex++;
  renderCurrentView();
};

// ==========================================
// УПРАВЛЕНИЕ КАРТОЧКОЙ
// ==========================================
window.flipCard = function() {
  const card = document.getElementById('flashcard');
  if (card) card.classList.toggle('flipped');
};

// Действие по кнопкам "Знаю точно" (true) / "Повторить позже" (false)
window.cardAction = function(known) {
  if (filteredList.length === 0) return;
  const item = filteredList[currentIndex];

  if (known) {
    learnedIds.add(item.id);
  } else {
    learnedIds.delete(item.id);
  }
  localStorage.setItem('learned_rcb_ids', JSON.stringify([...learnedIds]));

  const statusVal = document.getElementById('status-filter') ? document.getElementById('status-filter').value : 'all';

  // Если выбран фильтр "Не изучено" и вопрос выучен — исключаем его из выборки
  if (statusVal === 'unlearned' && known) {
    applyFilters();
  } else if (statusVal === 'learned' && !known) {
    applyFilters();
  } else {
    currentIndex++;
    renderCurrentView();
  }
};

// ==========================================
// ПЕРЕХОД К КОНКРЕТНОМУ НОМЕРУ
// ==========================================
function setupGoto() {
  const gotoBtn = document.getElementById('goto-btn');
  const gotoInput = document.getElementById('goto-input');

  if (gotoBtn && gotoInput) {
    gotoBtn.onclick = () => {
      const targetId = parseInt(gotoInput.value, 10);
      if (!targetId) return;

      // 1. Ищем вопрос по реальному ID
      let idx = filteredList.findIndex(x => x.id === targetId);

      // 2. Если по ID не нашли, проверяем порядковый номер в фильтре
      if (idx === -1 && targetId >= 1 && targetId <= filteredList.length) {
        idx = targetId - 1;
      }

      if (idx !== -1) {
        currentIndex = idx;
        renderCurrentView();
      } else {
        alert(`Вопрос №${targetId} не найден в текущих параметрах фильтра.`);
      }

      gotoInput.value = '';
    };
  }
}

// Слушатель смены фильтра статуса
const statusFilterEl = document.getElementById('status-filter');
if (statusFilterEl) {
  statusFilterEl.onchange = applyFilters;
}

// Запуск при старте страницы
document.addEventListener('DOMContentLoaded', () => {
  setupGoto();
  initApp();
});
