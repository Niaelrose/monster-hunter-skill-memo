const APP_STORAGE_KEY = 'lotteryMemoTool_static_v1';
const MAX_ROUNDS = 30;
const REQUIRED_LIMIT = 10;
const MOBILE_BREAKPOINT = 768;

const SAMPLE_MASTER = {
  weapons: ['大剣', '太刀', '片手剣', '双剣', 'ハンマー', '狩猟笛', 'ランス', 'ガンランス', 'スラアク', 'チャアク', '操虫棍', 'ライト', 'ヘビィ', '弓'],
  seriesSkills: ['火竜の力', '泡狐竜の力', '白熾龍の脈動', '凶爪竜の力', '雷顎竜の力', '雪獅子の力'],
  groupSkills: ['鱗張りの技法', '守勢の構え', '集中整備', '連撃補助', '毛皮の昂揚', '狙撃支援']
};

const state = {
  master: structuredClone(SAMPLE_MASTER),
  roundCount: 7,
  notes: {},
  requiredSeries: [],
  requiredGroup: [],
  visibleWeapons: [],
  modalType: null,
  filterCollapsed: false,
  isMobile: window.innerWidth <= MOBILE_BREAKPOINT,
  renderTimer: null
};

const els = {
  roundCount: document.getElementById('round-count'),
  memoTable: document.getElementById('memo-table'),
  saveCacheBtn: document.getElementById('save-cache-btn'),
  clearBtn: document.getElementById('clear-btn'),
  saveMessage: document.getElementById('save-message'),

  openSeriesModal: document.getElementById('open-series-modal'),
  openGroupModal: document.getElementById('open-group-modal'),
  seriesSelectedChips: document.getElementById('series-selected-chips'),
  groupSelectedChips: document.getElementById('group-selected-chips'),

  skillModal: document.getElementById('skill-modal'),
  modalTitle: document.getElementById('modal-title'),
  modalSubtext: document.getElementById('modal-subtext'),
  skillSearch: document.getElementById('skill-search'),
  skillList: document.getElementById('skill-list'),
  modalCountText: document.getElementById('modal-count-text'),
  closeModalBtn: document.getElementById('close-modal-btn'),
  modalCloseFooterBtn: document.getElementById('modal-close-footer-btn'),
  modalClearSelectionBtn: document.getElementById('modal-clear-selection-btn'),

  weaponFilterBox: document.getElementById('weapon-filter-box'),
  filterSelectAllBtn: document.getElementById('filter-select-all-btn'),
  filterClearAllBtn: document.getElementById('filter-clear-all-btn'),
  filterToggleBtn: document.getElementById('filter-toggle-btn'),

  desktopSection: document.getElementById('desktop-section'),
  mobileSection: document.getElementById('mobile-section'),
  mobileCardArea: document.getElementById('mobile-card-area'),

  openMasterModal: document.getElementById('open-master-modal'),
  masterModal: document.getElementById('master-modal'),
  closeMasterModalBtn: document.getElementById('close-master-modal-btn'),
  masterWeapons: document.getElementById('master-weapons'),
  masterSeries: document.getElementById('master-series'),
  masterGroup: document.getElementById('master-group'),
  saveMasterBtn: document.getElementById('save-master-btn'),
  resetMasterBtn: document.getElementById('reset-master-btn'),
  loadSampleMasterBtn: document.getElementById('load-sample-master-btn'),

  exportDataBtn: document.getElementById('export-data-btn'),
  importDataInput: document.getElementById('import-data-input')
};

document.addEventListener('DOMContentLoaded', initialize);

function initialize() {
  renderRoundCountOptions();
  bindEvents();
  loadStorage();
  ensureMasterShape();
  if (!state.visibleWeapons.length) {
    state.visibleWeapons = [...state.master.weapons];
  }
  fillMasterForm();
  renderWeaponFilters();
  renderSelectedChips();
  requestRender();
}

