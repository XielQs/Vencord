/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated, XielQ, Kosero, larei and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin, { PluginNative } from "@utils/types";
import { ChannelStore } from "@webpack/common";
import { Message } from "discord-types/general";

const NativeHelper = VencordNative.pluginHelpers.PokeR as PluginNative<typeof import("./native")>;

// yoinked from moyai plugin
export interface IMessageCreate {
  type: "MESSAGE_CREATE";
  optimistic: boolean;
  isPushNotification: boolean;
  channelId: string;
  message: Message;
}

export default definePlugin({
  name: "PokeR",
  description: "POKEEEEEEEEEER",
  authors: [Devs.XielQ, Devs.Kosero, Devs.larei],

  flux: {
    async MESSAGE_CREATE({ optimistic, type, message }: IMessageCreate) {
      if (optimistic || type !== "MESSAGE_CREATE") return;
      if (message.state === "SENDING") return;
      if (!message.content) return;
      const channel = ChannelStore.getChannel(message.channel_id);
      if (!channel.isDM()) return; // you can only poke in DMs
      if (message.content.toLowerCase() !== "poke") return;
      console.log("YOU GOT POKED");
      NativeHelper.pokeWindow();
    },
  },
});
