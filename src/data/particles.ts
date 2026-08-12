import type { Hyperparams, ParticlesFocus, ParticlesPickMode, StatsRecord } from '../shared/lib/types'
import { DEFAULT_HYPERPARAMS, createStatsRecord } from '../shared/lib/trainer'

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

/** Expanded cloze bank for the twelve core particles. */
export const PARTICLE_CLOZE_CARDS: ParticleClozeCard[] = [
  // は
  { id: 'p-ha-01', prompt: '私___学生です。', answer: 'は', glossRu: 'Я — студент.', kana: 'わたし___がくせいです。', romaji: 'watashi ___ gakusei desu' },
  { id: 'p-ha-02', prompt: 'これ___本です。', answer: 'は', glossRu: 'Это — книга.', kana: 'これ___ほんです。', romaji: 'kore ___ hon desu' },
  { id: 'p-ha-03', prompt: '今日___暑いです。', answer: 'は', glossRu: 'Сегодня жарко.', kana: 'きょう___あついです。', romaji: 'kyou ___ atsui desu' },
  { id: 'p-ha-04', prompt: '明日___テストです。', answer: 'は', glossRu: 'Завтра — тест.', kana: 'あした___テストです。', romaji: 'ashita ___ tesuto desu' },
  { id: 'p-ha-05', prompt: '週末___暇です。', answer: 'は', glossRu: 'На выходных свободен.', kana: 'しゅうまつ___ひまです。', romaji: 'shuumatsu ___ hima desu' },
  { id: 'p-ha-06', prompt: '日本語___難しいです。', answer: 'は', glossRu: 'Японский — сложный.', kana: 'にほんご___むずかしいです。', romaji: 'nihongo ___ muzukashii desu' },
  { id: 'p-ha-07', prompt: 'あの人___先生です。', answer: 'は', glossRu: 'Тот человек — учитель.', kana: 'あのひと___せんせいです。', romaji: 'ano hito ___ sensei desu' },

  // が
  { id: 'p-ga-01', prompt: '猫___好きです。', answer: 'が', glossRu: 'Люблю кошек.', kana: 'ねこ___すきです。', romaji: 'neko ___ suki desu' },
  { id: 'p-ga-02', prompt: '誰___来ましたか。', answer: 'が', glossRu: 'Кто пришёл?', kana: 'だれ___きましたか。', romaji: 'dare ___ kimashita ka' },
  { id: 'p-ga-03', prompt: '雨___降っています。', answer: 'が', glossRu: 'Идёт дождь.', kana: 'あめ___ふっています。', romaji: 'ame ___ futte imasu' },
  { id: 'p-ga-04', prompt: '犬___います。', answer: 'が', glossRu: 'Есть собака.', kana: 'いぬ___います。', romaji: 'inu ___ imasu' },
  { id: 'p-ga-05', prompt: '音___大きいです。', answer: 'が', glossRu: 'Звук громкий.', kana: 'おと___おおきいです。', romaji: 'oto ___ ookii desu' },
  { id: 'p-ga-06', prompt: 'これ___いいです。', answer: 'が', glossRu: 'Вот это хорошо.', kana: 'これ___いいです。', romaji: 'kore ___ ii desu' },
  { id: 'p-ga-07', prompt: '何___ありますか。', answer: 'が', glossRu: 'Что есть?', kana: 'なに___ありますか。', romaji: 'nani ___ arimasu ka' },

  // を
  { id: 'p-wo-01', prompt: '水___飲みます。', answer: 'を', glossRu: 'Пью воду.', kana: 'みず___のみます。', romaji: 'mizu ___ nomimasu' },
  { id: 'p-wo-02', prompt: '本___読みます。', answer: 'を', glossRu: 'Читаю книгу.', kana: 'ほん___よみます。', romaji: 'hon ___ yomimasu' },
  { id: 'p-wo-03', prompt: '日本語___勉強します。', answer: 'を', glossRu: 'Учу японский.', kana: 'にほんご___べんきょうします。', romaji: 'nihongo ___ benkyou shimasu' },
  { id: 'p-wo-04', prompt: '映画___見ます。', answer: 'を', glossRu: 'Смотрю фильм.', kana: 'えいが___みます。', romaji: 'eiga ___ mimasu' },
  { id: 'p-wo-05', prompt: '手紙___書きます。', answer: 'を', glossRu: 'Пишу письмо.', kana: 'てがみ___かきます。', romaji: 'tegami ___ kakimasu' },
  { id: 'p-wo-06', prompt: '窓___開けてください。', answer: 'を', glossRu: 'Откройте окно.', kana: 'まど___あけてください。', romaji: 'mado ___ akete kudasai' },
  { id: 'p-wo-07', prompt: '鍵___なくしました。', answer: 'を', glossRu: 'Потерял ключ.', kana: 'かぎ___なくしました。', romaji: 'kagi ___ nakushimashita' },
  { id: 'p-wo-08', prompt: '公園___歩きます。', answer: 'を', glossRu: 'Иду через парк.', kana: 'こうえん___あるきます。', romaji: 'kouen ___ arukimasu' },

  // に
  { id: 'p-ni-01', prompt: '学校___行きます。', answer: 'に', glossRu: 'Иду в школу.', kana: 'がっこう___いきます。', romaji: 'gakkou ___ ikimasu' },
  { id: 'p-ni-02', prompt: '七時___起きます。', answer: 'に', glossRu: 'Встаю в семь.', kana: 'しちじ___おきます。', romaji: 'shichiji ___ okimasu' },
  { id: 'p-ni-03', prompt: '友達___会います。', answer: 'に', glossRu: 'Встречаюсь с другом.', kana: 'ともだち___あいます。', romaji: 'tomodachi ___ aimasu' },
  { id: 'p-ni-04', prompt: '机の上___あります。', answer: 'に', glossRu: 'Лежит на столе.', kana: 'つくえのうえ___あります。', romaji: 'tsukue no ue ___ arimasu' },
  { id: 'p-ni-05', prompt: '日本___住んでいます。', answer: 'に', glossRu: 'Живу в Японии.', kana: 'にほん___すんでいます。', romaji: 'nihon ___ sunde imasu' },
  { id: 'p-ni-06', prompt: '駅___着きました。', answer: 'に', glossRu: 'Приехал на станцию.', kana: 'えき___つきました。', romaji: 'eki ___ tsukimashita' },
  { id: 'p-ni-07', prompt: '母___花をあげます。', answer: 'に', glossRu: 'Даю цветы маме.', kana: 'はは___はなをあげます。', romaji: 'haha ___ hana o agemasu' },
  { id: 'p-ni-08', prompt: '公園___います。', answer: 'に', glossRu: 'Нахожусь в парке.', kana: 'こうえん___います。', romaji: 'kouen ___ imasu' },

  // で
  { id: 'p-de-01', prompt: '図書館___勉強します。', answer: 'で', glossRu: 'Занимаюсь в библиотеке.', kana: 'としょかん___べんきょうします。', romaji: 'toshokan ___ benkyou shimasu' },
  { id: 'p-de-02', prompt: 'バス___行きます。', answer: 'で', glossRu: 'Еду на автобусе.', kana: 'バス___いきます。', romaji: 'basu ___ ikimasu' },
  { id: 'p-de-03', prompt: '箸___食べます。', answer: 'で', glossRu: 'Ем палочками.', kana: 'はし___たべます。', romaji: 'hashi ___ tabemasu' },
  { id: 'p-de-04', prompt: '日本語___話します。', answer: 'で', glossRu: 'Говорю по-японски.', kana: 'にほんご___はなします。', romaji: 'nihongo ___ hanashimasu' },
  { id: 'p-de-05', prompt: '公園___遊びます。', answer: 'で', glossRu: 'Играю в парке.', kana: 'こうえん___あそびます。', romaji: 'kouen ___ asobimasu' },
  { id: 'p-de-06', prompt: 'レストラン___食べます。', answer: 'で', glossRu: 'Ем в ресторане.', kana: 'レストラン___たべます。', romaji: 'resutoran ___ tabemasu' },
  { id: 'p-de-07', prompt: '海___泳ぎます。', answer: 'で', glossRu: 'Плаваю в море.', kana: 'うみ___およぎます。', romaji: 'umi ___ oyogimasu' },
  { id: 'p-de-08', prompt: 'ペン___書きます。', answer: 'で', glossRu: 'Пишу ручкой.', kana: 'ペン___かきます。', romaji: 'pen ___ kakimasu' },

  // へ
  { id: 'p-e-01', prompt: '東京___行きます。', answer: 'へ', glossRu: 'Еду в Токио (направление).', kana: 'とうきょう___いきます。', romaji: 'toukyou ___ ikimasu' },
  { id: 'p-e-02', prompt: '家___帰ります。', answer: 'へ', glossRu: 'Возвращаюсь домой.', kana: 'うち___かえります。', romaji: 'uchi ___ kaerimasu' },
  { id: 'p-e-03', prompt: '向こう___歩きましょう。', answer: 'へ', glossRu: 'Пойдём туда.', kana: 'むこう___あるきましょう。', romaji: 'mukou ___ arukimashou' },
  { id: 'p-e-04', prompt: '右___曲がってください。', answer: 'へ', glossRu: 'Поверните направо.', kana: 'みぎ___まがってください。', romaji: 'migi ___ magatte kudasai' },
  { id: 'p-e-05', prompt: '北___行きます。', answer: 'へ', glossRu: 'Иду на север.', kana: 'きた___いきます。', romaji: 'kita ___ ikimasu' },
  { id: 'p-e-06', prompt: '日本___来ました。', answer: 'へ', glossRu: 'Приехал в Японию (направление).', kana: 'にほん___きました。', romaji: 'nihon ___ kimashita' },
  { id: 'p-e-07', prompt: '前___進んでください。', answer: 'へ', glossRu: 'Продвиньтесь вперёд.', kana: 'まえ___すすんでください。', romaji: 'mae ___ susunde kudasai' },

  // と
  { id: 'p-to-01', prompt: 'りんご___バナナを買いました。', answer: 'と', glossRu: 'Купил яблоко и банан.', kana: 'りんご___バナナをかいました。', romaji: 'ringo ___ banana o kaimashita' },
  { id: 'p-to-02', prompt: '友達___話します。', answer: 'と', glossRu: 'Говорю с другом.', kana: 'ともだち___はなします。', romaji: 'tomodachi ___ hanashimasu' },
  { id: 'p-to-03', prompt: '母___行きます。', answer: 'と', glossRu: 'Иду с мамой.', kana: 'はは___いきます。', romaji: 'haha ___ ikimasu' },
  { id: 'p-to-04', prompt: '犬___猫がいます。', answer: 'と', glossRu: 'Есть собака и кошка.', kana: 'いぬ___ねこがいます。', romaji: 'inu ___ neko ga imasu' },
  { id: 'p-to-05', prompt: '先生___相談します。', answer: 'と', glossRu: 'Советуюсь с учителем.', kana: 'せんせい___そうだんします。', romaji: 'sensei ___ soudan shimasu' },
  { id: 'p-to-06', prompt: '「行こう」___言いました。', answer: 'と', glossRu: 'Сказал: «Пойдём».', kana: '「いこう」___いいました。', romaji: 'ikou ___ iimashita' },
  { id: 'p-to-07', prompt: 'パン___ミルクをください。', answer: 'と', glossRu: 'Хлеб и молоко, пожалуйста.', kana: 'パン___ミルクをください。', romaji: 'pan ___ miruku o kudasai' },

  // も
  { id: 'p-mo-01', prompt: '私___学生です。', answer: 'も', glossRu: 'Я тоже студент.', kana: 'わたし___がくせいです。', romaji: 'watashi ___ gakusei desu' },
  { id: 'p-mo-02', prompt: 'これ___ください。', answer: 'も', glossRu: 'Это тоже дайте.', kana: 'これ___ください。', romaji: 'kore ___ kudasai' },
  { id: 'p-mo-03', prompt: '明日___来ます。', answer: 'も', glossRu: 'Завтра тоже приду.', kana: 'あした___きます。', romaji: 'ashita ___ kimasu' },
  { id: 'p-mo-04', prompt: 'お茶___飲みます。', answer: 'も', glossRu: 'Чай тоже пью.', kana: 'おちゃ___のみます。', romaji: 'ocha ___ nomimasu' },
  { id: 'p-mo-05', prompt: '誰___いません。', answer: 'も', glossRu: 'Никого нет.', kana: 'だれ___いません。', romaji: 'dare ___ imasen' },
  { id: 'p-mo-06', prompt: '何___ありません。', answer: 'も', glossRu: 'Ничего нет.', kana: 'なに___ありません。', romaji: 'nani ___ arimasen' },
  { id: 'p-mo-07', prompt: 'パン___食べます。', answer: 'も', glossRu: 'Хлеб тоже ем.', kana: 'パン___たべます。', romaji: 'pan ___ tabemasu' },

  // の
  { id: 'p-no-01', prompt: '私___本です。', answer: 'の', glossRu: 'Это моя книга.', kana: 'わたし___ほんです。', romaji: 'watashi ___ hon desu' },
  { id: 'p-no-02', prompt: '日本___映画です。', answer: 'の', glossRu: 'Это японский фильм.', kana: 'にほん___えいがです。', romaji: 'nihon ___ eiga desu' },
  { id: 'p-no-03', prompt: '机___上にあります。', answer: 'の', glossRu: 'Лежит на столе.', kana: 'つくえ___うえにあります。', romaji: 'tsukue ___ ue ni arimasu' },
  { id: 'p-no-04', prompt: 'これは誰___ですか。', answer: 'の', glossRu: 'Чьё это?', kana: 'これはだれ___ですか。', romaji: 'kore wa dare ___ desu ka' },
  { id: 'p-no-05', prompt: '青い___がいいです。', answer: 'の', glossRu: 'Синий — хороший (тот, что…).', kana: 'あおい___がいいです。', romaji: 'aoi ___ ga ii desu' },
  { id: 'p-no-06', prompt: '友達___名前は田中です。', answer: 'の', glossRu: 'Имя друга — Танака.', kana: 'ともだち___なまえはたなかです。', romaji: 'tomodachi ___ namae wa tanaka desu' },
  { id: 'p-no-07', prompt: '学校___先生です。', answer: 'の', glossRu: 'Учитель школы.', kana: 'がっこう___せんせいです。', romaji: 'gakkou ___ sensei desu' },

  // から
  { id: 'p-kara-01', prompt: '家___駅まで歩きます。', answer: 'から', glossRu: 'Иду пешком от дома до станции.', kana: 'うち___えきまであるきます。', romaji: 'uchi ___ eki made arukimasu' },
  { id: 'p-kara-02', prompt: '九時___始めます。', answer: 'から', glossRu: 'Начинаем с девяти.', kana: 'くじ___はじめます。', romaji: 'kuji ___ hajimemasu' },
  { id: 'p-kara-03', prompt: '日本___来ました。', answer: 'から', glossRu: 'Приехал из Японии.', kana: 'にほん___きました。', romaji: 'nihon ___ kimashita' },
  { id: 'p-kara-04', prompt: '忙しい___行けません。', answer: 'から', glossRu: 'Не могу пойти, потому что занят.', kana: 'いそがしい___いけません。', romaji: 'isogashii ___ ikemasen' },
  { id: 'p-kara-05', prompt: '左___読んでください。', answer: 'から', glossRu: 'Читайте слева.', kana: 'ひだり___よんでください。', romaji: 'hidari ___ yonde kudasai' },
  { id: 'p-kara-06', prompt: 'ここ___遠いです。', answer: 'から', glossRu: 'Отсюда далеко.', kana: 'ここ___とおいです。', romaji: 'koko ___ tooi desu' },
  { id: 'p-kara-07', prompt: '朝___雨です。', answer: 'から', glossRu: 'С утра дождь.', kana: 'あさ___あめです。', romaji: 'asa ___ ame desu' },

  // まで
  { id: 'p-made-01', prompt: '駅___歩きます。', answer: 'まで', glossRu: 'Иду до станции.', kana: 'えき___あるきます。', romaji: 'eki ___ arukimasu' },
  { id: 'p-made-02', prompt: '五時___待ちます。', answer: 'まで', glossRu: 'Жду до пяти.', kana: 'ごじ___まちます。', romaji: 'goji ___ machimasu' },
  { id: 'p-made-03', prompt: '東京___電車で行きます。', answer: 'まで', glossRu: 'Еду на поезде до Токио.', kana: 'とうきょう___でんしゃでいきます。', romaji: 'toukyou ___ densha de ikimasu' },
  { id: 'p-made-04', prompt: 'ここ___どうぞ。', answer: 'まで', glossRu: 'Досюда, пожалуйста.', kana: 'ここ___どうぞ。', romaji: 'koko ___ douzo' },
  { id: 'p-made-05', prompt: '夜___勉強します。', answer: 'まで', glossRu: 'Учусь до ночи.', kana: 'よる___べんきょうします。', romaji: 'yoru ___ benkyou shimasu' },
  { id: 'p-made-06', prompt: '最後___読んでください。', answer: 'まで', glossRu: 'Прочитайте до конца.', kana: 'さいご___よんでください。', romaji: 'saigo ___ yonde kudasai' },
  { id: 'p-made-07', prompt: '明日___に出してください。', answer: 'まで', glossRu: 'Сдайте до завтра.', kana: 'あした___にだしてください。', romaji: 'ashita ___ ni dashite kudasai' },

  // や
  { id: 'p-ya-01', prompt: 'りんご___バナナを買いました。', answer: 'や', glossRu: 'Купил яблоки, бананы и т.п.', kana: 'りんご___バナナをかいました。', romaji: 'ringo ___ banana o kaimashita' },
  { id: 'p-ya-02', prompt: '本___雑誌を読みます。', answer: 'や', glossRu: 'Читаю книги, журналы и т.п.', kana: 'ほん___ざっしをよみます。', romaji: 'hon ___ zasshi o yomimasu' },
  { id: 'p-ya-03', prompt: '犬___猫が好きです。', answer: 'や', glossRu: 'Люблю собак, кошек и т.п.', kana: 'いぬ___ねこがすきです。', romaji: 'inu ___ neko ga suki desu' },
  { id: 'p-ya-04', prompt: '東京___大阪に行きました。', answer: 'や', glossRu: 'Ездил в Токио, Осаку и т.п.', kana: 'とうきょう___おおさかにいきました。', romaji: 'toukyou ___ oosaka ni ikimashita' },
  { id: 'p-ya-05', prompt: 'パン___おにぎりを食べます。', answer: 'や', glossRu: 'Ем хлеб, онигири и т.п.', kana: 'パン___おにぎりをたべます。', romaji: 'pan ___ onigiri o tabemasu' },
  { id: 'p-ya-06', prompt: '机の上に本___ペンがあります。', answer: 'や', glossRu: 'На столе книги, ручки и т.п.', kana: 'つくえのうえにほん___ペンがあります。', romaji: 'tsukue no ue ni hon ___ pen ga arimasu' },
  { id: 'p-ya-07', prompt: '映画___音楽が好きです。', answer: 'や', glossRu: 'Люблю кино, музыку и т.п.', kana: 'えいが___おんがくがすきです。', romaji: 'eiga ___ ongaku ga suki desu' },
]

const cardById = new Map(PARTICLE_CLOZE_CARDS.map((card) => [card.id, card]))

export function getParticleCard(id: string): ParticleClozeCard | null {
  return cardById.get(id) ?? null
}

export function particlesForFocus(focus: ParticlesFocus = 'all'): readonly CoreParticle[] {
  if (focus === 'all') return CORE_PARTICLES
  return PARTICLE_GROUPS[focus].particles
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
