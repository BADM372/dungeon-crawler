// The tutor's answers are short Markdown (prompt.js); this draws them as HTML. Everything is
// escaped first, and links only lead to pages and slides of the guide.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function md(src) {
  const blocks = [], out = [];
  let text = String(src).replace(/```[^\n]*\n([\s\S]*?)(```|$)/g, (_, code) => `\u0000${blocks.push(code.replace(/\n$/, '')) - 1}\u0000`);
  const inline = s => {
    const codes = [];
    return esc(s)
    .replace(/`([^`]+)`/g, (_, c) => `\u0001${codes.push(c) - 1}\u0001`)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])[*_]([^*_\s][^*_]*?)[*_](?=[\s).,!?:;]|$)/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
      const u = url.replace(/&amp;/g, '&');
      if (/^#[\w-]+$/.test(u)) return `<a href="${u}" data-slide="${u.slice(1)}">${label}</a>`;
      if (/^(?:\.\/)?[\w-]+\.html(?:#[\w-]+)?$/.test(u)) return `<a href="${u}">${label}</a>`;
      return label;
    })
    .replace(/\u0001(\d+)\u0001/g, (_, i) => `<code>${codes[+i]}</code>`);
  };
  let list = null;
  const flush = () => { if (list) { out.push(`<${list.tag}>${list.items.map(i => `<li>${i}</li>`).join('')}</${list.tag}>`); list = null; } };
  for (const para of text.split(/\n{2,}/)) {
    const lines = para.split('\n'), plain = [];
    for (const line of lines) {
      const code = line.match(/^\u0000(\d+)\u0000$/);
      const item = line.match(/^\s*(?:([-*])|(\d+)[.)])\s+(.*)$/);
      if (code) { if (plain.length) out.push(`<p>${plain.splice(0).join('<br>')}</p>`); flush(); out.push(`<pre><code>${esc(blocks[+code[1]])}</code></pre>`); }
      else if (item) {
        if (plain.length) out.push(`<p>${plain.splice(0).join('<br>')}</p>`);
        const tag = item[1] ? 'ul' : 'ol';
        if (list?.tag !== tag) { flush(); list = { tag, items: [] }; }
        list.items.push(inline(item[3]));
      } else if (/^#{1,4}\s/.test(line)) { flush(); out.push(`<p><b>${inline(line.replace(/^#+\s*/, ''))}</b></p>`); }
      else if (list && /^\s+\S/.test(line)) list.items[list.items.length - 1] += ' ' + inline(line.trim());
      else if (line.trim()) { flush(); plain.push(inline(line)); }
    }
    if (plain.length) out.push(`<p>${plain.join('<br>')}</p>`);
    flush();
  }
  return out.join('').replace(/\u0000(\d+)\u0000/g, (_, i) => `<pre><code>${esc(blocks[+i])}</code></pre>`);
}
