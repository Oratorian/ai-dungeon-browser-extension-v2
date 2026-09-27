import { VN_CARD_ENTRY } from "@/aid/vn_card";

export const VN_STYLE_START = "[Dungeon Extension: VN instructions]";
export const VN_STYLE_END = "[/Dungeon Extension: VN instructions]";

/** Only replace our marked block, or adopt an exact copy of our known template. */
export function planLynxVnStyle(content: string, enabled: boolean): string {
  const start = content.indexOf(VN_STYLE_START);
  const end = content.indexOf(VN_STYLE_END);
  let base = content;
  let insertion = 0;
  if (start >= 0 || end >= 0) {
    if (start < 0 || end < start || content.indexOf(VN_STYLE_START, start + 1) >= 0 || content.indexOf(VN_STYLE_END, end + 1) >= 0) {
      throw new Error("The VN instruction block was edited. Check its start and end labels in AI Writing Style, then retry.");
    }
    insertion = start;
    let tail = end + VN_STYLE_END.length;
    if (content.slice(tail, tail + 2) === "\n\n") tail += 2;
    base = content.slice(0, start) + content.slice(tail);
  } else if (enabled && content.includes(VN_CARD_ENTRY)) {
    insertion = content.indexOf(VN_CARD_ENTRY);
    let tail = insertion + VN_CARD_ENTRY.length;
    if (content.slice(tail, tail + 2) === "\n\n") tail += 2;
    base = content.slice(0, insertion) + content.slice(tail);
  }
  const result = enabled ? base.slice(0, insertion) + `${VN_STYLE_START}\n${VN_CARD_ENTRY}\n${VN_STYLE_END}\n\n` + base.slice(insertion) : base;
  if (enabled && result.length > 4000) throw new Error("AI Writing Style has no room for the VN instructions. Shorten it a little, then retry. Nothing was changed.");
  return result;
}
