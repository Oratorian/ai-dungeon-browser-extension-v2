import { expect, it } from "vitest";
import { mentionAtCaret, indexMentionNames, matchMentionNames, completeMention } from "@/aid/mentions";

it("finds @ queries at the caret, including multiword and Unicode names", () => {
  expect(mentionAtCaret("@", 1)).toEqual({ start: 0, end: 1, query: "" });
  const text = 'I ask (@Sage Ha';
  expect(mentionAtCaret(text, text.length)).toEqual({ start: 7, end: text.length, query: "Sage Ha" });
  expect(mentionAtCaret("@Élo", 4)?.query).toBe("Élo");
  expect(mentionAtCaret("Hello\n@Nyx", 10)?.query).toBe("Nyx");
});

it("ignores email addresses, selected text, and mentions on earlier lines", () => {
  for (const text of ["mail@example.com", "@@Nyx", "@Nyx\nhello", "plain text"]) {
    expect(mentionAtCaret(text, text.length)).toBeNull();
  }
  expect(mentionAtCaret("@Sage", 2, 5)).toBeNull();
});

it("deduplicates names, skips untitled cards, and ranks name prefixes before substrings", () => {
  const names = indexMentionNames([
    { id: "1", name: "Old Sage", type: "character", triggers: "sage" },
    { id: "2", name: "Sage Harrow", type: "character", triggers: "Sage" },
    { id: "3", name: "sage harrow", type: "character", triggers: "Sage" },
    { id: "4", name: "", type: "other", triggers: "Sage" },
    { id: "5", name: "The Dragon Cafe", type: "location", triggers: "Cafe" },
  ]);
  expect(matchMentionNames(names, "SAGE").map(n => n.name)).toEqual(["Sage Harrow", "Old Sage"]);
  expect(matchMentionNames(names, "Dragon")[0]?.type).toBe("location");
  expect(matchMentionNames(names, "unmatched")).toEqual([]);
  expect(matchMentionNames(names, "", 2)).toHaveLength(2);
});

it("replaces only the active mention and preserves the rest of the draft", () => {
  const text = "I ask @Sa about the cafe.";
  expect(completeMention(text, mentionAtCaret(text, 9)!, "Sage Harrow").text).toBe("I ask Sage Harrow about the cafe.");
  const middle = "I ask @Sage, then leave.";
  expect(completeMention(middle, mentionAtCaret(middle, 9)!, "Sage Harrow").text).toBe("I ask Sage Harrow, then leave.");
  expect(completeMention("@Nyx", mentionAtCaret("@Nyx", 4)!, "Nyxadra")).toEqual({ text: "Nyxadra ", caret: 8, insert: "Nyxadra " });
  const multiple = "@Sage speaks to @Nyx";
  expect(completeMention(multiple, mentionAtCaret(multiple, multiple.length)!, "Nyxadra").text).toBe("@Sage speaks to Nyxadra ");
});
