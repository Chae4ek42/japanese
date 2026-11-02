import json
from pathlib import Path

root = Path('.')
groups_path = root / 'src/features/vocab/groups.json'
groups = json.loads(groups_path.read_text(encoding='utf-8-sig'))
base = json.loads((root / 'src/data/words/words.json').read_text(encoding='utf-8-sig'))
catalog = json.loads((root / 'src/data/words/kana-catalog.json').read_text(encoding='utf-8-sig'))['extra']
curated_path = root / 'src/data/words/curated-vocabulary.json'
curated = json.loads(curated_path.read_text(encoding='utf-8'))['words'] if curated_path.exists() else []
words = base + catalog + curated

# These are explicitly chosen vocabulary lists, not dictionary classification rules.
# An optional |reading disambiguates a headword; =id records a reviewed dictionary entry.
expansions = {
    'colors': '緑 紫 桃色 灰色 金色|きんいろ 銀色|ぎんいろ オレンジ ピンク',
    'body': '首 肩 腕 指 胸 背中 腰 膝 鼻 舌 肌 骨 血 爪 お腹',
    'clothes': 'シャツ セーター スカート ズボン ジャケット 上着 下着 洋服 袖 襟 革 布 履く 被る 着替える',
    'home': '机 テーブル ベッド ソファ カーテン 棚 鏡 布団 毛布 枕 皿 茶碗 箸 掃除機 電子レンジ エアコン',
    'media': 'テレビ ラジオ カメラ インターネット パソコン スマホ スマートフォン メール アプリ 画面 番組 記事 広告 記者 動画 音声',
    'greetings': '有難うございます おはようございます はい いいえ 失礼します お願いします いただきます ごちそうさま お帰りなさい ただいま お休みなさい さようなら いらっしゃいませ',
    'dining': 'レストラン 喫茶店 メニュー 箸 スプーン フォーク ナイフ 皿 コップ おしぼり 定食 丼|どんぶり お代わり 満腹 禁煙 喫煙',
    'tourism': 'ホテル 旅館 フロント 受付 宿泊 客室 鍵 温泉 名所 旅券 両替 通訳 国際 国内 海外 往復 片道',
    'shopping': 'スーパー コンビニ 百貨店 商店街 売り場 品物 商品 袋 包む 返品 交換 領収書 レシート クレジットカード サイズ 試着 売り切れ 在庫',
    'health': '看護師 歯医者 患者 診察 治療 注射 救急車 咳|せき 頭痛 腹痛 吐き気 めまい アレルギー 体温 保険証 受付',
    'hobbies': '散歩 釣り 園芸 料理 手芸 絵 描く 撮る 集める 踊る ピアノ ギター 将棋 碁 漫画',
    'animals': '兎 鹿 鼠 狐 鳥類 鶏 鴨 鳩 鯨 イルカ 蛙 亀 蝶 蜂 蟻',
    'counters': '三人 四人|よにん 一枚 二枚 一匹|いっぴき 二匹 一本|いっぽん 二本 一冊 二冊 一台 二台 一杯|いっぱい 二杯 一個 二個',
    'seasons': '梅雨 花見 花粉 新緑 蒸し暑い 日焼け 紅葉狩り 落ち葉 雪だるま 大晦日 正月 年末 年始',
    'time': '今朝 今晩 一昨日 明後日|あさって 今年|ことし 去年 来年 今月 先月 来月 今週 毎週 毎月 夕方 深夜 正午 日付 予定',
    'food': 'パン コーヒー バナナ 林檎|りんご トマト チーズ ヨーグルト 豆腐 鶏肉 豚肉 牛肉 じゃが芋 玉葱 人参 胡椒 醤油 酢 味噌',
    'work': '出勤 退勤 出張 連絡 相談 報告 書類 資料 締め切り 受付 取引 契約 昇進 退職',
    'weather': '天気予報 気圧 快晴 大雨 大雪 強風 洪水 日差し 乾燥 蒸し暑い 凍る 溶ける',
    'numbers': '零 四つ 五つ 六つ 七つ 八つ 九つ 十|とお 億 兆 半分 倍 足す 引く|ひく 掛ける|かける 割る',
    'directions': '隣 横 間|あいだ 真ん中 周り 奥 手前 正面 反対 角|かど 交差点 曲がる 進む 戻る',
}

