import { renderIcon } from './icons.js';

// ── Static data ported from the design's Component/AnimalCard scripts ──────
const FACT_FIELDS = [
  { key: 'height', label: 'Height', icon: 'arrow-up' },
  { key: 'weight', label: 'Weight', icon: 'dumbbell' },
  { key: 'length', label: 'Length', icon: 'move-horizontal' },
  { key: 'lifespan', label: 'Lifespan', icon: 'clock' },
  { key: 'diet', label: 'Diet', icon: 'leaf' },
  { key: 'habitat', label: 'Habitat', icon: 'mountain' },
  { key: 'speed', label: 'Speed', icon: 'zap' },
  { key: 'range', label: 'Range', icon: 'map-pin' }
];

function factValueStyle(value) {
  const len = String(value || '').length;
  const size = len <= 14 ? 17 : len <= 20 ? 16 : len <= 26 ? 15 : len <= 34 ? 14 : len <= 42 ? 13 : 12;
  return 'font-size:' + size + 'px;font-weight:600;line-height:1.3;color:var(--color-text);white-space:nowrap;';
}

const STATUS_STYLES = {
  'Least Concern': { bg: 'var(--color-accent-2-100)', fg: 'var(--color-accent-2-800)' },
  'Near Threatened': { bg: 'var(--color-accent-100)', fg: 'var(--color-accent-700)' },
  'Vulnerable': { bg: 'var(--color-accent-200)', fg: 'var(--color-accent-800)' },
  'Endangered': { bg: 'var(--color-accent-300)', fg: 'var(--color-accent-900)' },
  'Critically Endangered': { bg: 'var(--color-accent-300)', fg: 'var(--color-accent-900)' },
  'Extinct': { bg: 'var(--color-neutral-300)', fg: 'var(--color-neutral-800)' },
  'Domesticated': { bg: 'var(--color-neutral-200)', fg: 'var(--color-neutral-700)' },
  'Not Evaluated': { bg: 'var(--color-neutral-200)', fg: 'var(--color-neutral-700)' }
};

const HABITAT_OPTIONS = ['Savanna', 'Forest', 'Rainforest', 'Desert', 'Arctic & Tundra', 'Ocean', 'Freshwater', 'Grassland', 'Farm'];
const DIET_OPTIONS = ['Carnivore', 'Herbivore', 'Omnivore'];
const CONTINENT_OPTIONS = ['Africa', 'Antarctica', 'Asia', 'Arctic Ocean', 'Atlantic Ocean', 'Europe', 'Indian Ocean', 'North America', 'Oceania', 'Pacific Ocean', 'South America', 'Worldwide'];
const SIZE_OPTIONS = ['Small', 'Medium', 'Large', 'Giant'];
const DANGER_OPTIONS = ['Low', 'Medium', 'High'];
const BOOL_FILTERS = [
  { key: 'canFly', label: 'Can Fly' }, { key: 'canSwim', label: 'Can Swim' },
  { key: 'canClimb', label: 'Can Climb' }, { key: 'canBePet', label: 'Can Be a Pet' },
  { key: 'nocturnal', label: 'Nocturnal' }, { key: 'endangered', label: 'Endangered' }
];
const DEFAULT_FILTERS = { habitat: null, diet: null, continent: null, size: null, dangerLevel: null, canFly: false, canSwim: false, canClimb: false, canBePet: false, nocturnal: false, endangered: false };

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const PLACEHOLDER_PALETTE = [
  { bg: '#ffe1c2', fg: '#f2914a', dark: '#a85a1c' },
  { bg: '#d6f0c6', fg: '#6cb24a', dark: '#3d6e28' },
  { bg: '#cfe6fb', fg: '#4f9fe0', dark: '#2c6291' },
  { bg: '#fbd7ec', fg: '#e06bb0', dark: '#96336f' }
];
function hueIndex(str) {
  let h = 0;
  const s = String(str || 'x');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % PLACEHOLDER_PALETTE.length;
}
function placeholderSrc(seedId, label) {
  const p = PLACEHOLDER_PALETTE[hueIndex(seedId)];
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
    '<rect width="400" height="300" fill="' + p.bg + '"/>' +
    '<circle cx="152" cy="108" r="36" fill="' + p.fg + '" opacity="0.6"/>' +
    '<path d="M30 232 L146 128 L204 184 L256 140 L370 232 Z" fill="' + p.fg + '"/>' +
    '<text x="200" y="272" font-family="Baloo 2,system-ui,sans-serif" font-size="22" font-weight="700" fill="' + p.dark + '" text-anchor="middle">' + esc(label || 'Photo') + '</text>' +
    '</svg>';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// ── Real photo loading: photos/{id}{n}.{ext}, cascading through common
// extensions, falling back to the generated placeholder if none exist yet. ──
const ANIMALS_BY_ID = {};
const PHOTO_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'JPG', 'JPEG', 'PNG', 'WEBP'];

window.__photoFallback = function (el, id, n, step) {
  if (step < PHOTO_EXTS.length) {
    el.src = './photos/' + id + n + '.' + PHOTO_EXTS[step];
    el.setAttribute('onerror', "window.__photoFallback(this,'" + id + "'," + n + "," + (step + 1) + ")");
  } else {
    el.removeAttribute('onerror');
    el.src = placeholderSrc(id, ANIMALS_BY_ID[id] || id);
  }
};

function photoImg(id, n, caption, style) {
  return `<img src="./photos/${id}${n}.${PHOTO_EXTS[0]}" alt="${esc(caption)}" style="${style}" onerror="window.__photoFallback(this,'${id}',${n},1)">`;
}

// ── Delegated event-action registry (innerHTML can't hold live function refs) ──
const Actions = {
  map: new Map(), id: 0,
  reset() { this.map = new Map(); this.id = 0; },
  reg(fn) { const id = this.id++; this.map.set(id, fn); return id; }
};

