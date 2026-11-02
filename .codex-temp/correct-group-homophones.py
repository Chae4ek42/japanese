import json
from pathlib import Path

path = Path('src/features/vocab/groups.json')
groups = json.loads(path.read_text(encoding='utf-8'))
by_id = {g['id']: g for g in groups}

# Explicit replacements after inspecting Japanese readings and Russian senses.
corrections = {
    'reading-pronouns': {'1182060': None},
    'reading-copula': {'2648880': 'curated-da'},
    'reading-aux': {'1298670': 'curated-suru', '1247040': None},
    'reading-frames': {'1241450': '1313580', '1372650': '1605840', '2461070': 'curated-hazu', '1502990': '1538330', '1392570': None},
    'reading-adjectives': {'1212490': None},
    'reading-interjections': {'1541760': '1394280'},
    'people': {'1000580': '1483070', '2846738': '1416830'},
}
for g in groups:
    replacements = corrections.get(g['id'], {})
    g['wordIds'] = list(dict.fromkeys(replacements.get(id, id) for id in g['wordIds'] if replacements.get(id, id)))
    # Use the ordinary contemporary reading for lunch; keep the older bank entry intact.
    g['wordIds'] = ['curated-chuushoku' if id == '2863029' else id for id in g['wordIds']]

words = json.loads(Path('src/data/words/words.json').read_text(encoding='utf-8-sig'))
words += json.loads(Path('src/data/words/kana-catalog.json').read_text(encoding='utf-8-sig'))['extra']
words += json.loads(Path('src/data/words/curated-vocabulary.json').read_text(encoding='utf-8'))['words']
additional = {
    'reading-pronouns': '我々 自分 彼ら 僕たち 私ども',
    'reading-adjectives': '難しい 優しい 危ない 忙しい|いそがしい 大きい 小さい 新しい 古い',
    'reading-greetings': '失礼します お願いします いただきます ごちそうさま お帰りなさい 只今 さようなら いらっしゃいませ',
    'reading-onomatopoeia': 'どきどき にこにこ きらきら ぐっすり そろそろ うっかり はっきり すっきり',
    'reading-interjections': 'なるほど ええ へえ',
    'reading-questions': '何方',
}
for group_id, terms in additional.items():
    for term in terms.split():
        writing, _, kana = term.partition('|')
        hits = [w for w in words if w['writing'] == writing and (not kana or w['kana'] == kana)]
        if len(hits) != 1:
            print('RESOLVE', term, [(w['id'], w['kana'], w['meanings']) for w in hits])
            raise SystemExit('Resolve manually first')
        id = hits[0]['id']
        if id not in by_id[group_id]['wordIds']:
            by_id[group_id]['wordIds'].append(id)

path.write_text(json.dumps(groups, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('GROUPS',len(groups),'MEMBERSHIPS',sum(len(g['wordIds']) for g in groups),'UNIQUE',len({id for g in groups for id in g['wordIds']}))