function renderRoundCountOptions() {
  els.roundCount.innerHTML = '';
  for (let i = 1; i <= MAX_ROUNDS; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `${i}回目まで表示`;
    if (i === state.roundCount) option.selected = true;
    els.roundCount.appendChild(option);
  }
}

function bindEvents() {
  els.roundCount.addEventListener('change', () => {
    state.roundCount = Number(els.roundCount.value || 1);
    requestRender();
    showStatus('表示回数を更新しました。');
  });

  els.saveCacheBtn.addEventListener('click', () => {
    saveStorage();
    showStatus('保存しました。');
  });

  els.clearBtn.addEventListener('click', () => {
    if (!window.confirm('メモ内容をクリアします。よろしいですか？')) return;
    state.notes = {};
    requestRender();
    saveStorage();
    showStatus('メモをクリアしました。');
  });

  els.openSeriesModal.addEventListener('click', () => openSkillModal('series'));
  els.openGroupModal.addEventListener('click', () => openSkillModal('group'));
  els.closeModalBtn.addEventListener('click', closeSkillModal);
  els.modalCloseFooterBtn.addEventListener('click', closeSkillModal);

  els.modalClearSelectionBtn.addEventListener('click', () => {
    if (state.modalType === 'series') state.requiredSeries = [];
    if (state.modalType === 'group') state.requiredGroup = [];
    renderSkillModal();
    renderSelectedChips();
    requestRender();
    saveStorage();
  });

  els.skillSearch.addEventListener('input', renderSkillModal);
  els.skillModal.addEventListener('click', (event) => {
    if (event.target.closest('.modal-backdrop')) closeSkillModal();
  });

  els.filterSelectAllBtn.addEventListener('click', () => {
    state.visibleWeapons = [...state.master.weapons];
    renderWeaponFilters();
    requestRender();
    saveStorage();
  });

  els.filterClearAllBtn.addEventListener('click', () => {
    state.visibleWeapons = [];
    renderWeaponFilters();
    requestRender();
    saveStorage();
  });

  els.filterToggleBtn.addEventListener('click', () => {
    state.filterCollapsed = !state.filterCollapsed;
    els.weaponFilterBox.classList.toggle('hidden', state.filterCollapsed);
    saveStorage();
  });

  els.openMasterModal.addEventListener('click', openMasterModal);
  els.closeMasterModalBtn.addEventListener('click', closeMasterModal);
  els.masterModal.addEventListener('click', (event) => {
    if (event.target.closest('.modal-backdrop')) closeMasterModal();
  });
  els.saveMasterBtn.addEventListener('click', saveMasterFromForm);
  els.resetMasterBtn.addEventListener('click', resetMasterToCurrent);
  els.loadSampleMasterBtn.addEventListener('click', () => {
    state.master = structuredClone(SAMPLE_MASTER);
    fillMasterForm();
    showStatus('サンプルを読み込みました。');
  });

  els.exportDataBtn.addEventListener('click', exportJson);
  els.importDataInput.addEventListener('change', importJson);

  window.addEventListener('resize', debounce(() => {
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    if (isMobile !== state.isMobile) {
      state.isMobile = isMobile;
      requestRender();
    }
  }, 120));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!els.skillModal.classList.contains('hidden')) closeSkillModal();
      if (!els.masterModal.classList.contains('hidden')) closeMasterModal();
      closeAllSuggestLists();
    }
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.suggest-wrap')) closeAllSuggestLists();
  });
}

function ensureMasterShape() {
  state.master = state.master || {};
  state.master.weapons = uniqueKeepOrder(state.master.weapons || SAMPLE_MASTER.weapons);
  state.master.seriesSkills = uniqueKeepOrder(state.master.seriesSkills || SAMPLE_MASTER.seriesSkills);
  state.master.groupSkills = uniqueKeepOrder(state.master.groupSkills || SAMPLE_MASTER.groupSkills);
  state.visibleWeapons = (state.visibleWeapons || []).filter(v => state.master.weapons.includes(v));
  if (!state.visibleWeapons.length) state.visibleWeapons = [...state.master.weapons];
}

