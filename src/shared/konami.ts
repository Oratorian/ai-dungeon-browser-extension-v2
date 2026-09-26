const code = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

/** Rolling suffix also recognizes the code after an extra leading arrow press. */
export function createKonamiCode() {
  let keys: string[] = [];
  return (key: string, reset = false): boolean => {
    if (reset) { keys = []; return false; }
    keys = [...keys, key.length === 1 ? key.toLowerCase() : key].slice(-code.length);
    if (!code.every((value, index) => keys[index] === value)) return false;
    keys = [];
    return true;
  };
}