function renderAnimalCard(animal, isFavorite, showSciName, onTap, onToggleFavorite) {
  const hero = (animal.images && animal.images[0]) || { id: animal.id + '-1', caption: animal.name };
  const favColor = isFavorite ? 'var(--color-accent-600)' : 'var(--color-neutral-500)';
  const favLabel = (isFavorite ? 'Remove ' : 'Add ') + animal.name + (isFavorite ? ' from favorites' : ' to favorites');
  const tapId = Actions.reg(() => onTap(animal.id));
  const keyId = Actions.reg((e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(animal.id); } });
  const favId = Actions.reg((e) => { e.stopPropagation(); onToggleFavorite(animal.id); });
  return `
    <div role="button" tabindex="0" aria-label="${esc(animal.name)}" data-onclick="${tapId}" data-onkeydown="${keyId}" style="display:flex;flex-direction:column;height:100%;width:100%;background:var(--color-surface);border-radius:calc(var(--radius-lg) * 1.15);overflow:hidden;box-shadow:var(--shadow-sm);cursor:pointer;">
      <div style="position:relative;width:100%;aspect-ratio:1/1;flex-shrink:0;background:var(--color-neutral-200);">
        ${photoImg(animal.id, 1, hero.caption, 'width:100%;height:100%;object-fit:cover;filter:saturate(0.6) contrast(0.85) brightness(1.1) opacity(0.94);')}
        <button type="button" aria-label="${esc(favLabel)}" data-onclick="${favId}" style="position:absolute;top:8px;right:8px;width:42px;height:42px;border-radius:999px;border:none;background:color-mix(in srgb, var(--color-bg) 88%, transparent);box-shadow:var(--shadow-sm);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;">
          ${renderIcon('heart', 22, favColor, 2.75, isFavorite)}
        </button>
      </div>
      <div style="padding:var(--space-2) var(--space-3) var(--space-3);display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;">
        <div style="font-family:var(--font-heading);font-size:clamp(18px,4vw,22px);line-height:1.2;color:var(--color-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(animal.name)}</div>
        ${showSciName ? `<div style="font-style:italic;font-size:15px;color:var(--color-neutral-600);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(animal.sciName)}</div>` : ''}
      </div>
    </div>`;
}

class App {
  constructor(root) {
    this.root = root;
    this.state = {
      loading: true, loadError: false,
      animals: [], categories: [],
      stack: [{ screen: 'home' }],
      activeTab: 'home',
      favorites: [], recentlyViewed: [],
      searchQuery: '',
      filters: Object.assign({}, DEFAULT_FILTERS),
      showFilterSheet: false,
      galleryOpen: false, galleryIndex: 0, galleryZoomed: false,
      quiz: null
    };
    this.props = { showScientificNames: true, showFunFacts: true, showMapSection: true };
  }

  init() {
    fetch('./animals.json')
      .then(r => r.json())
      .then(data => {
        (data.animals || []).forEach(a => { ANIMALS_BY_ID[a.id] = a.name; });
        this.setState({ animals: data.animals || [], categories: data.categories || [], loading: false });
      })
      .catch(() => this.setState({ loading: false, loadError: true }));
    try {
      const favs = JSON.parse(localStorage.getItem('wildwonders_favorites') || '[]');
      const recent = JSON.parse(localStorage.getItem('wildwonders_recent') || '[]');
      this.state.favorites = Array.isArray(favs) ? favs : [];
      this.state.recentlyViewed = Array.isArray(recent) ? recent : [];
    } catch (e) {}
    this.render();
  }

  setState(patch) {
    const next = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = Object.assign({}, this.state, next);
    this.render();
  }

  push(entry) { this.setState(s => ({ stack: [...s.stack, entry], galleryOpen: false, showFilterSheet: false })); }
  pop = () => { this.setState(s => (s.stack.length > 1 ? { stack: s.stack.slice(0, -1) } : s)); };

  goHome = () => this.setState({ activeTab: 'home', stack: [{ screen: 'home' }], galleryOpen: false, showFilterSheet: false });
  goSearchTab = () => this.setState({ activeTab: 'search', stack: [{ screen: 'search' }], galleryOpen: false, showFilterSheet: false });
  goFavoritesTab = () => this.setState({ activeTab: 'favorites', stack: [{ screen: 'favorites' }], galleryOpen: false, showFilterSheet: false });
  goRandomTab = () => {
    const id = this.pickRandomId();
    if (!id) return;
    this.setState({ activeTab: 'random', stack: [{ screen: 'detail', animalId: id }], galleryOpen: false, showFilterSheet: false });
    this.recordRecent(id);
  };

  pickRandomId(excludeId) {
    const pool = this.state.animals.filter(a => a.id !== excludeId);
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)].id;
  }

  recordRecent(id) {
    this.setState(s => {
      const recent = [id, ...s.recentlyViewed.filter(x => x !== id)].slice(0, 10);
      try { localStorage.setItem('wildwonders_recent', JSON.stringify(recent)); } catch (e) {}
      return { recentlyViewed: recent };
    });
  }

  openAnimal = (id) => {
    this.push({ screen: 'detail', animalId: id });
    this.setState({ galleryIndex: 0, galleryZoomed: false });
    this.recordRecent(id);
  };

  openCategory = (categoryId) => this.push({ screen: 'category', categoryId });
  backOne = () => { this.setState({ galleryOpen: false, showFilterSheet: false }); this.pop(); };

  toggleFavorite = (id) => {
    this.setState(s => {
      const has = s.favorites.indexOf(id) !== -1;
      const favs = has ? s.favorites.filter(x => x !== id) : [...s.favorites, id];
      try { localStorage.setItem('wildwonders_favorites', JSON.stringify(favs)); } catch (e) {}
      return { favorites: favs };
    });
  };

  clearRecent = () => { this.setState({ recentlyViewed: [] }); try { localStorage.setItem('wildwonders_recent', '[]'); } catch (e) {} };

  setSearchQuery = (e) => this.setState({ searchQuery: e.target.value });
  clearSearch = () => this.setState({ searchQuery: '' });
  clearSearchAndFilters = () => this.setState({ searchQuery: '', filters: Object.assign({}, DEFAULT_FILTERS) });

  setSingleFilter(key, value) {
    this.setState(s => ({ filters: Object.assign({}, s.filters, { [key]: s.filters[key] === value ? null : value }) }));
  }
  toggleBoolFilter(key) {
    this.setState(s => ({ filters: Object.assign({}, s.filters, { [key]: !s.filters[key] }) }));
  }
  clearFilters = () => this.setState({ filters: Object.assign({}, DEFAULT_FILTERS) });
  openFilterSheet = () => this.setState({ showFilterSheet: true });
  closeFilterSheet = () => this.setState({ showFilterSheet: false });
  stopClick = (e) => e.stopPropagation();

  matchesFilters(animal) {
    const f = this.state.filters;
    if (f.habitat && animal.traits.habitatTag !== f.habitat) return false;
    if (f.diet && animal.traits.diet !== f.diet) return false;
    if (f.continent && animal.mapRegions.indexOf(f.continent) === -1) return false;
    if (f.size && animal.traits.size !== f.size) return false;
    if (f.dangerLevel && animal.traits.dangerLevel !== f.dangerLevel) return false;
    if (f.canFly && !animal.traits.canFly) return false;
    if (f.canSwim && !animal.traits.canSwim) return false;
    if (f.canClimb && !animal.traits.canClimb) return false;
    if (f.canBePet && !animal.traits.canBePet) return false;
    if (f.nocturnal && !animal.traits.nocturnal) return false;
    if (f.endangered && !animal.traits.endangered) return false;
    return true;
  }

  matchesQuery(animal, q) {
    const s = (q || '').trim().toLowerCase();
    if (!s) return true;
    if (animal.name.toLowerCase().indexOf(s) !== -1) return true;
    if (animal.sciName.toLowerCase().indexOf(s) !== -1) return true;
    if ((animal.nicknames || []).some(n => n.toLowerCase().indexOf(s) !== -1)) return true;
    if (animal.categories.some(c => c.toLowerCase().indexOf(s) !== -1)) return true;
    return false;
  }

  openGallery = (index) => this.setState({ galleryOpen: true, galleryIndex: index, galleryZoomed: false });
  closeGallery = () => this.setState({ galleryOpen: false, galleryZoomed: false });
  galleryStep(delta) {
    this.setState(s => {
      const top = s.stack[s.stack.length - 1];
      const animal = this.state.animals.find(a => a.id === top.animalId);
      if (!animal) return s;
      const n = animal.images.length;
      return { galleryIndex: (s.galleryIndex + delta + n) % n, galleryZoomed: false };
    });
  }
  galleryNext = () => this.galleryStep(1);
  galleryPrev = () => this.galleryStep(-1);
  toggleGalleryZoom = () => this.setState(s => ({ galleryZoomed: !s.galleryZoomed }));

  startQuiz = () => {
    const animals = this.state.animals;
    if (animals.length < 4) return;
    const target = animals[Math.floor(Math.random() * animals.length)];
    const shuffledOthers = animals.filter(a => a.id !== target.id).sort(() => Math.random() - 0.5).slice(0, 3);
    const choiceIds = [...shuffledOthers.map(a => a.id), target.id].sort(() => Math.random() - 0.5);
    this.setState(s => ({
      stack: [...s.stack, { screen: 'quiz' }],
      galleryOpen: false, showFilterSheet: false,
      quiz: { targetId: target.id, choiceIds, cluesShown: 1, answered: false, selectedId: null }
    }));
  };
  quizNextClue = () => this.setState(s => ({ quiz: Object.assign({}, s.quiz, { cluesShown: Math.min(3, s.quiz.cluesShown + 1) }) }));
  quizAnswer(id) {
    if (this.state.quiz.answered) return;
    this.setState(s => ({ quiz: Object.assign({}, s.quiz, { answered: true, selectedId: id }) }));
  }

  withFav(animal) { return Object.assign({}, animal, { isFav: this.state.favorites.indexOf(animal.id) !== -1 }); }

  chip(label, active, onSelect) {
    return {
      label, active,
      style: 'display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:999px;font-size:16px;font-family:var(--font-body);font-weight:600;cursor:pointer;border:1.5px solid ' + (active ? 'var(--color-accent)' : 'var(--color-divider)') + ';background:' + (active ? 'var(--color-accent)' : 'transparent') + ';color:' + (active ? 'var(--color-bg)' : 'var(--color-text)') + ';white-space:nowrap;',
      onSelect
    };
  }

  // ── Focus preservation across full-innerHTML re-renders ─────────────────
  captureFocus() {
    const el = document.activeElement;
    if (el && el.id === 'search-input') return { id: 'search-input', start: el.selectionStart, end: el.selectionEnd };
    return null;
  }
  restoreFocus(f) {
    if (!f) return;
    const el = document.getElementById(f.id);
    if (el) { el.focus(); try { el.setSelectionRange(f.start, f.end); } catch (e) {} }
  }

  render() {
    Actions.reset();
    const v = this.renderVals();
    const focus = this.captureFocus();
    this.root.innerHTML = this.template(v);
    this.restoreFocus(focus);
  }

  renderVals() {
    const showScientificNamesBool = this.props.showScientificNames ?? true;
    const showFunFactsBool = this.props.showFunFacts ?? true;
    const showMapSectionBool = this.props.showMapSection ?? true;

    const { animals, categories, loading, favorites, recentlyViewed, searchQuery, filters, showFilterSheet, stack, activeTab, galleryOpen, galleryIndex, galleryZoomed, quiz } = this.state;

    const top = stack[stack.length - 1];
    const screen = top.screen;
    const isHome = screen === 'home', isSearch = screen === 'search', isFavorites = screen === 'favorites',
      isCategory = screen === 'category', isDetail = screen === 'detail', isQuiz = screen === 'quiz';

    const findAnimal = (id) => animals.find(a => a.id === id) || null;

    const dayIndex = animals.length ? Math.floor(Date.now() / 86400000) % animals.length : 0;
    const animalOfDay = animals.length ? this.withFav(animals[dayIndex]) : null;
    const animalOfDayHero = animalOfDay ? animalOfDay.images[0] : null;
    const animalOfDayName = animalOfDay ? animalOfDay.name : '';
    const animalOfDayImageCaption = animalOfDayHero ? animalOfDayHero.caption : '';
    const animalOfDayImageSrc = animalOfDay ? placeholderSrc(animalOfDay.id, animalOfDay.name) : '';
    const animalOfDayIsFav = animalOfDay ? animalOfDay.isFav : false;
    const animalOfDayFavColor = animalOfDayIsFav ? 'var(--color-accent-600)' : 'var(--color-text)';
    const animalOfDayFavLabel = animalOfDay ? ((animalOfDayIsFav ? 'Remove ' : 'Add ') + animalOfDay.name + (animalOfDayIsFav ? ' from favorites' : ' to favorites')) : '';
    const recentAnimals = recentlyViewed.map(findAnimal).filter(Boolean).map(a => this.withFav(a)).slice(0, 10);
    const favoritePreview = favorites.map(findAnimal).filter(Boolean).map(a => this.withFav(a)).slice(0, 10);
    const CATEGORY_HUES = [
      { bg: 'var(--color-accent-100)', fg: 'var(--color-accent-700)' },
      { bg: 'var(--color-accent-2-100)', fg: 'var(--color-accent-2-700)' },
      { bg: 'var(--color-accent-3-100)', fg: 'var(--color-accent-3-700)' },
      { bg: 'var(--color-accent-4-100)', fg: 'var(--color-accent-4-700)' }
    ];
    const categoryTiles = categories.map((c, idx) => {
      const hue = CATEGORY_HUES[idx % CATEGORY_HUES.length];
      return Object.assign({}, c, {
        badgeStyle: 'width:66px;height:66px;border-radius:999px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:' + hue.bg + ';',
        badgeFg: hue.fg,
        onSelect: () => this.openCategory(c.id)
      });
    });

    let currentCategory = null, categoryAnimals = [];
    if (isCategory) {
      currentCategory = categories.find(c => c.id === top.categoryId) || null;
      categoryAnimals = animals.filter(a => a.categories.indexOf(top.categoryId) !== -1 && this.matchesFilters(a)).map(a => this.withFav(a));
    }

    let searchResults = [];
    if (isSearch) {
      searchResults = animals.filter(a => this.matchesQuery(a, searchQuery) && this.matchesFilters(a)).map(a => this.withFav(a));
    }
    const searchResultsLabel = !searchQuery
      ? ('All ' + searchResults.length + ' Animals')
      : (searchResults.length + (searchResults.length === 1 ? ' result' : ' results') + ' for "' + searchQuery + '"');

    const favoriteAnimalsFull = isFavorites ? favorites.map(findAnimal).filter(Boolean).map(a => this.withFav(a)) : [];

    let currentAnimal = null, quickFactTiles = [], relatedAnimalsList = [], detailThumbs = [],
      statusStyle = '', mapIframeSrc = '', heroImage = null;
    if (isDetail) {
      currentAnimal = findAnimal(top.animalId);
      if (currentAnimal) {
        heroImage = currentAnimal.images[0];
        quickFactTiles = FACT_FIELDS.map(f => ({ key: f.key, label: f.label, icon: f.icon, value: currentAnimal.quickFacts[f.key] }))
          .filter(f => f.value && f.value !== '—')
          .map(f => Object.assign({}, f, { valueStyle: factValueStyle(f.value) }));
        relatedAnimalsList = (currentAnimal.relatedIds || []).map(findAnimal).filter(Boolean).map(a => this.withFav(a));
        detailThumbs = currentAnimal.images.map((img, idx) => Object.assign({}, img, { n: idx + 1, onSelect: () => this.openGallery(idx) }));
        const st = STATUS_STYLES[currentAnimal.conservationStatus] || STATUS_STYLES['Not Evaluated'];
        statusStyle = 'display:inline-flex;align-items:center;padding:4px 12px;border-radius:999px;font-size:14px;font-weight:600;background:' + st.bg + ';color:' + st.fg + ';';
        const regionsParam = encodeURIComponent(currentAnimal.mapRegions.join(','));
        mapIframeSrc = './world-map.html?highlight=' + regionsParam + '&bg=' + encodeURIComponent('#f5ead8') + '&land=' + encodeURIComponent('#dcd3c4') + '&border=' + encodeURIComponent('#f5ead8') + '&accent=' + encodeURIComponent('#c67139');
      }
    }
    const isFavCurrent = currentAnimal ? favorites.indexOf(currentAnimal.id) !== -1 : false;
    const heroImageSrc = heroImage ? placeholderSrc(currentAnimal.id, currentAnimal.name) : '';
    const galleryCount = currentAnimal ? currentAnimal.images.length : 0;
    const galleryImage = currentAnimal ? currentAnimal.images[Math.min(galleryIndex, galleryCount - 1)] : null;
    const galleryImageSrc = galleryImage ? placeholderSrc(currentAnimal.id, currentAnimal.name) : '';

    let quizTargetAnimal = null, quizClueTexts = [], quizChoices = [], quizRevealAnimal = null, quizWasCorrect = false;
    if (isQuiz && quiz) {
      quizTargetAnimal = findAnimal(quiz.targetId);
      if (quizTargetAnimal) {
        quizClueTexts = [
          'Habitat: ' + quizTargetAnimal.quickFacts.habitat,
          'Diet: ' + quizTargetAnimal.quickFacts.diet,
          quizTargetAnimal.funFact
        ].slice(0, quiz.cluesShown);
        quizChoices = quiz.choiceIds.map(id => {
          const a = findAnimal(id);
          const isCorrect = quiz.answered && id === quiz.targetId;
          const isWrongPick = quiz.answered && id === quiz.selectedId && id !== quiz.targetId;
          let bg = 'var(--color-surface)', fg = 'var(--color-text)', border = 'var(--color-divider)';
          if (isCorrect) { bg = 'var(--color-accent-2-200)'; fg = 'var(--color-accent-2-900)'; border = 'var(--color-accent-2-500)'; }
          else if (isWrongPick) { bg = 'var(--color-accent-200)'; fg = 'var(--color-accent-900)'; border = 'var(--color-accent-500)'; }
          return {
            id, name: a ? a.name : '',
            style: 'display:flex;align-items:center;justify-content:center;text-align:center;min-height:64px;padding:10px 14px;border-radius:999px;font-family:var(--font-heading);font-size:19px;border:2px solid ' + border + ';background:' + bg + ';color:' + fg + ';cursor:pointer;',
            onSelect: () => this.quizAnswer(id)
          };
        });
        if (quiz.answered) {
          quizRevealAnimal = this.withFav(quizTargetAnimal);
          quizWasCorrect = quiz.selectedId === quiz.targetId;
        }
      }
    }
    const quizResultText = quizTargetAnimal
      ? (quizWasCorrect ? ('That\'s right! It\'s the ' + quizTargetAnimal.name + '!') : ('Good guess! This one is the ' + quizTargetAnimal.name + '.'))
      : '';
    const quizResultBannerStyle = 'font-family:var(--font-heading);font-size:23px;padding:10px 20px;border-radius:999px;background:' + (quizWasCorrect ? 'var(--color-accent-2-200)' : 'var(--color-accent-200)') + ';color:' + (quizWasCorrect ? 'var(--color-accent-2-900)' : 'var(--color-accent-900)') + ';';

    const habitatChips = HABITAT_OPTIONS.map(opt => this.chip(opt, filters.habitat === opt, () => this.setSingleFilter('habitat', opt)));
    const dietChips = DIET_OPTIONS.map(opt => this.chip(opt, filters.diet === opt, () => this.setSingleFilter('diet', opt)));
    const continentChips = CONTINENT_OPTIONS.map(opt => this.chip(opt, filters.continent === opt, () => this.setSingleFilter('continent', opt)));
    const sizeChips = SIZE_OPTIONS.map(opt => this.chip(opt, filters.size === opt, () => this.setSingleFilter('size', opt)));
    const dangerChips = DANGER_OPTIONS.map(opt => this.chip(opt, filters.dangerLevel === opt, () => this.setSingleFilter('dangerLevel', opt)));
    const boolChips = BOOL_FILTERS.map(f => this.chip(f.label, !!filters[f.key], () => this.toggleBoolFilter(f.key)));

    const activeFilterCount = [filters.habitat, filters.diet, filters.continent, filters.size, filters.dangerLevel].filter(Boolean).length
      + ['canFly', 'canSwim', 'canClimb', 'canBePet', 'nocturnal', 'endangered'].filter(k => filters[k]).length;
    const filterResultCount = isCategory ? categoryAnimals.length : (isSearch ? searchResults.length : 0);

    const tabColor = (active) => active ? 'var(--color-bg)' : 'var(--color-neutral-400)';
    const tabLabelStyle = (active) => 'font-size:12px;font-weight:800;font-family:var(--font-body);color:' + tabColor(active) + ';';
    const tabIconWrapStyle = (active) => 'width:38px;height:38px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:' + (active ? 'var(--color-accent)' : 'transparent') + ';';

    const galleryImageWrapStyle = 'width:100%;height:100%;max-width:600px;margin:0 auto;border-radius:var(--radius-md);overflow:hidden;cursor:' + (galleryZoomed ? 'zoom-out' : 'zoom-in') + ';transform:scale(' + (galleryZoomed ? 1.8 : 1) + ');transition:transform 0.25s ease;';

    return {
      loading, showApp: !loading, showLoading: loading,
      isHome, isSearch, isFavorites, isCategory, isDetail, isQuiz,
      homeTabColor: tabColor(activeTab === 'home'), homeTabLabelStyle: tabLabelStyle(activeTab === 'home'), homeTabIconWrapStyle: tabIconWrapStyle(activeTab === 'home'),
      searchTabColor: tabColor(activeTab === 'search'), searchTabLabelStyle: tabLabelStyle(activeTab === 'search'), searchTabIconWrapStyle: tabIconWrapStyle(activeTab === 'search'),
      favTabColor: tabColor(activeTab === 'favorites'), favTabLabelStyle: tabLabelStyle(activeTab === 'favorites'), favTabIconWrapStyle: tabIconWrapStyle(activeTab === 'favorites'),
      randomTabColor: tabColor(activeTab === 'random'), randomTabLabelStyle: tabLabelStyle(activeTab === 'random'), randomTabIconWrapStyle: tabIconWrapStyle(activeTab === 'random'),
      goHome: this.goHome, goSearchTab: this.goSearchTab, goFavoritesTab: this.goFavoritesTab, goRandomTab: this.goRandomTab,
      backOne: this.backOne,
      showScientificNamesBool, showFunFactsBool, showMapSectionBool,

      searchQuery, onSearchInput: this.setSearchQuery, hasSearchQuery: !!searchQuery,
      clearSearch: this.clearSearch, clearSearchAndFilters: this.clearSearchAndFilters,
      focusSearchFromHome: this.goSearchTab, searchResultsLabel,

      animalOfDay, hasAnimalOfDay: !!animalOfDay, openAnimal: this.openAnimal, toggleFavorite: this.toggleFavorite,
      animalOfDayName, animalOfDayImageCaption, animalOfDayImageSrc, animalOfDayIsFav, animalOfDayFavColor, animalOfDayFavLabel,
      openAnimalOfDay: () => animalOfDay && this.openAnimal(animalOfDay.id),
      animalOfDayKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); animalOfDay && this.openAnimal(animalOfDay.id); } },
      toggleFavoriteOfDay: (e) => { e.stopPropagation(); animalOfDay && this.toggleFavorite(animalOfDay.id); },
      recentAnimals, hasRecent: recentAnimals.length > 0, clearRecent: this.clearRecent,
      favoritePreview, hasFavoritePreview: favoritePreview.length > 0,
      categoryTiles, startQuiz: this.startQuiz,

      currentCategory, categoryAnimals, categoryAnimalsCount: categoryAnimals.length, hasCategoryAnimals: categoryAnimals.length > 0, noCategoryAnimals: categoryAnimals.length === 0,
      searchResults, hasSearchResults: searchResults.length > 0, noSearchResults: searchResults.length === 0,
      favoriteAnimalsFull, hasFavorites: favoriteAnimalsFull.length > 0, noFavorites: isFavorites && favoriteAnimalsFull.length === 0,

      currentAnimal, hasCurrentAnimal: !!currentAnimal, isFavCurrentBool: isFavCurrent,
      favCurrentColor: isFavCurrent ? 'var(--color-accent-600)' : 'var(--color-text)',
      favToggleLabel: isFavCurrent ? 'Remove from favorites' : 'Add to favorites',
      heroImage, heroImageSrc, quickFactTiles, relatedAnimalsList, hasRelated: relatedAnimalsList.length > 0,
      detailThumbs, hasMultiplePhotos: detailThumbs.length > 1,
      statusStyle, mapIframeSrc, toggleFavCurrent: () => currentAnimal && this.toggleFavorite(currentAnimal.id),

      galleryOpen, galleryImage, galleryImageSrc, galleryIndexDisplay: galleryIndex + 1, galleryCount, galleryImageWrapStyle,
      closeGallery: this.closeGallery, galleryNext: this.galleryNext, galleryPrev: this.galleryPrev, toggleGalleryZoom: this.toggleGalleryZoom,

      quizTargetAnimal, quizClueTexts, quizChoices, quizRevealAnimal, quizWasCorrect,
      quizAnswered: !!(quiz && quiz.answered), quizNotAnswered: !(quiz && quiz.answered),
      quizCanMoreClues: !!(quiz && !quiz.answered && quiz.cluesShown < 3),
      quizNextClue: this.quizNextClue, quizPlayAgain: this.startQuiz, quizResultText, quizResultBannerStyle,

      showFilterSheet, openFilterSheet: this.openFilterSheet, closeFilterSheet: this.closeFilterSheet, stopClick: this.stopClick,
      habitatChips, dietChips, continentChips, sizeChips, dangerChips, boolChips,
      activeFilterCount, hasActiveFilterCount: activeFilterCount > 0, filterResultCount, clearFilters: this.clearFilters
    };
  }

  // ── Markup ────────────────────────────────────────────────────────────────
  template(v) {
    const A = (fn) => Actions.reg(fn);
    const icon = (name, size, color, filled) => renderIcon(name, size, color, 2.75, filled);
    const card = (animal) => renderAnimalCard(animal, animal.isFav, v.showScientificNamesBool, v.openAnimal, v.toggleFavorite);

    const decorLayer = `
      <div aria-hidden="true" style="position:absolute;inset:0;overflow:hidden;pointer-events:none;">
        <div style="position:absolute;left:calc(50% - 650px - 130px);top:8%;width:150px;height:150px;border-radius:50%;background:var(--color-accent-200);opacity:0.55;"></div>
        <div style="position:absolute;left:calc(50% - 650px - 70px);top:34%;width:90px;height:90px;border-radius:50%;background:var(--color-accent-3-200);opacity:0.55;"></div>
        <div style="position:absolute;left:calc(50% - 650px - 100px);top:58%;width:120px;height:120px;border-radius:50%;background:var(--color-accent-2-200);opacity:0.5;"></div>
        <div style="position:absolute;left:calc(50% - 650px - 40px);top:80%;width:56px;height:56px;transform:rotate(-16deg);opacity:0.6;">${icon('paw-print', 56, 'var(--color-accent-300)')}</div>
        <div style="position:absolute;right:calc(50% - 650px - 110px);top:12%;width:130px;height:130px;border-radius:50%;background:var(--color-accent-4-200);opacity:0.5;"></div>
        <div style="position:absolute;right:calc(50% - 650px - 60px);top:40%;width:80px;height:80px;border-radius:50%;background:var(--color-accent-200);opacity:0.55;"></div>
        <div style="position:absolute;right:calc(50% - 650px - 130px);top:64%;width:160px;height:160px;border-radius:50%;background:var(--color-accent-3-200);opacity:0.45;"></div>
        <div style="position:absolute;right:calc(50% - 650px - 30px);top:86%;width:50px;height:50px;transform:rotate(20deg);opacity:0.6;">${icon('paw-print', 50, 'var(--color-accent-4-300)')}</div>
      </div>`;

    if (v.showLoading) {
      return decorLayer + `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-3);">
          <div style="width:56px;height:56px;animation:ww-spin 1.1s linear infinite;">${icon('paw-print', 56, 'var(--color-accent)')}</div>
          <div style="font-family:var(--font-heading);font-size:22px;color:var(--color-neutral-700);">Loading animals&hellip;</div>
        </div>`;
    }

    const homeScreen = !v.isHome ? '' : `
      <div style="position:absolute;inset:0;overflow-y:auto;">
        <div style="max-width:1300px;margin:0 auto;padding:var(--space-4) var(--space-4) 120px;display:flex;flex-direction:column;gap:var(--space-6);">
          <div style="display:flex;flex-direction:column;gap:var(--space-3);padding-top:var(--space-2);">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:44px;height:44px;flex-shrink:0;">${icon('paw-print', 40, 'var(--color-accent)')}</div>
              <div style="font-family:var(--font-heading);font-size:48px;font-weight:800;color:var(--color-text);">Wild Wonders</div>
            </div>
            <button type="button" data-onclick="${A(v.focusSearchFromHome)}" aria-label="Search animals" style="display:flex;align-items:center;gap:10px;min-height:58px;padding:0 20px;border-radius:999px;border:none;background:var(--color-surface);box-shadow:var(--shadow-sm);color:var(--color-neutral-600);font-size:19px;cursor:pointer;text-align:left;width:100%;">
              <div style="width:22px;height:22px;flex-shrink:0;">${icon('search', 22, 'var(--color-neutral-500)')}</div>
              Search animals&hellip;
            </button>
          </div>

          ${!v.hasAnimalOfDay ? '' : `
          <div style="display:flex;flex-direction:column;gap:var(--space-2);">
            <div style="display:flex;align-items:center;gap:8px;color:var(--color-accent-700);">
              ${icon('sparkles', 22, 'var(--color-accent-700)')}
              <div style="font-size:17px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;">Animal of the Day</div>
            </div>
            <div role="button" tabindex="0" aria-label="${esc(v.animalOfDayName)}" data-onclick="${A(v.openAnimalOfDay)}" data-onkeydown="${A(v.animalOfDayKeyDown)}" style="position:relative;width:100%;aspect-ratio:3.4/1;max-height:220px;border-radius:calc(var(--radius-lg) * 1.15);overflow:hidden;box-shadow:var(--shadow-md);cursor:pointer;">
              ${photoImg(v.animalOfDay.id, 1, v.animalOfDayImageCaption, 'width:100%;height:100%;object-fit:cover;filter:saturate(0.6) contrast(0.85) brightness(1.1) opacity(0.94);')}
              <div style="position:absolute;inset:0;background:linear-gradient(to top, color-mix(in srgb, var(--color-text) 80%, transparent) 0%, transparent 60%);pointer-events:none;"></div>
              <button type="button" data-onclick="${A(v.toggleFavoriteOfDay)}" aria-label="${esc(v.animalOfDayFavLabel)}" style="position:absolute;top:16px;right:16px;width:48px;height:48px;border-radius:999px;border:none;background:color-mix(in srgb, var(--color-bg) 88%, transparent);box-shadow:var(--shadow-sm);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;">
                ${icon('heart', 22, v.animalOfDayFavColor, v.animalOfDayIsFav)}
              </button>
              <div style="position:absolute;left:20px;right:20px;bottom:16px;pointer-events:none;">
                <div style="font-family:var(--font-heading);font-size:clamp(20px,3vw,30px);font-weight:800;color:var(--color-bg);text-shadow:0 2px 10px rgba(0,0,0,0.4);">${esc(v.animalOfDayName)}</div>
              </div>
            </div>
          </div>`}

          <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;">
            <button type="button" data-onclick="${A(v.startQuiz)}" style="flex:1;min-width:180px;display:flex;align-items:center;gap:12px;min-height:64px;padding:0 20px;border-radius:calc(var(--radius-lg) * 1.15);border:none;background:var(--color-accent-100);color:var(--color-accent-800);cursor:pointer;font-family:var(--font-heading);font-size:18px;">
              ${icon('puzzle', 24, 'var(--color-accent-700)')}
              Guess the Animal
            </button>
            <button type="button" data-onclick="${A(v.goRandomTab)}" style="flex:1;min-width:180px;display:flex;align-items:center;gap:12px;min-height:64px;padding:0 20px;border-radius:calc(var(--radius-lg) * 1.15);border:none;background:var(--color-accent-2-100);color:var(--color-accent-2-800);cursor:pointer;font-family:var(--font-heading);font-size:18px;">
              ${icon('shuffle', 24, 'var(--color-accent-2-700)')}
              Surprise Me
            </button>
          </div>

          ${!v.hasRecent ? '' : `
          <div style="display:flex;flex-direction:column;gap:var(--space-2);">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <h2 style="font-family:var(--font-heading);font-size:23px;">Continue Exploring</h2>
              <button type="button" data-onclick="${A(v.clearRecent)}" style="border:none;background:transparent;color:var(--color-neutral-500);font-size:15px;cursor:pointer;">Clear</button>
            </div>
            <div style="display:flex;gap:var(--space-3);overflow-x:auto;padding-bottom:4px;">
              ${v.recentAnimals.map(a => `<div style="width:150px;flex-shrink:0;">${card(a)}</div>`).join('')}
            </div>
          </div>`}

          ${!v.hasFavoritePreview ? '' : `
          <div style="display:flex;flex-direction:column;gap:var(--space-2);">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <h2 style="font-family:var(--font-heading);font-size:23px;">Your Favorites</h2>
              <button type="button" data-onclick="${A(v.goFavoritesTab)}" style="border:none;background:transparent;color:var(--color-accent-700);font-size:15px;cursor:pointer;font-weight:700;">See All</button>
            </div>
            <div style="display:flex;gap:var(--space-3);overflow-x:auto;padding-bottom:4px;">
              ${v.favoritePreview.map(a => `<div style="width:150px;flex-shrink:0;">${card(a)}</div>`).join('')}
            </div>
          </div>`}

          <div style="display:flex;flex-direction:column;gap:var(--space-3);">
            <h2 style="font-family:var(--font-heading);font-size:23px;">Explore by Category</h2>
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:var(--space-3);">
              ${v.categoryTiles.map(cat => `
                <button type="button" data-onclick="${A(cat.onSelect)}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:152px;padding:var(--space-3);border:none;border-radius:calc(var(--radius-lg) * 1.15);background:var(--color-surface);box-shadow:var(--shadow-sm);cursor:pointer;font-family:var(--font-heading);font-size:18px;color:var(--color-text);text-align:center;">
                  <div style="${cat.badgeStyle}">${icon(cat.icon, 34, cat.badgeFg)}</div>
                  ${esc(cat.label)}
                </button>`).join('')}
            </div>
          </div>
        </div>
      </div>`;

    const searchScreen = !v.isSearch ? '' : `
      <div style="position:absolute;inset:0;overflow-y:auto;">
        <div style="max-width:1300px;margin:0 auto;padding:var(--space-4) var(--space-4) 120px;display:flex;flex-direction:column;gap:var(--space-4);">
          <h1 style="font-family:var(--font-heading);font-size:30px;">Search</h1>
          <div style="display:flex;align-items:center;gap:10px;min-height:56px;padding:0 18px;border-radius:999px;background:var(--color-surface);box-shadow:var(--shadow-sm);">
            <div style="width:20px;height:20px;flex-shrink:0;">${icon('search', 20, 'var(--color-neutral-500)')}</div>
            <input id="search-input" type="text" value="${esc(v.searchQuery)}" data-oninput="${A(v.onSearchInput)}" placeholder="Animal name, nickname, or category&hellip;" aria-label="Search animals" style="flex:1;border:none;background:transparent;outline:none;font-size:19px;color:var(--color-text);min-width:0;" />
            ${!v.hasSearchQuery ? '' : `
            <button type="button" data-onclick="${A(v.clearSearch)}" aria-label="Clear search" style="width:28px;height:28px;border-radius:999px;border:none;background:var(--color-neutral-200);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;padding:0;">${icon('x', 14, 'var(--color-neutral-700)')}</button>`}
          </div>
          <div style="font-size:16px;color:var(--color-neutral-600);">${esc(v.searchResultsLabel)}</div>
          ${!v.hasSearchResults ? '' : `
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:var(--space-4);">
            ${v.searchResults.map(a => card(a)).join('')}
          </div>`}
          ${!v.noSearchResults ? '' : `
          <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:var(--space-3);padding:var(--space-8) var(--space-4);color:var(--color-neutral-600);">
            ${icon('paw-print', 48, 'var(--color-neutral-400)')}
            <div style="font-size:19px;max-width:320px;line-height:1.5;">No animals found for &quot;${esc(v.searchQuery)}&quot;. Try a different search!</div>
            <button type="button" data-onclick="${A(v.clearSearchAndFilters)}" style="min-height:48px;padding:0 24px;border-radius:999px;border:none;background:var(--color-accent);color:var(--color-bg);font-family:var(--font-heading);font-size:18px;cursor:pointer;">Clear Search &amp; Filters</button>
          </div>`}
        </div>
      </div>`;

    const favoritesScreen = !v.isFavorites ? '' : `
      <div style="position:absolute;inset:0;overflow-y:auto;">
        <div style="max-width:1300px;margin:0 auto;padding:var(--space-4) var(--space-4) 120px;display:flex;flex-direction:column;gap:var(--space-4);">
          <h1 style="font-family:var(--font-heading);font-size:30px;">Favorites</h1>
          ${!v.hasFavorites ? '' : `
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:var(--space-4);">
            ${v.favoriteAnimalsFull.map(a => card(a)).join('')}
          </div>`}
          ${!v.noFavorites ? '' : `
          <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:var(--space-3);padding:var(--space-8) var(--space-4);color:var(--color-neutral-600);">
            ${icon('heart', 48, 'var(--color-neutral-400)')}
            <div style="font-size:19px;max-width:320px;line-height:1.5;">No favorites yet &mdash; tap the heart on any animal to save it here!</div>
            <button type="button" data-onclick="${A(v.goHome)}" style="min-height:48px;padding:0 24px;border-radius:999px;border:none;background:var(--color-accent);color:var(--color-bg);font-family:var(--font-heading);font-size:18px;cursor:pointer;">Explore Animals</button>
          </div>`}
        </div>
      </div>`;

    const categoryScreen = !v.isCategory ? '' : `
      <div style="position:absolute;inset:0;overflow-y:auto;">
        <div style="max-width:1300px;margin:0 auto;padding:var(--space-4) var(--space-4) 120px;display:flex;flex-direction:column;gap:var(--space-4);">
          <div style="display:flex;align-items:center;gap:10px;">
            <button type="button" data-onclick="${A(v.backOne)}" aria-label="Back" style="width:52px;height:52px;border-radius:999px;border:none;background:var(--color-surface);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;padding:0;">${icon('chevron-left', 20, 'var(--color-text)')}</button>
            <h1 style="font-family:var(--font-heading);font-size:26px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(v.currentCategory ? v.currentCategory.label : '')}</h1>
            <button type="button" data-onclick="${A(v.openFilterSheet)}" aria-label="Filters" style="min-height:40px;padding:0 16px;border-radius:999px;border:1.5px solid var(--color-divider);background:transparent;display:flex;align-items:center;gap:6px;cursor:pointer;font-size:16px;font-weight:600;flex-shrink:0;color:var(--color-text);">
              ${icon('filter', 16, 'var(--color-text)')}
              Filters
              ${!v.hasActiveFilterCount ? '' : `<span style="min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:var(--color-accent);color:var(--color-bg);font-size:13px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;">${v.activeFilterCount}</span>`}
            </button>
          </div>
          <div style="font-size:16px;color:var(--color-neutral-600);">${v.categoryAnimalsCount} animals</div>
          ${!v.hasCategoryAnimals ? '' : `
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:var(--space-4);">
            ${v.categoryAnimals.map(a => card(a)).join('')}
          </div>`}
          ${!v.noCategoryAnimals ? '' : `
          <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:var(--space-3);padding:var(--space-8) var(--space-4);color:var(--color-neutral-600);">
            ${icon('filter', 40, 'var(--color-neutral-400)')}
            <div style="font-size:19px;max-width:320px;line-height:1.5;">No animals match these filters yet.</div>
            <button type="button" data-onclick="${A(v.clearFilters)}" style="min-height:48px;padding:0 24px;border-radius:999px;border:none;background:var(--color-accent);color:var(--color-bg);font-family:var(--font-heading);font-size:18px;cursor:pointer;">Clear Filters</button>
          </div>`}
        </div>
      </div>`;

    const detailScreen = !v.isDetail || !v.hasCurrentAnimal ? '' : `
      <div style="position:absolute;inset:0;overflow-y:auto;">
        <div style="max-width:1300px;margin:0 auto;padding:var(--space-4) var(--space-4) 120px;display:flex;flex-direction:column;gap:var(--space-5);">
          <div style="position:relative;width:100%;aspect-ratio:16/9;max-height:400px;border-radius:calc(var(--radius-lg) * 1.15);overflow:hidden;box-shadow:var(--shadow-md);background:var(--color-neutral-200);">
            ${photoImg(v.currentAnimal.id, 1, v.heroImage.caption, 'width:100%;height:100%;object-fit:cover;filter:saturate(0.6) contrast(0.85) brightness(1.1) opacity(0.94);')}
            <button type="button" data-onclick="${A(v.backOne)}" aria-label="Back" style="position:absolute;top:14px;left:14px;width:56px;height:56px;border-radius:999px;border:none;background:color-mix(in srgb, var(--color-bg) 88%, transparent);box-shadow:var(--shadow-sm);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;">${icon('chevron-left', 28, 'var(--color-text)')}</button>
            <button type="button" data-onclick="${A(v.toggleFavCurrent)}" aria-label="${esc(v.favToggleLabel)}" style="position:absolute;top:14px;right:14px;width:56px;height:56px;border-radius:999px;border:none;background:color-mix(in srgb, var(--color-bg) 88%, transparent);box-shadow:var(--shadow-sm);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;">${icon('heart', 28, v.favCurrentColor, v.isFavCurrentBool)}</button>
          </div>

          <div style="display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <h1 style="font-family:var(--font-heading);font-size:clamp(32px,6vw,46px);">${esc(v.currentAnimal.name)}</h1>
              <div style="${v.statusStyle}">${esc(v.currentAnimal.conservationStatus)}</div>
            </div>
            ${!v.showScientificNamesBool ? '' : `<div style="font-style:italic;font-size:17px;color:var(--color-neutral-600);">${esc(v.currentAnimal.sciName)}</div>`}
          </div>

          ${!v.showFunFactsBool ? '' : `<p style="margin:0;font-size:19px;line-height:1.6;color:var(--color-text);">${esc(v.currentAnimal.blurb)}</p>`}

          <div style="display:flex;flex-wrap:wrap;gap:var(--space-3);">
            ${v.quickFactTiles.map(fact => `
              <div style="background:var(--color-surface);border-radius:var(--radius-md);padding:var(--space-3);display:flex;flex-direction:column;gap:6px;flex:0 0 auto;min-width:120px;">
                ${icon(fact.icon, 26, 'var(--color-accent-700)')}
                <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-neutral-600);font-weight:700;white-space:nowrap;">${esc(fact.label)}</div>
                <div style="${fact.valueStyle}">${esc(fact.value)}</div>
              </div>`).join('')}
          </div>

          ${!v.showFunFactsBool ? '' : `
          <div style="display:flex;gap:12px;align-items:flex-start;background:var(--color-accent-2-100);border-radius:var(--radius-md);padding:var(--space-4);">
            <div style="flex-shrink:0;">${icon('lightbulb', 22, 'var(--color-accent-2-800)')}</div>
            <div>
              <div style="font-family:var(--font-heading);font-size:16px;color:var(--color-accent-2-800);margin-bottom:4px;">Fun Fact</div>
              <p style="margin:0;font-size:18px;line-height:1.5;color:var(--color-accent-2-900);">${esc(v.currentAnimal.funFact)}</p>
            </div>
          </div>`}

          ${!v.hasMultiplePhotos ? '' : `
          <div style="display:flex;flex-direction:column;gap:var(--space-2);">
            <h2 style="font-family:var(--font-heading);font-size:23px;">Photos</h2>
            <div style="display:flex;gap:var(--space-2);overflow-x:auto;padding-bottom:4px;">
              ${v.detailThumbs.map(img => `
                <button type="button" data-onclick="${A(img.onSelect)}" aria-label="View photo" style="flex-shrink:0;width:96px;height:96px;border-radius:var(--radius-md);overflow:hidden;border:none;padding:0;cursor:pointer;">
                  ${photoImg(v.currentAnimal.id, img.n, img.caption, 'width:100%;height:100%;object-fit:cover;filter:saturate(0.6) contrast(0.85) brightness(1.1) opacity(0.94);')}
                </button>`).join('')}
            </div>
          </div>`}

          ${!v.showMapSectionBool ? '' : `
          <div style="display:flex;flex-direction:column;gap:var(--space-2);">
            <h2 style="font-family:var(--font-heading);font-size:23px;">Where in the World?</h2>
            <div style="width:100%;height:240px;border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-sm);background:var(--color-surface);">
              <iframe src="${v.mapIframeSrc}" title="Range map" style="width:100%;height:100%;border:none;display:block;" loading="lazy"></iframe>
            </div>
            <div style="font-size:15px;color:var(--color-neutral-600);">${esc(v.currentAnimal.mapCaption)}</div>
          </div>`}

          ${!v.hasRelated ? '' : `
          <div style="display:flex;flex-direction:column;gap:var(--space-2);">
            <h2 style="font-family:var(--font-heading);font-size:23px;">You Might Also Like</h2>
            <div style="display:flex;gap:var(--space-3);overflow-x:auto;padding-bottom:4px;">
              ${v.relatedAnimalsList.map(a => `<div style="width:150px;flex-shrink:0;">${card(a)}</div>`).join('')}
            </div>
          </div>`}
        </div>
      </div>`;

    const quizScreen = !v.isQuiz ? '' : `
      <div style="position:absolute;inset:0;overflow-y:auto;">
        <div style="max-width:860px;margin:0 auto;padding:var(--space-4) var(--space-4) 120px;display:flex;flex-direction:column;gap:var(--space-4);">
          <div style="display:flex;align-items:center;gap:10px;">
            <button type="button" data-onclick="${A(v.backOne)}" aria-label="Back" style="width:40px;height:40px;border-radius:999px;border:none;background:var(--color-surface);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;padding:0;">${icon('chevron-left', 20, 'var(--color-text)')}</button>
            <h1 style="font-family:var(--font-heading);font-size:26px;display:flex;align-items:center;gap:8px;">${icon('sparkles', 20, 'var(--color-accent)')}Guess the Animal</h1>
          </div>
          ${!v.quizNotAnswered ? '' : `
          <div style="background:var(--color-surface);border-radius:var(--radius-lg);padding:var(--space-4);display:flex;flex-direction:column;gap:10px;">
            <div style="font-family:var(--font-heading);font-size:17px;color:var(--color-accent-700);">Clues</div>
            ${v.quizClueTexts.map(clue => `<div style="font-size:19px;line-height:1.5;color:var(--color-text);">&bull; ${esc(clue)}</div>`).join('')}
            ${!v.quizCanMoreClues ? '' : `<button type="button" data-onclick="${A(v.quizNextClue)}" style="align-self:flex-start;margin-top:6px;min-height:44px;padding:0 20px;border-radius:999px;border:1.5px solid var(--color-accent);background:transparent;color:var(--color-accent-700);font-family:var(--font-heading);font-size:17px;cursor:pointer;">Give Me a Clue</button>`}
          </div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:var(--space-3);">
            ${v.quizChoices.map(choice => `<button type="button" data-onclick="${A(choice.onSelect)}" style="${choice.style}">${esc(choice.name)}</button>`).join('')}
          </div>`}
          ${!v.quizAnswered ? '' : `
          <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:var(--space-4);">
            <div style="${v.quizResultBannerStyle}">${esc(v.quizResultText)}</div>
            <div style="width:220px;">${v.quizRevealAnimal ? card(v.quizRevealAnimal) : ''}</div>
            <div style="display:flex;gap:var(--space-3);">
              <button type="button" data-onclick="${A(v.quizPlayAgain)}" style="min-height:50px;padding:0 26px;border-radius:999px;border:none;background:var(--color-accent);color:var(--color-bg);font-family:var(--font-heading);font-size:18px;cursor:pointer;">Play Again</button>
              <button type="button" data-onclick="${A(v.goHome)}" style="min-height:50px;padding:0 26px;border-radius:999px;border:1.5px solid var(--color-divider);background:transparent;color:var(--color-text);font-family:var(--font-heading);font-size:18px;cursor:pointer;">Back Home</button>
            </div>
          </div>`}
        </div>
      </div>`;

    const bottomNav = `
      <div style="flex-shrink:0;display:flex;justify-content:center;">
        <div style="width:100%;max-width:1300px;display:flex;background:var(--color-text);border-radius:calc(var(--radius-lg) * 1.15) calc(var(--radius-lg) * 1.15) 0 0;box-shadow:0 -6px 22px color-mix(in srgb, #2e2b25 30%, transparent);padding:4px 10px calc(env(safe-area-inset-bottom, 0px) + 4px);">
          <button type="button" data-onclick="${A(v.goHome)}" aria-label="Home" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;min-height:54px;border:none;background:transparent;cursor:pointer;padding:4px;">
            <div style="${v.homeTabIconWrapStyle}">${icon('home', 21, v.homeTabColor)}</div>
            <span style="${v.homeTabLabelStyle}">Home</span>
          </button>
          <button type="button" data-onclick="${A(v.goSearchTab)}" aria-label="Search" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;min-height:54px;border:none;background:transparent;cursor:pointer;padding:4px;">
            <div style="${v.searchTabIconWrapStyle}">${icon('search', 21, v.searchTabColor)}</div>
            <span style="${v.searchTabLabelStyle}">Search</span>
          </button>
          <button type="button" data-onclick="${A(v.goFavoritesTab)}" aria-label="Favorites" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;min-height:54px;border:none;background:transparent;cursor:pointer;padding:4px;">
            <div style="${v.favTabIconWrapStyle}">${icon('heart', 21, v.favTabColor)}</div>
            <span style="${v.favTabLabelStyle}">Favorites</span>
          </button>
          <button type="button" data-onclick="${A(v.goRandomTab)}" aria-label="Surprise me with a random animal" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;min-height:54px;border:none;background:transparent;cursor:pointer;padding:4px;">
            <div style="${v.randomTabIconWrapStyle}">${icon('shuffle', 21, v.randomTabColor)}</div>
            <span style="${v.randomTabLabelStyle}">Random</span>
          </button>
        </div>
      </div>`;

    const filterSheetChipGroup = (title, chips) => `
      <div style="display:flex;flex-direction:column;gap:10px;">
        <h3 style="font-size:15px;color:var(--color-neutral-600);text-transform:uppercase;letter-spacing:0.05em;">${title}</h3>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${chips.map(c => `<button type="button" data-onclick="${A(c.onSelect)}" style="${c.style}">${esc(c.label)}</button>`).join('')}
        </div>
      </div>`;

    const filterSheet = !v.showFilterSheet ? '' : `
      <div style="position:fixed;inset:0;background:color-mix(in srgb, var(--color-neutral-900) 55%, transparent);display:flex;align-items:flex-end;justify-content:center;z-index:50;" data-onclick="${A(v.closeFilterSheet)}">
        <div style="width:100%;max-width:1300px;max-height:82vh;background:var(--color-bg);border-radius:calc(var(--radius-lg) * 1.15) calc(var(--radius-lg) * 1.15) 0 0;display:flex;flex-direction:column;box-shadow:var(--shadow-lg);" data-onclick="${A(v.stopClick)}">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-4);border-bottom:1px solid var(--color-divider);flex-shrink:0;">
            <h2 style="font-family:var(--font-heading);font-size:22px;">Filters</h2>
            <button type="button" data-onclick="${A(v.closeFilterSheet)}" aria-label="Close filters" style="width:36px;height:36px;border-radius:999px;border:none;background:var(--color-surface);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;">${icon('x', 16, 'var(--color-text)')}</button>
          </div>
          <div style="flex:1;overflow-y:auto;padding:var(--space-4);display:flex;flex-direction:column;gap:var(--space-5);">
            ${filterSheetChipGroup('Habitat', v.habitatChips)}
            ${filterSheetChipGroup('Diet', v.dietChips)}
            ${filterSheetChipGroup('Continent', v.continentChips)}
            ${filterSheetChipGroup('Size', v.sizeChips)}
            ${filterSheetChipGroup('Danger Level', v.dangerChips)}
            ${filterSheetChipGroup('More', v.boolChips)}
          </div>
          <div style="display:flex;gap:var(--space-3);padding:var(--space-4);border-top:1px solid var(--color-divider);flex-shrink:0;">
            <button type="button" data-onclick="${A(v.clearFilters)}" style="min-height:48px;padding:0 20px;border-radius:999px;border:1.5px solid var(--color-divider);background:transparent;color:var(--color-text);font-family:var(--font-heading);font-size:17px;cursor:pointer;">Clear All</button>
            <button type="button" data-onclick="${A(v.closeFilterSheet)}" style="flex:1;min-height:48px;border-radius:999px;border:none;background:var(--color-accent);color:var(--color-bg);font-family:var(--font-heading);font-size:18px;cursor:pointer;">Show ${v.filterResultCount} Animals</button>
          </div>
        </div>
      </div>`;

    const gallery = !v.galleryOpen ? '' : `
      <div style="position:fixed;inset:0;background:color-mix(in srgb, var(--color-neutral-900) 92%, transparent);display:flex;flex-direction:column;z-index:60;">
        <div style="display:flex;justify-content:flex-end;padding:var(--space-3);flex-shrink:0;">
          <button type="button" data-onclick="${A(v.closeGallery)}" aria-label="Close" style="width:40px;height:40px;border-radius:999px;border:none;background:color-mix(in srgb, var(--color-bg) 20%, transparent);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;">${icon('x', 20, 'var(--color-bg)')}</button>
        </div>
        <div style="flex:1;min-height:0;display:flex;align-items:center;position:relative;padding:0 var(--space-4);">
          <button type="button" data-onclick="${A(v.galleryPrev)}" aria-label="Previous photo" style="position:absolute;left:var(--space-2);top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:999px;border:none;background:color-mix(in srgb, var(--color-bg) 20%, transparent);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;padding:0;">${icon('chevron-left', 22, 'var(--color-bg)')}</button>
          <div style="${v.galleryImageWrapStyle}" data-onclick="${A(v.toggleGalleryZoom)}">
            ${v.galleryImage ? photoImg(v.currentAnimal.id, v.galleryIndexDisplay, v.galleryImage.caption, 'width:100%;height:100%;object-fit:cover;') : ''}
          </div>
          <button type="button" data-onclick="${A(v.galleryNext)}" aria-label="Next photo" style="position:absolute;right:var(--space-2);top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:999px;border:none;background:color-mix(in srgb, var(--color-bg) 20%, transparent);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;padding:0;">${icon('chevron-right', 22, 'var(--color-bg)')}</button>
        </div>
        <div style="text-align:center;padding:var(--space-3) var(--space-4) calc(env(safe-area-inset-bottom, 0px) + var(--space-3));flex-shrink:0;color:var(--color-bg);">
          <div style="font-size:14px;opacity:0.6;">${v.galleryIndexDisplay} / ${v.galleryCount}</div>
        </div>
      </div>`;

    return decorLayer + `
      <div style="flex:1;min-height:0;position:relative;">
        ${homeScreen}${searchScreen}${favoritesScreen}${categoryScreen}${detailScreen}${quizScreen}
      </div>
      ${bottomNav}
      ${filterSheet}
      ${gallery}`;
  }
}

const app = new App(document.getElementById('app'));

document.getElementById('app').addEventListener('click', (e) => {
  const el = e.target.closest('[data-onclick]');
  if (!el) return;
  const fn = Actions.map.get(Number(el.dataset.onclick));
  if (fn) fn(e);
});
document.getElementById('app').addEventListener('input', (e) => {
  const el = e.target.closest('[data-oninput]');
  if (!el) return;
  const fn = Actions.map.get(Number(el.dataset.oninput));
  if (fn) fn(e);
});
document.getElementById('app').addEventListener('keydown', (e) => {
  const el = e.target.closest('[data-onkeydown]');
  if (!el) return;
  const fn = Actions.map.get(Number(el.dataset.onkeydown));
  if (fn) fn(e);
});

app.init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
