// --- 1. State & DOM references ---

const tableBody = document.querySelector("#cards-table tbody");
const resultsCount = document.querySelector("#results-count");
const backToTopBtn = document.getElementById("back-to-top");

const searchInput = document.getElementById("search-input");
const filterVolume = document.getElementById("filter-volume");
const filterBook = document.getElementById("filter-book");
const filterGender = document.getElementById("filter-gender");
const filterReward = document.getElementById("filter-reward");
const filterRarity = document.getElementById("filter-rarity");

const themeToggleBtn = document.getElementById("theme-toggle");

let cards = [];

let currentSort = {
  key: "volume",
  direction: "asc"
};

let currentList = [];
let currentIndex = -1;


// --- 2. Theme (light/dark) ---

function applyTheme(theme) {
  const isDark = theme === "dark";

  if (isDark) {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }

  if (themeToggleBtn) {
    themeToggleBtn.textContent = isDark ? "Light mode" : "Dark mode";
  }
}

function initTheme() {
  let theme = "light";

  try {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      theme = stored;
    } else if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      theme = "dark";
    }
  } catch (e) {
    // ignore storage errors
  }

  applyTheme(theme);
}

// Format reward as a compact emoji string, e.g. "20💎" or "8🍵"
function formatRewardShort(card) {
  if (!card.reward || card.rewardAmount == null) return "";

  const type = card.reward.toLowerCase();
  const isCups = type === "cups" || type === "cup";

  const symbol = isCups ? "🍵" : "💎";
  return `${card.rewardAmount}${symbol}`;
}

// --- 3. Initialisation & data loading ---

async function loadCards() {
  const response = await fetch("data/cards.json");
  cards = await response.json();

  // Preserve original order for stable sorting
  cards.forEach((card, index) => {
    card._index = index;
  });
}

async function init() {
  await loadCards();
  initTheme();
  populateFilterOptions();
  attachEventListeners();
  render();
}

// --- 4. Filters & events ---

function populateFilterOptions() {
  const volumes = new Set();
  const books = new Set();
  const rarities = new Set();
  const genders = new Set();

  cards.forEach(card => {
    if (card.volume != null) volumes.add(card.volume);

    // BOOKS: support single string or array of strings
    if (card.book) {
      if (Array.isArray(card.book)) {
        card.book.forEach(b => {
          if (b) books.add(b);
        });
      } else {
        books.add(card.book);
      }
    }

    if (card.rarity) rarities.add(card.rarity);

    if (card.gender) {
      if (Array.isArray(card.gender)) {
        card.gender.forEach(g => genders.add(g));
      } else {
        genders.add(card.gender);
      }
    }
  });

  // Volume
  [...volumes].sort((a, b) => a - b).forEach(v => {
    const opt = document.createElement("option");
    opt.value = String(v);
    opt.textContent = String(v);
    filterVolume.appendChild(opt);
  });

  // Book (each title once, even if used in arrays)
  [...books].sort().forEach(book => {
    const opt = document.createElement("option");
    opt.value = book;
    opt.textContent = book;
    filterBook.appendChild(opt);
  });

  // Rarity – fixed canonical order
  const canonicalRarity = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
  canonicalRarity.forEach(rarity => {
    if (rarities.has(rarity)) {
      const opt = document.createElement("option");
      opt.value = rarity;
      opt.textContent = rarity;
      filterRarity.appendChild(opt);
    }
  });

  // Gender – fixed canonical order, but only if present in data
  const canonicalGender = ["Male", "Female", "Non-binary", "Inanimate"];
  canonicalGender.forEach(g => {
    if (genders.has(g)) {
      const opt = document.createElement("option");
      opt.value = g;
      opt.textContent = g;
      filterGender.appendChild(opt);
    }
  });
}

