import * as vscode from 'vscode';
import { getRequiredXpForNextLevel, createProgressBar } from './xpLogic';

const KEY_LEVEL = 'tlt_level';
const KEY_CURRENT_XP = 'tlt_current_xp';
const KEY_TOTAL_XP = 'tlt_total_xp';
const KEY_INPUT_COUNT = 'tlt_input_count';
const KEY_SPACE_COUNT = 'tlt_space_count';
const KEY_DELETE_COUNT = 'tlt_delete_count';
const KEY_ENTER_COUNT = 'tlt_enter_count';
const KEY_SAVE_COUNT = 'tlt_save_count';
const KEY_LANG_XP = 'tlt_lang_xp';

let statusBarItem: vscode.StatusBarItem;
let lastTypedChar = '';
let consecutiveRepeats = 0;

export function activate(context: vscode.ExtensionContext) {
  console.log('Typing Level Tracker is active!');

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'typingLevelTracker.showDetails';
  context.subscriptions.push(statusBarItem);

  updateStatusBar(context);
  statusBarItem.show();

  const changeDocListener = vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.contentChanges.length > 0) {
      processTyping(event.contentChanges, context, event.document.languageId);
    }
  });
  context.subscriptions.push(changeDocListener);

  const saveDocListener = vscode.workspace.onDidSaveTextDocument(() => {
    incrementStat(context, KEY_SAVE_COUNT);
  });
  context.subscriptions.push(saveDocListener);

  const showDetailsCommand = vscode.commands.registerCommand('typingLevelTracker.showDetails', () => {
    showLevelDetails(context);
  });
  context.subscriptions.push(showDetailsCommand);
}

function incrementStat(context: vscode.ExtensionContext, key: string, amount: number = 1) {
  const current = context.globalState.get<number>(key, 0);
  context.globalState.update(key, current + amount);
}

function incrementLangXp(context: vscode.ExtensionContext, langId: string, amount: number) {
  const currentData = context.globalState.get<{ [key: string]: number }>(KEY_LANG_XP, {});
  if (!currentData[langId]) {
    currentData[langId] = 0;
  }
  currentData[langId] += amount;
  context.globalState.update(KEY_LANG_XP, currentData);
}

function processTyping(changes: readonly vscode.TextDocumentContentChangeEvent[], context: vscode.ExtensionContext, languageId: string) {
  for (const change of changes) {
    const text = change.text;
    const isDelete = text.length === 0 && change.rangeLength > 0;

    if (isDelete) {
      incrementStat(context, KEY_DELETE_COUNT);
      continue;
    }

    // ペーストで荒稼ぎできないように
    if (text.length > 3) {
      continue;
    }

    // 長押しで荒稼ぎできないように
    if (text === lastTypedChar) {
      consecutiveRepeats++;
    } else {
      lastTypedChar = text;
      consecutiveRepeats = 1;
    }

    if (consecutiveRepeats > 3) {
      continue;
    }

    incrementStat(context, KEY_INPUT_COUNT, text.length);
    incrementLangXp(context, languageId, text.length);

    const spaces = (text.match(/ /g) || []).length;
    if (spaces > 0) { incrementStat(context, KEY_SPACE_COUNT, spaces); }

    const newlines = (text.match(/\n/g) || []).length;
    if (newlines > 0) { incrementStat(context, KEY_ENTER_COUNT, newlines); }

    let level = context.globalState.get<number>(KEY_LEVEL, 1);
    let currentXp = context.globalState.get<number>(KEY_CURRENT_XP, 0);
    let totalXp = context.globalState.get<number>(KEY_TOTAL_XP, 0);
    const xpGain = text.length;
    currentXp += xpGain;
    totalXp += xpGain;

    let requiredXp = getRequiredXpForNextLevel(level);

    while (currentXp >= requiredXp) {
      currentXp -= requiredXp;
      level++;
      requiredXp = getRequiredXpForNextLevel(level);

      vscode.window.showInformationMessage(`Level Up! You reached Lv ${level}!`);
    }

    context.globalState.update(KEY_LEVEL, level);
    context.globalState.update(KEY_CURRENT_XP, currentXp);
    context.globalState.update(KEY_TOTAL_XP, totalXp);

    updateStatusBar(context);
  }
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function updateStatusBar(context: vscode.ExtensionContext) {
  const level = context.globalState.get<number>(KEY_LEVEL, 1);
  const currentXp = context.globalState.get<number>(KEY_CURRENT_XP, 0);
  const requiredXp = getRequiredXpForNextLevel(level);

  const percentage = Math.min((currentXp / requiredXp) * 100, 100);
  const bar = createProgressBar(percentage, 5);

  statusBarItem.text = `Lv ${level} ${bar} (${percentage.toFixed(1)}%)`;
  statusBarItem.tooltip = "Click to see details";
}

async function showLevelDetails(context: vscode.ExtensionContext) {
  const level = context.globalState.get<number>(KEY_LEVEL, 1);
  const currentXp = context.globalState.get<number>(KEY_CURRENT_XP, 0);
  const totalXp = context.globalState.get<number>(KEY_TOTAL_XP, 0);
  const requiredXp = getRequiredXpForNextLevel(level);
  const percentage = ((currentXp / requiredXp) * 100).toFixed(2);

  const inputCount = context.globalState.get<number>(KEY_INPUT_COUNT, 0);
  const spaceCount = context.globalState.get<number>(KEY_SPACE_COUNT, 0);
  const deleteCount = context.globalState.get<number>(KEY_DELETE_COUNT, 0);
  const enterCount = context.globalState.get<number>(KEY_ENTER_COUNT, 0);
  const saveCount = context.globalState.get<number>(KEY_SAVE_COUNT, 0);

  const langData = context.globalState.get<{ [key: string]: number }>(KEY_LANG_XP, {});
  const sortedLangs = Object.entries(langData)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  let langStats = '';
  if (sortedLangs.length > 0) {
    langStats = '\nTop 3 Lang (XP):\n' +
      sortedLangs.map(([lang, xp], index) => `${index + 1}. ${lang}: ${formatNumber(xp)}`).join('\n');
  }

  const detailText =
    `XP: ${formatNumber(currentXp)} / ${formatNumber(requiredXp)} (${percentage}%)\n` +
    `Total XP: ${formatNumber(totalXp)}\n\n` +
    `Statistics:\n` +
    `- Input: ${formatNumber(inputCount)}\n` +
    `- Space: ${formatNumber(spaceCount)}\n` +
    `- Delete: ${formatNumber(deleteCount)}\n` +
    `- Enter/Newline: ${formatNumber(enterCount)}\n` +
    `- Save: ${formatNumber(saveCount)}` +
    (langStats ? `\n${langStats}` : '');

  await vscode.window.showInformationMessage(
    `Level ${level}`,
    { modal: true, detail: detailText }
  );
}

export function deactivate() { }
