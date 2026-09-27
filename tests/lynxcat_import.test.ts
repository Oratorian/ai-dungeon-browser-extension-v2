import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { lynxCards } from "@/services/lynxcat_cards";
import { cardImage } from "@/shared/card_images";
import { lynxRunId } from "@/services/site";
import { Storage } from "@/storage";
import { aidDetected } from "@/aid/bridge";
import { refreshLynxCards, disconnectLynx, lynxImportError } from "@/services/lynxcat";

beforeEach(() => { Storage.adventures.set({}); Storage.selectedAdventureId.set(null); });
afterEach(() => { disconnectLynx(); vi.unstubAllGlobals(); });
const raw = { id: "card-1", name: "Kael", type: "other", category: "Character", triggers: ["Kael"], aliases: ["Kael", "engineer"], imageUrl: "https://example.com/portrait.png", content: "Private card text" };
it("maps imported categories and aliases, keeping native images separate from local media and excluding content", () => {
  expect(lynxCards([raw])).toEqual([{id:"lynxcat:card-1",name:"Kael",type:"character",triggers:"Kael, engineer",lynxImageUrl:raw.imageUrl}]);
  expect(lynxCards([{...raw,type:"location",category:"Character"}])[0]?.type).toBe("location");
  expect(lynxCards([null, {}, {...raw,enabled:false}, {...raw,deletedAt:"yesterday"}])).toEqual([]);
});
it("reimports changed metadata without replacing local pictures, voice gender or sound", () => {
  const adventure=Storage.createAdventure("Local set");
  const card=Storage.createStoryCard(adventure.id,"Kael")!;
  Storage.updateStoryCard(adventure.id,card.id,{icons:["data:image/png;base64,local-icon"],graphics:["data:image/png;base64,local-portrait"],gender:"male",audioClips:["local-sound"]});
  Storage.importStoryCards(adventure.id,lynxCards([raw]));
  Storage.importStoryCards(adventure.id,lynxCards([{...raw,name:"Kael the engineer",triggers:["Kael","scavenger"]}]));
  const cards=Object.values(Storage.getAdventureById(adventure.id)!.storyCards);
  expect(cards).toHaveLength(1);
  expect(cards[0]).toMatchObject({name:"Kael the engineer", icons:["data:image/png;base64,local-icon"],graphics:["data:image/png;base64,local-portrait"],gender:"male",audioClips:["local-sound"]});
});
it("keeps service links separate and preserves them through export/import", () => {
  const aid=Storage.createAdventure("AID");const lynx=Storage.createAdventure("Lynx");
  Storage.setAidShortId(aid.id,"same-id");Storage.setLynxRunId(lynx.id,"same-id");Storage.setLynxStoryId(lynx.id,"story-id");
  expect(Storage.selectAdventureByLynxId("same-id",null)).toBe(true);
  expect(get(Storage.selectedAdventureId)).toBe(lynx.id);
  expect(Storage.findAdventureForAid("same-id",null)?.id).toBe(aid.id);
  const restored=Storage.importAdventure(Storage.exportAdventure(lynx.id)!);
  expect(restored.adventure).toMatchObject({lynxRunId:"same-id",lynxStoryId:"story-id"});
});
it("uses website images only as a fallback and follows image changes on reimport", () => {
  const adventure = Storage.createAdventure("Pictures");
  const sync = (imageUrl: unknown) => Storage.importStoryCards(adventure.id, lynxCards([{ ...raw, imageUrl }]));
  const current = () => Object.values(Storage.getAdventureById(adventure.id)!.storyCards)[0]!;
  sync(raw.imageUrl);
  expect(current().graphics).toEqual([]);
  expect(cardImage(current())).toBe(raw.imageUrl);
  expect(cardImage(current(), "icon")).toBe(raw.imageUrl);
  Storage.updateStoryCard(adventure.id, current().id, { graphics: ["local-portrait"], icons: ["local-icon"] });
  sync("https://example.com/new.png");
  expect(cardImage(current())).toBe("local-portrait");
  expect(cardImage(current(), "icon")).toBe("local-icon");
  const restored = Storage.importAdventure(Storage.exportAdventure(adventure.id)!);
  expect(Object.values(restored.adventure!.storyCards)[0]?.lynxImageUrl).toBe("https://example.com/new.png");
  Storage.updateStoryCard(adventure.id, current().id, { graphics: [], icons: [] });
  expect(cardImage(current())).toBe("https://example.com/new.png");
  sync(null);
  expect(cardImage(current())).toBeUndefined();
  sync("javascript:alert(1)");
  expect(cardImage(current())).toBeUndefined();
});
it("accepts only play routes", () => {
  expect(lynxRunId("/plays/play-123")).toBe("play-123");
  expect(lynxRunId("/library")).toBeNull();expect(lynxRunId("/plays/play-123/settings")).toBeNull();
});
it("discards a response from a story the player already left", async () => {
  const location={hostname:"lynxcatai.com",pathname:"/plays/play-old"};vi.stubGlobal("location",location);
  let release!: (v: unknown) => void;
  const delayed=new Promise(resolve => release=resolve);
  vi.stubGlobal("fetch",vi.fn(async () => {await delayed; return {ok:true,json:async()=>({dynamicCards:[raw],run:{id:"play-old",storyId:"story-old",title:"Old"}})};}));
  const pending=refreshLynxCards();location.pathname="/plays/play-new";release(null);await pending;
  expect(get(aidDetected).cards).toEqual([]);
});
it("shows an understandable error on an expired login", async () => {
  vi.stubGlobal("location",{hostname:"lynxcatai.com",pathname:"/plays/play-123"});
  vi.stubGlobal("fetch",vi.fn(async()=>({ok:false,status:401})));
  await refreshLynxCards();expect(get(lynxImportError)).toContain("Log in");expect(get(aidDetected).cards).toEqual([]);
});
it("imports native gender on creation and reimport without clearing absent gender", () => {
  const adventure = Storage.createAdventure("Gender sync");
  const native = (value: string) => ({ ...raw, type: "character", fields: [{ key: "Gender", kind: "curated", value }] });
  Storage.importStoryCards(adventure.id, lynxCards([native(" Male ")]));
  const current = () => Object.values(Storage.getAdventureById(adventure.id)!.storyCards)[0]!;
  expect(current().gender).toBe("male");
  Storage.importStoryCards(adventure.id, lynxCards([native("Female")]));
  expect(current().gender).toBe("female");
  for (const value of ["", "unknown"]) {
    Storage.importStoryCards(adventure.id, lynxCards([native(value)]));
    expect(current().gender).toBe("female");
  }
  Storage.importStoryCards(adventure.id, lynxCards([raw]));
  expect(current().gender).toBe("female");
  Storage.importStoryCards(adventure.id, lynxCards([native("Other")]));
  expect(current().gender).toBe("none");
  expect(Object.values(Storage.getAdventureById(adventure.id)!.storyCards)).toHaveLength(1);
  expect(lynxCards([{ ...native("Male"), type: "location" }])[0]).not.toHaveProperty("gender");
  expect(lynxCards([{ ...raw, type: "character", structuredData: { fields: [{ key: "Gender", value: "Female" }] } }])[0]?.gender).toBe("female");
});
it("loads cards using absolute authenticated URLs in the extension context", async () => {
  vi.stubGlobal("location", { hostname: "lynxcatai.com", pathname: "/plays/play-123" });
  const requests: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
    const parsed = new URL(url); // Firefox's extension fetch rejects relative URLs.
    expect(parsed.origin).toBe("https://lynxcatai.com");
    expect(options.credentials).toBe("include");
    requests.push(parsed.pathname);
    return { ok: true, json: async () => parsed.pathname.endsWith("/elements")
      ? { dynamicCards: [{ ...raw, type: "character" }] }
      : { run: { id: "play-123", storyId: "story-123", title: "Test" } } };
  }));
  await refreshLynxCards();
  expect(requests.sort()).toEqual(["/api/runs/play-123", "/api/runs/play-123/elements"]);
  expect(get(lynxImportError)).toBe("");
  expect(get(aidDetected).cards).toHaveLength(1);
});
