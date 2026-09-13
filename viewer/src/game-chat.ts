import type { ChatMessage } from "@boardgamers/protocol/chat";
import { ChatController, chatSegments } from "@boardgamers/protocol/chat";
import { mountChat } from "@boardgamers/protocol/chat/dom";
import type { ViewerEmitter } from "@boardgamers/protocol/viewer";
import { attachChat } from "@boardgamers/protocol/viewer";
import { Faction } from "@gaia-project/engine";
import { factionArt } from "./data/faction-art";
import { factionColor } from "./graphics/utils";
type ChatEmitter = Pick<ViewerEmitter<any, any>, "on" | "emit">;
export function mountGameChat(emitter: ViewerEmitter<any, any>, host: Element): () => void {
  const chat = new ChatController();
  const detach = attachChat(emitter, chat);
  const slot = host.querySelector<HTMLElement>(".chat-host") || document.createElement("div");
  if (!slot.parentElement) host.insertAdjacentElement("afterend", slot);
  const style = document.createElement("style");
  style.textContent = `
.bgs-game-chat{box-sizing:border-box;font-family:inherit;font-size:14px;line-height:1.45;width:calc(100% - 30px);max-width:760px;border:1px solid var(--ui-border);border-radius:2px;margin:8px 15px;padding:0 8px 8px;background:var(--ui-surface);color:var(--ui-text)}
.chat-host .bgs-game-chat{width:100%;margin:8px 0}
.bgs-game-chat summary{cursor:pointer;font-weight:600;border-bottom:1px solid var(--ui-border);padding:5px 8px;margin:0 -8px;background:var(--ui-surface-muted)}
.bgs-game-chat summary:hover{color:#126778}
.bgs-game-chat summary:focus-visible,.bgs-game-chat button:focus-visible{outline:2px solid #247d8c;outline-offset:3px}
.bgs-game-chat .chat-messages{max-height:250px;overflow:auto;overscroll-behavior:contain;margin:6px 0 8px}
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
.chat-suggestions{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.chat-suggestions:empty{display:none}
.chat-suggestions button[aria-pressed="true"]{outline:2px solid #527f89}
.bgs-game-chat .chat-status{font-size:12px;margin-top:6px}
.bgs-game-chat .chat-status:empty{display:none}
.chat-shortcut{position:fixed;left:16px;bottom:max(16px,env(safe-area-inset-bottom));z-index:900;padding:7px 12px;border:1px solid #6a8589;border-radius:3px;background:#203a45;color:#fff;font:600 14px Arial,sans-serif;cursor:pointer;box-shadow:0 2px 6px #0003}
.chat-shortcut[hidden]{display:none}
.chat-shortcut:hover{background:#315966}
.chat-shortcut:focus-visible{outline:2px solid #fff;outline-offset:2px}
.chat-shortcut-host{margin-left:auto;padding-left:8px;flex-shrink:0}
.chat-shortcut.chat-shortcut--inline{position:static;padding:3px 8px;border-color:#ffffff66;background:#ffffff15;color:inherit;box-shadow:none;font-size:12px;line-height:20px;white-space:nowrap}
@media(max-width:767px){
  .chat-shortcut{bottom:calc(var(--chat-footer-height,0px) + max(16px,env(safe-area-inset-bottom)))}
  .bgs-game-chat .chat-messages{max-height:clamp(48px,calc(100dvh - var(--chat-footer-height,0px) - 120px),250px)}
}

`;
  slot.append(style);
  let players: { id: number; name: string; color?: string; faction?: string }[] = [];
  let localPlayer: number | undefined;
  let avatars: string[] = [];
  let chatVisible = false;
  const shortcut = document.createElement("button");
  shortcut.type = "button";
  shortcut.className = "chat-shortcut";
  shortcut.hidden = true;
  slot.append(shortcut);
  const footer = host.querySelector(".mobile-sticky-actions-spacer");
  function viewport() {
    return { bottom: Math.max(0, window.innerHeight - (footer?.getBoundingClientRect().height || 0)) };
  }
  const view = mountChat(slot, {
    chat,
    styles: false,
    openPlayer: (index) => emitter.emit("player:clicked", { index }),
    renderAuthor,
    onVisibilityChange(visible) {
      chatVisible = visible;
      updateShortcut();
    },
    viewport,
  });
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
  function updateShortcut() {
    const count = chat.unread;
    const label = count ? `Chat · ${count} unread` : "Chat";
    const barSlot = window.innerWidth < 768 ? host.querySelector(".mobile-sticky-actions .chat-shortcut-host") : null;
    const destination = barSlot || slot;
    if (shortcut.parentElement !== destination) destination.append(shortcut);
    shortcut.classList.toggle("chat-shortcut--inline", !!barSlot);
    const text = barSlot && count ? `Chat · ${count}` : label;
    if (shortcut.textContent !== text) shortcut.textContent = text;
    shortcut.hidden = !barSlot && chatVisible;
    shortcut.setAttribute("aria-label", `Open ${label}`);
  }
  shortcut.onclick = () => {
    view.open();
  };
  const dispose = [
    detach,
    chat.subscribe(updateShortcut),
    emitter.on("state", (state) => {
      players = (state?.players || []).map((player: any, index: number) => ({ ...player, id: index }));
      view.refresh();
    }),
    emitter.on("gamelog", ({ data }: any) => {
      if (data?.state) {
        players = (data.state.players || []).map((player: any, index: number) => ({ ...player, id: index }));
        view.refresh();
      }
    }),
    emitter.on("player", (player) => {
      localPlayer = player?.index;
      view.refresh();
    }),
  ];
  dispose.push(
    emitter.on("avatars", (data) => {
      avatars = data;
      view.refresh();
    })
  );
  // The action bar is mounted and removed as turns change.
  window.addEventListener("resize", updateShortcut);
  dispose.push(() => window.removeEventListener("resize", updateShortcut));
  const mutation = new MutationObserver(updateShortcut);
  mutation.observe(host, { childList: true, subtree: true });
  const resize = new ResizeObserver(() => {
    view.refresh();
    updateShortcut();
  });
  if (footer) resize.observe(footer);
  dispose.push(
    () => mutation.disconnect(),
    () => resize.disconnect()
  );
  return () => {
    dispose.forEach((cleanup) => cleanup());
    view.destroy();
    shortcut.remove();
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
