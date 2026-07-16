export function HomePage({ onOpenKana, onOpenKanji, onOpenNumbers }) {
  return (
    <main className="home-page">
      <section className="panel home-hero">
        <p className="home-eyebrow">Японский язык</p>
        <h1 className="home-title">Тренажёры для повседневной практики</h1>
        <p className="home-lead">
          Кана, кандзи JLPT N5–N3 со словами из словаря и числа с японским чтением.
        </p>
      </section>

      <section className="home-grid home-grid-3">
        <article className="panel home-card is-available">
          <div className="home-card-head">
            <h2>Кана</h2>
            <span className="home-card-badge">Доступно</span>
          </div>
          <p className="home-card-text">
            Хирагана и катакана с адаптивным подбором, очередью ошибок и учётом похожих символов.
          </p>
          <button type="button" className="primary-button" data-testid="open-kana" onClick={onOpenKana}>
            Открыть тренажёр
          </button>
        </article>

        <article className="panel home-card is-available">
          <div className="home-card-head">
            <h2>Кандзи</h2>
            <span className="home-card-badge">Доступно</span>
          </div>
          <p className="home-card-text">
            Таблица N5–N4–N3, отметка выученных и слова с чтением, ромадзи и русским переводом.
          </p>
          <button type="button" className="primary-button" data-testid="open-kanji" onClick={onOpenKanji}>
            Открыть раздел
          </button>
        </article>

        <article className="panel home-card is-available">
          <div className="home-card-head">
            <h2>Числа и возраст</h2>
            <span className="home-card-badge">Доступно</span>
          </div>
          <p className="home-card-text">
            Арабские цифры и возраст → японское чтение. Диапазоны и шпаргалка рядом с настройками.
          </p>
          <button type="button" className="primary-button" data-testid="open-numbers" onClick={onOpenNumbers}>
            Открыть тренажёр
          </button>
        </article>
      </section>
    </main>
  )
}
