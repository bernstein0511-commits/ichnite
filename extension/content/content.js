let selectedColor = "yellow";
let currentSelection = null;
let ichniteMarkersVisible = true;

console.log("Ichnite content.js 読み込み成功");


function applyMarkerVisibility(visible) {
  ichniteMarkersVisible = visible;
  document.body.classList.toggle("ichnite-markers-hidden", !visible);
}

chrome.storage.local.get({ markersVisible: true }, (data) => {
  applyMarkerVisibility(data.markersVisible);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.markersVisible) {
    applyMarkerVisibility(changes.markersVisible.newValue);
  }
});