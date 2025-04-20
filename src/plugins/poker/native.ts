/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated, XielQ, Kosero, larei and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BrowserWindow } from "electron";

const INTENSITY = 5;
const DURATION = 500;

export async function pokeWindow() {
  // trick to get the actual discord window
  const currentWindow = BrowserWindow.getAllWindows().find(win => win.eventNames().includes("page-title-updated")) ?? BrowserWindow.getAllWindows()[0];
  if (!currentWindow) return;
  const originalPosition = currentWindow.getPosition();
  const startTime = Date.now();
  let shakeIntervalId: NodeJS.Timeout | null = null;

  shakeIntervalId = setInterval(() => {
    const elapsedTime = Date.now() - startTime;

    // stop poking when time is elapsed or window is closed
    if (elapsedTime >= DURATION || !currentWindow || currentWindow.isDestroyed()) {
      clearInterval(shakeIntervalId!);
      // restore original position
      // if the window is closed, we don't need to restore the position
      if (currentWindow && !currentWindow.isDestroyed()) {
        currentWindow.setPosition(originalPosition[0], originalPosition[1]);
      }
      return;
    }

    // calculate random delta for x and y
    const deltaX = Math.round((Math.random() * 2 - 1) * INTENSITY);
    const deltaY = Math.round((Math.random() * 2 - 1) * INTENSITY);

    // calculate new position
    const newX = originalPosition[0] + deltaX;
    const newY = originalPosition[1] + deltaY;

    // set new position
    if (currentWindow && !currentWindow.isDestroyed()) {
      currentWindow.setPosition(newX, newY);
    } else {
      // if the window is closed, we don't need to restore the position
      clearInterval(shakeIntervalId!);
    }

  }, 50);
}
