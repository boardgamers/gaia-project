type PlayerCommands = {
  hoverPlayer(index: number, anchor: DOMRect): boolean;
  leavePlayer(): boolean;
};

export function installPlayerCards(root: Element, commands: PlayerCommands) {
  let active: Element | null = null;
  function show(event: Event) {
    const name = event.target instanceof Element ? event.target.closest("[data-bgs-player]") : null;
    if (!name || !root.contains(name) || name === active) return;
    const index = Number(name.getAttribute("data-bgs-player"));
    if (!Number.isInteger(index) || index < 0) return;
    active = name;
    commands.hoverPlayer(index, name.getBoundingClientRect());
  }
  function hide(event: Event) {
    if (!active) return;
    const related = (event as MouseEvent | FocusEvent).relatedTarget;
    if (related instanceof Node && active.contains(related)) return;
    active = null;
    commands.leavePlayer();
  }
  root.addEventListener("mouseover", show);
  root.addEventListener("focusin", show);
  root.addEventListener("mouseout", hide);
  root.addEventListener("focusout", hide);
  return () => {
    root.removeEventListener("mouseover", show);
    root.removeEventListener("focusin", show);
    root.removeEventListener("mouseout", hide);
    root.removeEventListener("focusout", hide);
    if (active) commands.leavePlayer();
  };
}

export function createBoardThumbnail(root: Element) {
  let preview: HTMLDivElement | undefined;
  function destroy() {
    preview?.remove();
    preview = undefined;
  }
  async function render(
    source: Element | null,
    size: { width: number; height: number },
    background: string,
    omit?: string
  ) {
    destroy();
    if (!source?.isConnected || !root.contains(source)) return null;
    await document.fonts.ready;
    preview = document.createElement("div");
    preview.className = "bgs-board-thumbnail";
    preview.setAttribute("aria-hidden", "true");
    preview.style.cssText = `position:fixed;inset:0 auto auto 0;width:${size.width}px;height:${size.height}px;z-index:2147483647;overflow:hidden;pointer-events:none;background:${background};`;
    const freeze = document.createElement("style");
    freeze.textContent =
      ".bgs-board-thumbnail *{animation:none!important;transition:none!important;caret-color:transparent!important}";
    preview.append(freeze);
    let content: HTMLElement | SVGSVGElement;
    if (source instanceof SVGElement) {
      const svg = source instanceof SVGSVGElement ? source : source.ownerSVGElement;
      if (!svg) return null;
      content = svg.cloneNode(false) as SVGSVGElement;
      content.removeAttribute("id");
      const box = source instanceof SVGSVGElement ? source.viewBox.baseVal : (source as SVGGraphicsElement).getBBox();
      if (!box.width || !box.height) return null;
      const padding = source === svg ? 0 : Math.max(box.width, box.height) * 0.02;
      content.setAttribute(
        "viewBox",
        `${box.x - padding} ${box.y - padding} ${box.width + padding * 2} ${box.height + padding * 2}`
      );
      if (source === svg) {
        for (const child of Array.from(source.childNodes)) content.append(child.cloneNode(true));
      } else {
        for (const defs of Array.from(svg.querySelectorAll("defs"))) content.append(defs.cloneNode(true));
        const copy = source.cloneNode(true) as SVGElement;
        copy.removeAttribute("transform");
        content.append(copy);
      }
      content.setAttribute("preserveAspectRatio", "xMidYMid meet");
      content.style.cssText =
        "display:block;position:static;width:100%;height:100%;max-width:none;max-height:none;min-width:0;margin:0;transform:none";
    } else {
      content = source.cloneNode(true) as HTMLElement;
      content.style.cssText = `display:flex;flex-direction:column;gap:14px;position:relative;width:${size.width}px;max-width:none;margin:0;transform-origin:top left;`;
    }
    if (omit) for (const element of Array.from(content.querySelectorAll(omit))) element.remove();
    // Keep ancestor-dependent styles without their clipping or stacking contexts.
    let parent: Element = preview;
    const ancestors: Element[] = [];
    for (
      let ancestor = source.parentElement;
      ancestor && ancestor !== document.body;
      ancestor = ancestor.parentElement
    ) {
      if (!(ancestor instanceof SVGElement)) {
        ancestors.unshift(ancestor);
      }
    }
    for (const ancestor of ancestors) {
      const context = ancestor.cloneNode(false) as HTMLElement;
      context.removeAttribute("id");
      context.style.cssText =
        "display:contents!important;transform:none!important;filter:none!important;contain:none!important";
      parent.append(context);
      parent = context;
    }
    parent.append(content);
    document.body.append(preview);
    if (!(content instanceof SVGSVGElement)) {
      const box = content.getBoundingClientRect();
      const scale = Math.min(1, size.width / box.width, size.height / box.height);
      content.style.transform = `translate(${(size.width - box.width * scale) / 2}px, ${(size.height - box.height * scale) / 2}px) scale(${scale})`;
    }
    await Promise.all(Array.from(preview.querySelectorAll("img")).map((img) => img.decode().catch(() => {})));
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    return preview;
  }
  return { render, destroy };
}