function loadStorage() {
  try {
    const raw = localStorage.getItem(APP_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.master = parsed.master || state.master;
    state.roundCount = clampNumber(parsed.roundCount, 1, MAX_ROUNDS, 7);
    state.notes = parsed.notes && typeof parsed.notes === 'object' ? parsed.notes : {};
    state.requiredSeries = Array.isArray(parsed.requiredSeries) ? parsed.requiredSeries.slice(0, REQUIRED_LIMIT) : [];
    state.requiredGroup = Array.isArray(parsed.requiredGroup) ? parsed.requiredGroup.slice(0, REQUIRED_LIMIT) : [];
    state.visibleWeapons = Array.isArray(parsed.visibleWeapons) ? parsed.visibleWeapons : [];
    state.filterCollapsed = !!parsed.filterCollapsed;
    els.roundCount.value = String(state.roundCount);
  } catch (error) {
    console.warn('保存データの読込に失敗しました。', error);
  }
}

function saveStorage() {
  const payload = {
    master: state.master,
    roundCount: state.roundCount,
    notes: state.notes,
    requiredSeries: state.requiredSeries,
    requiredGroup: state.requiredGroup,
    visibleWeapons: state.visibleWeapons,
    filterCollapsed: state.filterCollapsed
  };
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(payload));
}

function exportJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'lotteryMemoTool',
    version: 1,
    data: {
      master: state.master,
      roundCount: state.roundCount,
      notes: state.notes,
      requiredSeries: state.requiredSeries,
      requiredGroup: state.requiredGroup,
      visibleWeapons: state.visibleWeapons,
      filterCollapsed: state.filterCollapsed
    }
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lottery-memo-backup-${formatDateForFile(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showStatus('データを書き出しました。');
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const data = parsed.data || parsed;
      state.master = data.master || state.master;
      state.roundCount = clampNumber(data.roundCount, 1, MAX_ROUNDS, 7);
      state.notes = data.notes && typeof data.notes === 'object' ? data.notes : {};
      state.requiredSeries = Array.isArray(data.requiredSeries) ? data.requiredSeries.slice(0, REQUIRED_LIMIT) : [];
      state.requiredGroup = Array.isArray(data.requiredGroup) ? data.requiredGroup.slice(0, REQUIRED_LIMIT) : [];
      state.visibleWeapons = Array.isArray(data.visibleWeapons) ? data.visibleWeapons : [];
      state.filterCollapsed = !!data.filterCollapsed;

      ensureMasterShape();
      els.roundCount.value = String(state.roundCount);
      fillMasterForm();
      renderWeaponFilters();
      renderSelectedChips();
      requestRender();
      saveStorage();
      showStatus('データを読み込みました。');
    } catch (error) {
      alert('JSONの読み込みに失敗しました。');
      console.error(error);
    } finally {
      els.importDataInput.value = '';
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function openMasterModal() {
  fillMasterForm();
  els.masterModal.classList.remove('hidden');
}

function closeMasterModal() {
  els.masterModal.classList.add('hidden');
}

function fillMasterForm() {
  els.masterWeapons.value = (state.master.weapons || []).join('\n');
  els.masterSeries.value = (state.master.seriesSkills || []).join('\n');
  els.masterGroup.value = (state.master.groupSkills || []).join('\n');
}

function saveMasterFromForm() {
  const nextMaster = {
    weapons: parseLineList(els.masterWeapons.value),
    seriesSkills: parseLineList(els.masterSeries.value),
    groupSkills: parseLineList(els.masterGroup.value)
  };

  if (!nextMaster.weapons.length) {
    alert('武器種は1件以上必要です。');
    return;
  }
  if (!nextMaster.seriesSkills.length) {
    alert('シリーズスキルは1件以上必要です。');
    return;
  }
  if (!nextMaster.groupSkills.length) {
    alert('グループスキルは1件以上必要です。');
    return;
  }

  state.master = nextMaster;
  state.visibleWeapons = state.visibleWeapons.filter(v => nextMaster.weapons.includes(v));
  if (!state.visibleWeapons.length) state.visibleWeapons = [...nextMaster.weapons];
  state.requiredSeries = state.requiredSeries.filter(v => nextMaster.seriesSkills.includes(v));
  state.requiredGroup = state.requiredGroup.filter(v => nextMaster.groupSkills.includes(v));

  renderWeaponFilters();
  renderSelectedChips();
  requestRender();
  saveStorage();
  closeMasterModal();
  showStatus('Masterを保存しました。');
}

function resetMasterToCurrent() {
  fillMasterForm();
  showStatus('入力欄を現在の保存内容に戻しました。');
}

function parseLineList(text) {
  return uniqueKeepOrder(
    String(text || '')
      .split(/\r?\n/)
      .map(v => v.trim())
      .filter(Boolean)
  );
}

function renderWeaponFilters() {
  els.weaponFilterBox.innerHTML = '';
  els.weaponFilterBox.classList.toggle('hidden', state.filterCollapsed);
  state.master.weapons.forEach(weapon => {
    const label = document.createElement('label');
    label.className = 'weapon-filter-item';
    label.innerHTML = `<input type="checkbox" ${state.visibleWeapons.includes(weapon) ? 'checked' : ''}><span>${escapeHtml(weapon)}</span>`;
    const checkbox = label.querySelector('input');
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        if (!state.visibleWeapons.includes(weapon)) state.visibleWeapons.push(weapon);
      } else {
        state.visibleWeapons = state.visibleWeapons.filter(v => v !== weapon);
      }
      requestRender();
      saveStorage();
    });
    els.weaponFilterBox.appendChild(label);
  });
}