function attachEventListeners() {
  searchInput.addEventListener("input", render);
  filterVolume.addEventListener("change", render);
  filterBook.addEventListener("change", render);
  filterGender.addEventListener("change", render);
  filterReward.addEventListener("change", render);
  filterRarity.addEventListener("change", render);

  // Column header sorting
  const headers = document.querySelectorAll("#cards-table thead th");
  headers.forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.sortKey;
      if (!key) return;

      if (currentSort.key === key) {
        currentSort.direction =
          currentSort.direction === "asc" ? "desc" : "asc";
      } else {
        currentSort.key = key;
        currentSort.direction = "asc";
      }

      headers.forEach(h => h.classList.remove("sort-asc", "sort-desc"));
      th.classList.add(
        currentSort.direction === "asc" ? "sort-asc" : "sort-desc"
      );

      render();
    });
  });

  // Row click → detail view
  tableBody.addEventListener("click", (event) => {
    const row = event.target.closest("tr");
    if (!row) return;

    const cardId = row.dataset.cardId;
    if (!cardId) return;

    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    // Set currentIndex within the current filtered + sorted list
    const idx = currentList.findIndex(c => c.id === cardId);
    currentIndex = idx;

    showCardDetails(card);
  });

  // Back to top
  if (backToTopBtn) {
    backToTopBtn.addEventListener("click", () => {
      const tableSection = document.getElementById("table-section");
      const targetY = tableSection ? tableSection.offsetTop : 0;

      window.scrollTo({
        top: targetY,
        behavior: "smooth"
      });
    });
  }

  window.addEventListener("scroll", () => {
    if (!backToTopBtn) return;
    if (window.scrollY > 200) {
      backToTopBtn.classList.remove("hidden");
    } else {
      backToTopBtn.classList.add("hidden");
    }
  });

  // Mobile detail overlay close handlers
  const mobileOverlay = document.getElementById("mobile-detail-overlay");
  const mobileClose = document.getElementById("mobile-detail-close");

  if (mobileOverlay && mobileClose) {
    mobileClose.addEventListener("click", () => {
      mobileOverlay.classList.remove("open");
      mobileOverlay.classList.add("hidden");
    });

    mobileOverlay.addEventListener("click", (event) => {
      if (event.target === mobileOverlay) {
        mobileOverlay.classList.remove("open");
        mobileOverlay.classList.add("hidden");
      }
    });
  }

  // Mobile navigation arrows (now used on all viewports)
  const mobilePrev = document.getElementById("mobile-detail-prev");
  const mobileNext = document.getElementById("mobile-detail-next");

  if (mobilePrev) {
    mobilePrev.addEventListener("click", (event) => {
      event.stopPropagation();
      showPrevCard();
    });
  }

  if (mobileNext) {
    mobileNext.addEventListener("click", (event) => {
      event.stopPropagation();
      showNextCard();
    });
  }

  // Theme toggle
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const isDarkNow = !document.body.classList.contains("dark");
      const newTheme = isDarkNow ? "dark" : "light";

      applyTheme(newTheme);

      try {
        localStorage.setItem("theme", newTheme);
      } catch (e) {
        // ignore storage failures
      }
    });
  }

  // clear filters and sorting
  const clearFiltersBtn = document.getElementById("clear-filters");
  const clearSortingBtn = document.getElementById("clear-sorting");

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      searchInput.value = "";
      filterVolume.value = "";
      filterBook.value = "";
      filterGender.value = "";
      filterReward.value = "";
      filterRarity.value = "";
      render();
    });
  }

  if (clearSortingBtn) {
    clearSortingBtn.addEventListener("click", () => {
      currentSort = { key: "volume", direction: "asc" };

      const headers = document.querySelectorAll("#cards-table thead th");
      headers.forEach(h => h.classList.remove("sort-asc", "sort-desc"));

      render();
    });
  }
}

// --- 5. Filtering, sorting, rendering ---

function matchesGender(card, selectedGender) {
  if (!selectedGender) return true;

  const g = card.gender;
  if (!g) return false;

  if (Array.isArray(g)) {
    return g.includes(selectedGender);
  }

  return g === selectedGender;
}

// book matching that supports string or array
function matchesBook(card, selectedBook) {
  if (!selectedBook) return true; // no filter selected

  const b = card.book;
  if (!b) return false;

  if (Array.isArray(b)) {
    return b.includes(selectedBook);
  }

  return b === selectedBook;
}

