#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Wyciąga listę kluczy tłumaczeń z danych (JSON) i z kodu (TS).

Użycie: python3 keys.py > /tmp/keys-report.txt
Zapisuje /tmp/datakeys.txt i /tmp/codekeys.txt dla build.py.
"""
import json, glob, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def walk(obj, keys):
    """Zbiera wartości pól *Key oraz list *Keys — to są klucze tłumaczeń."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.endswith('Key') and isinstance(v, str):
                keys.add(v)
            elif k.endswith('Keys') and isinstance(v, list):
                for x in v:
                    if isinstance(x, str):
                        keys.add(x)
            else:
                walk(v, keys)
    elif isinstance(obj, list):
        for x in obj:
            walk(x, keys)

data_keys = set()
for f in glob.glob(os.path.join(ROOT, 'src/data/**/*.json'), recursive=True):
    if '/locales/' in f:
        continue
    walk(json.load(open(f, encoding='utf-8')), data_keys)

code_static, code_dyn = set(), set()
pat_static = re.compile(r"(?<![A-Za-z_])t\('([^']+)'")
pat_dyn = re.compile(r"(?<![A-Za-z_])t\('([a-zA-Z0-9_.]*\.)'\s*\+")
for f in glob.glob(os.path.join(ROOT, 'src/**/*.ts'), recursive=True):
    s = open(f, encoding='utf-8').read()
    for m in pat_static.finditer(s):
        code_static.add(m.group(1))
    for m in pat_dyn.finditer(s):
        code_dyn.add(m.group(1))

with open('/tmp/datakeys.txt', 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(sorted(data_keys)) + '\n')
with open('/tmp/codekeys.txt', 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(sorted(code_static | code_dyn)) + '\n')

print(f'data keys : {len(data_keys)} -> /tmp/datakeys.txt')
print(f'code keys : {len(code_static)} statyczne + {len(code_dyn)} dynamiczne -> /tmp/codekeys.txt')
