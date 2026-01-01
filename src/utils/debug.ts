export class Debug {
  static log(message: string, ...optionalParams: any[]) {
    console.log(`[Dungeon Extension v2] ${message}`, ...optionalParams);
  }

  static getAdventureId() {
    const match = window.location.pathname.match(/adventure\/([^\/]+)/);
    return match ? match[1] : "";
  }
}
