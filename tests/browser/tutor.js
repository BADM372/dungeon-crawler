// The kids' guide's tutor in a real page, on a scripted model. Run from the devtools of a room
// of the guide opened with ?dev=1 (the dev server serves /tests/), for example
// /learn/combat.html?dev=1#swing (any room with a demo on its first slide works too):
// await (await import('/tests/browser/tutor.js')).runTutorChecks()
// It asks one question in the room's conversation, which stays in the panel afterwards.
const check = (condition, message) => { if (!condition) throw Error(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, message, ms = 8000) {
  for (const end = Date.now() + ms; Date.now() < end; await delay(50)) if (await test()) return;
  throw Error(message);
}

export async function runTutorChecks() {
  check(new URLSearchParams(location.search).has('dev'), 'Open the page with ?dev=1');
  const slides = [...document.querySelectorAll('main.deck section.slide')];
  check(slides.length > 1, 'Open a room of the guide');
  if (!window.learnTutor) document.querySelector('#tutor-btn').click();
  await until(() => window.learnTutor && document.querySelector('#tutor .log'), 'The tutor did not start');
  const T = window.learnTutor, P = T.pi, before = localStorage.getItem('kids.tutor.provider');
  localStorage.setItem('kids.tutor.provider', 'faux');
  try {
    const target = slides.at(-1).id;
    const demo = slides.find(s => s.classList.contains('current'))?.querySelector('[data-demo]');
    T.faux.setResponses([
      P.fauxAssistantMessage([P.fauxToolCall('read_slide', {}), ...(demo ? [P.fauxToolCall('look_at_demo', {})] : [])], { stopReason: 'toolUse' }),
      P.fauxAssistantMessage([P.fauxToolCall('search_code', { query: 'export function' }), P.fauxToolCall('show_slide', { slide: target })], { stopReason: 'toolUse' }),
      P.fauxAssistantMessage(`What do you **guess**? Look at [the last slide](#${target}).`),
    ]);
    const input = document.querySelector('#tutor textarea');
    input.value = 'browser check: how does this work?';
    document.querySelector('#tutor form.ask').requestSubmit();
    await until(() => T.faux.getPendingResponseCount() === 0 && !document.querySelector('#tutor .thinking'), 'The scripted answer did not finish');
    await delay(300);

    const conversation = await T.room(location.pathname.split('/').pop());
    const { entries } = (await conversation.viewState(T.ctx)).value;
    const asked = entries.findLastIndex(e => e.kind === 'tutor.ask');
    check(entries[asked].data.text === 'browser check: how does this work?', 'The question is stored as the reader typed it');
    const results = entries.slice(asked).filter(e => e.kind === 'pi.tool-result').map(e => e.model[0]);
    check(results.every(r => !r.isError), 'A tool failed: ' + JSON.stringify(results.find(r => r.isError)?.content));
    // tools of one round run side by side, so their results come in any order
    const result = name => results.find(r => r.toolName === name);
    const text = r => r.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    check(/^Slide \d+\/\d+ of /.test(text(result('read_slide'))), 'read_slide reads the slide the reader is on');
    if (demo) check(result('look_at_demo').content.some(c => c.type === 'image' || /3D/.test(c.text ?? '')), 'look_at_demo takes a picture of a 2D demo');
    check(/src\/\S+\.js:\d+:/.test(text(result('search_code'))), 'search_code finds the game\'s code');
    check(location.hash === '#' + target, 'show_slide turned the page');
    const log = document.querySelector('#tutor .log');
    const answer = [...log.querySelectorAll('.msg.guide')].at(-1);
    check(answer?.querySelector(`a[data-slide="${target}"]`), 'The answer links to the slide');
    check(answer.querySelector('b')?.textContent === 'guess', 'The answer is drawn as Markdown');
    check(localStorage.getItem('kids.tutor.busy') === null, 'The busy flag is cleared once the tutor is idle');
    return 'tutor checks passed';
  } finally {
    if (before) localStorage.setItem('kids.tutor.provider', before); else localStorage.removeItem('kids.tutor.provider');
  }
}