function openSkillModal(type) {
  state.modalType = type;
  els.skillSearch.value = '';
  renderSkillModal();
  els.skillModal.classList.remove('hidden');
}

function closeSkillModal() {
  els.skillModal.classList.add('hidden');
  state.modalType = null;
}

function renderSkillModal() {
  const isSeries = state.modalType === 'series';
  const sourceList = isSeries ? state.master.seriesSkills : state.master.groupSkills;
  const selectedList = isSeries ? state.requiredSeries : state.requiredGroup;
  const keyword = normalizeText(els.skillSearch.value);

  els.modalTitle.textContent = isSeries ? '必要スキル選択（シリーズ）' : '必要スキル選択（グループ）';
  els.modalSubtext.textContent = `最大${REQUIRED_LIMIT}個まで選択できます。`;
  els.modalCountText.textContent = `${selectedList.length} / ${REQUIRED_LIMIT}`;
  els.skillList.innerHTML = '';

  sourceList.filter(skill => !keyword || normalizeText(skill).includes(keyword)).forEach(skill => {
    const wrap = document.createElement('label');
    wrap.className = 'skill-option';
    wrap.innerHTML = `<input type="checkbox" ${selectedList.includes(skill) ? 'checked' : ''}><span class="skill-option-text">${escapeHtml(skill)}</span>`;
    wrap.querySelector('input').addEventListener('change', (event) => updateRequiredList(isSeries ? 'series' : 'group', skill, event.target.checked));
    els.skillList.appendChild(wrap);
  });
}

function updateRequiredList(type, skill, shouldAdd) {
  const list = type === 'series' ? state.requiredSeries : state.requiredGroup;
  if (shouldAdd) {
    if (list.includes(skill)) return;
    if (list.length >= REQUIRED_LIMIT) {
      alert(`必要スキルは最大${REQUIRED_LIMIT}個までです。`);
      renderSkillModal();
      return;
    }
    list.push(skill);
  } else {
    const index = list.indexOf(skill);
    if (index >= 0) list.splice(index, 1);
  }
  renderSkillModal();
  renderSelectedChips();
  requestRender();
  saveStorage();
}

function renderSelectedChips() {
  renderChipArea(els.seriesSelectedChips, state.requiredSeries, 'series');
  renderChipArea(els.groupSelectedChips, state.requiredGroup, 'group');
}

