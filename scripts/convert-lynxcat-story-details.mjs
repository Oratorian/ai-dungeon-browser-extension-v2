import { readFile, writeFile } from 'node:fs/promises';

// Prepare native card data, not LynxCatAI's flattened AID-compatible import format.
const [source, destination] = process.argv.slice(2);
if (!source || !destination || source === destination) {
  throw new Error('Usage: node scripts/convert-lynxcat-story-details.mjs input.json different-output.json');
}
const input = JSON.parse(await readFile(source, 'utf8'));
if (!Array.isArray(input)) throw new Error('Expected a story-details array.');
const cards = input.filter(card => !/format inspection card/i.test(card.title)).map(card => {
  const sourceType = String(card.type || 'Other');
  const type = ['character', 'location'].includes(sourceType.toLowerCase()) ? sourceType.toLowerCase() : 'other';
  const match = String(card.value || '').match(/^([\s\S]*?)(?:\n\nSummary: ([\s\S]*))?$/);
  let body = match[1];
  if (body.startsWith('[') && body.endsWith(']')) body = body.slice(1, -1);
  const fields = [];
  const remaining = [];
  const curated = type === 'character' ? ['Gender', 'Appearance', 'Personality'] : [];
  for (const line of body.split('\n')) {
    const field = /^([^:]+):\s*(.*)$/.exec(line);
    if (field && curated.includes(field[1]) && (field[1] !== 'Gender' || /^(male|female|other)$/i.test(field[2]))) {
      fields.push({ key: field[1], kind: 'curated', value: field[2] });
    } else remaining.push(line);
  }
  if (type !== 'other' && remaining.join('\n').trim()) {
    fields.push({ key: 'Description', kind: 'curated', value: remaining.join('\n') });
  }
  return {
    name: card.title, type, category: sourceType,
    content: fields.length ? fields.map(f => `${f.key}: ${f.value}`).join('\n') : body,
    fields, summary: match[2] ?? card.title,
    triggers: String(card.keys || '').split(',').map(s => s.trim()).filter(Boolean),
    aliases: [], tags: [], structuredData: {}, enabled: true,
    activationMode: 'trigger', priority: 60, tokenBudgetHint: 120,
  };
});
await writeFile(destination, JSON.stringify(cards, null, 2) + '\n', { flag: 'wx' });
console.log(`Prepared ${cards.length} cards. The source file is unchanged.`);
