document
    .getElementById("recordsBtn")
    .addEventListener("click", () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL("ui/records.html")
        });
    });