function getFilteredCards() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const vol = filterVolume.value;
  const book = filterBook.value;
  const gender = filterGender.value;
  const reward = filterReward.value;
  const rarity = filterRarity.value;

  return cards.filter(card => {
    if (searchTerm) {
      const inCardName = card.cardName.toLowerCase().includes(searchTerm);
      const inCharacter = card.character.toLowerCase().includes(searchTerm);
      if (!inCardName && !inCharacter) return false;
    }

    if (vol && String(card.volume) !== vol) return false;

    // BOOK filter via helper (handles arrays)
    if (!matchesBook(card, book)) return false;

    if (!matchesGender(card, gender)) return false;
    if (reward && card.reward !== reward) return false;
    if (rarity && card.rarity !== rarity) return false;

    return true;
  });
}

function sortCards(list) {
  const { key, direction } = currentSort;
  const factor = direction === "asc" ? 1 : -1;

  const rarityOrder = {
    Common: 0,
    Uncommon: 1,
    Rare: 2,
    Epic: 3,
    Legendary: 4
  };

  function genderRank(card) {
    const g = card.gender;
    if (Array.isArray(g)) return 1;       // mixed tags
    if (g === "Male") return 0;
    if (g === "Female") return 2;
    if (g === "Non-binary") return 3;
    if (g === "Inanimate") return 4;
    return 99;
  }

  // Cups before Diamonds; others last
  const rewardTypeOrder = {
    Cups: 0,
    Diamonds: 1
  };

  // Map rewards into a common "tier" space: 2,4,8,12 for both cups/diamonds
  function rewardTier(card) {
    const amount = card.rewardAmount ?? 0;
    if (!card.reward) return 9999;
    if (card.reward === "Cups") return amount;            // 2,4,8,12
    if (card.reward === "Diamonds") return amount / 10;  // 20→2, 40→4...
    return 9999;
  }

  // For descending reward sort: diamonds dominate and higher amounts first
  function rewardDescScore(card) {
    const amt = card.rewardAmount ?? 0;
    if (card.reward === "Diamonds") return amt * 2; // always above cups
    if (card.reward === "Cups") return amt;         // 12 > 8 > 4 > 2
    return -1;
  }

  return [...list].sort((a, b) => {
    // --- Special: rarity ---
    if (key === "rarity") {
      const ra = rarityOrder[a.rarity] ?? 999;
      const rb = rarityOrder[b.rarity] ?? 999;

      // 1) rarity rank, honouring asc/desc
      if (ra !== rb) return (ra - rb) * factor;

      // 2) reward tier: asc or desc depending on direction
      const ta = rewardTier(a);
      const tb = rewardTier(b);

      if (ta !== tb) {
        if (direction === "asc") {
          return ta - tb;
        } else {
          return tb - ta; // reverse tier only
        }
      }

      // 3) volume: always ascending
      const va = a.volume ?? 9999;
      const vb = b.volume ?? 9999;
      if (va !== vb) return va - vb;

      // 4) reward type: cups before diamonds
      const rta = rewardTypeOrder[a.reward] ?? 999;
      const rtb = rewardTypeOrder[b.reward] ?? 999;
      if (rta !== rtb) return rta - rtb;

      // 5) fallback: original index
      return a._index - b._index;
    }

    // --- Special: gender ---
    if (key === "gender") {
      const ga = genderRank(a);
      const gb = genderRank(b);

      if (ga !== gb) return (ga - gb) * factor;
      return a._index - b._index;
    }

    // --- Special: reward (type/amount/volume) ---
    if (key === "reward") {
      if (direction === "asc") {
        // Ascending:
        // 1) Cups before Diamonds
        // 2) Amount ascending
        // 3) Volume ascending
        const ta = rewardTypeOrder[a.reward] ?? 999;
        const tb = rewardTypeOrder[b.reward] ?? 999;
        if (ta !== tb) return ta - tb;

        const aa = a.rewardAmount ?? 0;
        const ab = b.rewardAmount ?? 0;
        if (aa !== ab) return aa - ab;

        const va = a.volume ?? 9999;
        const vb = b.volume ?? 9999;
        if (va !== vb) return va - vb;

        return a._index - b._index;
      } else {
        // Descending:
        // 1) score so Diamonds outrank Cups, bigger first:
        //    120d, 80d, 40d, 20d, 12c, 8c, 4c, 2c
        // 2) volume ascending within same amount
        const sa = rewardDescScore(a);
        const sb = rewardDescScore(b);
        if (sa !== sb) return sb - sa; // bigger score first

        const va = a.volume ?? 9999;
        const vb = b.volume ?? 9999;
        if (va !== vb) return va - vb;

        return a._index - b._index;
      }
    }

    // --- Default behaviour for everything else ---
    let va = a[key];
    let vb = b[key];

    // If a field is an array (e.g. gender or book tags), sort by the first item
    if (Array.isArray(va)) va = va[0];
    if (Array.isArray(vb)) vb = vb[0];

    if (typeof va === "string") va = va.toLowerCase();
    if (typeof vb === "string") vb = vb.toLowerCase();

    if (va < vb) return -1 * factor;
    if (va > vb) return 1 * factor;

    return a._index - b._index;
  });
}

