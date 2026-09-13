import type { ChatMessage } from "@boardgamers/protocol/chat";
import { ChatController, applyMention, chatSegments, mentionQueryAt } from "@boardgamers/protocol/chat";
import type { ViewerEmitter } from "@boardgamers/protocol/viewer";
import { attachChat } from "@boardgamers/protocol/viewer";
import { Faction } from "@gaia-project/engine";
import { factionArt } from "./data/faction-art";
import { factionColor } from "./graphics/utils";
type ChatEmitter = Pick<ViewerEmitter<any, any>, "on" | "emit">;
export function mountGameChat(emitter: ViewerEmitter<any, any>, host: Element): () => void {
  const chat = new ChatController();
  const detach = attachChat(emitter, chat);
  const cleanup: (() => void)[] = [detach];
  let disposed = false;
  const panel = document.createElement("details");
  panel.className = "bgs-game-chat";
  panel.open = true;
  panel.innerHTML =
    '<summary>Chat</summary><div class="chat-messages" role="log" aria-label="Game chat"></div><div class="chat-composer"><input type="text" aria-label="Chat message" placeholder="Message…" autocomplete="off"><button type="button">Send</button></div><div class="chat-status" role="status"></div>';
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
  panel.append(style);
  const slot = host.querySelector(".chat-host");
  const footer = host.querySelector(".mobile-sticky-actions-spacer");
  if (slot) slot.append(panel);
  else host.insertAdjacentElement("afterend", panel);
  const list = panel.querySelector(".chat-messages") as HTMLDivElement;
  const input = panel.querySelector("input") as HTMLInputElement;
  const button = panel.querySelector("button") as HTMLButtonElement;
  const status = panel.querySelector(".chat-status") as HTMLDivElement;
  let messages: readonly ChatMessage[] = [];
  let players: { id: number; name: string; faction?: string }[] = [];
  let localPlayer: number | undefined;
  let avatars: string[] = [];
  cleanup.push(
    emitter.on("avatars", (data) => {
      avatars = data || [];
      render();
    })
  );
  cleanup.push(
    emitter.on("state", (state) => {
      players = (state?.players || []).map((p: any, index: number) => ({ ...p, id: index }));
      render();
    })
  );
  cleanup.push(
    emitter.on("gamelog", ({ data }: any) => {
      if (data?.state) {
        players = (data.state.players || []).map((p: any, index: number) => ({ ...p, id: index }));
        render();
      }
    })
  );
  cleanup.push(
    emitter.on("player", (player) => {
      localPlayer = player?.index;
      render();
    })
  );
  let following = true;
  let unread: readonly string[] = [];
  const summary = panel.querySelector("summary") as HTMLElement;
  const shortcut = document.createElement("button");
  shortcut.type = "button";
  shortcut.className = "chat-shortcut";
  shortcut.hidden = true;
  panel.insertAdjacentElement("afterend", shortcut);
  function viewportBottom(): number {
    return Math.max(0, window.innerHeight - (footer?.getBoundingClientRect().height || 0));
  }
  function keepComposerVisible(): void {
    if (document.activeElement !== input) return;
    const bounds = input.getBoundingClientRect();
    const bottom = viewportBottom() - 8;
    if (bounds.bottom > bottom) window.scrollBy({ top: bounds.bottom - bottom });
    else if (bounds.top < 8) window.scrollBy({ top: bounds.top - 8 });
  }
  function updateShortcut(): void {
    const count = chat.unread;
    const label = count ? `Chat · ${count} unread` : "Chat";
    const barSlot = window.innerWidth < 768 ? host.querySelector(".mobile-sticky-actions .chat-shortcut-host") : null;
    const destination = barSlot || slot || (panel.parentElement as HTMLElement);
    if (shortcut.parentElement !== destination) destination.append(shortcut);
    shortcut.classList.toggle("chat-shortcut--inline", !!barSlot);
    const buttonLabel = barSlot ? (count ? `Chat · ${count}` : "Chat") : label;
    if (shortcut.textContent !== buttonLabel) shortcut.textContent = buttonLabel;
    shortcut.setAttribute("aria-label", `Open ${label}`);
    if (summary.textContent !== label) summary.textContent = label;
    const bounds = panel.getBoundingClientRect();
    const visibleHeight = Math.min(bounds.bottom, viewportBottom()) - Math.max(bounds.top, 0);
    shortcut.hidden =
      !barSlot &&
      bounds.height > 0 &&
      bounds.right > 0 &&
      bounds.left < window.innerWidth &&
      visibleHeight >= Math.min(panel.open ? 80 : 20, bounds.height);
  }
  shortcut.onclick = () => {
    panel.open = true;
    requestAnimationFrame(() => {
      const firstUnread = Array.from(list.children).find((row) =>
        unread.includes((row as HTMLElement).dataset.id || "")
      );
      if (firstUnread) {
        list.scrollTop +=
          firstUnread.getBoundingClientRect().top -
          list.getBoundingClientRect().top -
          list.clientHeight / 2 +
          firstUnread.clientHeight / 2;
      }
      const bounds = panel.getBoundingClientRect();
      // Scroll only the game document, leaving the embedding page in place.
      window.scrollBy({ top: bounds.top - Math.max(8, (viewportBottom() - bounds.height) / 2) });
      summary.focus({ preventScroll: true });
      read();
    });
  };
  const visibility = new IntersectionObserver(() => read(), {
    threshold: Array.from({ length: 21 }, (_, i) => i / 20),
  });
  visibility.observe(panel);
  function controls(): void {
    const state = chat.snapshot;
    input.disabled = !state.canSend || state.disabled;
    button.disabled = input.disabled || !!state.pending || !state.draft.trim();
    if (input.value !== state.draft) input.value = state.draft;
    const reasons: Record<string, string> = {
      "not-logged-in": "Sign in to chat",
      "not-confirmed": "Confirm your account to chat",
      "not-a-player": "Only players can send messages",
      "chat-disabled": "Chat disabled",
      "no-game": "Chat will be available when the game starts",
    };
    status.textContent =
      state.error ||
      (state.pending
        ? "Sending…"
        : state.disabled
          ? "Chat disabled"
          : !state.enabled
            ? "Chat is connecting…"
            : !state.canSend
              ? reasons[state.reason] || "Chat is read-only"
              : "");
  }
  function read(): void {
    updateShortcut();
    if (disposed || !panel.open || document.visibilityState !== "visible" || !document.hasFocus()) {
      return;
    }
    const bounds = list.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const bottom = Math.min(bounds.bottom, viewportBottom());
    const visible = Array.from(list.children).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom <= bottom + 1 && r.top >= Math.max(bounds.top, 0);
    });
    const id = (visible[visible.length - 1] as HTMLElement)?.dataset.id;
    if (id) chat.markRead(id);
  }
  function render(): void {
    const scrollTop = list.scrollTop;
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
      row.append(author, document.createTextNode(" "));
      appendMessage(row, message);
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
    } else list.scrollTop = scrollTop;
    updateShortcut();
    read();
  }
  function appendMessage(row: HTMLElement, message: ChatMessage): void {
    for (const segment of message.segments || [{ kind: "text", text: message.text }]) {
      if (segment.kind === "link") {
        const link = document.createElement("a");
        link.href = segment.url;
        link.textContent = segment.text;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        row.append(link);
      } else if (segment.kind === "mention") {
        const mention = document.createElement("button");
        mention.type = "button";
        mention.className = "chat-mention";
        mention.textContent = "@" + segment.name;
        const player = chat.snapshot.mentions.find((p) => p.id === segment.id);
        const index = player?.playerIndex;
        if (index !== undefined) mention.onclick = () => emitter.emit("player:clicked", { index });
        else mention.disabled = true;
        row.append(mention);
      } else row.append(document.createTextNode(segment.text));
    }
  }
  const suggestions = document.createElement("div");
  suggestions.className = "chat-suggestions";
  suggestions.setAttribute("aria-label", "Mention suggestions");
  (panel.querySelector(".chat-composer") as HTMLElement).insertAdjacentElement("afterend", suggestions);
  let selected = 0;
  let candidates: ReturnType<ChatController["suggestions"]> = [];
  let query: ReturnType<typeof mentionQueryAt> = null;
  function chooseMention(index: number): void {
    const person = candidates[index];
    if (!query || !person) return;
    const result = applyMention(input.value, query, person.name);
    chat.setDraft(result.text);
    input.focus();
    input.setSelectionRange(result.caret, result.caret);
    suggestions.replaceChildren();
    candidates = [];
    query = null;
  }
  function suggest(): void {
    query = mentionQueryAt(input.value, input.selectionStart ?? input.value.length);
    candidates = query ? chat.suggestions(query.query).slice(0, 6) : [];
    selected = Math.min(selected, Math.max(0, candidates.length - 1));
    suggestions.replaceChildren();
    candidates.forEach((candidate, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.textContent = "@" + candidate.name;
      option.setAttribute("aria-pressed", String(index === selected));
      option.onmousedown = (event) => event.preventDefault();
      option.onclick = () => chooseMention(index);
      suggestions.append(option);
    });
  }
  button.onclick = () => chat.submit();
  input.oninput = () => {
    selected = 0;
    chat.setDraft(input.value);
    suggest();
  };
  input.onclick = suggest;
  input.onkeydown = (event) => {
    if (event.isComposing) return;
    if (candidates.length && ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        candidates = [];
        suggestions.replaceChildren();
      } else if (event.key === "Enter" || event.key === "Tab") chooseMention(selected);
      else {
        selected = (selected + (event.key === "ArrowDown" ? 1 : candidates.length - 1)) % candidates.length;
        suggest();
      }
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      chat.submit();
    }
  };
  cleanup.push(
    chat.subscribe((state) => {
      const changed = messages !== state.messages;
      messages = state.messages;
      unread = state.unreadIds;
      controls();
      if (changed) render();
      else updateShortcut();
    })
  );
  list.onscroll = () => {
    following = list.scrollHeight - list.scrollTop - list.clientHeight < 32;
    read();
  };
  panel.ontoggle = () => {
    chat.setOpen(panel.open);
    if (!disposed && panel.open && following) {
      list.scrollTop = list.scrollHeight;
    }
    read();
  };
  window.addEventListener("scroll", read, { passive: true });
  window.addEventListener("focus", read);
  const resize = () => {
    keepComposerVisible();
    read();
  };
  window.addEventListener("resize", resize);
  cleanup.push(() => window.removeEventListener("resize", resize));
  input.addEventListener("focus", () => requestAnimationFrame(keepComposerVisible));
  const sizing = new ResizeObserver(() => {
    if (following && list.clientHeight) list.scrollTop = list.scrollHeight;
    keepComposerVisible();
    read();
  });
  sizing.observe(panel);
  if (footer) sizing.observe(footer);
  // Commands is mounted and removed as the active player/phase changes.
  const mutation = new MutationObserver(updateShortcut);
  mutation.observe(host, { childList: true, subtree: true });
  cleanup.push(() => mutation.disconnect());
  document.addEventListener("visibilitychange", read);
  controls();
  return () => {
    disposed = true;
    cleanup.forEach((dispose) => dispose());
    visibility.disconnect();
    sizing.disconnect();
    window.removeEventListener("scroll", read);
    window.removeEventListener("focus", read);
    window.removeEventListener("resize", read);
    document.removeEventListener("visibilitychange", read);
    panel.remove();
    shortcut.remove();
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
