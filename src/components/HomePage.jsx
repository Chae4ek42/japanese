export function HomePage({ onOpenKana, onOpenNumbers }) {
  return (
    <main className="home-page">
      <section className="panel home-hero">
        <p className="home-eyebrow">Японский язык</p>
        <h1 className="home-title">Тренажёры для повседневной практики</h1>
        <p className="home-lead">
          Короткие сессии с мгновенной обратной связью: кана с адаптивным подбором карточек и числа с
          шпаргалкой чтений.
        </p>
      </section>

      <section className="home-grid">
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
            <h2>Числа и возраст</h2>
            <span className="home-card-badge">Доступно</span>
          </div>
          <p className="home-card-text">
            Арабские цифры и возраст → японское чтение. Режимы, диапазон 1–10 / 1–99 / 1–999, шпаргалка
            рядом с настройками.
          </p>
          <button type="button" className="primary-button" data-testid="open-numbers" onClick={onOpenNumbers}>
            Открыть тренажёр
          </button>
        </article>
      </section>
    </main>
  )
}
