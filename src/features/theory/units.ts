export interface TheoryExample {
  writing: string
  kana?: string
  romaji: string
  meaning: string
}

export interface TheoryTable {
  caption?: string
  headers: string[]
  rows: string[][]
}

export interface TheorySection {
  heading: string
  paragraphs: string[]
  table?: TheoryTable
  examples?: TheoryExample[]
}

/** Self-contained reading-grammar lesson with embedded core words. */
export interface TheoryUnit {
  id: string
  title: string
  subtitle: string
  /** Linked vocab catalog group for «тренировать». */
  readingGroupId?: string
  sections: TheorySection[]
}

export const THEORY_UNITS: TheoryUnit[] = [
  {
    id: 'ko-so-a-do',
    title: 'Указательные: こ・そ・あ・ど',
    subtitle: 'これ／それ／あれ и вся система «близко — у собеседника — далеко — вопрос»',
    readingGroupId: 'reading-demo',
    sections: [
      {
        heading: 'Зачем четыре ряда',
        paragraphs: [
          'В японском «это / то» зависит не только от расстояния, а от того, в чьей зоне находится предмет: рядом с говорящим, рядом со слушающим или далеко от обоих. Четвёртый ряд — вопросительный.',
          'Корень один и тот же, меняется приставка: こ (ko) · そ (so) · あ (a) · ど (do). Выучив сетку, вы сразу понимаете десятки слов.',
        ],
      },
      {
        heading: 'Что значит こ・そ・あ・ど',
        paragraphs: [
          'こ — зона говорящего («вот это, у меня / рядом со мной»).',
          'そ — зона слушающего или только что упомянутое («то, у вас / о чём мы говорим»).',
          'あ — далеко от обоих или вне текущей сцены («вон то»).',
          'ど — вопрос («какой? / где? / как?»).',
        ],
        table: {
          caption: 'Сетка указательных',
          headers: ['Ряд', 'Вещь', 'Место', 'Направление', 'Способ', 'Такой'],
          rows: [
            ['こ · рядом со мной', 'これ', 'ここ', 'こちら / こっち', 'こう', 'こんな'],
            ['そ · у вас / в теме', 'それ', 'そこ', 'そちら / そっち', 'そう', 'そんな'],
            ['あ · далеко', 'あれ', 'あそこ', 'あちら / あっち', 'ああ', 'あんな'],
            ['ど · вопрос', 'どれ', 'どこ', 'どちら / どっち', 'どう', 'どんな'],
          ],
        },
      },
      {
        heading: 'Вещи: これ・それ・あれ・どれ',
        paragraphs: [
          'これ / それ / あれ — самостоятельные местоимения («это / то»). Перед существительным ставят この / その / あの / どの: この本 «эта книга».',
        ],
        examples: [
          { writing: 'これ', romaji: 'kore', meaning: 'это (у меня)' },
          { writing: 'それ', romaji: 'sore', meaning: 'то (у вас / в теме)' },
          { writing: 'あれ', romaji: 'are', meaning: 'вон то' },
          { writing: 'どれ', romaji: 'dore', meaning: 'который?' },
          { writing: 'この', romaji: 'kono', meaning: 'этот + сущ.' },
          { writing: 'その', romaji: 'sono', meaning: 'тот + сущ.' },
          { writing: 'あの', romaji: 'ano', meaning: 'вон тот + сущ.' },
          { writing: 'どの', romaji: 'dono', meaning: 'какой + сущ.?' },
        ],
      },
      {
        heading: 'Места и направления',
        paragraphs: [
          'ここ / そこ / あそこ / どこ — места. こちら / そちら / あちら / どちら — более вежливые направления («сюда / туда / куда»); разговорные короткие формы: こっち / そっち / あっち / どっち.',
        ],
        examples: [
          { writing: 'ここ', romaji: 'koko', meaning: 'здесь' },
          { writing: 'そこ', romaji: 'soko', meaning: 'там (у вас)' },
          { writing: 'あそこ', romaji: 'asoko', meaning: 'вон там' },
          { writing: 'どこ', romaji: 'doko', meaning: 'где?' },
          { writing: 'こちら', romaji: 'kochira', meaning: 'сюда / я (вежл.)' },
          { writing: 'そちら', romaji: 'sochira', meaning: 'туда / вы (вежл.)' },
          { writing: 'あちら', romaji: 'achira', meaning: 'вон туда' },
          { writing: 'どちら', romaji: 'dochira', meaning: 'куда? / который?' },
        ],
      },
      {
        heading: 'Способ и качество',
        paragraphs: [
          'こう / そう / ああ / どう — «таким образом». こんな / そんな / あんな / どんな — «такой» перед существительным: こんな日 «такой день».',
          'そう часто значит «так» в ответе (そうですか), а どう — «как?» (どうしますか).',
        ],
        examples: [
          { writing: 'こう', romaji: 'kou', meaning: 'вот так' },
          { writing: 'そう', romaji: 'sou', meaning: 'так' },
          { writing: 'ああ', romaji: 'aa', meaning: 'вон так' },
          { writing: 'どう', romaji: 'dou', meaning: 'как?' },
          { writing: 'こんな', romaji: 'konna', meaning: 'такой (как этот)' },
          { writing: 'そんな', romaji: 'sonna', meaning: 'такой (как тот)' },
          { writing: 'あんな', romaji: 'anna', meaning: 'такой (вон тот)' },
          { writing: 'どんな', romaji: 'donna', meaning: 'какой?' },
        ],
      },
    ],
  },
  {
    id: 'questions',
    title: 'Вопросительные слова',
    subtitle: '誰・何・いつ・なぜ и счётные вопросы',
    readingGroupId: 'reading-questions',
    sections: [
      {
        heading: 'Базовый набор',
        paragraphs: [
          'Вопросы в японском часто держатся на одном слове + частица か (или интонация). Запомните ядро — и большинство простых вопросов соберутся сами.',
          'Многие вопросительные слова в обычных текстах пишут каной (どこ, なぜ, いくら). Кандзи вроде 何処 / 何故 встречаются редко — в тренажёре для них показывается кана.',
        ],
        examples: [
          { writing: '誰', kana: 'だれ', romaji: 'dare', meaning: 'кто?' },
          { writing: '何', kana: 'なに / なん', romaji: 'nani / nan', meaning: 'что?' },
          { writing: 'いつ', romaji: 'itsu', meaning: 'когда?' },
          { writing: 'どこ', romaji: 'doko', meaning: 'где?' },
          { writing: 'どれ', romaji: 'dore', meaning: 'который?' },
          { writing: 'どう', romaji: 'dou', meaning: 'как?' },
          { writing: 'なぜ', romaji: 'naze', meaning: 'почему?' },
          { writing: 'どうして', romaji: 'doushite', meaning: 'почему? / как так?' },
        ],
      },
      {
        heading: 'Сколько',
        paragraphs: [
          'いくら — цена / «сколько стоит». いくつ — количество штук или возраст ребёнка. どのくらい / どれくらい — «насколько / сколько примерно».',
        ],
        examples: [
          { writing: 'いくら', romaji: 'ikura', meaning: 'сколько (стоит)?' },
          { writing: 'いくつ', romaji: 'ikutsu', meaning: 'сколько штук?' },
          { writing: 'どのくらい', romaji: 'dono kurai', meaning: 'насколько?' },
        ],
      },
      {
        heading: 'なに vs なん',
        paragraphs: [
          'Перед словами на t/d/n часто говорят なん: なんですка, なんにん. Перед другими — чаще なに: なにを食べますか. Оба пишутся 何.',
        ],
      },
    ],
  },
  {
    id: 'pronouns',
    title: 'Личные местоимения',
    subtitle: 'Я / ты / он — и почему их часто избегают',
    readingGroupId: 'reading-pronouns',
    sections: [
      {
        heading: 'Важно',
        paragraphs: [
          'В японском местоимения используют реже, чем в русском: часто хватает темы (は) или контекста. Когда всё же называют «я / ты», выбор слова задаёт тон — от нейтрального до грубого.',
        ],
      },
      {
        heading: '«Я»',
        paragraphs: ['わたくし — самое вежливое; わたし — нейтральное; あたし — чаще женская речь; ぼく — мягкое «я» (часто мужчины); おれ — грубоватое / своё.'],
        examples: [
          { writing: '私', kana: 'わたくし', romaji: 'watakushi', meaning: 'я (офиц.)' },
          { writing: '私', kana: 'わたし', romaji: 'watashi', meaning: 'я' },
          { writing: '私', kana: 'あたし', romaji: 'atashi', meaning: 'я (разг., чаще ж.)' },
          { writing: '僕', kana: 'ぼく', romaji: 'boku', meaning: 'я (м., мягко)' },
          { writing: '俺', kana: 'おれ', romaji: 'ore', meaning: 'я (грубо / своё)' },
        ],
      },
      {
        heading: '«Ты» и третьи лица',
        paragraphs: [
          'あなた — универсально, но к старшим/незнакомцам лучше имя + さん. きみ / おまえ — ближе или грубее. 彼 / 彼女 — «он / она», также «парень / девушка».',
        ],
        examples: [
          { writing: 'あなた', romaji: 'anata', meaning: 'ты / вы' },
          { writing: '君', kana: 'きみ', romaji: 'kimi', meaning: 'ты (близко)' },
          { writing: 'お前', kana: 'おまえ', romaji: 'omae', meaning: 'ты (грубо)' },
          { writing: '彼', kana: 'かれ', romaji: 'kare', meaning: 'он / парень' },
          { writing: '彼女', kana: 'かのじょ', romaji: 'kanojo', meaning: 'она / девушка' },
          { writing: '皆', kana: 'みな', romaji: 'mina / minna', meaning: 'все (みな／みんな)' },
          { writing: '皆さん', kana: 'みなさん', romaji: 'minasan', meaning: 'вы все (вежл.)' },
        ],
      },
    ],
  },
  {
    id: 'copula',
    title: 'Связка です / だ',
    subtitle: 'Как закрывать именное предложение',
    readingGroupId: 'reading-copula',
    sections: [
      {
        heading: 'Роль связки',
        paragraphs: [
          'После существительного или на-прилагательного связка ставит точку: «X есть Y». です — вежливая форма; だ — простая / письменная / мужская речь; である — книжная.',
        ],
        examples: [
          { writing: 'です', romaji: 'desu', meaning: 'есть (вежл.)' },
          { writing: 'だ', romaji: 'da', meaning: 'есть (прост.)' },
          { writing: 'である', romaji: 'de aru', meaning: 'есть (письм.)' },
          { writing: 'でした', romaji: 'deshita', meaning: 'было (вежл.)' },
          { writing: 'だった', romaji: 'datta', meaning: 'было (прост.)' },
          { writing: 'でしょう', romaji: 'deshou', meaning: 'вероятно / не так ли' },
          { writing: 'だろう', romaji: 'darou', meaning: 'вероятно (прост.)' },
        ],
      },
      {
        heading: 'Отрицание',
        paragraphs: [
          'Вежливо: ではありません / разг. じゃありません / じゃないです. Просто: ではない / じゃない.',
        ],
        examples: [
          { writing: 'じゃない', romaji: 'ja nai', meaning: 'не есть (разг.)' },
          { writing: 'ではない', romaji: 'de wa nai', meaning: 'не есть' },
        ],
      },
    ],
  },
  {
    id: 'particles',
    title: 'Частицы',
    subtitle: 'Маленькие слова, которые держат смысл предложения',
    readingGroupId: 'reading-particles',
    sections: [
      {
        heading: 'Каркас предложения',
        paragraphs: [
          'は — тема («что касается…»). が — подлежащее / новое. を — объект. に — цель, время, получатель. で — место действия / средство. へ — направление.',
        ],
        examples: [
          { writing: 'は', romaji: 'wa', meaning: 'тема' },
          { writing: 'が', romaji: 'ga', meaning: 'подлежащее' },
          { writing: 'を', romaji: 'o', meaning: 'объект' },
          { writing: 'に', romaji: 'ni', meaning: 'куда / когда / кому' },
          { writing: 'で', romaji: 'de', meaning: 'где делают / чем' },
          { writing: 'へ', romaji: 'e', meaning: 'направление' },
        ],
      },
      {
        heading: 'Связки и пределы',
        paragraphs: [
          'と — «и / с» (полный список). や — «и … и т.п.» から — «из / потому что». まで — «до». など — «и тому подобное».',
        ],
        examples: [
          { writing: 'と', romaji: 'to', meaning: 'и / с / что' },
          { writing: 'や', romaji: 'ya', meaning: 'и … (неполный список)' },
          { writing: 'から', romaji: 'kara', meaning: 'из / потому что' },
          { writing: 'まで', romaji: 'made', meaning: 'до' },
          { writing: 'など', romaji: 'nado', meaning: 'и т.п.' },
          { writing: 'について', romaji: 'ni tsuite', meaning: 'о / про' },
          { writing: 'として', romaji: 'toshite', meaning: 'в качестве' },
        ],
      },
      {
        heading: 'Ограничение и степень',
        paragraphs: [
          'だけ — «только». しか + отрицание — «всего лишь». ばかり — «одно сплошное…». ほど / くらい — «примерно / настолько».',
        ],
        examples: [
          { writing: 'だけ', romaji: 'dake', meaning: 'только' },
          { writing: 'しか', romaji: 'shika', meaning: 'только (с отриц.)' },
          { writing: 'ばかり', romaji: 'bakari', meaning: 'сплошь / только что' },
          { writing: 'ほど', romaji: 'hodo', meaning: 'настолько / около' },
          { writing: 'くらい', romaji: 'kurai', meaning: 'примерно' },
          { writing: 'ずつ', romaji: 'zutsu', meaning: 'по … (каждый)' },
        ],
      },
      {
        heading: 'Концовочные частицы',
        paragraphs: [
          'か — вопрос. ね — поиск согласия. よ — сообщение нового. な / なあ — размышление. かな — «интересно, … ли».',
        ],
        examples: [
          { writing: 'か', romaji: 'ka', meaning: '?' },
          { writing: 'ね', romaji: 'ne', meaning: 'ведь так?' },
          { writing: 'よ', romaji: 'yo', meaning: 'слушай / утверждаю' },
          { writing: 'な', romaji: 'na', meaning: 'ну… / запрет (с глаг.)' },
          { writing: 'かな', romaji: 'kana', meaning: 'интересно, …?' },
        ],
      },
    ],
  },
  {
    id: 'connectors',
    title: 'Союзы и связки речи',
    subtitle: 'Как склеивать мысли: и / но / поэтому',
    readingGroupId: 'reading-connectors',
    sections: [
      {
        heading: 'Добавление и смена темы',
        paragraphs: ['そして — «и затем». それから — «после этого». また — «также». ところで — мягкий переход к новой теме.'],
        examples: [
          { writing: 'そして', romaji: 'soshite', meaning: 'и / затем' },
          { writing: 'それから', romaji: 'sorekara', meaning: 'после этого' },
          { writing: 'また', romaji: 'mata', meaning: 'также / снова' },
          { writing: 'または', romaji: 'matawa', meaning: 'или' },
          { writing: 'ところで', romaji: 'tokorode', meaning: 'кстати' },
          { writing: 'ちなみに', romaji: 'chinamini', meaning: 'к слову' },
        ],
      },
      {
        heading: 'Противопоставление и причина',
        paragraphs: ['でも / しかし / だが — «но». だから / ですから — «поэтому». なので — более мягкая причина. それでも — «и всё же».'],
        examples: [
          { writing: 'でも', romaji: 'demo', meaning: 'но' },
          { writing: 'しかし', romaji: 'shikashi', meaning: 'однако' },
          { writing: 'だが', romaji: 'daga', meaning: 'но (письм.)' },
          { writing: 'だから', romaji: 'dakara', meaning: 'поэтому' },
          { writing: 'ですから', romaji: 'desukara', meaning: 'поэтому (вежл.)' },
          { writing: 'なので', romaji: 'nanode', meaning: 'так что / поскольку' },
          { writing: 'それでも', romaji: 'soredemo', meaning: 'и всё же' },
        ],
      },
      {
        heading: 'Пояснение',
        paragraphs: ['つまり — «то есть». たとえば — «например». ただし — «однако учтите». おまけに — «вдобавок».'],
        examples: [
          { writing: 'つまり', romaji: 'tsumari', meaning: 'то есть' },
          { writing: 'たとえば', romaji: 'tatoeba', meaning: 'например' },
          { writing: 'ただし', romaji: 'tadashi', meaning: 'однако' },
          { writing: 'おまけに', romaji: 'omake ni', meaning: 'вдобавок' },
        ],
      },
    ],
  },
  {
    id: 'frames',
    title: 'Рамки: こと・もの・とき…',
    subtitle: 'Абстрактные «слоты», из которых собирается смысл',
    readingGroupId: 'reading-frames',
    sections: [
      {
        heading: 'Зачем рамки',
        paragraphs: [
          'В японском часто берут глагол/фразу и «упаковывают» в существительное-рамку. Так появляются «дело X», «время X», «ради X».',
        ],
      },
      {
        heading: 'Базовые рамки',
        paragraphs: [
          'こと — факт / дело / умение. もの — вещь / то, что положено. とき — время, когда. ところ — место / момент. ため — цель / причина. よう — вид / «как будто».',
        ],
        examples: [
          { writing: 'こと', romaji: 'koto', meaning: 'дело / факт' },
          { writing: 'もの', romaji: 'mono', meaning: 'вещь / то, что…' },
          { writing: 'とき', romaji: 'toki', meaning: 'когда / время' },
          { writing: 'ところ', romaji: 'tokoro', meaning: 'место / момент' },
          { writing: 'ため', romaji: 'tame', meaning: 'ради / из‑за' },
          { writing: 'よう', romaji: 'you', meaning: 'вид / будто' },
          { writing: 'つもり', romaji: 'tsumori', meaning: 'намерен' },
          { writing: 'はず', romaji: 'hazu', meaning: 'должно быть' },
          { writing: 'わけ', romaji: 'wake', meaning: 'смысл / причина' },
          { writing: '場合', kana: 'ばあい', romaji: 'baai', meaning: 'в случае' },
        ],
      },
      {
        heading: 'Пространственные рамки',
        paragraphs: ['まえ / あと / うえ / した / なか — не только «перед / после / верх / низ / внутри», но и абстрактно: 食べる前に «перед едой».'],
        examples: [
          { writing: '前', kana: 'まえ', romaji: 'mae', meaning: 'перед / раньше' },
          { writing: '後', kana: 'あと', romaji: 'ato', meaning: 'после' },
          { writing: '上', kana: 'うえ', romaji: 'ue', meaning: 'верх / над' },
          { writing: '下', kana: 'した', romaji: 'shita', meaning: 'низ / под' },
          { writing: '中', kana: 'なか', romaji: 'naka', meaning: 'внутри' },
          { writing: '間', kana: 'あいだ', romaji: 'aida', meaning: 'между / пока' },
        ],
      },
    ],
  },
  {
    id: 'aux',
    title: 'Глаголы-опоры',
    subtitle: 'する・いる・ある・ください и компания',
    readingGroupId: 'reading-aux',
    sections: [
      {
        heading: 'База',
        paragraphs: [
          'する — делать (и превращает сущ. в глагол: 勉強する). なる — становиться. ある — есть (неодуш.). いる — есть / находиться (одуш.) и прогрессив с 〜ている.',
        ],
        examples: [
          { writing: 'する', romaji: 'suru', meaning: 'делать' },
          { writing: 'できる', romaji: 'dekiru', meaning: 'мочь / получаться' },
          { writing: 'なる', romaji: 'naru', meaning: 'становиться' },
          { writing: 'ある', romaji: 'aru', meaning: 'есть (вещь)' },
          { writing: 'いる', romaji: 'iru', meaning: 'есть / быть (кто-то)' },
        ],
      },
      {
        heading: 'Движение и речь',
        paragraphs: ['行く / 来る — уход / приход относительно говорящего. 見る — смотреть (+ てみる «попробовать»). 言う — говорить.'],
        examples: [
          { writing: '行く', kana: 'いく', romaji: 'iku', meaning: 'идти / ехать' },
          { writing: '来る', kana: 'くる', romaji: 'kuru', meaning: 'приходить' },
          { writing: '見る', kana: 'みる', romaji: 'miru', meaning: 'смотреть' },
          { writing: '言う', kana: 'いう', romaji: 'iu', meaning: 'говорить' },
        ],
      },
      {
        heading: 'Вежливость и вид',
        paragraphs: [
          'ください — «пожалуйста / дайте» (после て-формы: 見てください). しまう — завершённость / «увы, случилось». あげる / くれる / もらう — дать / мне дают / получить.',
        ],
        examples: [
          { writing: 'ください', romaji: 'kudasai', meaning: 'пожалуйста' },
          { writing: 'しまう', romaji: 'shimau', meaning: 'закончить / увы' },
          { writing: 'あげる', romaji: 'ageru', meaning: 'дать (другому)' },
          { writing: 'くれる', romaji: 'kureru', meaning: 'дать (мне)' },
          { writing: 'もらう', romaji: 'morau', meaning: 'получить' },
        ],
      },
    ],
  },
  {
    id: 'greetings',
    title: 'Приветствия и реплики',
    subtitle: 'Формулы, которые держат разговор',
    readingGroupId: 'reading-greetings',
    sections: [
      {
        heading: 'День и вежливость',
        paragraphs: ['おはよう(ございます) — утро. こんにちは — день. こんばんは — вечер. さようなら — прощание надолго. ありがとう(ございます) — спасибо.'],
        examples: [
          { writing: 'おはよう', romaji: 'ohayou', meaning: 'доброе утро' },
          { writing: 'おはようございます', romaji: 'ohayou gozaimasu', meaning: 'доброе утро (вежл.)' },
          { writing: 'こんにちは', romaji: 'konnichiwa', meaning: 'добрый день' },
          { writing: 'こんばんは', romaji: 'konbanwa', meaning: 'добрый вечер' },
          { writing: 'さようなら', romaji: 'sayounara', meaning: 'до свидания' },
          { writing: 'ありがとう', romaji: 'arigatou', meaning: 'спасибо' },
          { writing: 'すみません', romaji: 'sumimasen', meaning: 'извините / привлечь внимание' },
        ],
      },
      {
        heading: 'Короткие ответы',
        paragraphs: ['はい / ええ / うん — согласие (от вежливого к разговорному). いいえ — нет. 大丈夫 — «всё в порядке». だめ — «нельзя / не получится».'],
        examples: [
          { writing: 'はい', romaji: 'hai', meaning: 'да' },
          { writing: 'ええ', romaji: 'ee', meaning: 'да (мягко)' },
          { writing: 'うん', romaji: 'un', meaning: 'ага' },
          { writing: 'いいえ', romaji: 'iie', meaning: 'нет' },
          { writing: '大丈夫', kana: 'だいじょうぶ', romaji: 'daijoubu', meaning: 'всё ок' },
          { writing: 'だめ', romaji: 'dame', meaning: 'нельзя / плохо' },
          { writing: 'もう一度', romaji: 'mou ichido', meaning: 'ещё раз' },
        ],
      },
    ],
  },
  {
    id: 'adverbs',
    title: 'Наречия',
    subtitle: 'Ещё / уже / очень / сразу — и формы на 〜り',
    readingGroupId: 'reading-adverbs',
    sections: [
      {
        heading: 'Частота и степень',
        paragraphs: [
          'もう — уже / больше. まだ — ещё (не). とても / すごく — очень. ちょっと / すこし — немного. あまり + отриц. — «не очень». ぜんぜん + отриц. — «совсем не».',
        ],
        examples: [
          { writing: 'もう', romaji: 'mou', meaning: 'уже / больше' },
          { writing: 'まだ', romaji: 'mada', meaning: 'ещё' },
          { writing: 'いつも', romaji: 'itsumo', meaning: 'всегда' },
          { writing: 'とても', romaji: 'totemo', meaning: 'очень' },
          { writing: 'ちょっと', romaji: 'chotto', meaning: 'немного / эй' },
          { writing: 'すこし', romaji: 'sukoshi', meaning: 'немного' },
          { writing: 'たくさん', romaji: 'takusan', meaning: 'много' },
          { writing: 'あまり', romaji: 'amari', meaning: 'не очень (+отриц.)' },
          { writing: 'ぜんぜん', romaji: 'zenzen', meaning: 'совсем (+отриц.)' },
        ],
      },
      {
        heading: 'Вероятность и образ действия',
        paragraphs: ['たぶん / きっと — вероятно / наверняка. すぐ — сразу. ゆっくり — медленно. Многие разговорные наречия оканчиваются на 〜り / 〜っと: はっきり、しっかり、うっかり.'],
        examples: [
          { writing: 'たぶん', romaji: 'tabun', meaning: 'наверное' },
          { writing: 'きっと', romaji: 'kitto', meaning: 'наверняка' },
          { writing: 'すぐ', romaji: 'sugu', meaning: 'сразу' },
          { writing: 'ゆっくり', romaji: 'yukkuri', meaning: 'медленно / спокойно' },
          { writing: 'はっきり', romaji: 'hakkiri', meaning: 'чётко' },
          { writing: 'しっかり', romaji: 'shikkari', meaning: 'крепко / надёжно' },
          { writing: 'もちろん', romaji: 'mochiron', meaning: 'конечно' },
          { writing: 'ぜひ', romaji: 'zehi', meaning: 'обязательно' },
        ],
      },
    ],
  },
  {
    id: 'adjectives',
    title: 'Прилагательные',
    subtitle: 'い и な — два семейства',
    readingGroupId: 'reading-adjectives',
    sections: [
      {
        heading: 'Два типа',
        paragraphs: [
          'い-прилагательные спрягаются сами: 高い → 高くない → 高かった. な-прилагательные перед сущ. берут な (静かな町), в сказуемом — связку (静かです).',
        ],
        examples: [
          { writing: 'おいしい', romaji: 'oishii', meaning: 'вкусный' },
          { writing: 'すごい', romaji: 'sugoi', meaning: 'крутой / ужасный' },
          { writing: 'かわいい', romaji: 'kawaii', meaning: 'милый' },
          { writing: 'おもしろい', romaji: 'omoshiroi', meaning: 'интересный' },
          { writing: 'いい / よい', romaji: 'ii / yoi', meaning: 'хороший' },
          { writing: 'ない', romaji: 'nai', meaning: 'нет / не' },
          { writing: 'きれい', romaji: 'kirei', meaning: 'красивый / чистый (な)' },
          { writing: '静か', kana: 'しずか', romaji: 'shizuka', meaning: 'тихий (な)' },
          { writing: '元気', kana: 'げんき', romaji: 'genki', meaning: 'бодрый (な)' },
          { writing: '大変', kana: 'たいへん', romaji: 'taihen', meaning: 'тяжело / очень' },
        ],
      },
    ],
  },
  {
    id: 'onomatopoeia',
    title: 'Ономатопея',
    subtitle: 'Звукоподражания и «чувства словами»',
    readingGroupId: 'reading-onomatopoeia',
    sections: [
      {
        heading: 'Как устроены',
        paragraphs: [
          'Японский любит удвоения и формы на 〜り / 〜っと: они рисуют звук, движение или внутреннее состояние. Часто идут с する: びっくりする «испугаться».',
          'В текстах их много — не учите все сразу, копите «пакеты» по ситуациям (погода, эмоции, движение).',
        ],
        examples: [
          { writing: 'びっくり', romaji: 'bikkuri', meaning: 'вздрогнуть / удивиться' },
          { writing: 'がっかり', romaji: 'gakkari', meaning: 'расстроиться' },
          { writing: 'ぐっすり', romaji: 'gussuri', meaning: 'крепко (спать)' },
          { writing: 'そっと', romaji: 'sotto', meaning: 'тихонько' },
          { writing: 'ぴったり', romaji: 'pittari', meaning: 'в самый раз' },
          { writing: 'いろいろ', romaji: 'iroiro', meaning: 'всякое / разное' },
        ],
      },
    ],
  },
]

export function getTheoryUnit(id: string): TheoryUnit | null {
  return THEORY_UNITS.find((unit) => unit.id === id) ?? null
}
