let allMarkers = [];
let currentFilter = "all";
let currentCategory = "";
let currentImportance = "";
let searchQuery = "";

const CATEGORY_COLORS = [
  { bg: "#e8f5e9", text: "#2e7d32" },
  { bg: "#e3f2fd", text: "#1565c0" },
  { bg: "#fff3e0", text: "#e65100" },
  { bg: "#f3e5f5", text: "#6a1b9a" },
  { bg: "#fce4ec", text: "#c62828" },
  { bg: "#e0f7fa", text: "#00695c" },
  { bg: "#fff8e1", text: "#f57f17" },
  { bg: "#ede7f6", text: "#4527a0" },
];

function categoryColor(category) {
  if (!category) return { bg: "#f5f5f5", text: "#757575" };
  let hash = 0;
  for (const c of category) {
    hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  }
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

function renderStars(importance) {
  const n = Math.min(5, Math.max(1, importance || 3));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCard(marker) {
  const { bg, text } = categoryColor(marker.category);

  const card = document.createElement("div");
  card.className = "marker-card";

  card.innerHTML = `
    <div class="card-actions">
      <button class="edit-btn" title="編集">✎</button>
      <button class="delete-btn" title="削除">🗑</button>
    </div>
    ${marker.category
      ? `<span class="category-badge" style="background:${bg};color:${text}">${escapeHtml(marker.category)}</span>`
      : ""}
    <h3 class="card-title">${escapeHtml(marker.title) || "（タイトルなし）"}</h3>
    <p class="card-text">${escapeHtml(marker.text)}</p>
    ${marker.source
      ? `<div class="card-source">📖 ${escapeHtml(marker.source)}</div>`
      : ""}
    <div class="card-footer">
      <span class="card-date">記録日: ${escapeHtml(marker.date)}</span>
      <span class="card-stars">${renderStars(marker.importance)}</span>
    </div>
  `;

  card.querySelector(".edit-btn").addEventListener("click", () => openEditModal(marker));
  card.querySelector(".delete-btn").addEventListener("click", () => deleteRecord(marker));

  return card;
}

function getFilteredMarkers() {
  let markers = allMarkers;

  if (currentCategory) {
    markers = markers.filter((m) => m.category === currentCategory);
  }

  if (currentImportance) {
    markers = markers.filter((m) => String(m.importance) === currentImportance);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    markers = markers.filter(
      (m) =>
        (m.title || "").toLowerCase().includes(q) ||
        (m.text || "").toLowerCase().includes(q) ||
        (m.category || "").toLowerCase().includes(q) ||
        (m.source || "").toLowerCase().includes(q) ||
        (m.memo || "").toLowerCase().includes(q)
    );
  }

  if (currentFilter === "date") {
    markers = [...markers].sort((a, b) =>
      (b.date || "").localeCompare(a.date || "")
    );
  } else if (currentFilter === "importance") {
    markers = [...markers].sort(
      (a, b) => (b.importance || 0) - (a.importance || 0)
    );
  }

  return markers;
}

function renderCards() {
  const grid = document.getElementById("cards-grid");
  const empty = document.getElementById("empty-state");
  const markers = getFilteredMarkers();

  grid.innerHTML = "";

  if (markers.length === 0) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";
  markers.forEach((m) => grid.appendChild(renderCard(m)));
}

function loadMarkers() {
  chrome.storage.local.get(["markers"], (result) => {
    allMarkers = result.markers || [];
    updateCategorySelect();
    renderCards();
  });
}

function updateCategorySelect() {
  const sel = document.getElementById("category-filter");
  const categories = [
    ...new Set(allMarkers.map((m) => m.category).filter(Boolean)),
  ];

  sel.innerHTML = '<option value="">すべてのカテゴリ</option>';
  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    sel.appendChild(opt);
  });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function openAddModal() {
  document.getElementById("modal-title").textContent = "記録を追加";
  document.getElementById("edit-id").value = "";
  document.getElementById("form-category").value = "";
  document.getElementById("form-title").value = "";
  document.getElementById("form-text").value = "";
  document.getElementById("form-source").value = "";
  document.getElementById("form-memo").value = "";
  setStarValue(3);
  document.getElementById("modal-overlay").style.display = "flex";
}

function openEditModal(marker) {
  document.getElementById("modal-title").textContent = "記録を編集";
  document.getElementById("edit-id").value = marker.id || "";
  document.getElementById("form-category").value = marker.category || "";
  document.getElementById("form-title").value = marker.title || "";
  document.getElementById("form-text").value = marker.text || "";
  document.getElementById("form-source").value = marker.source || "";
  document.getElementById("form-memo").value = marker.memo || "";
  setStarValue(marker.importance || 3);
  document.getElementById("modal-overlay").style.display = "flex";
}

function closeModal() {
  document.getElementById("modal-overlay").style.display = "none";
}

function setStarValue(val) {
  document.getElementById("form-importance").value = val;
  document.querySelectorAll(".star-btn").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.val) <= val);
  });
}

