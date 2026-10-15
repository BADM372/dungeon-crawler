// The tutor's agent, on pi-durable: every question, answer and tool call is saved (files.js,
// in the browser) before it shows, so a page that closes in the middle of an answer loses
// nothing: the next page of the guide opens the same storage and the answer finishes there.
//
// One conversation per room (the "tutor.room" document says which), found through the
// session's "tutor.rooms" index. The "tutor.notebook" is shared by all rooms: what the tutor
// noted about the reader.
import { AgentDoc, Harness, JsonlStorage, createRegistry, defineDoc, defineExtension, section } from '../../vendor/pi-durable/pi-durable.js';
import { GUIDE, roomSection, notebookSection } from './prompt.js';
import { createTools } from './tools.js';
import * as page from './page.js';
import { DECKS, local } from '../decks.js';

export const RoomDoc = defineDoc({ kind: 'tutor.room', version: 1, scope: 'conversation', history: 'latest', fork: 'current', initial: () => ({ file: '' }) });
export const IndexDoc = defineDoc({ kind: 'tutor.rooms', version: 1, scope: 'session', initial: () => ({ rooms: {} }) });
export const NotebookDoc = defineDoc({ kind: 'tutor.notebook', version: 1, scope: 'session', initial: () => ({ notes: [] }) });
const MAX_NOTES = 40;
export const THINKING = 'low';

export function guideExtension({ lang = page.pageLang() } = {}) {
  const roomOf = async (api, context) => (await api.snapshot(RoomDoc, api.conversationId, context))?.file ?? '';
  const addNote = (api, room, text, context) => api.commit(async tx => {
    const book = await tx.doc(NotebookDoc);
    if (book.notes.some(n => n.text === text)) return;
    book.notes.push({ room, text });
    if (book.notes.length > MAX_NOTES) book.notes.splice(0, book.notes.length - MAX_NOTES);
  }, context);
  return defineExtension({
    name: 'guide',
    sections: [
      section('guide', () => GUIDE, { tag: false }),
      section('room', async (input, context) => {
        const file = (await input.read.snapshot(RoomDoc, input.conversationId, context))?.file;
        const info = file && page.roomInfo(file, lang);
        return roomSection(info, info ? page.outline(await page.roomDoc(file), lang) : [], lang);
      }),
      section('rooms', () => 'All rooms, in order (link as file#slide-id):\n' + DECKS.map((d, i) => `${i + 1}. ${d.file}: ${local(d, lang).title}`).join('\n') + '\nAlso words.html (the glossary) and index.html (the map).'),
      section('notebook', async (input, context) => notebookSection((await input.read.snapshot(NotebookDoc, context))?.notes ?? [])),
    ],
    tools: createTools({ roomOf, addNote, lang }),
  });
}

// open the tutor over a file system (files.js) and a model collection (models.js)
export async function openTutor({ files, models, context, lang = page.pageLang(), onReport = e => console.warn('tutor:', e) }) {
  const registry = createRegistry();
  registry.install(guideExtension({ lang }));
  const storage = await JsonlStorage.open('/tutor', files, context);
  const harness = await Harness.open(storage, {
    models, registry, onReport,
    settings: { progress: { partialIntervalMs: 120, outputIntervalMs: 250 }, retry: { maxRetries: 2 }, stream: { timeoutMs: 120_000 } },
  }, context);
  harness.resume();   // finish whatever a page that closed left running

  const opening = new Map();
  // the conversation of a room (or another page of the guide), made on first use
  async function room(file) {
    const known = (await harness.snapshot(IndexDoc, context))?.rooms?.[file];
    if (known !== undefined) {
      const c = await harness.conversation(known, context);
      if (c) return c;
    }
    if (!opening.has(file)) opening.set(file, harness.createConversation({
      ownership: { kind: 'ownerless' },
      init: async (tx, id) => {
        (await tx.doc(RoomDoc, id)).file = file;
        (await tx.doc(IndexDoc)).rooms[file] = id;
      },
    }, context).finally(() => opening.delete(file)));
    return opening.get(file);
  }

  // ask in a room's conversation; `where` tells the tutor what the reader looks at (page.whereText)
  async function ask(conversation, text, where, model) {
    const agent = await harness.snapshot(AgentDoc, conversation.id, context);
    if (model && (agent?.model?.provider !== model.provider || agent?.model?.modelId !== model.modelId || agent?.thinkingLevel !== THINKING))
      await conversation.configure({ model, thinkingLevel: THINKING }, context);
    return conversation.submit({
      type: 'input',
      content: `<where>${where}</where>\n${text}`,
      entry: { kind: 'tutor.ask', data: { text, where } },
    }, context);
  }

  const notes = async () => (await harness.snapshot(NotebookDoc, context))?.notes ?? [];
  const forgetNotes = () => harness.commit(async tx => { (await tx.doc(NotebookDoc)).notes = []; }, context);
  return { harness, room, ask, notes, forgetNotes };
}
