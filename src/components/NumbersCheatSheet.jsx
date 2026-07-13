import {
  AGE_SPECIAL_CASES,
  CHEAT_SHEET_DIGITS,
  CHEAT_SHEET_EXAMPLES,
  CHEAT_SHEET_HUNDREDS,
} from '../data/numbers'

function CheatTable({ headers, rows, testId }) {
  return (
    <table className="cheat-table" data-testid={testId}>
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            {row.cells.map((cell) => (
              <td key={cell}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function NumbersCheatSheet() {
  return (
    <section className="panel numbers-cheat-sheet" data-testid="numbers-cheat-sheet">
      <div className="cheat-sheet-head">
        <h2 className="cheat-sheet-title">Шпаргалка</h2>
        <p className="cheat-sheet-lead">Числа и возраст — кандзи, чтение и типичные исключения.</p>
      </div>

      <div className="cheat-section">
        <h3 className="cheat-section-title">Цифры 1–10</h3>
        <CheatTable
          testId="cheat-digits"
          headers={['Цифра', 'Кандзи', 'Чтение']}
          rows={CHEAT_SHEET_DIGITS.map((row) => ({
            key: row.value,
            cells: [row.value, row.kanji, row.kana],
          }))}
        />
      </div>

      <div className="cheat-section">
        <h3 className="cheat-section-title">Десятки и составные</h3>
        <p className="cheat-note">10 = 十 (じゅう). 20 = 二十 (にじゅう). Остальное: [десятки] + [единицы].</p>
        <CheatTable
          testId="cheat-compounds"
          headers={['Число', 'Кандзи', 'Чтение']}
          rows={CHEAT_SHEET_EXAMPLES.filter((row) => row.value < 100).map((row) => ({
            key: row.value,
            cells: [row.value, row.plain.kanji, row.plain.kana],
          }))}
        />
      </div>

      <div className="cheat-section">
        <h3 className="cheat-section-title">Сотни</h3>
        <p className="cheat-note">100 = 百 (ひゃく). Озвончение: 300 → さんびゃく, 600 → ろっぴゃく, 800 → はっぴゃく.</p>
        <CheatTable
          testId="cheat-hundreds"
          headers={['Число', 'Кандзи', 'Чтение']}
          rows={CHEAT_SHEET_HUNDREDS.map((row) => ({
            key: row.value,
            cells: [row.value, row.kanji, row.kana],
          }))}
        />
      </div>

      <div className="cheat-section">
        <h3 className="cheat-section-title">Возраст (歳)</h3>
        <p className="cheat-note">Обычно: число + さい. Исключения:</p>
        <CheatTable
          testId="cheat-age-special"
          headers={['Возраст', 'Кандзи', 'Чтение']}
          rows={AGE_SPECIAL_CASES.map((row) => ({
            key: row.value,
            cells: [row.prompt, row.kanji, row.kana],
          }))}
        />
        <CheatTable
          testId="cheat-age-examples"
          headers={['Возраст', 'Кандзи', 'Чтение']}
          rows={CHEAT_SHEET_EXAMPLES.filter((row) => row.value >= 20).map((row) => ({
            key: `age-${row.value}`,
            cells: [row.agePrompt, row.age.kanji, row.age.kana],
          }))}
        />
      </div>
    </section>
  )
}
