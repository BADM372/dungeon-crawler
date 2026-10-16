"""Mechanical scores per answer: ask-back, tool use, code names that really exist, latency, cost.
Correctness is graded by hand ({model: {qid: 0|1|2}}) and merged here.
Usage: python3 score.py <repo> results-r1:grades-r1.json [results-r2:grades-r2.json ...]"""
import json, re, subprocess, sys, statistics as st
from pathlib import Path

REPO = Path(sys.argv[1])
MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'gpt-6-sol', 'gpt-6-luna']
LABEL = {'gpt-6-sol': 'qwen3.6-35b-a3b (Lumen)', 'gpt-6-luna': 'qwen3.8-27b (Lumen)'}
LOOK = {'read_code', 'search_code', 'read_slide', 'look_at_demo', 'search_guide', 'look_up_word', 'look_at_game'}
GAME = {'game', 'run_js', 'look_at_game'}
RUNS = [a.split(':') for a in sys.argv[2:]] or [['results', 'grades.json']]

def exists(name):
    # a backticked name counts as grounded when the repo's src/ or learn/ contains it
    r = subprocess.run(['grep', '-rqF', '--', name, 'src', 'learn', 'docs'], cwd=REPO)
    return r.returncode == 0

rows = []
for m, (rdir, gfile) in [(m, run) for m in MODELS for run in RUNS]:
    f = Path(f'{rdir}/{m}.jsonl')
    if not f.exists(): continue
    grades = json.loads(Path(gfile).read_text()) if Path(gfile).exists() else {}
    for line in f.read_text().splitlines():
        r = json.loads(line)
        final = r.get('final', '')
        names = set(re.findall(r'`([^`\n]{2,60})`', '\n'.join(r.get('text', []))))
        names = {n.split('(')[0].strip() for n in names}
        real = sum(exists(n) for n in names)
        tools = [t['name'] for t in r.get('tools', [])]
        last = re.split(r'(?<=[.!?])\s+', final.strip())[-1] if final.strip() else ''
        rows.append({
            'model': m, 'id': r['id'], 'kind': r['kind'], 'ms': r.get('ms'), 'usd': r.get('usd', 0),
            'error': r.get('error') or next((s for s in r.get('stops', []) if s.startswith('error')), None),
            'asks_back': last.endswith('?'), 'questions': final.count('?'), 'words': len(final.split()),
            'look_tools': sum(t in LOOK for t in tools), 'game_tools': sum(t in GAME for t in tools),
            'tool_errors': tools.count('!error'), 'n_tools': len([t for t in tools if t != '!error']),
            'names': len(names), 'names_real': real, 'grade': grades.get(m, {}).get(r['id']),
        })
Path('scored.json').write_text(json.dumps(rows, indent=1))
print(f"{'model':28} n  err asks1? avgQ words look game toolErr names real/  grade  p50s  maxs   $")
for m in MODELS:
    R = [r for r in rows if r['model'] == m]
    if not R: continue
    ms = [r['ms'] / 1000 for r in R if r['ms']]
    g = [r['grade'] for r in R if r['grade'] is not None]
    print(f"{LABEL.get(m, m):28} {len(R):2} {sum(bool(r['error']) for r in R):3} "
          f"{sum(r['asks_back'] and r['questions'] == 1 for r in R):5} {st.mean(r['questions'] for r in R):5.1f} "
          f"{st.mean(r['words'] for r in R):5.0f} {sum(r['look_tools'] for r in R):4} {sum(r['game_tools'] for r in R):4} "
          f"{sum(r['tool_errors'] for r in R):6} {sum(r['names'] for r in R):5} {sum(r['names_real'] for r in R):5}  "
          f"{(str(sum(g)) + '/' + str(2 * len(g))) if g else '-':6} {st.median(ms) if ms else 0:5.1f} {max(ms) if ms else 0:5.1f} {sum(r['usd'] for r in R):7.3f}")