new_groups = [
    ('daily-routine', 'Распорядок дня', 'От подъёма до сна: действия и домашние дела', '起きる 目覚める 寝る 眠る 洗う 磨く 着替える 出かける 帰宅 通勤 通学 朝食 昼食 夕食 掃除 洗濯 散歩 入浴 休憩 準備 片付ける'),
    ('kitchen-cooking', 'Кухня и приготовление еды', 'Посуда, ингредиенты и способы готовить', '台所 冷蔵庫 電子レンジ 包丁 まな板 鍋 フライパン 皿 茶碗 箸 計る 切る|きる 混ぜる 焼く 煮る 蒸す 揚げる 炒める ゆでる 調味料 塩 砂糖 醤油 味噌'),
    ('fruit-vegetables', 'Фрукты и овощи', 'Продукты на рынке и в магазине', '果物 野菜 林檎|りんご バナナ 蜜柑 桃 葡萄 梨 苺 西瓜 メロン レモン トマト 胡瓜 茄子 人参 玉葱 じゃが芋 南瓜 大根 白菜 キャベツ ほうれん草 豆'),
    ('digital-life', 'Компьютер и интернет', 'Устройства, действия и связь в интернете', 'パソコン スマートフォン スマホ インターネット 画面 キーボード マウス メール アプリ パスワード ログイン ダウンロード アップロード クリック スクリーンショット オンライン オフライン 検索 保存 削除 設定 接続 充電 電池'),
    ('sports', 'Спорт и тренировки', 'Виды спорта, участники и соревнования', 'スポーツ サッカー テニス バスケットボール 野球 水泳 柔道 剣道 相撲 卓球 陸上競技 競争 試合 選手 監督 審判 練習 運動 勝つ 負ける 引き分け 優勝 得点 体育館'),
    ('music-performance', 'Музыка и выступления', 'Инструменты, слушатели и сцена', '音楽 歌 歌う 演奏 楽器 ピアノ ギター 太鼓 笛 弾く|ひく 吹く 叩く コンサート 舞台 観客 拍手 歌手 作曲 指揮 音 リズム メロディー'),
    ('occupations', 'Профессии', 'Люди и их работа', '医者 看護師 歯医者 教師 警察官 消防士 弁護士 運転手 料理人 店員 駅員 会社員 公務員 研究者 記者 作家 画家 歌手 俳優 農家 大工 技師'),
    ('housing-rental', 'Жильё и аренда', 'Поиск квартиры, договор и устройство дома', '家 部屋 住宅 アパート マンション 賃貸 家賃 敷金 礼金 契約 引っ越し 不動産 大家|おおや 住所 近所 玄関 廊下 階段 エレベーター ベランダ 駐車場 水道 電気 ガス'),
    ('post-delivery', 'Почта и доставка', 'Письма, посылки и адреса', '郵便局 郵便 郵便番号 手紙 葉書 切手 封筒 宛名 住所 小包 荷物 配達 宅配便 送料 速達 書留 不在 再配達 受け取る 送る 届く 届ける'),
    ('emergencies', 'Безопасность и экстренные ситуации', 'Слова для происшествий и обращения за помощью', '危険 安全 注意 助ける 逃げる 避難 地震 火事 火災 津波 洪水 台風 事故 救急車 消防車 警察 交番 怪我 迷子 非常口 消火器 停電'),
    ('environment', 'Экология и отходы', 'Сортировка мусора и забота о природе', '環境 自然 資源 ごみ 分別 回収 リサイクル 再利用 ペットボトル エコバッグ 紙 瓶|びん 缶 袋 捨てる 拾う 汚染 節約 節電 森林 空気 水道'),
    ('relationships', 'Общение и отношения', 'Встречи, дружба, приглашения и договорённости', '友達 仲間 知り合い 隣人 恋人 先輩 後輩 同僚 夫婦 約束 招待 誘う 訪ねる 会う 紹介 相談 連絡 謝る 許す 感謝 尊敬 信頼'),
    ('personality', 'Характер человека', 'Качества, привычки и отношение к людям', '親切 優しい 厳しい 真面目 正直 素直 丁寧 失礼 勇気 我慢 努力 積極的 消極的 内気 頑固 自慢 謙虚 明るい 暗い のんびり'),
    ('shapes-materials', 'Формы и материалы', 'Форма, поверхность, вес и вещество', '形 丸|まる 丸い 四角 三角 長方形 円|えん 線 点 面 穴 木材 金属 鉄 銅 銀|ぎん 金|きん ガラス 紙 布 革 石 重さ 厚さ'),
    ('schedule-calendar', 'Планы и календарь', 'Встречи, сроки и частота событий', '予定 計画 約束 予約 日付 締め切り 期限 延期 中止 変更 開始 終了 出席 欠席 遅刻 間に合う 毎日 毎週 毎月 毎年 平日 週末 祝日 連休'),
    ('travel-accommodation', 'В гостинице', 'Заселение, номер и удобства', 'ホテル 旅館 フロント 受付 予約 宿泊 泊まる 客室 鍵 荷物 朝食 夕食 風呂 シャワー タオル シャンプー エアコン ベッド 毛布 枕 満室 空室 チェックイン チェックアウト'),
]

