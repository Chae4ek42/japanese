import type { Hyperparams, ParticlesFocus, ParticlesPickMode, StatsRecord } from '../shared/lib/types'
import { DEFAULT_HYPERPARAMS, createStatsRecord } from '../shared/lib/trainer'
import { PARTICLE_CLOZE_MORE } from './particles-cloze-more'
import { PARTICLE_CLOZE_BATCH3 } from './particles-cloze-batch3'

/**
 * Twelve core beginner particles:
 * case/frame はがをにでへ + connect ともからまでやの
 */
export const CORE_PARTICLES = [
  'は',
  'が',
  'を',
  'に',
  'で',
  'へ',
  'と',
  'も',
  'の',
  'から',
  'まで',
  'や',
] as const

export type CoreParticle = (typeof CORE_PARTICLES)[number]

export type ParticleGroupId = 'frame' | 'connect'

export const PARTICLE_GROUPS: Record<
  ParticleGroupId,
  { label: string; particles: readonly CoreParticle[] }
> = {
  frame: {
    label: 'Каркас',
    particles: ['は', 'が', 'を', 'に', 'で', 'へ'],
  },
  connect: {
    label: 'Связки',
    particles: ['と', 'も', 'の', 'から', 'まで', 'や'],
  },
}

export const PARTICLE_LABELS: Record<CoreParticle, string> = {
  は: 'wa · тема',
  が: 'ga · подлежащее',
  を: 'o · объект',
  に: 'ni · куда/когда/кому',
  で: 'de · где/чем',
  へ: 'e · направление',
  と: 'to · и / с',
  も: 'mo · тоже',
  の: 'no · род. п. / связка',
  から: 'kara · из / от',
  まで: 'made · до',
  や: 'ya · и … и т.п.',
}

export const PARTICLE_ROMAJI: Record<CoreParticle, string> = {
  は: 'wa',
  が: 'ga',
  を: 'o',
  に: 'ni',
  で: 'de',
  へ: 'e',
  と: 'to',
  も: 'mo',
  の: 'no',
  から: 'kara',
  まで: 'made',
  や: 'ya',
}

export interface ParticleClozeCard {
  id: string
  /** Japanese sentence with `___` as the blank. */
  prompt: string
  answer: CoreParticle
  glossRu: string
  /** Hiragana/katakana reading with the same `___` blank. */
  kana: string
  /** Romaji with the same `___` blank. */
  romaji: string
}

export const PARTICLE_HYPERPARAMS: Hyperparams = {
  ...DEFAULT_HYPERPARAMS,
  targetLatencyMs: 3800,
  masteryGain: 0.14,
  mistakePenalty: 0.18,
  queueSize: 10,
  unseenBoost: 4.6,
}

