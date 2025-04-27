/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated, XielQ, Kosero, larei and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { RendererSettings } from "@main/settings";
import { BrowserWindow } from "electron";

interface PokerSettings {
  enabled: boolean;
  focusOnPoke: boolean;
  intensity: number;
  duration: number;
}

function getWindow() {
  // trick to get the actual discord window
  const currentWindow = BrowserWindow.getAllWindows().find(win => win.eventNames().includes("page-title-updated")) ?? BrowserWindow.getAllWindows()?.[0];
  if (!currentWindow || currentWindow.isDestroyed()) return null;
  return currentWindow;
}

export function shouldWait() {
  const currentWindow = getWindow();
  if (!currentWindow) return false;
  return currentWindow.isMaximized() || currentWindow.isFullScreen() || currentWindow.isMinimized();
}

export function pokeWindow() {
  const settings = RendererSettings.store.plugins?.PokeR as PokerSettings | undefined;
  if (!settings?.enabled) return;

  const intensity = settings?.intensity ?? 5;
  const duration = settings?.duration ?? 500;

  const currentWindow = getWindow();
  if (!currentWindow) return;

  if (settings.focusOnPoke) {
    try {
      currentWindow.show();
      currentWindow.focus();
    } catch {
      // window is closed
      return;
    }
  }

  const [posX, posY] = currentWindow.getPosition();
  const startTime = Date.now();
  let shakeIntervalId: NodeJS.Timeout | null = null;

  shakeIntervalId = setInterval(() => {
    if (!currentWindow || currentWindow.isDestroyed()) {
      clearInterval(shakeIntervalId!);
      return;
    }

    const elapsedTime = Date.now() - startTime;

    // stop poking when time is elapsed or window is closed
    if (elapsedTime >= duration || !currentWindow || currentWindow.isDestroyed()) {
      clearInterval(shakeIntervalId!);
      // restore original position
      // if the window is closed, we don't need to restore the position
      try {
        if (currentWindow && !currentWindow.isDestroyed()) {
          currentWindow.setPosition(posX, posY);
        }
      } catch {
        // idk
      }
      return;
    }

    // calculate random delta for x and y
    const deltaX = Math.round((Math.random() * 2 - 1) * intensity);
    const deltaY = Math.round((Math.random() * 2 - 1) * intensity);

    // calculate new position
    const newX = posX + deltaX;
    const newY = posY + deltaY;

    try {
      // set new position
      if (currentWindow && !currentWindow.isDestroyed()) {
        currentWindow.setPosition(newX, newY);
      } else {
        // if the window is closed, we don't need to restore the position
        clearInterval(shakeIntervalId!);
      }
    } catch {
      // if the window is closed, we don't need to restore the position
      clearInterval(shakeIntervalId!);
    }

  }, 50);
}
