// ==========================================================
// modules/textLocator.js — マーカー位置を「ページ内で同じ文字列の
// 何番目の出現か」で一意に特定するためのユーティリティ。
// 拡張機能自身が挿入するUI（サイドパネル等）は対象から除外する。
//
// 使う側：
//   marker.js  … 新規マーカー保存時に getOccurrenceIndex() で「何番目か」を求めてDBに保存
//   restore.js … ページ再読み込み時に findOccurrenceRange() で保存済みの
//                occurrenceIndex から元のテキストノード/位置を逆引きしてハイライトを復元
// ==========================================================

const ICHNITE_UI_SELECTOR =
  "#ichnite-side-panel, #ichnite-toolbar, #ichnite-floating-button, #ichnite-memo-popup";

function getIchniteTextNodes() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest(ICHNITE_UI_SELECTOR)) return NodeFilter.FILTER_REJECT;
        if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const nodes = [];
  let node;
  while ((node = walker.nextNode())) nodes.push(node);
  return nodes;
}

// text内にtargetが何回出現するか（非重複区切りでカウント）
function countOccurrences(text, target) {
  if (!target) return 0;
  let count = 0;
  let index = text.indexOf(target);
  while (index !== -1) {
    count++;
    index = text.indexOf(target, index + target.length);
  }
  return count;
}

// 選択範囲(range)が、ページ内で何番目のtargetText出現かを求める（0始まり）
function getOccurrenceIndex(range, targetText) {
  const nodes = getIchniteTextNodes();
  let occurrenceIndex = 0;

  for (const node of nodes) {
    if (node === range.startContainer) {
      occurrenceIndex += countOccurrences(node.textContent.slice(0, range.startOffset), targetText);
      break;
    }
    occurrenceIndex += countOccurrences(node.textContent, targetText);
  }

  return occurrenceIndex;
}

// occurrenceIndex番目のtargetTextが現れるテキストノードと範囲を求める
function findOccurrenceRange(targetText, occurrenceIndex) {
  if (!targetText || occurrenceIndex < 0) return null;

  const nodes = getIchniteTextNodes();
  let remaining = occurrenceIndex;

  for (const node of nodes) {
    const text = node.textContent;
    let searchFrom = 0;

    while (true) {
      const index = text.indexOf(targetText, searchFrom);
      if (index === -1) break;

      if (remaining === 0) {
        return { node, start: index, end: index + targetText.length };
      }

      remaining--;
      searchFrom = index + targetText.length;
    }
  }

  return null;
}