function render() {
  const filtered = getFilteredCards();
  const sorted = sortCards(filtered);

  // keep the current navigation list in sync with what the user sees
  currentList = sorted;

  tableBody.innerHTML = "";

  sorted.forEach(card => {
    const tr = document.createElement("tr");
    tr.dataset.cardId = card.id;

    const rewardDisplay = formatRewardShort(card);

    const thumbHtml = card.image
      ? `<img src="${card.image}"
           alt="${card.character ?? ""}"
           class="thumb-image"
           loading="lazy"
           decoding="async">`
      : "";

    const rarityClass = card.rarity
      ? `rarity-${card.rarity.toLowerCase().replace(/\s+/g, "-")}`
      : "";

    tr.innerHTML = `
      <td class="thumb-cell">${thumbHtml}</td>
      <td class="col-cardName">${card.cardName ?? ""}</td>
      <td>${card.character ?? ""}</td>
      <td>${card.volume ?? ""}</td>
      <td class="${rarityClass}">${card.rarity ?? ""}</td>
      <td>${rewardDisplay}</td>
    `;

    tableBody.appendChild(tr);
  });

  resultsCount.textContent =
    `${sorted.length} card${sorted.length === 1 ? "" : "s"} shown`;
}

function showPrevCard() {
  if (!currentList || currentIndex <= 0) return;
  currentIndex -= 1;
  const card = currentList[currentIndex];
  if (card) {
    showCardDetails(card);
  }
}

function showNextCard() {
  if (!currentList || currentIndex < 0 || currentIndex >= currentList.length - 1) return;
  currentIndex += 1;
  const card = currentList[currentIndex];
  if (card) {
    showCardDetails(card);
  }
}

