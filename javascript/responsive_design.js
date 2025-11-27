// 画面上部のInjectパネルの表示/非表示を切り替える
function insertPanel() {
    const panel = document.createElement('div');

    _insertButton(panel, "", "responsive-design-inject-button", "", e => {
        panel.classList.toggle("opened", _toggleResponsiveCSS())
    });
    _insertButton(panel, "Nega", "nagetive-prompt-toggle-button", "operator", e => {
        const tabs = document.getElementById('tabs');
        tabs.classList.toggle("nega-hidden")
    });

    panel.id = 'responsive-design-inject-panel';
    document.body.insertBefore(panel, document.body.firstChild);
    
    console.log("Responsive design CSS injector has been loaded.")
}


function _insertButton(panel, label, id, className, onClick) {
    const button = document.createElement('button');
    button.id = id;
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    panel.appendChild(button);
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
        link.href = 'file=extensions/sd-webui-responsive-design/responsive.css';
        document.head.appendChild(link);
        return true
    } else {
        existingLink.remove();
        return false
    }
}



// ページ読み込み時に自動的にInjectボタンを表示
document.addEventListener('DOMContentLoaded', insertPanel);
