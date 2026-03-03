const APP_STORAGE_KEY = 'lotteryMemoTool_v3';
const MAX_ROUNDS = 30;
const REQUIRED_LIMIT = 10;
const MOBILE_BREAKPOINT = 768;
const TAB_KEYS = ['attribute', 'attack', 'critical'];
const TAB_LABELS = {
  attribute: '属性',
  attack: '攻撃',
  critical: '会心'
};

const SAMPLE_MASTER = {
  weapons: ['大剣', '太刀', '片手剣', '双剣', 'ランス', 'ライト'],
  seriesSkills: ['火竜の力', '雷顎竜の闘志', '白熾龍の脈動', '泡狐竜の力', '氷牙竜の執念'],
  groupSkills: ['鱗張りの技法', '守勢の構え', '連撃強化', 'スタミナ補助', '回避の極意']
};

const state = {
  master: deepClone(SAMPLE_MASTER),
  roundCount: 7,
  notes: {},
  roundStates: {},
  cellTabs: {},
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
  saveCacheBtn: document.getElementById('save-cache-btn'),
  deleteFirstRoundBtn: document.getElementById('delete-first-round-btn'),
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

  memoTable: document.getElementById('memo-table'),
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

  els.deleteFirstRoundBtn.addEventListener('click', () => {
    deleteRoundAt(1, true);
  });

  els.clearBtn.addEventListener('click', () => {
    if (!window.confirm('メモ内容をすべてクリアします。よろしいですか？')) return;
    state.notes = {};
    state.roundStates = {};
    state.cellTabs = {};
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
    state.master = deepClone(SAMPLE_MASTER);
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
    state.roundStates = parsed.roundStates && typeof parsed.roundStates === 'object' ? parsed.roundStates : {};
    state.cellTabs = parsed.cellTabs && typeof parsed.cellTabs === 'object' ? parsed.cellTabs : {};
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
    roundStates: state.roundStates,
    cellTabs: state.cellTabs,
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
    version: 2,
    data: {
      master: state.master,
      roundCount: state.roundCount,
      notes: state.notes,
      roundStates: state.roundStates,
      cellTabs: state.cellTabs,
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
      state.roundStates = data.roundStates && typeof data.roundStates === 'object' ? data.roundStates : {};
      state.cellTabs = data.cellTabs && typeof data.cellTabs === 'object' ? data.cellTabs : {};
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

  if (!nextMaster.weapons.length) return alert('武器種は1件以上必要です。');
  if (!nextMaster.seriesSkills.length) return alert('シリーズスキルは1件以上必要です。');
  if (!nextMaster.groupSkills.length) return alert('グループスキルは1件以上必要です。');

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
  return uniqueKeepOrder(String(text || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean));
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

  sourceList
    .filter(skill => !keyword || normalizeText(skill).includes(keyword))
    .forEach(skill => {
      const wrap = document.createElement('label');
      wrap.className = 'skill-option';
      wrap.innerHTML = `<input type="checkbox" ${selectedList.includes(skill) ? 'checked' : ''}><span class="skill-option-text">${escapeHtml(skill)}</span>`;
      wrap.querySelector('input').addEventListener('change', (event) => {
        updateRequiredList(isSeries ? 'series' : 'group', skill, event.target.checked);
      });
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
    if (isRoundCompleted(round)) tr.classList.add('completed-row');

    const label = document.createElement('td');
    label.className = `round-label round-tone-${(round - 1) % 7}`;
    label.appendChild(createRoundLabel(round, false));
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
    card.className = `round-card ${isRoundCompleted(round) ? 'completed-card' : ''}`;

    const head = document.createElement('div');
    head.className = `round-card-head round-tone-${(round - 1) % 7}`;
    head.textContent = `${round}回目`;
    card.appendChild(head);

    const meta = document.createElement('div');
    meta.className = 'round-card-meta';
    meta.appendChild(createRoundCompleteToggle(round));

    const actions = document.createElement('div');
    actions.className = 'round-card-actions';
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'round-delete-btn';
    deleteBtn.textContent = 'この回を削除';
    deleteBtn.addEventListener('click', () => deleteRoundAt(round));
    actions.appendChild(deleteBtn);
    meta.appendChild(actions);
    card.appendChild(meta);

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

function createRoundLabel(round) {
  const wrap = document.createElement('div');
  wrap.className = 'round-label-inner';

  const top = document.createElement('div');
  top.className = 'round-label-top';
  top.innerHTML = `<span>${round}回目</span>`;
  wrap.appendChild(top);

  const small = document.createElement('small');
  small.textContent = '属性 / 攻撃 / 会心';
  wrap.appendChild(small);

  const controls = document.createElement('div');
  controls.className = 'round-control-row';
  controls.appendChild(createRoundCompleteToggle(round));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'round-delete-btn';
  deleteBtn.textContent = round === 1 ? '先頭削除' : 'この回を削除';
  deleteBtn.addEventListener('click', () => deleteRoundAt(round, round === 1));
  controls.appendChild(deleteBtn);
  wrap.appendChild(controls);

  return wrap;
}

function createRoundCompleteToggle(round) {
  const label = document.createElement('label');
  label.innerHTML = `<input class="round-complete-checkbox" type="checkbox" ${isRoundCompleted(round) ? 'checked' : ''}><span>完了</span>`;
  const checkbox = label.querySelector('input');
  label.style.display = 'inline-flex';
  label.style.alignItems = 'center';
  label.style.gap = '6px';
  label.style.fontWeight = '700';
  checkbox.addEventListener('change', () => {
    setRoundCompleted(round, checkbox.checked);
    requestRender();
    saveStorage();
  });
  return label;
}

function createCellContent(round, weapon) {
  const wrap = document.createElement('div');
  wrap.className = 'cell-stack';
  wrap.appendChild(createTabbedSkillBox(round, weapon, 'series'));
  wrap.appendChild(createTabbedSkillBox(round, weapon, 'group'));
  return wrap;
}

function createTabbedSkillBox(round, weapon, type) {
  const box = document.createElement('div');
  box.className = 'skill-box';

  const label = document.createElement('label');
  label.className = 'skill-box-label';
  label.textContent = type === 'series' ? 'シリーズスキル' : 'グループスキル';
  box.appendChild(label);

  const tabs = document.createElement('div');
  tabs.className = 'cell-tabs';
  box.appendChild(tabs);

  const activeTab = getCellTab(round, weapon, type);
  const panelWrap = document.createElement('div');
  box.appendChild(panelWrap);

  TAB_KEYS.forEach(tabKey => {
    const tabBtn = document.createElement('button');
    tabBtn.type = 'button';
    tabBtn.className = `cell-tab-btn ${activeTab === tabKey ? 'is-active' : ''}`;
    tabBtn.textContent = TAB_LABELS[tabKey];
    tabBtn.addEventListener('click', () => {
      setCellTab(round, weapon, type, tabKey);
      updateTabUI(box, round, weapon, type);
      saveStorage();
    });
    tabs.appendChild(tabBtn);

    const panel = document.createElement('div');
    panel.className = `tab-panel ${activeTab === tabKey ? 'is-active' : ''}`;
    panel.dataset.tab = tabKey;
    panel.appendChild(createInputArea(round, weapon, type, tabKey));
    panelWrap.appendChild(panel);
  });

  const currentValue = getNoteValue(round, weapon, activeTab, type);
  applySkillBoxHighlight(box, type, currentValue);
  return box;
}

function updateTabUI(box, round, weapon, type) {
  const activeTab = getCellTab(round, weapon, type);
  box.querySelectorAll('.cell-tab-btn').forEach((btn, index) => {
    const tabKey = TAB_KEYS[index];
    btn.classList.toggle('is-active', tabKey === activeTab);
  });
  box.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('is-active', panel.dataset.tab === activeTab);
  });
  const value = getNoteValue(round, weapon, activeTab, type);
  applySkillBoxHighlight(box, type, value);
}

function createInputArea(round, weapon, type, tabKey) {
  const suggestWrap = document.createElement('div');
  suggestWrap.className = 'suggest-wrap';

  const input = document.createElement('input');
  input.className = 'skill-input';
  input.type = 'text';
  input.value = getNoteValue(round, weapon, tabKey, type);
  input.placeholder = `${TAB_LABELS[tabKey]} / 入力または候補から選択`;
  input.dataset.round = String(round);
  input.dataset.weapon = weapon;
  input.dataset.type = type;
  input.dataset.tab = tabKey;
  input.autocomplete = 'off';

  const suggestList = document.createElement('div');
  suggestList.className = 'suggest-list hidden';

  input.addEventListener('focus', () => openSuggestList(input, suggestList));
  input.addEventListener('input', () => {
    setNoteValue(round, weapon, tabKey, type, input.value || '');
    if (getCellTab(round, weapon, type) === tabKey) {
      applySkillBoxHighlight(input.closest('.skill-box'), type, input.value || '');
    }
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
  return suggestWrap;
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
      setNoteValue(Number(input.dataset.round), input.dataset.weapon, input.dataset.tab, input.dataset.type, skill);
      if (getCellTab(Number(input.dataset.round), input.dataset.weapon, input.dataset.type) === input.dataset.tab) {
        applySkillBoxHighlight(input.closest('.skill-box'), input.dataset.type, skill);
      }
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

function applySkillBoxHighlight(skillBox, type, value) {
  if (!skillBox) return;
  const trimmed = String(value || '').trim();
  skillBox.classList.toggle('series-match', type === 'series' && state.requiredSeries.includes(trimmed) && !!trimmed);
  skillBox.classList.toggle('group-match', type === 'group' && state.requiredGroup.includes(trimmed) && !!trimmed);
}

function deleteRoundAt(targetRound, fromTop = false) {
  if (state.roundCount < 1) return;
  const label = fromTop ? '1回目を削除して、下の行を繰り上げます。よろしいですか？' : `${targetRound}回目を削除して、下の行を繰り上げます。よろしいですか？`;
  if (!window.confirm(label)) return;

  const nextNotes = {};
  const nextRoundStates = {};
  const nextCellTabs = {};

  for (let round = 1; round <= state.roundCount; round++) {
    if (round === targetRound) continue;
    const newRound = round > targetRound ? round - 1 : round;

    for (const weapon of state.master.weapons) {
      for (const type of ['series', 'group']) {
        TAB_KEYS.forEach(tabKey => {
          const value = getNoteValue(round, weapon, tabKey, type);
          if (value) nextNotes[getNoteKey(newRound, weapon, tabKey, type)] = value;
        });
        const tabState = getCellTab(round, weapon, type, false);
        if (tabState) nextCellTabs[getCellTabKey(newRound, weapon, type)] = tabState;
      }
    }

    if (isRoundCompleted(round)) {
      nextRoundStates[newRound] = true;
    }
  }

  state.notes = nextNotes;
  state.roundStates = nextRoundStates;
  state.cellTabs = nextCellTabs;
  state.roundCount = Math.max(1, state.roundCount - 1);
  els.roundCount.value = String(state.roundCount);
  requestRender();
  saveStorage();
  showStatus(`${targetRound}回目を削除しました。`);
}

function getVisibleWeapons() {
  return state.master.weapons.filter(weapon => state.visibleWeapons.includes(weapon));
}

function getRoundStateKey(round) {
  return String(round);
}

function isRoundCompleted(round) {
  return !!state.roundStates[getRoundStateKey(round)];
}

function setRoundCompleted(round, isCompleted) {
  const key = getRoundStateKey(round);
  if (isCompleted) {
    state.roundStates[key] = true;
  } else {
    delete state.roundStates[key];
  }
}

function getCellTabKey(round, weapon, type) {
  return `${round}__${weapon}__${type}`;
}

function getCellTab(round, weapon, type, ensureDefault = true) {
  const key = getCellTabKey(round, weapon, type);
  if (!state.cellTabs[key] && ensureDefault) {
    state.cellTabs[key] = 'attribute';
  }
  return state.cellTabs[key] || '';
}

function setCellTab(round, weapon, type, tabKey) {
  state.cellTabs[getCellTabKey(round, weapon, type)] = tabKey;
}

function getNoteKey(round, weapon, tabKey, type) {
  return `${round}__${weapon}__${tabKey}__${type}`;
}

function getNoteValue(round, weapon, tabKey, type) {
  return state.notes[getNoteKey(round, weapon, tabKey, type)] || '';
}

function setNoteValue(round, weapon, tabKey, type, value) {
  const key = getNoteKey(round, weapon, tabKey, type);
  if (value) {
    state.notes[key] = value;
  } else {
    delete state.notes[key];
  }
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

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function showStatus(message) {
  els.saveMessage.textContent = message;
  clearTimeout(showStatus.timer);
  showStatus.timer = setTimeout(() => {
    els.saveMessage.textContent = '';
  }, 2600);
}
