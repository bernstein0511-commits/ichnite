// ==========================================================
// modules/shadowHost.js — 拡張機能のUI（サイドパネル・ツールバー・
// メモポップアップ等）をShadow DOMに隔離し、閲覧中のページのCSSから
// 影響を受けない/与えないようにする（document.body直下に隠しdivを1つ作り、
// その中に閉じたスタイル空間を用意するイメージ）。
//
// getIchniteRoot() が唯一の入り口。marker.js・popup.js・panel.js は
// 自前のUI要素を作る際、必ずこの戻り値（ShadowRoot）に対して
// appendChild / getElementById する。
// ==========================================================

const ICHNITE_HOST_ID = "ichnite-shadow-host";

function getIchniteRoot() {
  const existingHost = document.getElementById(ICHNITE_HOST_ID);
  if (existingHost?.shadowRoot) return existingHost.shadowRoot;

  const host = document.createElement("div");
  host.id = ICHNITE_HOST_ID;
  // documentElement（<html>）直下ではなくbody直下に挿入する。
  // <html>にdisplay:flex/grid等のレイアウトを適用しているサイトだと、
  // <html>の子要素はbodyだけのはずが、この見えないホストdivも兄弟として
  // レイアウトに参加してしまい、横幅をbodyと分け合って狭くなる事故になる
  // （例：ピクシブ百科事典を開くとウィンドウの横幅が短くなる現象）。
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  // ページ側から継承されるフォント・色などをリセットし、UIの見た目を安定させる
  const resetStyle = document.createElement("style");
  resetStyle.textContent = ":host { all: initial; display: block; }";
  shadow.appendChild(resetStyle);

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("content/panel-ui.css");
  shadow.appendChild(link);

  return shadow;
}