reviewed = {
    '首': '首|くび', '腕': '腕|うで', '骨': '骨|ほね', '被る': '被る|かぶる',
    '鍵': '鍵|かぎ', '半分': '半分|はんぶん', '手前': '手前|てまえ',
    '塩': '塩|しお', '音': '音|おと', '自然': '自然|しぜん',
    '分別': '分別|ぶんべつ', '夫婦': '夫婦|ふうふ', '真面目': '真面目|まじめ',
    '形': '形|かたち', '面': '面|めん', '穴': '穴|あな', '石': '石|いし',
    '玉葱': '玉ねぎ', 'おしぼり': 'お絞り', 'ただいま': '只今', 'イルカ': 'いるか',
}

def resolve(term):
    term = reviewed.get(term, term)
    if term.startswith('='):
        hits = [w for w in words if w['id'] == term[1:]]
    else:
        writing, _, kana = term.partition('|')
        hits = [w for w in words if w['writing'] == writing and (not kana or w['kana'] == kana)]
    if len(hits) != 1:
        print('RESOLVE', term, [(w['id'], w['writing'], w['kana'], w['meanings'][:2]) for w in hits])
        return None
    return hits[0]['id']

resolved = {}
for key, terms in list(expansions.items()) + [(g[0], g[3]) for g in new_groups]:
    resolved[key] = [resolve(term) for term in terms.split()]

if any(None in ids for ids in resolved.values()):
    raise SystemExit('Resolve every selected lexeme before writing files.')

for group in groups:
    if group['id'] in expansions:
        group['wordIds'] = list(dict.fromkeys(group['wordIds'] + resolved[group['id']]))
for id, label, description, _ in new_groups:
    assert not any(g['id'] == id for g in groups)
    groups.append(dict(id=id, label=label, description=description, kind='theme', wordIds=list(dict.fromkeys(resolved[id]))))

groups_path.write_text(json.dumps(groups, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('GROUPS', len(groups), 'MEMBERSHIPS', sum(len(g['wordIds']) for g in groups), 'UNIQUE', len({i for g in groups for i in g['wordIds']}))
