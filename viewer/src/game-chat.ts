import type { ChatMessage } from "@boardgamers/protocol/chat";
import { ChatController, chatSegments } from "@boardgamers/protocol/chat";
import { mountChat } from "@boardgamers/protocol/chat/dom";
import type { ViewerEmitter } from "@boardgamers/protocol/viewer";
import { attachChat } from "@boardgamers/protocol/viewer";
import { Faction } from "@gaia-project/engine";
import { factionArt } from "./data/faction-art";
import { factionColor } from "./graphics/utils";
import { loadLocale, resolveLocale, translateText } from "./localization";
type ChatEmitter = Pick<ViewerEmitter<any, any>, "on" | "emit">;
export function mountGameChat(emitter: ViewerEmitter<any, any>, host: Element): () => void {
  const chat = new ChatController();
  const detach = attachChat(emitter, chat);
  const style = document.createElement("style");
  style.textContent = `
.bgs-game-chat{box-sizing:border-box;font-family:inherit;font-size:14px;line-height:1.45;width:calc(100% - 30px);max-width:760px;border:1px solid var(--ui-border);border-radius:2px;margin:8px 15px;padding:0 8px 8px;background:var(--ui-surface);color:var(--ui-text)}
.bgs-game-chat summary{cursor:pointer;font-weight:600;border-bottom:1px solid var(--ui-border);padding:5px 8px;margin:0 -8px;background:var(--ui-surface-muted)}
.bgs-game-chat summary:hover{color:#126778}
.bgs-game-chat summary:focus-visible,.bgs-game-chat button:focus-visible{outline:2px solid #247d8c;outline-offset:3px}
.bgs-game-chat .chat-day{display:flex;align-items:center;gap:8px;margin:12px 0 6px;font-size:.85em;opacity:.8}
.bgs-game-chat .chat-day::before,.bgs-game-chat .chat-day::after{content:"";flex:1;border-top:1px solid currentColor;opacity:.3}
.bgs-game-chat .chat-day time{margin:0;color:inherit;font-size:inherit}
.bgs-game-chat .chat-messages{max-height:250px;overflow:auto;margin:6px 0 8px}
.bgs-game-chat article{padding:4px 6px;border-bottom:1px solid var(--ui-border);white-space:pre-wrap;overflow-wrap:anywhere}
.chat-avatar{display:inline-block;vertical-align:middle;width:26px;height:26px;border-radius:50%;overflow:hidden;margin-right:6px;background:var(--ui-surface-muted)}
.chat-avatar img{height:100%;max-width:none}
.chat-avatar .player-avatar{width:100%;object-fit:cover}
.chat-avatar .faction-avatar{width:234%;transform:translateX(-3.4%)}
.bgs-game-chat article strong{padding:0 3px;font-weight:bold}
.bgs-game-chat article:nth-child(odd){background:var(--ui-surface-muted)}
.bgs-game-chat article:hover{background:var(--ui-surface-hover)}
.bgs-game-chat .faction-author{border-radius:2px;padding:1px 4px;box-shadow:inset 0 0 0 1px #0002}
.bgs-game-chat article:last-child{border-bottom:0}
.bgs-game-chat time{font-size:12px;color:var(--ui-text-muted);margin-left:8px;white-space:nowrap}
.bgs-game-chat .chat-composer{display:flex;gap:6px;align-items:center;margin:0}
.bgs-game-chat input{flex:1;min-width:0;box-sizing:border-box;height:30px;background:var(--ui-surface-muted);color:var(--ui-text);border:1px solid var(--ui-border-strong);border-radius:2px;padding:4px 7px;font:14px Arial,sans-serif}
.bgs-game-chat input::placeholder{color:var(--ui-text-muted)}
.bgs-game-chat input:focus{outline:2px solid #527f89;outline-offset:1px}
.bgs-game-chat button{box-sizing:border-box;height:30px;cursor:pointer;border:1px solid #7f8c8d;border-radius:3px;background:var(--ui-surface-raised);color:var(--ui-text);padding:3px 12px;font:14px Arial,sans-serif}
.bgs-game-chat button:hover:not(:disabled){background:var(--ui-surface-hover)}
.bgs-game-chat button:disabled{color:var(--ui-text-muted);border-color:var(--ui-border);background:var(--ui-surface-muted);cursor:default}
.bgs-game-chat .chat-mention{height:auto;padding:0 2px;border:0;background:transparent;color:inherit;font:inherit;font-weight:bold;text-decoration:underline}
.bgs-game-chat article a{color:inherit;text-decoration:underline}
.bgs-game-chat .chat-translate{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;width:24px;height:24px;min-height:0;padding:4px;margin-left:3px;border:0;background:transparent;color:inherit;opacity:.55}
.bgs-game-chat .chat-edit{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;width:24px;height:24px;min-height:0;padding:4px;margin-left:3px;border:0;background:transparent;color:inherit;opacity:.55}
.bgs-game-chat .chat-translate:hover,.bgs-game-chat .chat-translate:focus-visible{opacity:1}
.bgs-game-chat .chat-edit:hover,.bgs-game-chat .chat-edit:focus-visible{opacity:1}
.bgs-game-chat .chat-translate[aria-pressed="true"]{opacity:1;background:#75818d26}
.bgs-game-chat .chat-edit[aria-pressed="true"]{opacity:1;background:#75818d26}
.bgs-game-chat .chat-translate[aria-busy="true"]{background:transparent;cursor:wait}
.bgs-game-chat .chat-edit[aria-busy="true"]{background:transparent;cursor:wait}
.chat-suggestions{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.chat-suggestions:empty{display:none}
.chat-suggestions button[aria-pressed="true"]{outline:2px solid #527f89}
.bgs-game-chat .chat-editing{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;opacity:.85;padding:3px 0;flex-shrink:0}
.bgs-game-chat .chat-editing[hidden]{display:none}
.bgs-game-chat .chat-edit-cancel{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;min-height:0;padding:0;border:0;background:transparent;color:inherit;cursor:pointer}
.bgs-game-chat .chat-status{font-size:12px;margin-top:6px}
.bgs-game-chat .chat-status:empty{display:none}
.game-chat-button-host{display:inline-flex;flex-shrink:0;margin-left:auto}
.game-chat-button-host:empty{display:none}
.game-chat-button-host--desktop{margin-left:.4rem}
.game-chat-button-host--fallback{display:flex;justify-content:flex-end}
.game-chat-button{position:relative;display:inline-grid;place-items:center;flex-shrink:0;width:40px;height:40px;padding:7px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--ui-text-muted);cursor:pointer;line-height:1}
.game-chat-button[hidden],.game-chat-unread[hidden]{display:none}
.game-chat-button:hover,.game-chat-button:focus-visible{background:var(--ui-surface-hover);border-color:var(--ui-border);color:var(--ui-text)}
.game-chat-button:focus-visible{outline:2px solid #97c8ff;outline-offset:2px}
.game-chat-unread{position:absolute;right:0;top:0;min-width:17px;height:17px;padding:0 3px;border:2px solid var(--ui-bg);border-radius:10px;background:#f1c457;color:#18202a;font:700 10px/13px system-ui;text-align:center}
.game-chat-dialog{margin:auto;padding:16px;width:min(600px,calc(100vw - 24px));max-height:calc(100dvh - 24px);border:1px solid var(--ui-border);border-radius:12px;background:var(--ui-surface);color:var(--ui-text)}
.game-chat-dialog::backdrop{background:#0a172580}
.game-chat-dialog h2{margin:0 40px 12px 0;font-size:1.1rem}
.game-chat-dialog .game-chat-close{position:absolute;top:8px;right:8px;width:36px;height:36px;background:transparent;color:inherit;border:0;font-size:24px;cursor:pointer}
.game-chat-dialog .bgs-game-chat{width:100%;max-width:none;margin:0;padding:0;border:0}
.game-chat-dialog .bgs-game-chat summary{display:none}
.game-chat-dialog .chat-messages{max-height:min(440px,50dvh)}
@media(max-width:767px){
  .game-chat-button-host--mobile .game-chat-button{width:42px;height:42px;margin:-7px 0;color:inherit}
  .game-chat-button-host--mobile .game-chat-unread{border-color:var(--ui-banner-end)}
}

`;
  document.head.append(style);
  let locale = "en";
  let disposed = false;
  let players: { id: number; name: string; color?: string; faction?: string }[] = [];
  let localPlayer: number | undefined;
  let avatars: string[] = [];
  let chatNotifications = true;
  let analysis = false;
  let platformChat = false;
  let view: ReturnType<typeof mountChat> | undefined;
  let dialog: HTMLDialogElement | undefined;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "game-chat-button";
  button.setAttribute("translate", "no");
  button.hidden = true;
  button.innerHTML = `<svg viewBox="0 0 16 16" width="23" height="23" fill="currentColor" aria-hidden="true"><path d="M2.678 11.894a1 1 0 0 1 .287.801a10.97 10.97 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8.06 8.06 0 0 0 8 14c3.996 0 7-2.807 7-6c0-3.192-3.004-6-7-6S1 4.808 1 8c0 1.468.617 2.83 1.678 3.894zm-.493 3.905a21.682 21.682 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a9.68 9.68 0 0 1 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7s-3.582 7-8 7a9.06 9.06 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105z"/></svg>`;
  const badge = document.createElement("span");
  badge.className = "game-chat-unread";
  badge.setAttribute("aria-hidden", "true");
  badge.hidden = true;
  button.append(badge);

  function closeLocalChat() {
    dialog?.close();
    chat.setOpen(false);
  }
  function openLocalChat() {
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "game-chat-dialog";
      const title = document.createElement("h2");
      const close = document.createElement("button");
      close.type = "button";
      close.className = "game-chat-close";
      close.textContent = "×";
      close.onclick = closeLocalChat;
      dialog.append(title, close);
      host.append(dialog);
      dialog.addEventListener("close", () => chat.setOpen(false));
      dialog.addEventListener("keydown", (event) => event.stopPropagation());
      view = mountChat(dialog, {
        chat,
        styles: false,
        openPlayer: (index) => emitter.emit("player:clicked", { index }),
        renderAuthor,
      });
    }
    dialog.setAttribute("aria-label", translateText("Chat", locale));
    const title = dialog.querySelector("h2");
    if (title) title.textContent = translateText("Chat", locale);
    dialog.querySelector(".game-chat-close")?.setAttribute("aria-label", translateText("Close", locale));
    dialog.showModal();
    chat.setOpen(true);
    view?.refresh();
  }
  function renderAuthor(message: ChatMessage): Node {
    const author = document.createElement("strong");
    author.textContent = message.author || "Game";
    const index =
      message.playerIndex ??
      (message.author === "You" ? localPlayer : players.find((p) => p.name === message.author)?.id);
    const wrapper = document.createElement("span");
    const faction = players.find((p) => p.id === index)?.faction;
    if (faction && Object.values(Faction).includes(faction as Faction)) {
      const color = factionColor(faction as Faction);
      const channels = (color.slice(1).match(/../g) || []).map((hex) => {
        const value = parseInt(hex, 16) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      author.className = "faction-author";
      author.style.backgroundColor = color;
      author.style.color = luminance > 0.179 ? "#000" : "#fff";
    }
    const avatar = index !== undefined ? avatars[index] : undefined;
    const artwork = avatar || (faction && factionArt[faction]);
    if (artwork && /^(https?:|data:image\/|\/)/i.test(artwork)) {
      const portrait = document.createElement("span");
      portrait.className = "chat-avatar";
      const img = document.createElement("img");
      img.src = artwork;
      img.alt = "";
      img.className = avatar ? "player-avatar" : "faction-avatar";
      img.onerror = () => portrait.remove();
      portrait.append(img);
      wrapper.append(portrait);
    }
    wrapper.append(author);
    return wrapper;
  }
  function updateButton() {
    const count = chatNotifications ? chat.unread : 0;
    const sourceLabel = count ? `Chat · ${count} unread` : "Chat";
    const mobileSlot =
      window.innerWidth < 768 ? host.querySelector(".mobile-sticky-actions .game-chat-button-host--mobile") : null;
    const destination =
      mobileSlot ||
      host.querySelector(".game-chat-button-host--desktop") ||
      host.querySelector(".game-chat-button-host--fallback");
    if (destination && button.parentElement !== destination) destination.append(button);
    button.hidden = analysis || !chat.snapshot.enabled;
    const text = String(count);
    if (badge.textContent !== text) badge.textContent = text;
    badge.hidden = count === 0;
    button.title = translateText(sourceLabel, locale);
    button.setAttribute("aria-label", translateText(`Open ${sourceLabel}`, locale));
  }
  button.onclick = () => {
    if (platformChat) emitter.emit("chat:open");
    else openLocalChat();
  };
  const dispose = [
    detach,
    emitter.on("preferences", (preferences) => {
      chatNotifications = preferences.chatNotifications !== false;
      locale = resolveLocale(preferences.locale);
      void loadLocale(locale)
        .then(() => {
          if (!disposed) updateButton();
        })
        .catch(() => {});
      analysis = preferences.analysis === true;
      platformChat = preferences.platformChat === true;
      if (analysis || platformChat) closeLocalChat();
      if (platformChat && dialog) {
        view?.destroy();
        view = undefined;
        dialog.remove();
        dialog = undefined;
      }
      updateButton();
    }),
    chat.subscribe(updateButton),
    emitter.on("state", (state) => {
      players = (state?.players || []).map((player: any, index: number) => ({ ...player, id: index }));
      view?.refresh();
    }),
    emitter.on("gamelog", ({ data }: any) => {
      if (data?.state) {
        players = (data.state.players || []).map((player: any, index: number) => ({ ...player, id: index }));
        view?.refresh();
      }
    }),
    emitter.on("player", (player) => {
      localPlayer = player?.index;
      view?.refresh();
    }),
  ];
  dispose.push(
    emitter.on("avatars", (data) => {
      avatars = data;
      view?.refresh();
    })
  );
  // The action bar is mounted and removed as turns change.
  window.addEventListener("resize", updateButton);
  dispose.push(() => window.removeEventListener("resize", updateButton));
  const mutation = new MutationObserver(updateButton);
  mutation.observe(host, { childList: true, subtree: true });
  dispose.push(() => mutation.disconnect());
  return () => {
    disposed = true;
    dispose.forEach((cleanup) => cleanup());
    view?.destroy();
    dialog?.remove();
    button.remove();
    style.remove();
  };
}

export function installLocalChat(emitter: ChatEmitter): void {
  let seat = 0;
  let roster: { id: string; name: string; playerIndex: number }[] = [];
  emitter.on("player", (player) => {
    seat = player.index ?? 0;
  });
  emitter.on("state", (state) => {
    roster = (state?.players || []).map((player: any, index: number) => ({
      id: String(index),
      name: player.name || `Player ${index + 1}`,
      playerIndex: index,
    }));
    emitter.emit("chat:state", { canSend: true, mentions: roster.filter((player) => player.playerIndex !== seat) });
  });
  emitter.emit("chat:state", { canSend: true });
  emitter.emit("chat:messages", [
    {
      _id: "000000000000000000000001",
      type: "system",
      author: "Playtest",
      text: "Local chat preview. Messages stay in this browser.",
      createdAt: new Date().toISOString(),
    },
  ]);
  let next = 2;
  emitter.on("chat:send", ({ text, requestId }) => {
    emitter.emit("chat:appended", [
      {
        _id: (next++).toString(16).padStart(24, "0"),
        type: "text",
        author: "You",
        playerIndex: seat,
        text,
        segments: chatSegments(text, new Map(roster.map((player) => [player.name, player.id])), true),
        createdAt: new Date().toISOString(),
      },
    ]);
    emitter.emit("chat:result", { requestId, ok: true });
  });
}
