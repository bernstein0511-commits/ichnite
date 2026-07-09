document
    .getElementById("recordsBtn")
    .addEventListener("click", () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL("ui/records.html")
        });
    });

const markerToggleCheckbox = document.getElementById("markerToggleCheckbox");

chrome.storage.local.get({ markersVisible: true }, (data) => {
    markerToggleCheckbox.checked = data.markersVisible;
});

markerToggleCheckbox.addEventListener("change", () => {
    chrome.storage.local.set({ markersVisible: markerToggleCheckbox.checked });
});
