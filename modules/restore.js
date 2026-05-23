window.addEventListener(
  "load",
  restoreMarkers
);


function restoreMarkers() {

  const url =
    window.location.href;

  chrome.storage.local.get(
    ["markers"],
    (result) => {

      const markers =
        result.markers || [];

      const pageMarkers =
        markers.filter(
          marker =>
            marker.url === url
        );

      pageMarkers.forEach(
        marker => {

          highlightSavedText(
            marker.text,
            marker.memo
          );

        }
      );

    }
  );

}


function highlightSavedText(
  targetText,
  memo
) {

  const walker =
    document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );

  let node;

  while (
    node = walker.nextNode()
  ) {

    const text =
      node.textContent;

    const index =
      text.indexOf(
        targetText
      );

    if (
      index !== -1
    ) {

      const range =
        document.createRange();

      range.setStart(
        node,
        index
      );

      range.setEnd(
        node,
        index +
        targetText.length
      );

      const marker =
        document.createElement(
          "span"
        );

      marker.className =
        "ichnite-highlight";

      marker.dataset.memo =
        memo;

      try {

        range
          .surroundContents(
            marker
          );

        console.log(
          "復元成功:",
          targetText
        );

      } catch (error) {

        console.log(
          "復元失敗:",
          error
        );

      }

      break;

    }
  }
}