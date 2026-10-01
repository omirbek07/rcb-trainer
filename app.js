// ==========================================
// СОСТОЯНИЕ ПРИЛОЖЕНИЯ
// ==========================================
let fullDatabase = [];
let filteredList = [];
let currentIndex = 0;
let currentMode = 'cards'; // 'cards' | 'test'
let isCardFlipped = false;

// Хранилище изученных вопросов в LocalStorage
let learnedIds = new Set(JSON.parse(localStorage.getItem('learned_rcb_ids') || '[]'));

// Элементы интерфейса
const elModeCards = document.getElementById('mode-cards');
const elModeTest = document.getElementById('mode-test');
const elModuleFilter = document.getElementById('module-filter');
const elLevelFilter = document.getElementById('level-filter');
const elStatusFilter = document.getElementById('status-filter');

const elCardContainer = document.getElementById('card-container');
const elTestContainer = document.getElementById('test-container');
const elCounter = document.getElementById('question-counter');
const elLearnedCounter = document.getElementById('learned-counter');
const elProgressBar = document.getElementById('progress-bar');

const elBtnRepeat = document.getElementById('btn-repeat');
const elBtnKnown = document.getElementById('btn-known');
const elGotoInput = document.getElementById('goto-input');
const elGotoBtn = document.getElementById('goto-btn');

// ==========================================
// ЗАГРУЗКА ДАННЫХ
// ==========================================
async function initApp() {
  try {
    const res = await fetch('data/rcb.json');
    fullDatabase = await res.json();
    applyFilters();
  } catch (err) {
    console.error('Ошибка загрузки базы вопросов:', err);
    if (elCardContainer) {
      elCardContainer.innerHTML = '<div style="color: #ef4444; padding: 20px; text-align: center;">Не удалось загрузить data/rcb.json. Проверьте путь к файлу.</div>';
    }
  }
}

// ==========================================
// ФИЛЬТРАЦИЯ
// ==========================================
function applyFilters() {
  const selectedModule = elModuleFilter ? elModuleFilter.value : 'all';
  const selectedLevel = elLevelFilter ? elLevelFilter.value : 'all';
  const selectedStatus = elStatusFilter ? elStatusFilter.value : 'all';

  filteredList = fullDatabase.filter(item => {
    const matchModule = (selectedModule === 'all' || item.module === selectedModule);
    const matchLevel = (selectedLevel === 'all' || String(item.level) === String(selectedLevel));
    
    const isLearned = learnedIds.has(item.id);
    let matchStatus = true;
    if (selectedStatus === 'learned') matchStatus = isLearned;
    if (selectedStatus === 'unlearned') matchStatus = !isLearned;

    return matchModule && matchLevel && matchStatus;
  });

  currentIndex = 0;
  isCardFlipped = false;
  renderView();
}

// ==========================================
// ОТРИСОВКА (КАРТОЧКИ / ТЕСТ)
// ==========================================
function renderView() {
  updateProgress();

  if (filteredList.length === 0) {
    const emptyHtml = '<div style="text-align:center; padding: 40px; color: #94a3b8;">По выбранным фильтрам вопросов не найдено.</div>';
    if (elCardContainer) elCardContainer.innerHTML = emptyHtml;
    if (elTestContainer) elTestContainer.innerHTML = emptyHtml;
    return;
  }

  if (currentIndex >= filteredList.length) currentIndex = 0;
  if (currentIndex < 0) currentIndex = filteredList.length - 1;

  const currentItem = filteredList[currentIndex];

  if (currentMode === 'cards') {
    if (elCardContainer) elCardContainer.style.display = 'block';
    if (elTestContainer) elTestContainer.style.display = 'none';
    renderCard(currentItem);
  } else {
    if (elCardContainer) elCardContainer.style.display = 'none';
    if (elTestContainer) elTestContainer.style.display = 'block';
    renderTest(currentItem);
  }
}

// Отрисовка режима "Карточки" (с очисткой дублей цитат)
function renderCard(item) {
  if (!elCardContainer) return;

  const isLearned = learnedIds.has(item.id);

  // Проверка: выводить ли цитату, чтобы не дублировать ответ
  const showQuote = item.lawQuote && item.lawQuote.trim() !== item.answer.trim();
  const cleanQuote = item.lawQuote ? item.lawQuote.replace(/\[span_\d+\]|\(start_span\)|\(end_span\)/g, '').trim() : '';

  elCardContainer.innerHTML = `
    <div class="card ${isCardFlipped ? 'flipped' : ''}" id="flashcard" onclick="toggleFlip()">
      <div class="card-inner">
        <!-- Лицевая сторона (Вопрос) -->
        <div class="card-front">
          <div class="card-meta">
            <span class="badge">№ ${item.id}</span>
            <span class="badge ${isLearned ? 'badge-learned' : ''}">${isLearned ? 'Изучено ✓' : 'Не изучено'}</span>
          </div>
          <div class="card-content">
            <p>${item.question}</p>
          </div>
          <div class="card-hint">Нажмите, чтобы увидеть ответ ↻</div>
        </div>

        <!-- Оборотная сторона (Ответ) -->
        <div class="card-back">
          <div class="card-meta">
            <span class="answer-title">ПРАВИЛЬНЫЙ ОТВЕТ</span>
            <span class="article-badge">${item.lawArticle || ''}</span>
          </div>
          <div class="card-content">
            <p class="answer-text">${item.answer}</p>
            ${showQuote && cleanQuote ? `<div class="law-quote-box">${cleanQuote}</div>` : ''}
          </div>
          <div class="card-hint">Нажмите, чтобы вернуться к вопросу ↻</div>
        </div>
      </div>
    </div>
  `;
}