/** Expanded cloze bank for the twelve core particles (~18 each, batch 1). */
const PARTICLE_CLOZE_BASE: ParticleClozeCard[] = [
  // は
  { id: 'p-ha-01', prompt: '私___学生です。', answer: 'は', glossRu: 'Я — студент.', kana: 'わたし___がくせいです。', romaji: 'watashi ___ gakusei desu' },
  { id: 'p-ha-02', prompt: 'これ___本です。', answer: 'は', glossRu: 'Это — книга.', kana: 'これ___ほんです。', romaji: 'kore ___ hon desu' },
  { id: 'p-ha-03', prompt: '今日___暑いです。', answer: 'は', glossRu: 'Сегодня жарко.', kana: 'きょう___あついです。', romaji: 'kyou ___ atsui desu' },
  { id: 'p-ha-04', prompt: '明日___テストです。', answer: 'は', glossRu: 'Завтра — тест.', kana: 'あした___テストです。', romaji: 'ashita ___ tesuto desu' },
  { id: 'p-ha-05', prompt: '週末___暇です。', answer: 'は', glossRu: 'На выходных свободен.', kana: 'しゅうまつ___ひまです。', romaji: 'shuumatsu ___ hima desu' },
  { id: 'p-ha-06', prompt: '日本語___難しいです。', answer: 'は', glossRu: 'Японский — сложный.', kana: 'にほんご___むずかしいです。', romaji: 'nihongo ___ muzukashii desu' },
  { id: 'p-ha-07', prompt: 'あの人___先生です。', answer: 'は', glossRu: 'Тот человек — учитель.', kana: 'あのひと___せんせいです。', romaji: 'ano hito ___ sensei desu' },
  { id: 'p-ha-08', prompt: '冬___寒いです。', answer: 'は', glossRu: 'Зимой холодно.', kana: 'ふゆ___さむいです。', romaji: 'fuyu ___ samui desu' },
  { id: 'p-ha-09', prompt: 'コーヒー___好きです。', answer: 'は', glossRu: 'Кофе люблю (как тема).', kana: 'コーヒー___すきです。', romaji: 'koohii ___ suki desu' },
  { id: 'p-ha-10', prompt: '彼女___看護師です。', answer: 'は', glossRu: 'Она — медсестра.', kana: 'かのじょ___かんごしです。', romaji: 'kanojo ___ kangoshi desu' },
  { id: 'p-ha-11', prompt: '夜___静かです。', answer: 'は', glossRu: 'Ночью тихо.', kana: 'よる___しずかです。', romaji: 'yoru ___ shizuka desu' },
  { id: 'p-ha-12', prompt: '野菜___健康にいいです。', answer: 'は', glossRu: 'Овощи полезны для здоровья.', kana: 'やさい___けんこうにいいです。', romaji: 'yasai ___ kenkou ni ii desu' },
  { id: 'p-ha-13', prompt: '兄___医者です。', answer: 'は', glossRu: 'Старший брат — врач.', kana: 'あに___いしゃです。', romaji: 'ani ___ isha desu' },
  { id: 'p-ha-14', prompt: 'この店___安いです。', answer: 'は', glossRu: 'Этот магазин дешёвый.', kana: 'このみせ___やすいです。', romaji: 'kono mise ___ yasui desu' },
  { id: 'p-ha-15', prompt: '英語___簡単です。', answer: 'は', glossRu: 'Английский — простой.', kana: 'えいご___かんたんです。', romaji: 'eigo ___ kantan desu' },
  { id: 'p-ha-16', prompt: '子供___元気です。', answer: 'は', glossRu: 'Ребёнок бодрый.', kana: 'こども___げんきです。', romaji: 'kodomo ___ genki desu' },
  { id: 'p-ha-17', prompt: '日曜日___休みです。', answer: 'は', glossRu: 'Воскресенье — выходной.', kana: 'にちようび___やすみです。', romaji: 'nichiyoubi ___ yasumi desu' },
  { id: 'p-ha-18', prompt: '部屋___広いです。', answer: 'は', glossRu: 'Комната просторная.', kana: 'へや___ひろいです。', romaji: 'heya ___ hiroi desu' },

  // が
  { id: 'p-ga-01', prompt: '猫___好きです。', answer: 'が', glossRu: 'Люблю кошек.', kana: 'ねこ___すきです。', romaji: 'neko ___ suki desu' },
  { id: 'p-ga-02', prompt: '誰___来ましたか。', answer: 'が', glossRu: 'Кто пришёл?', kana: 'だれ___きましたか。', romaji: 'dare ___ kimashita ka' },
  { id: 'p-ga-03', prompt: '雨___降っています。', answer: 'が', glossRu: 'Идёт дождь.', kana: 'あめ___ふっています。', romaji: 'ame ___ futte imasu' },
  { id: 'p-ga-04', prompt: '犬___います。', answer: 'が', glossRu: 'Есть собака.', kana: 'いぬ___います。', romaji: 'inu ___ imasu' },
  { id: 'p-ga-05', prompt: '音___大きいです。', answer: 'が', glossRu: 'Звук громкий.', kana: 'おと___おおきいです。', romaji: 'oto ___ ookii desu' },
  { id: 'p-ga-06', prompt: 'これ___いいです。', answer: 'が', glossRu: 'Вот это хорошо.', kana: 'これ___いいです。', romaji: 'kore ___ ii desu' },
  { id: 'p-ga-07', prompt: '何___ありますか。', answer: 'が', glossRu: 'Что есть?', kana: 'なに___ありますか。', romaji: 'nani ___ arimasu ka' },
  { id: 'p-ga-08', prompt: '雪___降ります。', answer: 'が', glossRu: 'Идёт снег.', kana: 'ゆき___ふります。', romaji: 'yuki ___ furimasu' },
  { id: 'p-ga-09', prompt: '頭___痛いです。', answer: 'が', glossRu: 'Голова болит.', kana: 'あたま___いたいです。', romaji: 'atama ___ itai desu' },
  { id: 'p-ga-10', prompt: '時間___ありません。', answer: 'が', glossRu: 'Нет времени.', kana: 'じかん___ありません。', romaji: 'jikan ___ arimasen' },
  { id: 'p-ga-11', prompt: 'お金___必要です。', answer: 'が', glossRu: 'Нужны деньги.', kana: 'おかね___ひつようです。', romaji: 'okane ___ hitsuyou desu' },
  { id: 'p-ga-12', prompt: '弟___います。', answer: 'が', glossRu: 'Есть младший брат.', kana: 'おとうと___います。', romaji: 'otouto ___ imasu' },
  { id: 'p-ga-13', prompt: '風___強いです。', answer: 'が', glossRu: 'Ветер сильный.', kana: 'かぜ___つよいです。', romaji: 'kaze ___ tsuyoi desu' },
  { id: 'p-ga-14', prompt: '問題___難しいです。', answer: 'が', glossRu: 'Задача сложная.', kana: 'もんだい___むずかしいです。', romaji: 'mondai ___ muzukashii desu' },
  { id: 'p-ga-15', prompt: '誰___わかりますか。', answer: 'が', glossRu: 'Кто понимает?', kana: 'だれ___わかりますか。', romaji: 'dare ___ wakarimasu ka' },
  { id: 'p-ga-16', prompt: '花___きれいです。', answer: 'が', glossRu: 'Цветы красивые.', kana: 'はな___きれいです。', romaji: 'hana ___ kirei desu' },
  { id: 'p-ga-17', prompt: '電話___鳴っています。', answer: 'が', glossRu: 'Телефон звонит.', kana: 'でんわ___なっています。', romaji: 'denwa ___ natte imasu' },
  { id: 'p-ga-18', prompt: '車___止まりました。', answer: 'が', glossRu: 'Машина остановилась.', kana: 'くるま___とまりました。', romaji: 'kuruma ___ tomarimashita' },

  // を
  { id: 'p-wo-01', prompt: '水___飲みます。', answer: 'を', glossRu: 'Пью воду.', kana: 'みず___のみます。', romaji: 'mizu ___ nomimasu' },
  { id: 'p-wo-02', prompt: '本___読みます。', answer: 'を', glossRu: 'Читаю книгу.', kana: 'ほん___よみます。', romaji: 'hon ___ yomimasu' },
  { id: 'p-wo-03', prompt: '日本語___勉強します。', answer: 'を', glossRu: 'Учу японский.', kana: 'にほんご___べんきょうします。', romaji: 'nihongo ___ benkyou shimasu' },
  { id: 'p-wo-04', prompt: '映画___見ます。', answer: 'を', glossRu: 'Смотрю фильм.', kana: 'えいが___みます。', romaji: 'eiga ___ mimasu' },
  { id: 'p-wo-05', prompt: '手紙___書きます。', answer: 'を', glossRu: 'Пишу письмо.', kana: 'てがみ___かきます。', romaji: 'tegami ___ kakimasu' },
  { id: 'p-wo-06', prompt: '窓___開けてください。', answer: 'を', glossRu: 'Откройте окно.', kana: 'まど___あけてください。', romaji: 'mado ___ akete kudasai' },
  { id: 'p-wo-07', prompt: '鍵___忘れました。', answer: 'を', glossRu: 'Забыл ключ.', kana: 'かぎ___わすれました。', romaji: 'kagi ___ wasuremashita' },
  { id: 'p-wo-08', prompt: '公園___歩きます。', answer: 'を', glossRu: 'Иду через парк.', kana: 'こうえん___あるきます。', romaji: 'kouen ___ arukimasu' },
  { id: 'p-wo-09', prompt: 'ご飯___食べます。', answer: 'を', glossRu: 'Ем рис / еду.', kana: 'ごはん___たべます。', romaji: 'gohan ___ tabemasu' },
  { id: 'p-wo-10', prompt: '音楽___聞きます。', answer: 'を', glossRu: 'Слушаю музыку.', kana: 'おんがく___ききます。', romaji: 'ongaku ___ kikimasu' },
  { id: 'p-wo-11', prompt: '写真___撮ります。', answer: 'を', glossRu: 'Фотографирую.', kana: 'しゃしん___とります。', romaji: 'shashin ___ torimasu' },
  { id: 'p-wo-12', prompt: 'ドア___閉めてください。', answer: 'を', glossRu: 'Закройте дверь.', kana: 'ドア___しめてください。', romaji: 'doa ___ shimete kudasai' },
  { id: 'p-wo-13', prompt: '荷物___持ちます。', answer: 'を', glossRu: 'Несу багаж.', kana: 'にもつ___もちます。', romaji: 'nimotsu ___ mochimasu' },
  { id: 'p-wo-14', prompt: '宿題___します。', answer: 'を', glossRu: 'Делаю домашнее задание.', kana: 'しゅくだい___します。', romaji: 'shukudai ___ shimasu' },
  { id: 'p-wo-15', prompt: '切符___買います。', answer: 'を', glossRu: 'Покупаю билет.', kana: 'きっぷ___かいます。', romaji: 'kippu ___ kaimasu' },
  { id: 'p-wo-16', prompt: 'テレビ___消してください。', answer: 'を', glossRu: 'Выключите телевизор.', kana: 'テレビ___けしてください。', romaji: 'terebi ___ keshite kudasai' },
  { id: 'p-wo-17', prompt: '橋___渡ります。', answer: 'を', glossRu: 'Перехожу мост.', kana: 'はし___わたります。', romaji: 'hashi ___ watarimasu' },
  { id: 'p-wo-18', prompt: '名前___書いてください。', answer: 'を', glossRu: 'Напишите имя.', kana: 'なまえ___かいてください。', romaji: 'namae ___ kaite kudasai' },

  // に
  { id: 'p-ni-01', prompt: '学校___行きます。', answer: 'に', glossRu: 'Иду в школу.', kana: 'がっこう___いきます。', romaji: 'gakkou ___ ikimasu' },
  { id: 'p-ni-02', prompt: '七時___起きます。', answer: 'に', glossRu: 'Встаю в семь.', kana: 'しちじ___おきます。', romaji: 'shichiji ___ okimasu' },
  { id: 'p-ni-03', prompt: '友達___会います。', answer: 'に', glossRu: 'Встречаюсь с другом.', kana: 'ともだち___あいます。', romaji: 'tomodachi ___ aimasu' },
  { id: 'p-ni-04', prompt: '机の上___あります。', answer: 'に', glossRu: 'Лежит на столе.', kana: 'つくえのうえ___あります。', romaji: 'tsukue no ue ___ arimasu' },
  { id: 'p-ni-05', prompt: '日本___住んでいます。', answer: 'に', glossRu: 'Живу в Японии.', kana: 'にほん___すんでいます。', romaji: 'nihon ___ sunde imasu' },
  { id: 'p-ni-06', prompt: '駅___着きました。', answer: 'に', glossRu: 'Приехал на станцию.', kana: 'えき___つきました。', romaji: 'eki ___ tsukimashita' },
  { id: 'p-ni-07', prompt: '母___花をあげます。', answer: 'に', glossRu: 'Даю цветы маме.', kana: 'はは___はなをあげます。', romaji: 'haha ___ hana o agemasu' },
  { id: 'p-ni-08', prompt: '公園___います。', answer: 'に', glossRu: 'Нахожусь в парке.', kana: 'こうえん___います。', romaji: 'kouen ___ imasu' },
  { id: 'p-ni-09', prompt: '病院___行きます。', answer: 'に', glossRu: 'Иду в больницу.', kana: 'びょういん___いきます。', romaji: 'byouin ___ ikimasu' },
  { id: 'p-ni-10', prompt: '三時___会いましょう。', answer: 'に', glossRu: 'Встретимся в три.', kana: 'さんじ___あいましょう。', romaji: 'sanji ___ aimashou' },
  { id: 'p-ni-11', prompt: '箱の中___入れてください。', answer: 'に', glossRu: 'Положите в коробку.', kana: 'はこのなか___いれてください。', romaji: 'hako no naka ___ irete kudasai' },
  { id: 'p-ni-12', prompt: '先生___質問します。', answer: 'に', glossRu: 'Задаю вопрос учителю.', kana: 'せんせい___しつもんします。', romaji: 'sensei ___ shitsumon shimasu' },
  { id: 'p-ni-13', prompt: '椅子___座ってください。', answer: 'に', glossRu: 'Садитесь на стул.', kana: 'いす___すわってください。', romaji: 'isu ___ suwatte kudasai' },
  { id: 'p-ni-14', prompt: '週末___旅行します。', answer: 'に', glossRu: 'В выходные еду в поездку.', kana: 'しゅうまつ___りょこうします。', romaji: 'shuumatsu ___ ryokou shimasu' },
  { id: 'p-ni-15', prompt: '床___落ちました。', answer: 'に', glossRu: 'Упало на пол.', kana: 'ゆか___おちました。', romaji: 'yuka ___ ochimashita' },
  { id: 'p-ni-16', prompt: '弟___本を貸します。', answer: 'に', glossRu: 'Одалживаю книгу младшему брату.', kana: 'おとうと___ほんをかします。', romaji: 'otouto ___ hon o kashimasu' },
  { id: 'p-ni-17', prompt: '会社___勤めています。', answer: 'に', glossRu: 'Работаю в компании.', kana: 'かいしゃ___つとめています。', romaji: 'kaisha ___ tsutomete imasu' },
  { id: 'p-ni-18', prompt: '壁___絵があります。', answer: 'に', glossRu: 'На стене есть картина.', kana: 'かべ___えがあります。', romaji: 'kabe ___ e ga arimasu' },

  // で
  { id: 'p-de-01', prompt: '図書館___勉強します。', answer: 'で', glossRu: 'Занимаюсь в библиотеке.', kana: 'としょかん___べんきょうします。', romaji: 'toshokan ___ benkyou shimasu' },
  { id: 'p-de-02', prompt: 'バス___行きます。', answer: 'で', glossRu: 'Еду на автобусе.', kana: 'バス___いきます。', romaji: 'basu ___ ikimasu' },
  { id: 'p-de-03', prompt: '箸___食べます。', answer: 'で', glossRu: 'Ем палочками.', kana: 'はし___たべます。', romaji: 'hashi ___ tabemasu' },
  { id: 'p-de-04', prompt: '日本語___話します。', answer: 'で', glossRu: 'Говорю по-японски.', kana: 'にほんご___はなします。', romaji: 'nihongo ___ hanashimasu' },
  { id: 'p-de-05', prompt: '公園___遊びます。', answer: 'で', glossRu: 'Играю в парке.', kana: 'こうえん___あそびます。', romaji: 'kouen ___ asobimasu' },
  { id: 'p-de-06', prompt: 'レストラン___食べます。', answer: 'で', glossRu: 'Ем в ресторане.', kana: 'レストラン___たべます。', romaji: 'resutoran ___ tabemasu' },
  { id: 'p-de-07', prompt: '海___泳ぎます。', answer: 'で', glossRu: 'Плаваю в море.', kana: 'うみ___およぎます。', romaji: 'umi ___ oyogimasu' },
  { id: 'p-de-08', prompt: 'ペン___書きます。', answer: 'で', glossRu: 'Пишу ручкой.', kana: 'ペン___かきます。', romaji: 'pen ___ kakimasu' },
  { id: 'p-de-09', prompt: '電車___通います。', answer: 'で', glossRu: 'Езжу на поезде.', kana: 'でんしゃ___かよいます。', romaji: 'densha ___ kayoimasu' },
  { id: 'p-de-10', prompt: 'ナイフ___切ります。', answer: 'で', glossRu: 'Режу ножом.', kana: 'ナイフ___きります。', romaji: 'naifu ___ kirimasu' },
  { id: 'p-de-11', prompt: '英語___説明します。', answer: 'で', glossRu: 'Объясняю по-английски.', kana: 'えいご___せつめいします。', romaji: 'eigo ___ setsumei shimasu' },
  { id: 'p-de-12', prompt: '家___休みます。', answer: 'で', glossRu: 'Отдыхаю дома.', kana: 'うち___やすみます。', romaji: 'uchi ___ yasumimasu' },
  { id: 'p-de-13', prompt: 'スマホ___写真を撮ります。', answer: 'で', glossRu: 'Фотографирую смартфоном.', kana: 'スマホ___しゃしんをとります。', romaji: 'sumaho ___ shashin o torimasu' },
  { id: 'p-de-14', prompt: '川___釣りをします。', answer: 'で', glossRu: 'Ловлю рыбу в реке.', kana: 'かわ___つりをします。', romaji: 'kawa ___ tsuri o shimasu' },
  { id: 'p-de-15', prompt: '一人___行きます。', answer: 'で', glossRu: 'Иду один.', kana: 'ひとり___いきます。', romaji: 'hitori ___ ikimasu' },
  { id: 'p-de-16', prompt: '現金___払います。', answer: 'で', glossRu: 'Плачу наличными.', kana: 'げんきん___はらいます。', romaji: 'genkin ___ haraimasu' },
  { id: 'p-de-17', prompt: '教室___待ちます。', answer: 'で', glossRu: 'Жду в классе.', kana: 'きょうしつ___まちます。', romaji: 'kyoushitsu ___ machimasu' },
  { id: 'p-de-18', prompt: '自転車___学校に行きます。', answer: 'で', glossRu: 'Еду в школу на велосипеде.', kana: 'じてんしゃ___がっこうにいきます。', romaji: 'jitensha ___ gakkou ni ikimasu' },

  // へ
  { id: 'p-e-01', prompt: '東京___行きます。', answer: 'へ', glossRu: 'Еду в Токио (направление).', kana: 'とうきょう___いきます。', romaji: 'toukyou ___ ikimasu' },
  { id: 'p-e-02', prompt: '家___帰ります。', answer: 'へ', glossRu: 'Возвращаюсь домой.', kana: 'うち___かえります。', romaji: 'uchi ___ kaerimasu' },
  { id: 'p-e-03', prompt: '向こう___歩きましょう。', answer: 'へ', glossRu: 'Пойдём туда.', kana: 'むこう___あるきましょう。', romaji: 'mukou ___ arukimashou' },
  { id: 'p-e-04', prompt: '右___曲がってください。', answer: 'へ', glossRu: 'Поверните направо.', kana: 'みぎ___まがってください。', romaji: 'migi ___ magatte kudasai' },
  { id: 'p-e-05', prompt: '北___行きます。', answer: 'へ', glossRu: 'Иду на север.', kana: 'きた___いきます。', romaji: 'kita ___ ikimasu' },
  { id: 'p-e-06', prompt: '日本___来ました。', answer: 'へ', glossRu: 'Приехал в Японию (направление).', kana: 'にほん___きました。', romaji: 'nihon ___ kimashita' },
  { id: 'p-e-07', prompt: '前___進んでください。', answer: 'へ', glossRu: 'Продвиньтесь вперёд.', kana: 'まえ___すすんでください。', romaji: 'mae ___ susunde kudasai' },
  { id: 'p-e-08', prompt: '左___曲がります。', answer: 'へ', glossRu: 'Поворачиваю налево.', kana: 'ひだり___まがります。', romaji: 'hidari ___ magarimasu' },
  { id: 'p-e-09', prompt: '駅___向かいます。', answer: 'へ', glossRu: 'Направляюсь к станции.', kana: 'えき___むかいます。', romaji: 'eki ___ mukaimasu' },
  { id: 'p-e-10', prompt: '海___行きましょう。', answer: 'へ', glossRu: 'Поедем к морю.', kana: 'うみ___いきましょう。', romaji: 'umi ___ ikimashou' },
  { id: 'p-e-11', prompt: '上___見てください。', answer: 'へ', glossRu: 'Посмотрите вверх.', kana: 'うえ___みてください。', romaji: 'ue ___ mite kudasai' },
  { id: 'p-e-12', prompt: '南___飛んでいきます。', answer: 'へ', glossRu: 'Летит на юг.', kana: 'みなみ___とんでいきます。', romaji: 'minami ___ tonde ikimasu' },
  { id: 'p-e-13', prompt: '会社___出かけます。', answer: 'へ', glossRu: 'Выхожу на работу.', kana: 'かいしゃ___でかけます。', romaji: 'kaisha ___ dekakemasu' },
  { id: 'p-e-14', prompt: '後ろ___下がってください。', answer: 'へ', glossRu: 'Отойдите назад.', kana: 'うしろ___さがってください。', romaji: 'ushiro ___ sagatte kudasai' },
  { id: 'p-e-15', prompt: '大阪___出張します。', answer: 'へ', glossRu: 'Еду в командировку в Осаку.', kana: 'おおさか___しゅっちょうします。', romaji: 'oosaka ___ shucchou shimasu' },
  { id: 'p-e-16', prompt: '外___出ます。', answer: 'へ', glossRu: 'Выхожу наружу.', kana: 'そと___でます。', romaji: 'soto ___ demasu' },
  { id: 'p-e-17', prompt: '西___歩きます。', answer: 'へ', glossRu: 'Иду на запад.', kana: 'にし___あるきます。', romaji: 'nishi ___ arukimasu' },
  { id: 'p-e-18', prompt: '空港___向かいました。', answer: 'へ', glossRu: 'Направился в аэропорт.', kana: 'くうこう___むかいました。', romaji: 'kuukou ___ mukaimashita' },

  // と
  { id: 'p-to-01', prompt: 'りんご___バナナを買いました。', answer: 'と', glossRu: 'Купил яблоко и банан.', kana: 'りんご___バナナをかいました。', romaji: 'ringo ___ banana o kaimashita' },
  { id: 'p-to-02', prompt: '友達___話します。', answer: 'と', glossRu: 'Говорю с другом.', kana: 'ともだち___はなします。', romaji: 'tomodachi ___ hanashimasu' },
  { id: 'p-to-03', prompt: '母___行きます。', answer: 'と', glossRu: 'Иду с мамой.', kana: 'はは___いきます。', romaji: 'haha ___ ikimasu' },
  { id: 'p-to-04', prompt: '犬___猫がいます。', answer: 'と', glossRu: 'Есть собака и кошка.', kana: 'いぬ___ねこがいます。', romaji: 'inu ___ neko ga imasu' },
  { id: 'p-to-05', prompt: '先生___相談します。', answer: 'と', glossRu: 'Советуюсь с учителем.', kana: 'せんせい___そうだんします。', romaji: 'sensei ___ soudan shimasu' },
  { id: 'p-to-06', prompt: '「行こう」___言いました。', answer: 'と', glossRu: 'Сказал: «Пойдём».', kana: '「いこう」___いいました。', romaji: 'ikou ___ iimashita' },
  { id: 'p-to-07', prompt: 'パン___ミルクをください。', answer: 'と', glossRu: 'Хлеб и молоко, пожалуйста.', kana: 'パン___ミルクをください。', romaji: 'pan ___ miruku o kudasai' },
  { id: 'p-to-08', prompt: '兄___映画を見ます。', answer: 'と', glossRu: 'Смотрю фильм со старшим братом.', kana: 'あに___えいがをみます。', romaji: 'ani ___ eiga o mimasu' },
  { id: 'p-to-09', prompt: '塩___こしょうを入れます。', answer: 'と', glossRu: 'Добавляю соль и перец.', kana: 'しお___こしょうをいれます。', romaji: 'shio ___ koshou o iremasu' },
  { id: 'p-to-10', prompt: '彼女___結婚します。', answer: 'と', glossRu: 'Женюсь на ней / выхожу замуж за него.', kana: 'かのじょ___けっこんします。', romaji: 'kanojo ___ kekkon shimasu' },
  { id: 'p-to-11', prompt: '同じ___思います。', answer: 'と', glossRu: 'Думаю так же.', kana: 'おなじ___おもいます。', romaji: 'onaji ___ omoimasu' },
  { id: 'p-to-12', prompt: '父___釣りに行きます。', answer: 'と', glossRu: 'Иду на рыбалку с отцом.', kana: 'ちち___つりにいきます。', romaji: 'chichi ___ tsuri ni ikimasu' },
  { id: 'p-to-13', prompt: '茶___コーヒーがあります。', answer: 'と', glossRu: 'Есть чай и кофе.', kana: 'ちゃ___コーヒーがあります。', romaji: 'cha ___ koohii ga arimasu' },
  { id: 'p-to-14', prompt: '「はい」___答えました。', answer: 'と', glossRu: 'Ответил: «Да».', kana: '「はい」___こたえました。', romaji: 'hai ___ kotaemashita' },
  { id: 'p-to-15', prompt: '同僚___昼ごはんを食べます。', answer: 'と', glossRu: 'Обедаю с коллегой.', kana: 'どうりょう___ひるごはんをたべます。', romaji: 'douryou ___ hirugohan o tabemasu' },
  { id: 'p-to-16', prompt: '鉛筆___消しゴムを買います。', answer: 'と', glossRu: 'Покупаю карандаш и ластик.', kana: 'えんぴつ___けしゴムをかいます。', romaji: 'enpitsu ___ keshigomu o kaimasu' },
  { id: 'p-to-17', prompt: '妹___遊びます。', answer: 'と', glossRu: 'Играю с младшей сестрой.', kana: 'いもうと___あそびます。', romaji: 'imouto ___ asobimasu' },
  { id: 'p-to-18', prompt: '静か___言われました。', answer: 'と', glossRu: 'Мне сказали быть тише.', kana: 'しずか___いわれました。', romaji: 'shizuka ___ iwaremashita' },

  // も
  { id: 'p-mo-01', prompt: '私___学生です。', answer: 'も', glossRu: 'Я тоже студент.', kana: 'わたし___がくせいです。', romaji: 'watashi ___ gakusei desu' },
  { id: 'p-mo-02', prompt: 'これ___ください。', answer: 'も', glossRu: 'Это тоже дайте.', kana: 'これ___ください。', romaji: 'kore ___ kudasai' },
  { id: 'p-mo-03', prompt: '明日___来ます。', answer: 'も', glossRu: 'Завтра тоже приду.', kana: 'あした___きます。', romaji: 'ashita ___ kimasu' },
  { id: 'p-mo-04', prompt: 'お茶___飲みます。', answer: 'も', glossRu: 'Чай тоже пью.', kana: 'おちゃ___のみます。', romaji: 'ocha ___ nomimasu' },
  { id: 'p-mo-05', prompt: '誰___いません。', answer: 'も', glossRu: 'Никого нет.', kana: 'だれ___いません。', romaji: 'dare ___ imasen' },
  { id: 'p-mo-06', prompt: '何___ありません。', answer: 'も', glossRu: 'Ничего нет.', kana: 'なに___ありません。', romaji: 'nani ___ arimasen' },
  { id: 'p-mo-07', prompt: 'パン___食べます。', answer: 'も', glossRu: 'Хлеб тоже ем.', kana: 'パン___たべます。', romaji: 'pan ___ tabemasu' },
  { id: 'p-mo-08', prompt: '彼___来ます。', answer: 'も', glossRu: 'Он тоже придёт.', kana: 'かれ___きます。', romaji: 'kare ___ kimasu' },
  { id: 'p-mo-09', prompt: '日本語___話せます。', answer: 'も', glossRu: 'Японским тоже могу говорить.', kana: 'にほんご___はなせます。', romaji: 'nihongo ___ hanasemasu' },
  { id: 'p-mo-10', prompt: '今日___暑いです。', answer: 'も', glossRu: 'Сегодня тоже жарко.', kana: 'きょう___あついです。', romaji: 'kyou ___ atsui desu' },
  { id: 'p-mo-11', prompt: 'どこ___行きません。', answer: 'も', glossRu: 'Никуда не иду.', kana: 'どこ___いきません。', romaji: 'doko ___ ikimasen' },
  { id: 'p-mo-12', prompt: '水___ください。', answer: 'も', glossRu: 'Воду тоже, пожалуйста.', kana: 'みず___ください。', romaji: 'mizu ___ kudasai' },
  { id: 'p-mo-13', prompt: '子供___好きです。', answer: 'も', glossRu: 'Детей тоже люблю.', kana: 'こども___すきです。', romaji: 'kodomo ___ suki desu' },
  { id: 'p-mo-14', prompt: '週末___働きます。', answer: 'も', glossRu: 'На выходных тоже работаю.', kana: 'しゅうまつ___はたらきます。', romaji: 'shuumatsu ___ hatarakimasu' },
  { id: 'p-mo-15', prompt: '魚___食べます。', answer: 'も', glossRu: 'Рыбу тоже ем.', kana: 'さかな___たべます。', romaji: 'sakana ___ tabemasu' },
  { id: 'p-mo-16', prompt: '何時___いいです。', answer: 'も', glossRu: 'В любое время хорошо.', kana: 'なんじ___いいです。', romaji: 'nanji ___ ii desu' },
  { id: 'p-mo-17', prompt: '姉___医者です。', answer: 'も', glossRu: 'Старшая сестра тоже врач.', kana: 'あね___いしゃです。', romaji: 'ane ___ isha desu' },
  { id: 'p-mo-18', prompt: 'どれ___欲しいです。', answer: 'も', glossRu: 'Хочу любой / все.', kana: 'どれ___ほしいです。', romaji: 'dore ___ hoshii desu' },

  // の
  { id: 'p-no-01', prompt: '私___本です。', answer: 'の', glossRu: 'Это моя книга.', kana: 'わたし___ほんです。', romaji: 'watashi ___ hon desu' },
  { id: 'p-no-02', prompt: '日本___映画です。', answer: 'の', glossRu: 'Это японский фильм.', kana: 'にほん___えいがです。', romaji: 'nihon ___ eiga desu' },
  { id: 'p-no-03', prompt: '机___上にあります。', answer: 'の', glossRu: 'Лежит на столе.', kana: 'つくえ___うえにあります。', romaji: 'tsukue ___ ue ni arimasu' },
  { id: 'p-no-04', prompt: 'これは誰___ですか。', answer: 'の', glossRu: 'Чьё это?', kana: 'これはだれ___ですか。', romaji: 'kore wa dare ___ desu ka' },
  { id: 'p-no-05', prompt: '青い___がいいです。', answer: 'の', glossRu: 'Синий — хороший (тот, что…).', kana: 'あおい___がいいです。', romaji: 'aoi ___ ga ii desu' },
  { id: 'p-no-06', prompt: '友達___名前は田中です。', answer: 'の', glossRu: 'Имя друга — Танака.', kana: 'ともだち___なまえはたなかです。', romaji: 'tomodachi ___ namae wa tanaka desu' },
  { id: 'p-no-07', prompt: '学校___先生です。', answer: 'の', glossRu: 'Учитель школы.', kana: 'がっこう___せんせいです。', romaji: 'gakkou ___ sensei desu' },
  { id: 'p-no-08', prompt: '彼___車です。', answer: 'の', glossRu: 'Это его машина.', kana: 'かれ___くるまです。', romaji: 'kare ___ kuruma desu' },
  { id: 'p-no-09', prompt: '猫___耳は小さいです。', answer: 'の', glossRu: 'Уши кошки маленькие.', kana: 'ねこ___みみはちいさいです。', romaji: 'neko ___ mimi wa chiisai desu' },
  { id: 'p-no-10', prompt: '東京___天気はいいです。', answer: 'の', glossRu: 'Погода в Токио хорошая.', kana: 'とうきょう___てんきはいいです。', romaji: 'toukyou ___ tenki wa ii desu' },
  { id: 'p-no-11', prompt: '赤い___をください。', answer: 'の', glossRu: 'Дайте красный (тот, что…).', kana: 'あかい___をください。', romaji: 'akai ___ o kudasai' },
  { id: 'p-no-12', prompt: '会社___社長です。', answer: 'の', glossRu: 'Это президент компании.', kana: 'かいしゃ___しゃちょうです。', romaji: 'kaisha ___ shachou desu' },
  { id: 'p-no-13', prompt: '母___料理は美味しいです。', answer: 'の', glossRu: 'Мамина еда вкусная.', kana: 'はは___りょうりはおいしいです。', romaji: 'haha ___ ryouri wa oishii desu' },
  { id: 'p-no-14', prompt: '部屋___鍵を忘れました。', answer: 'の', glossRu: 'Забыл ключ от комнаты.', kana: 'へや___かぎをわすれました。', romaji: 'heya ___ kagi o wasuremashita' },
  { id: 'p-no-15', prompt: '昨日___新聞です。', answer: 'の', glossRu: 'Это вчерашняя газета.', kana: 'きのう___しんぶんです。', romaji: 'kinou ___ shinbun desu' },
  { id: 'p-no-16', prompt: '木___下で休みます。', answer: 'の', glossRu: 'Отдыхаю под деревом.', kana: 'き___したでやすみます。', romaji: 'ki ___ shita de yasumimasu' },
  { id: 'p-no-17', prompt: '子供___頃の写真です。', answer: 'の', glossRu: 'Фото детских лет.', kana: 'こども___ころのしゃしんです。', romaji: 'kodomo ___ koro no shashin desu' },
  { id: 'p-no-18', prompt: '白い___が欲しいです。', answer: 'の', glossRu: 'Хочу белый (тот, что…).', kana: 'しろい___がほしいです。', romaji: 'shiroi ___ ga hoshii desu' },

  // から
  { id: 'p-kara-01', prompt: '家___駅まで歩きます。', answer: 'から', glossRu: 'Иду пешком от дома до станции.', kana: 'うち___えきまであるきます。', romaji: 'uchi ___ eki made arukimasu' },
  { id: 'p-kara-02', prompt: '九時___始めます。', answer: 'から', glossRu: 'Начинаем с девяти.', kana: 'くじ___はじめます。', romaji: 'kuji ___ hajimemasu' },
  { id: 'p-kara-03', prompt: '日本___来ました。', answer: 'から', glossRu: 'Приехал из Японии.', kana: 'にほん___きました。', romaji: 'nihon ___ kimashita' },
  { id: 'p-kara-04', prompt: '忙しい___行けません。', answer: 'から', glossRu: 'Не могу пойти, потому что занят.', kana: 'いそがしい___いけません。', romaji: 'isogashii ___ ikemasen' },
  { id: 'p-kara-05', prompt: '左___読んでください。', answer: 'から', glossRu: 'Читайте слева.', kana: 'ひだり___よんでください。', romaji: 'hidari ___ yonde kudasai' },
  { id: 'p-kara-06', prompt: 'ここ___遠いです。', answer: 'から', glossRu: 'Отсюда далеко.', kana: 'ここ___とおいです。', romaji: 'koko ___ tooi desu' },
  { id: 'p-kara-07', prompt: '朝___雨です。', answer: 'から', glossRu: 'С утра дождь.', kana: 'あさ___あめです。', romaji: 'asa ___ ame desu' },
  { id: 'p-kara-08', prompt: '駅___歩いて五分です。', answer: 'から', glossRu: 'От станции пять минут пешком.', kana: 'えき___あるいてごふんです。', romaji: 'eki ___ aruite gofun desu' },
  { id: 'p-kara-09', prompt: '十月___冬です。', answer: 'から', glossRu: 'С октября зима.', kana: 'じゅうがつ___ふゆです。', romaji: 'juugatsu ___ fuyu desu' },
  { id: 'p-kara-10', prompt: '友達___手紙が来ました。', answer: 'から', glossRu: 'Пришло письмо от друга.', kana: 'ともだち___てがみがきました。', romaji: 'tomodachi ___ tegami ga kimashita' },
  { id: 'p-kara-11', prompt: '暑い___窓を開けます。', answer: 'から', glossRu: 'Открываю окно, потому что жарко.', kana: 'あつい___まどをあけます。', romaji: 'atsui ___ mado o akemasu' },
  { id: 'p-kara-12', prompt: '右___見てください。', answer: 'から', glossRu: 'Смотрите справа.', kana: 'みぎ___みてください。', romaji: 'migi ___ mite kudasai' },
  { id: 'p-kara-13', prompt: '会社___帰ります。', answer: 'から', glossRu: 'Возвращаюсь с работы.', kana: 'かいしゃ___かえります。', romaji: 'kaisha ___ kaerimasu' },
  { id: 'p-kara-14', prompt: '一___十まで数えます。', answer: 'から', glossRu: 'Считаю от одного до десяти.', kana: 'いち___じゅうまでかぞえます。', romaji: 'ichi ___ juu made kazoemasu' },
  { id: 'p-kara-15', prompt: '病気___休みます。', answer: 'から', glossRu: 'Отдыхаю из‑за болезни.', kana: 'びょうき___やすみます。', romaji: 'byouki ___ yasumimasu' },
  { id: 'p-kara-16', prompt: '窓___風が入ります。', answer: 'から', glossRu: 'Через окно входит ветер.', kana: 'まど___かぜがはいります。', romaji: 'mado ___ kaze ga hairimasu' },
  { id: 'p-kara-17', prompt: '明日___旅行です。', answer: 'から', glossRu: 'С завтра поездка.', kana: 'あした___りょこうです。', romaji: 'ashita ___ ryokou desu' },
  { id: 'p-kara-18', prompt: '疲れた___寝ます。', answer: 'から', glossRu: 'Сплю, потому что устал.', kana: 'つかれた___ねます。', romaji: 'tsukareta ___ nemasu' },

  // まで
  { id: 'p-made-01', prompt: '駅___歩きます。', answer: 'まで', glossRu: 'Иду до станции.', kana: 'えき___あるきます。', romaji: 'eki ___ arukimasu' },
  { id: 'p-made-02', prompt: '五時___待ちます。', answer: 'まで', glossRu: 'Жду до пяти.', kana: 'ごじ___まちます。', romaji: 'goji ___ machimasu' },
  { id: 'p-made-03', prompt: '東京___電車で行きます。', answer: 'まで', glossRu: 'Еду на поезде до Токио.', kana: 'とうきょう___でんしゃでいきます。', romaji: 'toukyou ___ densha de ikimasu' },
  { id: 'p-made-04', prompt: 'ここ___どうぞ。', answer: 'まで', glossRu: 'Досюда, пожалуйста.', kana: 'ここ___どうぞ。', romaji: 'koko ___ douzo' },
  { id: 'p-made-05', prompt: '夜___勉強します。', answer: 'まで', glossRu: 'Учусь до ночи.', kana: 'よる___べんきょうします。', romaji: 'yoru ___ benkyou shimasu' },
  { id: 'p-made-06', prompt: '最後___読んでください。', answer: 'まで', glossRu: 'Прочитайте до конца.', kana: 'さいご___よんでください。', romaji: 'saigo ___ yonde kudasai' },
  { id: 'p-made-07', prompt: '明日___に出してください。', answer: 'まで', glossRu: 'Сдайте до завтра.', kana: 'あした___にだしてください。', romaji: 'ashita ___ ni dashite kudasai' },
  { id: 'p-made-08', prompt: '十___数えてください。', answer: 'まで', glossRu: 'Посчитайте до десяти.', kana: 'じゅう___かぞえてください。', romaji: 'juu ___ kazoete kudasai' },
  { id: 'p-made-09', prompt: '空港___送ります。', answer: 'まで', glossRu: 'Провожу до аэропорта.', kana: 'くうこう___おくります。', romaji: 'kuukou ___ okurimasu' },
  { id: 'p-made-10', prompt: '朝___寝ます。', answer: 'まで', glossRu: 'Сплю до утра.', kana: 'あさ___ねます。', romaji: 'asa ___ nemasu' },
  { id: 'p-made-11', prompt: '橋___走ります。', answer: 'まで', glossRu: 'Бегу до моста.', kana: 'はし___はしります。', romaji: 'hashi ___ hashirimasu' },
  { id: 'p-made-12', prompt: '来週___休みます。', answer: 'まで', glossRu: 'Отдыхаю до следующей недели.', kana: 'らいしゅう___やすみます。', romaji: 'raishuu ___ yasumimasu' },
  { id: 'p-made-13', prompt: '出口___まっすぐです。', answer: 'まで', glossRu: 'До выхода прямо.', kana: 'でぐち___まっすぐです。', romaji: 'deguchi ___ massugu desu' },
  { id: 'p-made-14', prompt: '三月___に終わります。', answer: 'まで', glossRu: 'Заканчивается к марту.', kana: 'さんがつ___におわります。', romaji: 'sangatsu ___ ni owarimasu' },
  { id: 'p-made-15', prompt: '家___タクシーで帰ります。', answer: 'まで', glossRu: 'Еду домой на такси.', kana: 'うち___タクシーでかえります。', romaji: 'uchi ___ takushii de kaerimasu' },
  { id: 'p-made-16', prompt: '今___待ちました。', answer: 'まで', glossRu: 'Ждал до сих пор.', kana: 'いま___まちました。', romaji: 'ima ___ machimashita' },
  { id: 'p-made-17', prompt: '山___登ります。', answer: 'まで', glossRu: 'Поднимаюсь до горы / на гору.', kana: 'やま___のぼります。', romaji: 'yama ___ noborimasu' },
  { id: 'p-made-18', prompt: 'ドア___来てください。', answer: 'まで', glossRu: 'Подойдите до двери.', kana: 'ドア___きてください。', romaji: 'doa ___ kite kudasai' },

  // や
  { id: 'p-ya-01', prompt: 'りんご___バナナを買いました。', answer: 'や', glossRu: 'Купил яблоки, бананы и т.п.', kana: 'りんご___バナナをかいました。', romaji: 'ringo ___ banana o kaimashita' },
  { id: 'p-ya-02', prompt: '本___雑誌を読みます。', answer: 'や', glossRu: 'Читаю книги, журналы и т.п.', kana: 'ほん___ざっしをよみます。', romaji: 'hon ___ zasshi o yomimasu' },
  { id: 'p-ya-03', prompt: '犬___猫が好きです。', answer: 'や', glossRu: 'Люблю собак, кошек и т.п.', kana: 'いぬ___ねこがすきです。', romaji: 'inu ___ neko ga suki desu' },
  { id: 'p-ya-04', prompt: '東京___大阪に行きました。', answer: 'や', glossRu: 'Ездил в Токио, Осаку и т.п.', kana: 'とうきょう___おおさかにいきました。', romaji: 'toukyou ___ oosaka ni ikimashita' },
  { id: 'p-ya-05', prompt: 'パン___おにぎりを食べます。', answer: 'や', glossRu: 'Ем хлеб, онигири и т.п.', kana: 'パン___おにぎりをたべます。', romaji: 'pan ___ onigiri o tabemasu' },
  { id: 'p-ya-06', prompt: '机の上に本___ペンがあります。', answer: 'や', glossRu: 'На столе книги, ручки и т.п.', kana: 'つくえのうえにほん___ペンがあります。', romaji: 'tsukue no ue ni hon ___ pen ga arimasu' },
  { id: 'p-ya-07', prompt: '映画___音楽が好きです。', answer: 'や', glossRu: 'Люблю кино, музыку и т.п.', kana: 'えいが___おんがくがすきです。', romaji: 'eiga ___ ongaku ga suki desu' },
  { id: 'p-ya-08', prompt: 'お茶___コーヒーを飲みます。', answer: 'や', glossRu: 'Пью чай, кофе и т.п.', kana: 'おちゃ___コーヒーをのみます。', romaji: 'ocha ___ koohii o nomimasu' },
  { id: 'p-ya-09', prompt: '靴___服を買います。', answer: 'や', glossRu: 'Покупаю обувь, одежду и т.п.', kana: 'くつ___ふくをかいます。', romaji: 'kutsu ___ fuku o kaimasu' },
  { id: 'p-ya-10', prompt: '兄___弟がいます。', answer: 'や', glossRu: 'Есть старший брат, младший брат и т.п.', kana: 'あに___おとうとがいます。', romaji: 'ani ___ otouto ga imasu' },
  { id: 'p-ya-11', prompt: '机___椅子を動かします。', answer: 'や', glossRu: 'Двигаю стол, стул и т.п.', kana: 'つくえ___いすをうごかします。', romaji: 'tsukue ___ isu o ugokashimasu' },
  { id: 'p-ya-12', prompt: '花___木があります。', answer: 'や', glossRu: 'Есть цветы, деревья и т.п.', kana: 'はな___きがあります。', romaji: 'hana ___ ki ga arimasu' },
  { id: 'p-ya-13', prompt: '英語___中国語を勉強します。', answer: 'や', glossRu: 'Учу английский, китайский и т.п.', kana: 'えいご___ちゅうごくごをべんきょうします。', romaji: 'eigo ___ chuugokugo o benkyou shimasu' },
  { id: 'p-ya-14', prompt: '魚___肉を食べます。', answer: 'や', glossRu: 'Ем рыбу, мясо и т.п.', kana: 'さかな___にくをたべます。', romaji: 'sakana ___ niku o tabemasu' },
  { id: 'p-ya-15', prompt: '駅___公園に行きます。', answer: 'や', glossRu: 'Хожу на станцию, в парк и т.п.', kana: 'えき___こうえんにいきます。', romaji: 'eki ___ kouen ni ikimasu' },
  { id: 'p-ya-16', prompt: 'ノート___辞書を持ってきます。', answer: 'や', glossRu: 'Принесу тетрадь, словарь и т.п.', kana: 'ノート___じしょをもってきます。', romaji: 'nooto ___ jisho o motte kimasu' },
  { id: 'p-ya-17', prompt: '雨___風が強いです。', answer: 'や', glossRu: 'Дождь, ветер и т.п. сильные.', kana: 'あめ___かぜがつよいです。', romaji: 'ame ___ kaze ga tsuyoi desu' },
  { id: 'p-ya-18', prompt: '自転車___車で行きます。', answer: 'や', glossRu: 'Езжу на велосипеде, машине и т.п.', kana: 'じてんしゃ___くるまでいきます。', romaji: 'jitensha ___ kuruma de ikimasu' },
]

