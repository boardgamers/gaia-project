import { Faction } from "@gaia-project/engine";
import { factionArt } from "./data/faction-art";
import { factionColor } from "./graphics/utils";
type ChatMessage = { _id?: string; author?: string; text: string; createdAt?: string; playerIndex?: number };
type ChatEmitter = {
  on: (event: string, fn: (data: any) => void) => unknown;
  emit: (event: string, data: any) => unknown;
};
export function mountGameChat(emitter: ChatEmitter, host: Element): void {
  const panel = document.createElement("details");
  panel.className = "bgs-game-chat";
  panel.open = true;
  panel.innerHTML =
    '<summary>Chat</summary><div class="chat-messages" role="log" aria-label="Game chat"></div><div class="chat-composer"><input type="text" aria-label="Chat message" placeholder="Message…" autocomplete="off"><button type="button">Send</button></div><div class="chat-status" role="status"></div>';
  const style = document.createElement("style");
  style.textContent = `
.bgs-game-chat{box-sizing:border-box;font-family:inherit;font-size:14px;line-height:1.45;width:calc(100% - 30px);max-width:760px;border:1px solid var(--ui-border);border-radius:2px;margin:8px 15px;padding:0 8px 8px;background:var(--ui-surface);color:var(--ui-text)}
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
.bgs-game-chat .chat-status{font-size:12px;margin-top:6px}
.bgs-game-chat .chat-status:empty{display:none}
.chat-shortcut{position:fixed;left:16px;bottom:max(16px,env(safe-area-inset-bottom));z-index:900;padding:7px 12px;border:1px solid #6a8589;border-radius:3px;background:#203a45;color:#fff;font:600 14px Arial,sans-serif;cursor:pointer;box-shadow:0 2px 6px #0003}
.chat-shortcut[hidden]{display:none}
.chat-shortcut:hover{background:#315966}
.chat-shortcut:focus-visible{outline:2px solid #fff;outline-offset:2px}

`;
  panel.append(style);
  const slot = host.querySelector(".chat-host");
  if (slot) slot.append(panel);
  else host.insertAdjacentElement("afterend", panel);
  const list = panel.querySelector(".chat-messages") as HTMLDivElement;
  const input = panel.querySelector("input") as HTMLInputElement;
  const button = panel.querySelector("button") as HTMLButtonElement;
  const status = panel.querySelector(".chat-status") as HTMLDivElement;
  let messages: ChatMessage[] = [];
  let players: { id: number; name: string; faction?: string }[] = [];
  let localPlayer: number | undefined;
  let avatars: string[] = [];
  emitter.on("avatars", (data) => {
    avatars = data || [];
    render();
  });
  emitter.on("state", (state) => {
    players = (state?.players || []).map((p: any, index: number) => ({ ...p, id: index }));
    render();
  });
  emitter.on("player", (player) => {
    localPlayer = player?.index;
    render();
  });
  let canSend = false;
  let disabled = false;
  let reason = "Chat is connecting…";
  let pending: { id: string; text: string } | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let readTimer: ReturnType<typeof setTimeout> | undefined;
  let watermark = "";
  let candidate = "";
  let following = true;
  const unread = new Set<string>();
  const summary = panel.querySelector("summary") as HTMLElement;
  const shortcut = document.createElement("button");
  shortcut.type = "button";
  shortcut.className = "chat-shortcut";
  shortcut.hidden = true;
  panel.insertAdjacentElement("afterend", shortcut);
  let chatVisible = false;
  function updateShortcut(): void {
    const count = unread.size;
    const label = count ? `Chat · ${count} unread` : "Chat";
    shortcut.textContent = label;
    shortcut.setAttribute("aria-label", `Open ${label}`);
    summary.textContent = label;
    shortcut.hidden = chatVisible;
  }
  shortcut.onclick = () => {
    panel.open = true;
    requestAnimationFrame(() => {
      const firstUnread = Array.from(list.children).find((row) => unread.has((row as HTMLElement).dataset.id || ""));
      if (firstUnread) firstUnread.scrollIntoView({ block: "center" });
      else panel.scrollIntoView({ block: "center" });
      summary.focus({ preventScroll: true });
      read();
    });
  };
  const visibility = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.target === panel) {
          chatVisible =
            entry.isIntersecting &&
            entry.intersectionRect.height >= Math.min(panel.open ? 80 : 20, entry.boundingClientRect.height);
        }
      }
      updateShortcut();
      read();
    },
    { threshold: Array.from({ length: 21 }, (_, i) => i / 20) }
  );
  visibility.observe(panel);
  function controls(): void {
    button.disabled = !canSend || disabled || !!pending || !input.value.trim();
    input.disabled = !canSend || disabled;
  }
  function read(): void {
    if (!panel.open || document.visibilityState !== "visible" || !document.hasFocus()) {
      return;
    }
    const bounds = list.getBoundingClientRect();
    const visible = Array.from(list.children).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom <= Math.min(bounds.bottom, window.innerHeight) + 1 && r.top >= Math.max(bounds.top, 0);
    });
    for (const row of visible) unread.delete((row as HTMLElement).dataset.id || "");
    updateShortcut();
    const id = (visible[visible.length - 1] as HTMLElement)?.dataset.id || "";
    if (!/^[a-f0-9]{24}$/i.test(id) || id.toLowerCase() <= watermark) {
      return;
    }
    candidate = candidate > id.toLowerCase() ? candidate : id.toLowerCase();
    if (!readTimer) {
      readTimer = setTimeout(() => {
        readTimer = undefined;
        if (panel.open && document.visibilityState === "visible" && document.hasFocus() && candidate > watermark) {
          watermark = candidate;
          emitter.emit("chat:read", { messageId: watermark });
        }
      }, 500);
    }
  }
  function render(): void {
    list.textContent = "";
    for (const message of messages) {
      const row = document.createElement("article");
      row.dataset.id = message._id || "";
      const author = document.createElement("strong");
      author.textContent = message.author || "Game";
      const index =
        message.playerIndex ??
        (message.author === "You" ? localPlayer : players.find((p) => p.name === message.author)?.id);
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
        row.append(portrait);
      }
      row.append(author, document.createTextNode(" "), document.createTextNode(message.text));
      if (message.createdAt) {
        const time = document.createElement("time");
        const date = new Date(message.createdAt);
        if (!isNaN(date.getTime())) {
          time.textContent = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          time.title = date.toLocaleString();
          row.append(time);
        }
      }

      list.append(row);
    }
    if (following) {
      list.scrollTop = list.scrollHeight;
    }
    updateShortcut();
    read();
  }
  emitter.on("chat:messages", (data: ChatMessage[]) => {
    messages = data || [];
    render();
  });
  emitter.on("chat:appended", (data: ChatMessage[]) => {
    for (const message of data || []) {
      if (!message._id || !messages.some((m) => m._id === message._id)) {
        messages.push(message);
        const own = message.playerIndex !== undefined && message.playerIndex === localPlayer;
        if (message._id && !own && message.author !== "You") unread.add(message._id);
      }
    }
    render();
  });
  emitter.on("chat:updated", (data: ChatMessage[]) => {
    for (const message of data || []) {
      const index = messages.findIndex((m) => m._id === message._id);
      if (index >= 0) {
        messages[index] = message;
      }
    }
    render();
  });
  emitter.on("chat:deleted", (ids: string[]) => {
    messages = messages.filter((m) => !ids.includes(m._id || ""));
    ids.forEach((id) => unread.delete(id));
    render();
  });
  emitter.on("chat:disabled", (value: boolean) => {
    disabled = value;
    status.textContent = value ? "Chat disabled" : reason;
    controls();
  });
  emitter.on("chat:state", (value: { canSend: boolean; reason?: string }) => {
    canSend = value.canSend;
    reason = canSend
      ? ""
      : (
          {
            "not-logged-in": "Sign in to chat",
            "not-confirmed": "Confirm your account to chat",
            "not-a-player": "Only players can send messages",
            "chat-disabled": "Chat disabled",
            "no-game": "Chat will be available when the game starts",
          } as Record<string, string>
        )[value.reason || ""] || "Chat is read-only";
    status.textContent = reason;
    controls();
  });
  emitter.on("chat:result", (result: { requestId: string; ok: boolean; error?: string }) => {
    if (pending?.id !== result.requestId) {
      return;
    }
    if (timeout) {
      clearTimeout(timeout);
    }
    if (result.ok && input.value === pending.text) {
      input.value = "";
    }
    status.textContent = result.ok ? "" : result.error || "Message could not be sent. Your draft is kept.";
    pending = undefined;
    controls();
  });
  function sendMessage(): void {
    if (button.disabled) {
      return;
    }
    pending = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: input.value };
    controls();
    status.textContent = "Sending…";
    const sending = pending;
    timeout = setTimeout(() => {
      if (pending) {
        pending = undefined;
        status.textContent = "No confirmation received. Check the conversation before sending again.";
        controls();
      }
    }, 20000);
    emitter.emit("chat:send", { text: sending.text.trim(), requestId: sending.id });
  }
  button.onclick = sendMessage;
  input.oninput = controls;
  input.onkeydown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      event.stopPropagation();
      sendMessage();
    }
  };
  list.onscroll = () => {
    following = list.scrollHeight - list.scrollTop - list.clientHeight < 32;
    read();
  };
  panel.ontoggle = () => {
    if (panel.open && following) {
      list.scrollTop = list.scrollHeight;
    }
    read();
  };
  window.addEventListener("scroll", read, { passive: true });
  window.addEventListener("focus", read);
  window.addEventListener("resize", read);
  const sizing = new ResizeObserver(() => {
    updateShortcut();
    read();
  });
  sizing.observe(panel);
  document.addEventListener("visibilitychange", read);
  status.textContent = reason;
  controls();
}

export function installLocalChat(emitter: ChatEmitter): void {
  emitter.emit("chat:state", { canSend: true });
  emitter.emit("chat:messages", [
    {
      _id: "000000000000000000000001",
      author: "Playtest",
      text: "Local chat preview. Messages stay in this browser.",
      createdAt: new Date().toISOString(),
    },
  ]);
  // Give preview messages a stable seat without locking the pass-and-play game to it.
  let next = 2;
  emitter.on("chat:send", ({ text, requestId }) => {
    emitter.emit("chat:appended", [
      {
        _id: (next++).toString(16).padStart(24, "0"),
        author: "You",
        playerIndex: 0,
        text,
        createdAt: new Date().toISOString(),
      },
    ]);
    emitter.emit("chat:result", { requestId, ok: true });
  });
}
