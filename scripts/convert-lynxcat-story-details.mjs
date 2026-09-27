import { readFile, writeFile } from 'node:fs/promises';

// Match the four-field story-details export, including its text field labels.
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
  const curated = type === 'character' ? ['Gender', 'Appearance', 'Personality'] : type === 'location' ? ['Type', 'Region', 'Appearance', 'Atmosphere'] : [];
  for (const line of body.split('\n')) {
    const field = /^([^:]+):\s*(.*)$/.exec(line);
    if (field && curated.includes(field[1]) && (field[1] !== 'Gender' || /^(male|female|other)$/i.test(field[2]))) {
      fields.push({ key: field[1], kind: 'curated', value: field[2] });
    } else remaining.push(line);
  }
  if (type !== 'other' && remaining.join('\n').trim()) {
    fields.push({ key: 'Description', kind: 'curated', value: remaining.join('\n') });
  }
  const text = type === 'other' ? body : [...curated, 'Description']
    .map(key => `${key}: ${fields.find(field => field.key === key)?.value ?? ''}`).join('\n');
  return {
    title: card.title,
    type: type === 'other' ? sourceType : 'Other',
    value: `${text}\n\nSummary: ${match[2] ?? card.title}`,
    keys: card.keys ?? '',
  };
});
await writeFile(destination, JSON.stringify(cards, null, 2) + '\n', { flag: 'wx' });
console.log(`Prepared ${cards.length} cards. The source file is unchanged.`);
