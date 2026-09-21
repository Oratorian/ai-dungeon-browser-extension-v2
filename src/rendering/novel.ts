/** Local, conservative dialogue attribution. No model calls or story text sent elsewhere. */
export type NovelCharacter = { id: string; name: string; triggers: string; portrait?: string };
export type NovelFrame = { text: string; kind: "narration" | "dialogue"; speakerId: string | null; inferred?: boolean };

const speech = "(?:says?|said|asks?|asked|repl(?:y|ies|ied)|whispers?|whispered|murmurs?|murmured|shouts?|shouted|calls?|called|answers?|answered|adds?|added|exclaims?|exclaimed|mutters?|muttered|continues?|continued|chirps?|chirped|echo(?:es|ed)?|rasps?|rasped|muses?|mused|purrs?|purred|repeats?|repeated|tells?|told|insists?|insisted|sighs?|sighed|gasps?|gasped)";
const adverb = "(?:(?:[\\p{L}]+ly|finally|already|still|just|then|now|even)\\s+){0,2}";
const action = `(?:${speech}|stands?|stood|jumps?|jumped|grips?|gripped|lets?|let|gives?|gave|pivots?|pivoted|descends?|descended|hovers?|hovered|looks?|looked|watches?|watched|slides?|slid|peeks?|peeked|curls?|curled|pops?|popped|stiffens?|stiffened|dismantles?|dismantled|wipes?|wiped|turns?|turned|smiles?|smiled|nods?|nodded|shakes?|shook|enters?|entered|leaves?|left|emerges?|emerged|freezes?|froze|crosses|crossed|steps?|stepped|reaches|reached|leans?|leaned|folds?|folded|flops?|flopped|is|are|was|were|has|have|had)`;
const quoted = /"[^"\n]+"|“[^”\n]+”|«[^»\n]+»/gu;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const bounded = (text: string) => `(?<![\\p{L}\\p{N}_])${escape(text)}(?![\\p{L}\\p{N}_])`;
type Attribution = Pick<NovelFrame, "speakerId" | "inferred">;
type Context = { subject: string | null; references: Set<string>; blocked: boolean };
const emptyContext = (): Context => ({ subject: null, references: new Set(), blocked: false });

/** Ambiguous aliases are excluded instead of assigning them to whichever card comes last. */
function aliases(characters: NovelCharacter[]) {
  const owners = new Map<string, Set<string>>();
  for (const character of characters) {
    for (const value of [character.name, ...character.triggers.split(",")]) {
      const alias = value.trim().toLocaleLowerCase();
      if (!alias) continue;
      const ids = owners.get(alias) ?? new Set<string>();
      ids.add(character.id);
      owners.set(alias, ids);
    }
  }
  return [...owners].filter(([, ids]) => ids.size === 1)
    .map(([alias, ids]) => ({ alias, id: [...ids][0]!,
      name: characters.some(c => ids.has(c.id) && (new RegExp(bounded(alias), "iu").test(c.name) || (alias.length >= 3 && c.name.toLowerCase().startsWith(alias)))),
    }))
    .sort((a, b) => b.alias.length - a.alias.length);
}

export function parseNovel(text: string, characters: NovelCharacter[]): NovelFrame[] {
  return createNovelParser(characters)(text);
}

