from modules import script_callbacks

# 拡張機能がロードされたら自動的にJavaScriptを実行してInjectボタンを表示
def on_ui_loaded():
    pass

# JavaScriptを自動的に読み込むためのコールバックを登録
script_callbacks.on_ui_loaded(on_ui_loaded)