// Отрисовка режима "Тестирование"
function renderTest(item) {
  if (!elTestContainer) return;

  // Формируем варианты и перемешиваем
  const options = [
    { text: item.answer, isCorrect: true },
    ...(item.distractors || []).map(d => ({ text: d, isCorrect: false }))
  ].sort(() => Math.random() - 0.5);

  elTestContainer.innerHTML = `
    <div class="test-box">
      <div class="card-meta">
        <span class="badge">Вопрос № ${item.id}</span>
        <span class="article-badge">${item.lawArticle || ''}</span>
      </div>
      <p class="test-question">${item.question}</p>
      <div class="test-options">
        ${options.map((opt, idx) => `
          <button class="test-option-btn" onclick="checkAnswer(this, ${opt.isCorrect})">
            ${opt.text}
          </button>
        `).join('')}
      </div>
      <div id="test-feedback" class="test-feedback" style="display: none;"></div>
    </div>
  `;
}

// Проверка ответа в тесте
window.checkAnswer = function(btn, isCorrect) {
  const allBtns = document.querySelectorAll('.test-option-btn');
  allBtns.forEach(b => b.disabled = true);

  const feedback = document.getElementById('test-feedback');
  const currentItem = filteredList[currentIndex];

  if (isCorrect) {
    btn.classList.add('correct');
    learnedIds.add(currentItem.id);
    localStorage.setItem('learned_rcb_ids', JSON.stringify([...learnedIds]));
    feedback.innerHTML = `
      <div style="color: #22c55e; font-weight: 600; margin-bottom: 8px;">Верно!</div>
      <button class="next-btn" onclick="nextQuestion()">Следующий вопрос →</button>
    `;
  } else {
    btn.classList.add('wrong');
    allBtns.forEach(b => {
      if (b.innerText.trim() === currentItem.answer.trim()) b.classList.add('correct');
    });
    feedback.innerHTML = `
      <div style="color: #ef4444; font-weight: 600; margin-bottom: 8px;">Неверно!</div>
      <button class="next-btn" onclick="nextQuestion()">Следующий вопрос →</button>
    `;
  }
  feedback.style.display = 'block';
  updateProgress();
};

// ==========================================
// УПРАВЛЕНИЕ И НАВИГАЦИЯ
// ==========================================
window.toggleFlip = function() {
  isCardFlipped = !isCardFlipped;
  const card = document.getElementById('flashcard');
  if (card) card.classList.toggle('flipped', isCardFlipped);
};

function nextQuestion() {
  currentIndex++;
  isCardFlipped = false;
  renderView();
}

function updateProgress() {
  const totalInFilter = filteredList.length;
  const currentPos = totalInFilter > 0 ? currentIndex + 1 : 0;

  if (elCounter) elCounter.innerText = `Вопрос ${currentPos} из ${totalInFilter}`;
  if (elLearnedCounter) elLearnedCounter.innerText = `Изучено: ${learnedIds.size}`;

  if (elProgressBar) {
    const percent = totalInFilter > 0 ? (currentPos / totalInFilter) * 100 : 0;
    elProgressBar.style.width = `${percent}%`;
  }
}

// Кнопка "Знаю точно" (Зеленая)
if (elBtnKnown) {
  elBtnKnown.addEventListener('click', () => {
    if (filteredList.length === 0) return;
    const currentItem = filteredList[currentIndex];
    learnedIds.add(currentItem.id);
    localStorage.setItem('learned_rcb_ids', JSON.stringify([...learnedIds]));

    const currentStatus = elStatusFilter ? elStatusFilter.value : 'all';
    if (currentStatus === 'unlearned') {
      applyFilters();
    } else {
      nextQuestion();
    }
  });
}

// Кнопка "Повторить позже" (Красная)
if (elBtnRepeat) {
  elBtnRepeat.addEventListener('click', () => {
    if (filteredList.length === 0) return;
    const currentItem = filteredList[currentIndex];
    learnedIds.delete(currentItem.id);
    localStorage.setItem('learned_rcb_ids', JSON.stringify([...learnedIds]));

    const currentStatus = elStatusFilter ? elStatusFilter.value : 'all';
    if (currentStatus === 'learned') {
      applyFilters();
    } else {
      nextQuestion();
    }
  });
}

// Быстрый переход по номеру
if (elGotoBtn && elGotoInput) {
  elGotoBtn.addEventListener('click', () => {
    const targetNum = parseInt(elGotoInput.value, 10);
    if (!targetNum) return;

    // 1. Поиск по точному ID вопроса
    let idx = filteredList.findIndex(item => item.id === targetNum);

    // 2. Если по ID не нашли, переход по порядковому номеру (например, 5-й из текущего списка)
    if (idx === -1 && targetNum >= 1 && targetNum <= filteredList.length) {
      idx = targetNum - 1;
    }

    if (idx !== -1) {
      currentIndex = idx;
      isCardFlipped = false;
      renderView();
    } else {
      alert(`Вопрос №${targetNum} не найден в текущей выборке фильтров.`);
    }

    elGotoInput.value = '';
  });
}

// Переключение режимов
if (elModeCards) {
  elModeCards.addEventListener('click', () => {
    currentMode = 'cards';
    elModeCards.classList.add('active');
    if (elModeTest) elModeTest.classList.remove('active');
    renderView();
  });
}

if (elModeTest) {
  elModeTest.addEventListener('click', () => {
    currentMode = 'test';
    elModeTest.classList.add('active');
    if (elModeCards) elModeCards.classList.remove('active');
    renderView();
  });
}

// Слушатели фильтров
if (elModuleFilter) elModuleFilter.addEventListener('change', applyFilters);
if (elLevelFilter) elLevelFilter.addEventListener('change', applyFilters);
if (elStatusFilter) elStatusFilter.addEventListener('change', applyFilters);

// Запуск приложения
initApp();