function renderChipArea(container, list, type) {
  container.innerHTML = '';
  if (!list.length) {
    const empty = document.createElement('span');
    empty.className = 'control-help';
    empty.textContent = '未選択';
    container.appendChild(empty);
    return;
  }
  list.forEach(skill => {
    const chip = document.createElement('span');
    chip.className = `skill-chip ${type === 'group' ? 'group-chip' : ''}`;
    chip.innerHTML = `<span>${escapeHtml(skill)}</span><button class="chip-remove" type="button">×</button>`;
    chip.querySelector('.chip-remove').addEventListener('click', () => {
      if (type === 'series') state.requiredSeries = state.requiredSeries.filter(v => v !== skill);
      if (type === 'group') state.requiredGroup = state.requiredGroup.filter(v => v !== skill);
      renderSelectedChips();
      requestRender();
      saveStorage();
    });
    container.appendChild(chip);
  });
}

function requestRender() {
  if (state.renderTimer) cancelAnimationFrame(state.renderTimer);
  state.renderTimer = requestAnimationFrame(renderView);
}

function renderView() {
  closeAllSuggestLists();
  if (state.isMobile) {
    els.desktopSection.classList.add('hidden');
    els.mobileSection.classList.remove('hidden');
    renderMobileCards();
  } else {
    els.desktopSection.classList.remove('hidden');
    els.mobileSection.classList.add('hidden');
    renderDesktopTable();
  }
}

function renderDesktopTable() {
  const weapons = getVisibleWeapons();
  els.memoTable.innerHTML = '';
  if (!weapons.length) {
    els.memoTable.innerHTML = '<tr><td style="padding:16px;">表示対象の武器種がありません。</td></tr>';
    return;
  }
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th class="corner-head">回数</th>';
  weapons.forEach(weapon => {
    const th = document.createElement('th');
    th.className = 'weapon-head';
    th.textContent = weapon;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  els.memoTable.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (let round = 1; round <= state.roundCount; round++) {
    const tr = document.createElement('tr');
    const label = document.createElement('td');
    label.className = `round-label round-tone-${(round - 1) % 7}`;
    label.innerHTML = `<div class="round-label-inner"><span>${round}回目</span><small>シリーズ / グループ</small></div>`;
    tr.appendChild(label);
    weapons.forEach(weapon => {
      const td = document.createElement('td');
      td.className = 'memo-cell';
      td.appendChild(createCellContent(round, weapon));
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  els.memoTable.appendChild(tbody);
}

function renderMobileCards() {
  const weapons = getVisibleWeapons();
  els.mobileCardArea.innerHTML = '';
  if (!weapons.length) {
    els.mobileCardArea.innerHTML = '<div class="control-help">表示対象の武器種がありません。</div>';
    return;
  }
  const fragment = document.createDocumentFragment();
  for (let round = 1; round <= state.roundCount; round++) {
    const card = document.createElement('section');
    card.className = 'round-card';
    card.innerHTML = `<div class="round-card-head round-tone-${(round - 1) % 7}">${round}回目</div>`;
    const body = document.createElement('div');
    body.className = 'round-card-body';
    weapons.forEach(weapon => {
      const weaponCard = document.createElement('div');
      weaponCard.className = 'weapon-card';
      weaponCard.innerHTML = `<h3 class="weapon-card-title">${escapeHtml(weapon)}</h3>`;
      weaponCard.appendChild(createCellContent(round, weapon));
      body.appendChild(weaponCard);
    });
    card.appendChild(body);
    fragment.appendChild(card);
  }
  els.mobileCardArea.appendChild(fragment);
}

function createCellContent(round, weapon) {
  const wrap = document.createElement('div');
  wrap.className = 'cell-stack';
  wrap.appendChild(createSkillBox(round, weapon, 'series'));
  wrap.appendChild(createSkillBox(round, weapon, 'group'));
  return wrap;
}

function createSkillBox(round, weapon, type) {
  const value = getNoteValue(round, weapon, type);
  const matched = type === 'series'
    ? state.requiredSeries.includes(value.trim()) && !!value.trim()
    : state.requiredGroup.includes(value.trim()) && !!value.trim();

  const box = document.createElement('div');
  box.className = `skill-box ${matched ? (type === 'series' ? 'series-match' : 'group-match') : ''}`;
  box.innerHTML = `<label class="skill-box-label">${type === 'series' ? 'シリーズスキル' : 'グループスキル'}</label>`;

  const suggestWrap = document.createElement('div');
  suggestWrap.className = 'suggest-wrap';
  const input = document.createElement('input');
  input.className = 'skill-input';
  input.type = 'text';
  input.value = value;
  input.placeholder = '入力または候補から選択';
  input.dataset.round = String(round);
  input.dataset.weapon = weapon;
  input.dataset.type = type;
  input.autocomplete = 'off';

  const suggestList = document.createElement('div');
  suggestList.className = 'suggest-list hidden';

  input.addEventListener('focus', () => openSuggestList(input, suggestList));
  input.addEventListener('input', () => {
    setNoteValue(round, weapon, type, input.value || '');
    updateInputHighlight(input, type, input.value || '');
    openSuggestList(input, suggestList);
    saveStorage();
  });
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (!suggestList.matches(':hover')) suggestList.classList.add('hidden');
    }, 150);
  });

  suggestWrap.appendChild(input);
  suggestWrap.appendChild(suggestList);
  box.appendChild(suggestWrap);
  return box;
}

function openSuggestList(input, suggestList) {
  closeAllSuggestLists(suggestList);
  const keyword = normalizeText(input.value);
  const source = input.dataset.type === 'series' ? state.master.seriesSkills : state.master.groupSkills;
  const filtered = source.filter(skill => !keyword || normalizeText(skill).includes(keyword)).slice(0, 50);
  suggestList.innerHTML = '';
  if (!filtered.length) {
    suggestList.innerHTML = '<div class="suggest-empty">候補がありません</div>';
    suggestList.classList.remove('hidden');
    return;
  }
  filtered.forEach(skill => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'suggest-item';
    btn.textContent = skill;
    btn.addEventListener('mousedown', event => event.preventDefault());
    btn.addEventListener('click', () => {
      input.value = skill;
      setNoteValue(Number(input.dataset.round), input.dataset.weapon, input.dataset.type, skill);
      updateInputHighlight(input, input.dataset.type, skill);
      suggestList.classList.add('hidden');
      saveStorage();
    });
    suggestList.appendChild(btn);
  });
  suggestList.classList.remove('hidden');
}

