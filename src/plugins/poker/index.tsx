/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated, XielQ, Kosero, larei and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { makeRange } from "@components/PluginSettings/components";
import { Devs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import { sleep } from "@utils/misc";
import { ModalAPI } from "@utils/modal";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { Button, ChannelRouter, ChannelStore, ComponentDispatch, PrivateChannelsStore, RelationshipStore, UserStore } from "@webpack/common";
import { Message, User } from "discord-types/general";

import managedStyle from "./style.css?managed";

const NativeHelper = VencordNative.pluginHelpers.PokeR as PluginNative<typeof import("./native")>;
const POKE_MESSAGE = "%s just poked you! Install the 'PokeR' Vencord plugin to see pokes and poke back.";

type UserExtended = User & {
  globalName: string;
};

// yoinked from moyai plugin
interface IMessageCreate {
  type: "MESSAGE_CREATE";
  optimistic: boolean;
  isPushNotification: boolean;
  channelId: string;
  message: Message;
}

function formatPokeMessage(authorId: string) {
  return POKE_MESSAGE.replace("%s", `<@${authorId}>`);
}

function didIPoked(message: Message) {
  const fromMe = message.content === formatPokeMessage(UserStore.getCurrentUser().id);
  if (message.content !== formatPokeMessage(message.author.id) && !fromMe) return null; // not a poke message
  return fromMe;
}

const settings = definePluginSettings({
  ignoredUsers: {
    type: OptionType.STRING,
    description: "Comma-separated list of user IDs to ignore pokes from",
    default: "",
    placeholder: "209621571088678912, 1154585783529910292, 748539900793716887, ..."
  },
  focusOnPoke: {
    type: OptionType.BOOLEAN,
    description: "Focus on the window when poked",
    default: true,
  },
  allowPokesFromUnknown: {
    type: OptionType.BOOLEAN,
    description: "Allow pokes from users not in your friends list",
    default: false,
  },
  intensity: {
    type: OptionType.SLIDER,
    description: "The intensity of the poke (higher = more intense)",
    markers: makeRange(0, 10, 1),
    stickToMarkers: false,
    default: 5,
  },
  duration: {
    type: OptionType.SLIDER,
    description: "The duration of the poke (in ms)",
    markers: makeRange(0, 1000, 100),
    stickToMarkers: false,
    default: 500,
  },
});

export default definePlugin({
  name: "PokeR",
  description: "Poke your friends on Discord, just like the old MSN days!",
  authors: [Devs.XielQ, Devs.Kosero, Devs.larei],
  settings,
  managedStyle,

  flux: {
    async MESSAGE_CREATE({ optimistic, type, message }: IMessageCreate) {
      if (optimistic || type !== "MESSAGE_CREATE") return;
      if (message.state === "SENDING") return;
      if (!message.content) return;
      const channel = ChannelStore.getChannel(message.channel_id);
      if (!channel.isDM()) return; // you can only poke in DMs
      if (UserStore.getCurrentUser().id === message.author.id) return; // you can't poke yourself!
      if (settings.store.ignoredUsers.split(",").map(id => id.trim()).includes(message.author.id)) return; // ignore pokes from ignored users
      if (!settings.store.allowPokesFromUnknown && !RelationshipStore.isFriend(message.author.id)) return; // ignore pokes from unknown users
      if (message.content !== formatPokeMessage(message.author.id)) return; // not a poke message
      NativeHelper.pokeWindow();
      if (await NativeHelper.shouldWait()) {
        await sleep(200); // wait for window to focus
        ComponentDispatch.dispatch("SHAKE_APP", {
          duration: settings.store.duration,
          intensity: settings.store.intensity,
        });
      }
    },
  },

  patches: [
    // profile popup
    {
      find: /"footer",{className:\i.footer,children(.*)user:\i,/,
      replacement: {
        match: /children:\[\i&&.*user:(\i).*\]/,
        replace: "$&.concat([$self.PokeButton($1)])"
      }
    },

    // full profile
    {
      find: /hasIncomingPendingGameFriends:\i,hasOutgoingPendingGameFriends:\i}\)/,
      replacement: {
        match: /,?\(0,\i.jsx\)\(\i.\i,{userId:(\i.id),onClose:\i}\)(.)/g,
        replace: (match, id, type) => {
          const isArray = type === "]";
          const result = `${!isArray ? "[" : ""}${match.slice(0, -1)}].concat([$self.PokeButton(${id})])${!isArray ? type : ""}`;
          return result;
        }
      },
      all: true
    },

    // render pokes in message
    {
      find: "#{intl::MESSAGE_EDITED}",
      replacement: {
        match: /(\("div",\{id:.+?children:\[.*?)(\i\((\i),\i\)),/,
        replace: "$1 $self.renderMessage($3, $2),"
      }
    },

    // render mention correctly
    {
      find: /\("ChatMessage"\)/,
      replacement: {
        match: /let \i,{id:\i,message:(\i),message:{id:\i}.*?}=\i/,
        replace: "$&;$1.mentioned=$self.renderMention($1)"
      }
    }
  ],

  renderMention(message: Message) {
    const byMe = didIPoked(message);
    if (byMe === null) return message.mentioned; // not a poke message
    return !byMe;
  },

  renderMessage(message: Message, reactContent: React.ReactNode) {
    const fromMe = didIPoked(message);
    if (message.content !== formatPokeMessage(message.author.id) && !fromMe) return reactContent; // render the original message
    const channelUser = UserStore.getUser(ChannelStore.getChannel(message.channel_id).recipients[0]) as UserExtended;

    return (
      <>
        {fromMe ? (
          <>
            you poked {channelUser.globalName}!
          </>
        ) : (
          <>
            {message.author.username} poked you!
            {this.PokeButton(message.author, "Poke Back")}
          </>
        )}
      </>
    );
  },

  async onPokeClick(user: User) {
    const channelId = ChannelStore.getDMFromUserId(user.id) ?? await PrivateChannelsStore.openPrivateChannel({ recipientIds: [user.id] });
    ChannelRouter.transitionToChannel(channelId);
    const message = formatPokeMessage(UserStore.getCurrentUser().id);
    sendMessage(channelId, { content: message });
    // close modal popup if it exists
    ModalAPI.closeAllModals();
    // todo: close profile popup if it exists
  },

  PokeButton(user: User | string, label: string = "Poke") {
    if (typeof user === "string") {
      user = UserStore.getUser(user);
      if (!user) return null;
    }
    if (user.bot) return null; // you can't poke bots
    if (user.id === UserStore.getCurrentUser().id) return null; // you can't poke yourself!
    if (settings.store.ignoredUsers.split(",").map(id => id.trim()).includes(user.id)) return null; // ignore pokes from ignored users

    return (
      <Button
        sizes={Button.Sizes.TINY}
        color={Button.Colors.PRIMARY}
        style={{ alignSelf: "stretch", height: "auto", minHeight: "auto" }}
        onClick={() => this.onPokeClick(user)}
      >
        {label}
      </Button>
    );
  }

});
