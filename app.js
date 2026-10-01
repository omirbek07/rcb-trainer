let fullDatabase = [];
let activeMode = 'cards';
let filteredList = [];
let currentIdx = 0;
let knownCards = JSON.parse(localStorage.getItem('arrfr_known_cards') || '[]');

async function loadData() {
  try {
    const res = await fetch('data/rcb.json');
    fullDatabase = await res.json();
    applyFilters();
  } catch (err) {
    console.error("Ошибка загрузки data/rcb.json:", err);
    document.getElementById('counterText').innerText = "Ошибка загрузки данных JSON";
  }
}

function setMode(mode) {
  activeMode = mode;
  document.getElementById('btnModeCards').classList.toggle('active', mode === 'cards');
  document.getElementById('btnModeQuiz').classList.toggle('active', mode === 'quiz');

  document.getElementById('cardsSection').style.display = (mode === 'cards') ? 'flex' : 'none';
  document.getElementById('quizSection').style.display = (mode === 'quiz') ? 'flex' : 'none';

  currentIdx = 0;
  renderCurrent();
}

function applyFilters() {
  const mod = document.getElementById('moduleSelect').value;
  const lvl = document.getElementById('levelSelect').value;

  filteredList = fullDatabase.filter(item => {
    const matchMod = (mod === 'all') || (item.module === mod);
    const matchLvl = (lvl === 'all') || (item.level.toString() === lvl);
    return matchMod && matchLvl;
  });

  currentIdx = 0;
  renderCurrent();
}

function renderCurrent() {
  const total = filteredList.length;
  if (total === 0) {
    document.getElementById('counterText').innerText = "0 из 0";
    document.getElementById('progressFill').style.width = "0%";
    return;
  }

  document.getElementById('counterText').innerText = `Вопрос ${currentIdx + 1} из ${total}`;
  document.getElementById('progressFill').style.width = `${((currentIdx + 1) / total) * 100}%`;
  document.getElementById('scoreText').innerText = `Изучено: ${knownCards.length}`;

  const currentItem = filteredList[currentIdx];

  if (activeMode === 'cards') {
    renderCard(currentItem);
  } else {
    renderQuiz(currentItem);
  }
}

function renderCard(item) {
  const card = document.getElementById('flashcard');
  card.classList.remove('is-flipped');

  document.getElementById('cNumber').innerText = `№ ${item.id}`;
  document.getElementById('cQuestion').innerText = item.question;
  document.getElementById('cAnswer').innerText = item.answer;
  document.getElementById('cArticle').innerText = item.lawArticle;
  document.getElementById('cLawQuote').innerText = item.lawQuote;

  const badge = document.getElementById('cBadge');
  badge.className = `badge badge-l${item.level}`;
  badge.innerText = `Уровень ${item.level}`;
}

function flipCard() {
  document.getElementById('flashcard').classList.toggle('is-flipped');
}

function cardAction(isKnown) {
  const item = filteredList[currentIdx];
  if (isKnown && !knownCards.includes(item.id)) {
    knownCards.push(item.id);
    localStorage.setItem('arrfr_known_cards', JSON.stringify(knownCards));
  } else if (!isKnown && knownCards.includes(item.id)) {
    knownCards = knownCards.filter(id => id !== item.id);
    localStorage.setItem('arrfr_known_cards', JSON.stringify(knownCards));
  }

  currentIdx = (currentIdx + 1) % filteredList.length;
  renderCurrent();
}

function renderQuiz(item) {
  document.getElementById('qNumber').innerText = `Тест № ${item.id}`;
  document.getElementById('quizQuestionText').innerText = item.question;
  
  const badge = document.getElementById('qBadge');
  badge.className = `badge badge-l${item.level}`;
  badge.innerText = `Уровень ${item.level}`;

  document.getElementById('btnNextQuiz').style.display = 'none';
  const expBox = document.getElementById('quizExplanation');
  expBox.style.display = 'none';
  expBox.innerHTML = `<strong>Обоснование (${item.lawArticle}):</strong><br>${item.lawQuote}`;

  const options = [
    { text: item.answer, isCorrect: true },
    ...item.distractors.map(d => ({ text: d, isCorrect: false }))
  ].sort(() => Math.random() - 0.5);

  const grid = document.getElementById('optionsGrid');
  grid.innerHTML = '';

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerText = opt.text;
    btn.onclick = () => selectOption(btn, opt.isCorrect, item.answer);
    grid.appendChild(btn);
  });
}

function selectOption(button, isCorrect, correctText) {
  const allButtons = document.querySelectorAll('.option-btn');
  allButtons.forEach(btn => {
    btn.disabled = true;
    if (btn.innerText === correctText) {
      btn.classList.add('correct');
    }
  });

  if (!isCorrect) {
    button.classList.add('wrong');
  }

  document.getElementById('quizExplanation').style.display = 'block';
  document.getElementById('btnNextQuiz').style.display = 'block';
}

function nextQuizQuestion() {
  currentIdx = (currentIdx + 1) % filteredList.length;
  renderCurrent();
}

loadData();
