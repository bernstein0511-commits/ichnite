document
    .getElementById("openMarkerBookBtn")
    .addEventListener("click", () => {

        window.open(chrome.runtime.getURL("ui/marker_book.html"), "_blank");

    });

document
    .getElementById("testBtn")
    .addEventListener("click", () => {

        alert("Ichnite起動中");

    });