function showCardDetails(card) {
  const placeholder = document.getElementById("detail-placeholder");
  const content = document.getElementById("detail-content");

  const imageWrapper = document.getElementById("detail-image-wrapper");
  const imageEl = document.getElementById("detail-image");
  const titleEl = document.getElementById("detail-title");
  const charEl = document.getElementById("detail-character");
  const cardNameEl = document.getElementById("detail-cardName");
  const volumeEl = document.getElementById("detail-volume");
  const bookEl = document.getElementById("detail-book");
  const genderEl = document.getElementById("detail-gender");
  const rewardEl = document.getElementById("detail-reward");
  const rarityEl = document.getElementById("detail-rarity");
  const messageEl = document.getElementById("detail-message");

  if (placeholder) placeholder.classList.add("hidden");
  if (content) content.classList.remove("hidden");

  // Book display (single or multiple) – line breaks between stories
  const bookDisplay = Array.isArray(card.book)
    ? card.book.join("\n")
    : (card.book ?? "");

  // --- desktop / regular detail panel (still populated, though hidden in CSS) ---
  if (card.image && imageWrapper && imageEl) {
    imageWrapper.classList.remove("hidden");
    imageEl.src = card.image;
    imageEl.alt = `${card.character ?? ""} – ${card.cardName ?? ""}`;
  } else if (imageWrapper && imageEl) {
    imageWrapper.classList.add("hidden");
    imageEl.removeAttribute("src");
    imageEl.alt = "";
  }

  if (titleEl) titleEl.textContent = `${card.character ?? ""} – ${card.cardName ?? ""}`;
  if (charEl) charEl.textContent = card.character ?? "";
  if (cardNameEl) cardNameEl.textContent = card.cardName ?? "";
  if (volumeEl) volumeEl.textContent = card.volume ?? "";
  if (bookEl) bookEl.textContent = bookDisplay;

  const genderDisplay = Array.isArray(card.gender)
    ? card.gender.join(", ")
    : (card.gender ?? "");
  if (genderEl) genderEl.textContent = genderDisplay;

  if (rewardEl) rewardEl.textContent = formatRewardShort(card);

  if (rarityEl) {
    rarityEl.textContent = card.rarity ?? "";

    // reset old rarity classes
    rarityEl.classList.remove(
      "rarity-common",
      "rarity-uncommon",
      "rarity-rare",
      "rarity-epic",
      "rarity-legendary"
    );

    if (card.rarity) {
      const rarityClass = `rarity-${card.rarity.toLowerCase().replace(/\s+/g, "-")}`;
      rarityEl.classList.add(rarityClass);
    }
  }

  if (messageEl) messageEl.textContent = card.message ?? "";

  // --- overlay version (all viewports) ---
  const mobileOverlay = document.getElementById("mobile-detail-overlay");
  const mImageWrapper = document.getElementById("mobile-detail-image-wrapper");
  const mImageEl = document.getElementById("mobile-detail-image");
  const mTitleEl = document.getElementById("mobile-detail-title");
  const mCharEl = document.getElementById("mobile-detail-character");
  const mCardNameEl = document.getElementById("mobile-detail-cardName");
  const mVolumeEl = document.getElementById("mobile-detail-volume");
  const mBookEl = document.getElementById("mobile-detail-book");
  const mGenderEl = document.getElementById("mobile-detail-gender");
  const mRewardEl = document.getElementById("mobile-detail-reward");
  const mRarityEl = document.getElementById("mobile-detail-rarity");
  const mMessageEl = document.getElementById("mobile-detail-message");

  if (!mobileOverlay) return;

  // image
  if (card.image && mImageWrapper && mImageEl) {
    mImageWrapper.classList.remove("hidden");
    mImageEl.src = card.image;
    mImageEl.alt = `${card.character ?? ""} – ${card.cardName ?? ""}`;
  } else if (mImageWrapper && mImageEl) {
    mImageWrapper.classList.add("hidden");
    mImageEl.removeAttribute("src");
    mImageEl.alt = "";
  }

  // text fields
  if (mTitleEl) {
    mTitleEl.textContent = `${card.character ?? ""} – ${card.cardName ?? ""}`;
  }
  if (mCharEl) mCharEl.textContent = card.character ?? "";
  if (mCardNameEl) mCardNameEl.textContent = card.cardName ?? "";
  if (mVolumeEl) mVolumeEl.textContent = card.volume ?? "";
  if (mBookEl) mBookEl.textContent = bookDisplay;
  if (mGenderEl) mGenderEl.textContent = genderDisplay;
  if (mRewardEl) {
    mRewardEl.textContent = formatRewardShort(card);
  }
  if (mRarityEl) mRarityEl.textContent = card.rarity ?? "";
  if (mMessageEl) mMessageEl.textContent = card.message ?? "";

  // Show/hide prev/next arrows based on currentIndex
  const mPrevBtn = document.getElementById("mobile-detail-prev");
  const mNextBtn = document.getElementById("mobile-detail-next");

  if (mPrevBtn) {
    if (currentIndex > 0) {
      mPrevBtn.classList.remove("hidden");
    } else {
      mPrevBtn.classList.add("hidden");
    }
  }

  if (mNextBtn) {
    if (currentIndex >= 0 && currentIndex < currentList.length - 1) {
      mNextBtn.classList.remove("hidden");
    } else {
      mNextBtn.classList.add("hidden");
    }
  }

  // show overlay
  mobileOverlay.classList.remove("hidden");
  mobileOverlay.classList.add("open");
  mobileOverlay.scrollTop = 0;
}

// --- 6. Kick off ---

init();
