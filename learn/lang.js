// The guide's language: the reader's choice (the EN / DE switch, see deck.js), else the
// browser's. A plain script in <head>, so it runs before the page is drawn: kids.css then
// shows only the elements marked with this language (<p lang="en"> / <p lang="de"> pairs).
(function () {
  let lang = null;
  try { lang = localStorage.getItem('kids.lang'); } catch { /* private mode */ }
  if (lang !== 'en' && lang !== 'de')
    lang = (navigator.languages || [navigator.language]).map(l => (l || '').slice(0, 2)).find(l => l === 'en' || l === 'de') || 'en';
  document.documentElement.lang = lang;
  document.documentElement.dataset.lang = lang;
})();
