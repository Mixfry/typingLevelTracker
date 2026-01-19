import * as vscode from 'vscode';
import { getRequiredXpForNextLevel, createProgressBar } from './extension';

const KEY_LEVEL = 'tlt_level';
const KEY_CURRENT_XP = 'tlt_current_xp';
const KEY_TOTAL_XP = 'tlt_total_xp';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  console.log('Typing Level Tracker is active!');

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'typingLevelTracker.showDetails';
  context.subscriptions.push(statusBarItem);

  updateStatusBar(context);
  statusBarItem.show();

  const changeDocListener = vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.contentChanges.length > 0) {
      processTyping(event.contentChanges, context);
    }
  });
  context.subscriptions.push(changeDocListener);

  const showDetailsCommand = vscode.commands.registerCommand('typingLevelTracker.showDetails', () => {
    showLevelDetails(context);
  });
  context.subscriptions.push(showDetailsCommand);
}

function processTyping(changes: readonly vscode.TextDocumentContentChangeEvent[], context: vscode.ExtensionContext) {
  let addedChars = 0;
  for (const change of changes) {
    if (change.text.length > 0) {
      addedChars += change.text.length;
    }
  }

  if (addedChars === 0) { return; }

  let level = context.globalState.get<number>(KEY_LEVEL, 1);
  let currentXp = context.globalState.get<number>(KEY_CURRENT_XP, 0);
  let totalXp = context.globalState.get<number>(KEY_TOTAL_XP, 0);

  currentXp += addedChars;
  totalXp += addedChars;

  let requiredXp = getRequiredXpForNextLevel(level);

  while (currentXp >= requiredXp) {
    currentXp -= requiredXp;
    level++;
    requiredXp = getRequiredXpForNextLevel(level);
    vscode.window.setStatusBarMessage(`Level Up! You reached Lv ${level}!`, 5000);
  }

  context.globalState.update(KEY_LEVEL, level);
  context.globalState.update(KEY_CURRENT_XP, currentXp);
  context.globalState.update(KEY_TOTAL_XP, totalXp);

  updateStatusBar(context);
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

  vscode.window.showInformationMessage(
    `Level ${level}`,
    {
      modal: true, detail:
        `XP: ${currentXp} / ${requiredXp} (${percentage}%)\n` +
        `Total XP: ${totalXp}`
    },
    "Close"
  );
}

export function deactivate() { }
