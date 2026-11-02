import json
from pathlib import Path
ws=json.loads(Path('src/data/words/words.json').read_text('utf-8-sig'))+json.loads(Path('src/data/words/kana-catalog.json').read_text('utf-8-sig'))['extra']
terms='だ する くる こと よう はず わけ よし スマートフォン インターネット パソコン メール アプリ パスワード ログイン ダウンロード アップロード クリック スクリーンショット オンライン オフライン カメラ テレビ ラジオ レストラン メニュー スプーン フォーク ナイフ チーズ ヨーグルト トマト バナナ りんご パン コーヒー スーパー コンビニ ホテル フロント エレベーター エアコン シャワー タオル シャンプー ティッシュ トイレットペーパー ペットボトル リサイクル エコバッグ アレルギー ワクチン マスク バス タクシー トイレ チケット クレジットカード レシート サイズ セーター シャツ スカート ズボン ジャケット カーテン ソファ ベッド テーブル サッカー テニス バスケットボール ピアノ ギター'.split()
for term in terms:
 hits=[w for w in ws if w['writing']==term]
 print(term,[(w['id'],w['kana'],w['meanings'][:1]) for w in hits])
