// 画面上部のInjectパネルの表示/非表示を切り替える
function insertPanel() {
    const panel = document.getElementById('sd-smartphone-plus-panel');
    const root = document.getElementById('tabs').parentNode;

    _setOnClick('sspp-inject-css', () => {
        panel.classList.toggle("opened", _toggleResponsiveCSS());
    })
    // Negaボタンの追加
    _setOnClick('sspp-setting', e => {
        root.classList.toggle("setting-hidden");
    });
    // Negaボタンの追加
    _setOnClick('sspp-nega-prompt', e => {
        root.classList.toggle("nega-prompt-hidden");
    });
    // Sampleボタンの追加
    _setOnClick('sspp-sampling', e => {
        root.classList.toggle("sampling-hidden");
    });
    // Sizeボタンの追加
    _setOnClick('sspp-size', e => {
        root.classList.toggle("size-hidden");
    });

    root.appendChild(panel)
    root.classList.add('setting-hidden', 'nega-prompt-hidden', 'sampling-hidden', 'size-hidden');

    console.log("Responsive design CSS injector has been loaded.");
}


// パネルにボタンを追加するユーティリティ関数
function _setOnClick(id, onClick) {
    document.getElementById(id).addEventListener('click', onClick)
}


// CSSのインジェクション/解除を切り替える
function _toggleResponsiveCSS() {
    const cssID = 'responsive-design-css';
    const existingLink = document.getElementById(cssID);
    
    if (!existingLink) {
        // CSSが注入されていない場合 → 注入する
        const link = document.createElement('link');
        link.id = cssID;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = 'file=extensions/sd-webui-smartphone-plus/responsive.css';
        document.head.appendChild(link);
        return true
    } else {
        existingLink.remove();
        return false
    }
}
