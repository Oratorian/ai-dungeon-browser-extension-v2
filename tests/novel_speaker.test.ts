import { describe, expect, it } from "vitest";
import { parseNovel } from "@/rendering/novel";
import { novelSpeakers } from "@/rendering/novel_speaker";

const characters = [
  { id: "sage", name: "Sage Harrow", triggers: "Sage" },
  { id: "elarion", name: "Elarion", triggers: "you" },
];
const speakers = (text: string) => novelSpeakers(parseNovel(text), characters);

describe("explicit VN speakers", () => {
  it("keeps the speaker when dialogue resumes after their action beat", () => {
    const text = 'Serastra: "Help?" Serastra barks a laugh that sounds like a tea kettle boiling over. "You want to help? You want to assist in the sacred art of custard creation?"';
    expect(novelSpeakers(parseNovel(text), [...characters, { id: "serastra", name: "Serastra", triggers: "" }]))
      .toEqual(["serastra", null, "serastra", "serastra"]);
    expect(speakers('Sage: “Wait.” She smiles. “Stay here.”')).toEqual(["sage", null, "sage"]);
    expect(speakers('Sage: "Wait." "Stay here."')).toEqual(["sage", "sage"]);
  });
  it("does not carry resumed dialogue over a different actor, label or paragraph", () => {
    expect(speakers('Sage: "Wait." Elarion smiles. "No."')).toEqual(["sage", null, null]);
    expect(speakers('Sage: "Wait." Guest: "No."')).toEqual(["sage", null]);
    expect(speakers('Sage: "Wait." Elarion: "No."')).toEqual(["sage", "elarion"]);
    expect(speakers('Sage: "Wait."\n"No."')).toEqual(["sage", null]);
    expect(speakers('Sage: "Wait." A stranger laughs. "No."')).toEqual(["sage", null, null]);
  });
  it.each(["reply", "whisper", "shout", "yell", "mutter", "hush", "hiss", "scream"])("tracks the player attribution: you %s", verb => {
    expect(speakers(`"I am merely a connoisseur of observation, Sage," you ${verb}.`)).toEqual(["elarion"]);
    expect(speakers(`You ${verb}, "Sage is waiting."`)).toEqual(["elarion"]);
  });
  it("tracks named, inverted and softly spoken attributions across long quotes", () => {
    expect(speakers('"Hello. Stay here," Sage whispers.')).toEqual(["sage", "sage"]);
    expect(speakers('“Stay here,” whispers Sage.')).toEqual(["sage"]);
    expect(speakers('Elarion quietly replies, «Of course.»')).toEqual(["elarion"]);
    expect(speakers('"Of course," you softly reply.')).toEqual(["elarion"]);
    expect(speakers('Sage shouts, "Stop!" Elarion replies, "No."')).toEqual(["sage", "elarion"]);
  });
  it("does not use names inside quotes, ordinary action tags or ambiguous attributions", () => {
    expect(speakers('"Sage whispers, Elarion shouts."')).toEqual([null]);
    expect(speakers('"Hello." Sage smiles.')).toEqual([null, null]);
    expect(speakers('"Hello," she whispers.')).toEqual([null]);
    expect(novelSpeakers(parseNovel('"Hello," Sage whispers.'), [...characters,
      { id: "other", name: "Other", triggers: "Sage" }])).toEqual([null]);
  });
  it.each(["You", "you", "Elarion"])("resolves the player alias %s to the same card", label => {
    expect(speakers(`${label}: "Hello."`)).toEqual(["elarion"]);
  });
  it("focuses the player card throughout native Say actions", () => {
    expect(speakers('You say, "Hello. Stay here."')).toEqual(["elarion", "elarion"]);
    expect(speakers('You say, “Hello.”')).toEqual(["elarion"]);
    expect(speakers('Sage: "You say, hello."')).toEqual(["sage"]);
  });
  it("keeps focus through a multi-sentence quote and clears it for narration", () => {
    expect(speakers('Sage: "Careful, Elarion. You will regret that." She smiles.'))
      .toEqual(["sage", "sage", null]);
  });
  it("switches speakers within a paragraph and supports quote styles and aliases", () => {
    expect(speakers('SAGE: “Hello.” Elarion: «Welcome!»')).toEqual(["sage", "elarion"]);
  });
  it("does not infer speakers from mentions, unknown labels or unlabeled dialogue", () => {
    expect(speakers('Sage smiles.\nGuest: "Hello."\n"Sage: hello."')).toEqual([null, null, null]);
  });
  it("ignores ambiguous aliases", () => {
    expect(novelSpeakers(parseNovel('Sage: "Hello."'), [...characters,
      { id: "other", name: "Other", triggers: "Sage" }])).toEqual([null]);
  });
  it("handles unfinished streaming quotes without carrying focus into another paragraph", () => {
    expect(speakers('Sage: "Wait\nThe door opens.')).toEqual(["sage", null]);
  });
});
