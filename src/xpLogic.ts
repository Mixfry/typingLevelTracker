export function getRequiredXpForNextLevel(level: number): number {
  return 100 + Math.pow(Math.floor(level / 5), 3);
}

// プログレスバー
export function createProgressBar(percentage: number, width: number = 10): string {
  const filledCount = Math.round((percentage / 100) * width);
  const emptyCount = width - filledCount;

  const filledChar = '■';
  const emptyChar = '□';

  return `[${filledChar.repeat(filledCount)}${emptyChar.repeat(emptyCount)}]`;
}
