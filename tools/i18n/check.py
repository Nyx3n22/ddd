#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Sprawdza zgodność parametrów {x} między kodem a plikami tłumaczeń."""
import json, glob, re, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PL = json.load(open(os.path.join(ROOT, 'src/data/locales/pl.json'), encoding='utf-8'))
EN = json.load(open(os.path.join(ROOT, 'src/data/locales/en.json'), encoding='utf-8'))

call = re.compile(r"(?<![A-Za-z_])t\('([^']+)'\s*,\s*\{([^\{\}]*)\}", re.S)
ph = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")

used = collections.defaultdict(set)   # klucz -> parametry z kodu
for f in glob.glob(os.path.join(ROOT, 'src/**/*.ts'), recursive=True):
    s = open(f, encoding='utf-8').read()
    for m in call.finditer(s):
        key, body = m.group(1), m.group(2)
        # tylko NAZWY parametrów (klucze obiektu + skrót { days }), bez wartości
        for part in re.split(r',(?![^()]*\))', body):
            part = part.strip()
            if not part:
                continue
            m2 = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\s*:', part)
            if m2:
                used[key].add(m2.group(1))
            elif re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', part):
                used[key].add(part)

problems = []
for key, params in sorted(used.items()):
    for name, table in (('pl', PL), ('en', EN)):
        if key not in table:
            problems.append(f'BRAK KLUCZA {key} ({name}) — kod przekazuje {sorted(params)}')
            continue
        have = set(ph.findall(table[key]))
        if params - have:
            problems.append(f'{key} [{name}]: kod daje {sorted(params - have)}, a tekst ich nie ma -> "{table[key]}"')
        if have - params:
            problems.append(f'{key} [{name}]: tekst chce {sorted(have - params)}, ale kod ich nie przekazuje -> "{table[key]}"')

# klucze użyte w danych, których nie ma w tłumaczeniach
missing = [k for k in PL if k not in EN] + [k for k in EN if k not in PL]
if missing:
    problems.append('NIESPAROWANE KLUCZE PL/EN: ' + ', '.join(missing))

print(f'sprawdzono {len(used)} kluczy z parametrami; problemów: {len(problems)}')
for p in problems:
    print(' -', p)
