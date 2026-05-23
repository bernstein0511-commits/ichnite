function saveMarker(
  text,
  memo
) {
  const url =
    window.location.href;

  chrome.storage.local.get(
    ["markers"],
    (result) => {
      let markers =
        result.markers || [];

      markers.push({
        url: url,
        text: text,
        memo: memo
      });

      chrome.storage.local.set({
        markers: markers
      });

      console.log(
        "保存成功"
      );
    }
  );

}

function deleteMarker(
  text,
  memo
) {

  const url =
    window.location.href;

  chrome.storage.local.get(
    ["markers"],
    (result) => {
      let markers =
        result.markers || [];
      markers =
        markers.filter(
          marker => {
            return !(
              marker.url === url &&
              marker.text === text &&
              marker.memo === memo
            );
          }
        );

      chrome.storage.local.set({
        markers: markers
      });

      console.log(
        "削除成功"
      );

    }
  );
}