function closeAllSuggestLists(except) {
  document.querySelectorAll('.suggest-list').forEach(list => {
    if (except && list === except) return;
    list.classList.add('hidden');
  });
}

function updateInputHighlight(input, type, value) {
  const skillBox = input.closest('.skill-box');
  if (!skillBox) return;
  skillBox.classList.toggle('series-match', type === 'series' && state.requiredSeries.includes(value.trim()) && !!value.trim());
  skillBox.classList.toggle('group-match', type === 'group' && state.requiredGroup.includes(value.trim()) && !!value.trim());
}

function getVisibleWeapons() {
  return state.master.weapons.filter(weapon => state.visibleWeapons.includes(weapon));
}

function getNoteKey(round, weapon, type) {
  return `${round}__${weapon}__${type}`;
}

function getNoteValue(round, weapon, type) {
  return state.notes[getNoteKey(round, weapon, type)] || '';
}

function setNoteValue(round, weapon, type, value) {
  state.notes[getNoteKey(round, weapon, type)] = value;
}

function normalizeText(text) {
  return String(text || '').trim().toLowerCase().normalize('NFKC');
}

function uniqueKeepOrder(arr) {
  const seen = new Set();
  return arr.filter(item => {
    const value = String(item || '').trim();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function formatDateForFile(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}${m}${d}-${h}${min}`;
}

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function showStatus(message) {
  els.saveMessage.textContent = message;
  clearTimeout(showStatus.timer);
  showStatus.timer = setTimeout(() => { els.saveMessage.textContent = ''; }, 2500);
}
