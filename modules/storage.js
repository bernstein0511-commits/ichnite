function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function saveMarker(text, memo, color, options = {}) {
  const url = window.location.href;

  chrome.storage.local.get(["markers"], (result) => {
    let markers = result.markers || [];

    markers.push({
      id: generateId(),
      url,
      text,
      memo,
      color: color || "yellow",
      category: options.category || "",
      title: options.title || "",
      source: options.source || "",
      date: new Date().toLocaleDateString("ja-JP"),
      importance: options.importance != null ? options.importance : 3,
    });

    chrome.storage.local.set({ markers });
  });
}

function updateMarker(text, oldMemo, newMemo) {
  const url = window.location.href;

  chrome.storage.local.get(["markers"], (result) => {
    let markers = result.markers || [];

    markers = markers.map((marker) => {
      if (
        marker.url === url &&
        marker.text === text &&
        marker.memo === oldMemo
      ) {
        return { ...marker, memo: newMemo };
      }
      return marker;
    });

    chrome.storage.local.set({ markers });
  });
}

function updateMarkerById(id, updates) {
  chrome.storage.local.get(["markers"], (result) => {
    let markers = result.markers || [];

    markers = markers.map((marker) =>
      marker.id === id ? { ...marker, ...updates } : marker
    );

    chrome.storage.local.set({ markers });
  });
}

function deleteMarker(text, memo) {
  const url = window.location.href;

  chrome.storage.local.get(["markers"], (result) => {
    let markers = result.markers || [];

    markers = markers.filter(
      (marker) =>
        !(marker.url === url && marker.text === text && marker.memo === memo)
    );

    chrome.storage.local.set({ markers });
  });
}

function deleteMarkerById(id) {
  chrome.storage.local.get(["markers"], (result) => {
    let markers = result.markers || [];
    markers = markers.filter((marker) => marker.id !== id);
    chrome.storage.local.set({ markers });
  });
}