/** Compile the card aliases once when the selected set changes, not on each streaming update. */
export function createNovelParser(characters: NovelCharacter[]): (text: string) => NovelFrame[] {
  const names = aliases(characters);
  const playerIds = new Set(characters.filter(c => c.name.toLowerCase() === "you").map(c => c.id));
  const listener = `(?:${names.map(a => escape(a.alias)).join("|") || "(?!)"}|you|him|her|them|me)`;
  const patterns = names.map(alias => {
    const name = bounded(alias.alias);
    return { ...alias,
      mention: new RegExp(name, "giu"),
      subject: new RegExp(`${name}(?:['’]s\\s+(?:head|eyes|wings|hands|claws|voice|expression))?\\s+${adverb}${action}(?![\\p{L}\\p{N}_])`, "giu"),
      before: new RegExp(`(?:${name}\\s+${adverb}${speech}(?:\\s+(?:to\\s+)?${listener})?(?:\\s+\\p{L}+ly)?\\s*[:,]?|${name}\\s*:)\\s*$`, "iu"),
      after: new RegExp(`^\\s*[,;.!?]?\\s*(?:${name}\\s+${adverb}${speech}|${speech}\\s+${name})(?![\\p{L}\\p{N}_])`, "iu"),
    };
  });
  const pronounBefore = new RegExp(`\\b(?:she|he|they|it)\\s+${adverb}${speech}(?:\\s+\\p{L}+ly)?\\s*[:,]?\\s*$`, "iu");
  const pronounAfter = new RegExp(`^\\s*[,;.!?]?\\s*(?:she|he|they|it)\\s+${adverb}${speech}\\b`, "iu");
  return (text: string): NovelFrame[] => {
    const frames: NovelFrame[] = [];
    let carry = emptyContext();

    function mentions(segment: string) {
      const matches = patterns.flatMap(p => [...segment.matchAll(p.mention)].map(m => ({ ...p, start: m.index!, end: m.index! + m[0].length })));
      return matches.filter(m => !matches.some(other => other.start <= m.start && other.end >= m.end && other.end - other.start > m.end - m.start));
    }
    function advance(segment: string, context: Context) {
      for (const part of segment.match(/[^.!?]+(?:[.!?]+|$)/gu) ?? []) {
        const found = mentions(part);
        const strong = found.filter(m => m.name);
        for (const mention of strong) context.references.add(mention.id);
        const subjects = patterns.flatMap(p => [...part.matchAll(p.subject)].map(m => ({ ...p, start: m.index!, text: m[0] })))
          .filter(s => {
            // Broad triggers must be the whole subject, not "dragon" in "the crimson dragon".
            if (!s.name && !/^\s*(?:(?:the|a|an)\s+)?$/iu.test(part.slice(0, s.start))) return false;
            if (!s.name && /\b(?:is|are|was|were|has|have|had)$/iu.test(s.text)) return false;
            return !found.some(m => m.start <= s.start && m.end >= s.start + s.alias.length && (m.start < s.start || m.end > s.start + s.alias.length));
          }).sort((a, b) => a.start - b.start);
        if (subjects.length) {
          const subject = subjects.at(-1)!;
          const otherNames = strong.filter(m => m.id !== subject.id);
          const shared = /\band\s*$/iu.test(part.slice(0, subject.start)) && otherNames.length > 0;
          const watching = /\b(?:looks?|looked|watches?|watched)\b/iu.test(subject.text) && otherNames.length > 0;
          context.subject = shared || watching ? null : subject.id;
          context.blocked = shared || watching;
        } else if (/^\s*(?:the|a|an|someone|somebody|another)\b/iu.test(part)) {
          context.subject = null; context.references.clear(); context.blocked = true;
        }
        if (!context.blocked && /^\s*(?:she|her|he|his|they|their|it|its)\b/iu.test(part) && (!context.subject || playerIds.has(context.subject))) {
          const npcs = [...context.references].filter(id => !playerIds.has(id));
          context.subject = npcs.length === 1 ? npcs[0]! : null;
        }
      }
    }
    function speaker(before: string, after: string, nextQuote: boolean, context: Context, allowContext: boolean): Attribution {
      const ids = new Set<string>();
      const beforeNames = mentions(before);
      for (const pattern of patterns) {
        const preceding = pattern.before.exec(before);
        const prefix = preceding ? before.slice(0, preceding.index).split(/[,.!?;]/u).at(-1)! : "";
        const wholeSubject = pattern.name || /^\s*(?:the\s+)?$/iu.test(prefix);
        const namedBefore = preceding && wholeSubject && beforeNames.some(m => m.id === pattern.id && m.start === preceding.index);
        if (namedBefore || (pattern.after.test(after) && !(nextQuote && pattern.before.test(after)))) ids.add(pattern.id);
      }
      if (ids.size) return { speakerId: ids.size === 1 ? [...ids][0]! : null };
      const pronoun = pronounBefore.test(before) || pronounAfter.test(after);
      let candidate = context.subject;
      if (pronoun && candidate && playerIds.has(candidate)) {
        const npcs = [...context.references].filter(id => !playerIds.has(id));
        candidate = npcs.length === 1 ? npcs[0]! : null;
      }
      if (!context.blocked && candidate && (allowContext || pronoun)) return { speakerId: candidate, inferred: true };
      return { speakerId: null };
    }
    function narration(value: string) {
      if (value.trim()) frames.push({ text: value.trim(), kind: "narration", speakerId: null });
    }
    // Only narrative paragraphs seed the following paragraph, whose opening quote still needs
    // a pronoun cue. Context never crosses responses; incomplete quotes remain narration.
    for (const paragraph of text.split(/\n+/).filter(p => p.trim())) {
      const quotes = [...paragraph.matchAll(quoted)];
      const context: Context = { ...carry, references: new Set(carry.references) };
      let end = 0;
      for (let i = 0; i < quotes.length; i++) {
        const quote = quotes[i]!;
        const start = quote.index!;
        const nextStart = quotes[i + 1]?.index ?? paragraph.length;
        const before = paragraph.slice(end, start);
        const after = paragraph.slice(start + quote[0].length, nextStart);
        advance(before, context);
        narration(before);
        const attribution = speaker(before, after, i + 1 < quotes.length, context, i > 0 || !!before.trim());
        frames.push({ text: quote[0], kind: "dialogue", ...attribution });
        context.subject = attribution.speakerId;
        context.blocked = !attribution.speakerId;
        end = start + quote[0].length;
      }
      const rest = paragraph.slice(end);
      narration(rest);
      if (!quotes.length) { advance(rest, context); carry = context; }
      else carry = emptyContext();
    }
    return frames;
  };
}