function saveRecord(e) {
  e.preventDefault();

  const id = document.getElementById("edit-id").value;
  const updates = {
    category: document.getElementById("form-category").value.trim(),
    title: document.getElementById("form-title").value.trim(),
    text: document.getElementById("form-text").value.trim(),
    source: document.getElementById("form-source").value.trim(),
    memo: document.getElementById("form-memo").value.trim(),
    importance: Number(document.getElementById("form-importance").value),
  };

  chrome.storage.local.get(["markers"], (result) => {
    let markers = result.markers || [];

    if (id) {
      markers = markers.map((m) => (m.id === id ? { ...m, ...updates } : m));
    } else {
      markers.push({
        id: generateId(),
        url: "",
        color: "yellow",
        date: new Date().toLocaleDateString("ja-JP"),
        ...updates,
      });
    }

    chrome.storage.local.set({ markers }, () => {
      allMarkers = markers;
      updateCategorySelect();
      renderCards();
      closeModal();
    });
  });
}

function deleteRecord(marker) {
  const label = marker.title || (marker.text || "").slice(0, 20);
  if (!confirm(`「${label}」を削除しますか？`)) return;

  chrome.storage.local.get(["markers"], (result) => {
    let markers = result.markers || [];

    if (marker.id) {
      markers = markers.filter((m) => m.id !== marker.id);
    } else {
      markers = markers.filter(
        (m) =>
          !(m.url === marker.url && m.text === marker.text && m.memo === marker.memo)
      );
    }

    chrome.storage.local.set({ markers }, () => {
      allMarkers = markers;
      updateCategorySelect();
      renderCards();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadMarkers();

  document.getElementById("add-btn").addEventListener("click", openAddModal);
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("cancel-btn").addEventListener("click", closeModal);
  document.getElementById("marker-form").addEventListener("submit", saveRecord);

  document.getElementById("search-input").addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderCards();
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentFilter = tab.dataset.filter;

      document.getElementById("category-select-wrapper").style.display =
        currentFilter === "category" ? "block" : "none";
      document.getElementById("importance-filter-wrapper").style.display =
        currentFilter === "importance" ? "block" : "none";

      renderCards();
    });
  });

  document.getElementById("category-filter").addEventListener("change", (e) => {
    currentCategory = e.target.value;
    renderCards();
  });

  document.getElementById("importance-filter").addEventListener("change", (e) => {
    currentImportance = e.target.value;
    renderCards();
  });

  document.querySelectorAll(".star-btn").forEach((btn) => {
    btn.addEventListener("click", () => setStarValue(Number(btn.dataset.val)));

    btn.addEventListener("mouseover", () => {
      document.querySelectorAll(".star-btn").forEach((b) => {
        b.classList.toggle("hover", Number(b.dataset.val) <= Number(btn.dataset.val));
      });
    });

    btn.addEventListener("mouseout", () => {
      document.querySelectorAll(".star-btn").forEach((b) => b.classList.remove("hover"));
    });
  });

  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
  });
});
