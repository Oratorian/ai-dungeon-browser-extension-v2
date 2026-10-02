<script lang="ts">
  import { untrack } from "svelte";
  import { Storage } from "@/storage";
  import { playedAdventureId } from "@/aid/adventure";
  import { aidDetected } from "@/aid/bridge";
  import { isLynxCat } from "@/services/site";
  import { storyOutput, storyOutputSelector } from "@/services/story_dom";
  import { parseNovel } from "@/rendering/novel";
  import { novelCards } from "@/rendering/novel_cards";
  import { readNovelPassages } from "@/rendering/novel_dom";
  import { StoryPortraitSession, publishStoryPortraits, registerStoryPortraitPicker } from "@/rendering/story_portraits";

  const adventures = Storage.adventures;
  const selected = Storage.selectedAdventureId;
  const cards = $derived(novelCards($selected ? Object.values($adventures[$selected]?.storyCards ?? {}) : [],
    isLynxCat() && $playedAdventureId && $aidDetected.shortId === $playedAdventureId ? $aidDetected.cards : []));
  let session = $state<StoryPortraitSession | null>(null);
  $effect(() => {
    const adventure = $playedAdventureId;
    const set = $selected;
    untrack(() => {
      session = adventure ? new StoryPortraitSession() : null;
      publishStoryPortraits({});
    });
    return () => untrack(() => publishStoryPortraits({}));
  });
  $effect(() => {
    const current = session;
    const sceneCards = cards;
    if (!current) return;
    let output: HTMLElement | null = null;
    let signature = "";
    let queued = 0;
    function refresh() {
      output = storyOutput();
      const passages = output ? readNovelPassages(output) : [];
      const next = JSON.stringify(passages.map(passage => passage.text));
      if (next === signature) return;
      signature = next;
      publishStoryPortraits(current!.update(passages.flatMap(passage => parseNovel(passage.text)), sceneCards));
    }
    untrack(refresh);
    const unregister = registerStoryPortraitPicker((card, portrait) => publishStoryPortraits(current.choose(card, portrait)));
    const observer = new MutationObserver(records => {
      if (!queued && records.some(record => output?.contains(record.target) || [...record.addedNodes, ...record.removedNodes]
        .some(node => node instanceof HTMLElement && (node.matches(storyOutputSelector()) || node.querySelector(storyOutputSelector()))))) {
        queued = requestAnimationFrame(() => { queued = 0; refresh(); });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => { unregister(); observer.disconnect(); cancelAnimationFrame(queued); };
  });
</script>
