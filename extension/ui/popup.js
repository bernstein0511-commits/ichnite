// popup.js — popup の基本的な挙動を追加します
// 直接 DOM がない場合はエラーにならないよう存在チェックを行います

const send = (msg) => chrome && chrome.runtime && chrome.runtime.sendMessage && chrome.runtime.sendMessage(msg);

const recordBtn = document.querySelector('.record-book');
if (recordBtn) {
    recordBtn.addEventListener('click', () => {
        send({ type: 'ichnite:open-marker-book' });
    });
}

const closeBtn = document.querySelector('.close-btn');
if (closeBtn) {
    closeBtn.addEventListener('click', () => window.close());
}

// トグルは将来的に状態を背景に保存するフックを追加
document.querySelectorAll('.switch input').forEach((el) => {
    el.addEventListener('change', (e) => {
        const label = e.target.closest('.toggle-row')?.querySelector('.toggle-label')?.textContent?.trim();
        send({ type: 'ichnite:toggle', key: label, value: e.target.checked });
    });
});

// cardsContainer は拡張機能側でデータがある場合にのみ埋める想定
// ここでは初期表示は空のままにします。