/** Full cloze bank: batches 1–3 (72 per particle). */
export const PARTICLE_CLOZE_CARDS: ParticleClozeCard[] = [
  ...PARTICLE_CLOZE_BASE,
  ...(PARTICLE_CLOZE_MORE as ParticleClozeCard[]),
  ...(PARTICLE_CLOZE_BATCH3 as ParticleClozeCard[]),
]

const cardById = new Map(PARTICLE_CLOZE_CARDS.map((card) => [card.id, card]))

export function getParticleCard(id: string): ParticleClozeCard | null {
  return cardById.get(id) ?? null
}

export function particlesForFocus(focus: ParticlesFocus = 'all'): readonly CoreParticle[] {
  if (focus === 'all') return CORE_PARTICLES
  return PARTICLE_GROUPS[focus].particles
}

export function particleCardSurface(card: ParticleClozeCard): string {
  return formatParticlePrompt(card.prompt, card.answer)
}

export function buildParticlePool(focus: ParticlesFocus = 'all'): ParticleClozeCard[] {
  const allowed = new Set(particlesForFocus(focus))
  return PARTICLE_CLOZE_CARDS.filter((card) => allowed.has(card.answer))
}

export function ensureParticleStats(
  stats: Record<string, StatsRecord>,
  cardId: string,
): StatsRecord {
  return stats[cardId] ?? createStatsRecord()
}

/** Fixed pad order for muscle memory (not shuffled). */
export function particleChoiceOptions(focus: ParticlesFocus = 'all'): CoreParticle[] {
  return [...particlesForFocus(focus)]
}

export function formatParticlePrompt(prompt: string, fill?: string): string {
  if (fill == null) return prompt
  return prompt.replace('___', fill)
}

export function splitParticlePrompt(prompt: string): { before: string; after: string } {
  const index = prompt.indexOf('___')
  if (index < 0) return { before: prompt, after: '' }
  return { before: prompt.slice(0, index), after: prompt.slice(index + 3) }
}

/** Fill for kana line uses the particle glyph; romaji uses reading. */
export function particleBlankFill(
  particle: CoreParticle,
  line: 'kana' | 'romaji' = 'kana',
): string {
  return line === 'romaji' ? PARTICLE_ROMAJI[particle] : particle
}

export function countCardsByParticle(cards: ParticleClozeCard[]): Record<CoreParticle, number> {
  const counts = Object.fromEntries(CORE_PARTICLES.map((p) => [p, 0])) as Record<
    CoreParticle,
    number
  >
  for (const card of cards) {
    counts[card.answer] += 1
  }
  return counts
}

export type { ParticlesPickMode }
