export function splitStringAt(string: string, pos: number) {
  return [string.slice(0, pos), string.slice(pos)];
}

export enum Position {
  Before = -1,
  After = 1,
}
