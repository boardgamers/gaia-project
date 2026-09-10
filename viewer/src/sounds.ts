import { factionPlanet, Planet } from "@gaia-project/engine";
import SpaceMap from "@gaia-project/engine/src/map";
type Note = [number, number, number, number, number?];
type Cue = { label: string; notes: Note[] };
export const soundCues: Record<string, Cue> = {
  build: {
    label: "Build / upgrade",
    notes: [
      [0, 0.12, 0, 0.07, 1700],
      [0.04, 0.22, 145, 0.09, 75],
      [0.13, 0.18, 440, 0.04, 550],
    ],
  },
  terraform: {
    label: "Terraform / Gaia project",
    notes: [
      [0, 0.55, 0, 0.09, 650],
      [0.1, 0.5, 80, 0.07, 160],
      [0.25, 0.3, 240, 0.035, 320],
    ],
  },
  research: {
    label: "Research progress",
    notes: [
      [0, 0.2, 440, 0.06],
      [0.13, 0.24, 660, 0.055],
      [0.26, 0.3, 880, 0.04],
    ],
  },
  charge: { label: "Charge power", notes: [[0, 0.23, 180, 0.055, 540]] },
  federation: {
    label: "Form federation",
    notes: [
      [0, 0.35, 220, 0.06],
      [0.1, 0.4, 330, 0.055],
      [0.2, 0.45, 440, 0.05],
    ],
  },
  ship: {
    label: "Lost Fleet exploration",
    notes: [
      [0, 0.45, 100, 0.07, 300],
      [0.08, 0.45, 151, 0.045, 450],
    ],
  },
};
let context: AudioContext | undefined;
let enabled = true;
export function setSoundEnabled(value: boolean): void {
  enabled = value;
}
export function playSound(name: string): void {
  if (!enabled || !soundCues[name] || typeof window === "undefined") {
    return;
  }
  if (typeof navigator !== "undefined") {
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (activation && !activation.hasBeenActive) {
      return;
    }
  }
  const Audio = window.AudioContext;
  if (!Audio) {
    return;
  }
  context = context || new Audio();
  const ctx = context;
  void ctx
    .resume()
    .then(() => {
      if (!enabled || ctx.state !== "running") {
        return;
      }
      for (const [offset, duration, frequency, volume, endFrequency] of soundCues[name].notes) {
        const start = ctx.currentTime + offset;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        gain.connect(ctx.destination);
        if (frequency === 0) {
          const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
          const samples = buffer.getChannelData(0);
          for (let i = 0; i < samples.length; i++) {
            samples[i] = Math.random() * 2 - 1;
          }
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.value = endFrequency || 900;
          source.connect(filter);
          filter.connect(gain);
          source.start(start);
          source.stop(start + duration);
        } else {
          const oscillator = ctx.createOscillator();
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(frequency, start);
          oscillator.frequency.exponentialRampToValueAtTime(endFrequency || frequency, start + duration);
          oscillator.connect(gain);
          oscillator.start(start);
          oscillator.stop(start + duration);
        }
      }
    })
    .catch(() => undefined);
}

export function installActionSounds(emitter: { on: (event: string, fn: (value: any) => void) => unknown }): void {
  let previous: string[] | undefined;
  let replaying = false;
  emitter.on("update:preference", (pref) => {
    if (pref?.name === "sound") {
      setSoundEnabled(pref.value);
    }
  });
  emitter.on("preferences", (prefs) => {
    if (typeof prefs?.sound === "boolean") {
      setSoundEnabled(prefs.sound);
    }
  });
  emitter.on("replay:start", () => {
    replaying = true;
  });
  emitter.on("replay:end", () => {
    replaying = false;
    previous = undefined;
  });
  const receiveState = (state: any) => {
    const entries = state?.moveHistory || [];
    const next = entries.map((entry: any) => JSON.stringify(entry));
    const extendsHistory = previous && previous.length < next.length && previous.every((entry, i) => entry === next[i]);
    const from = previous?.length || 0;
    previous = next;
    if (!extendsHistory || replaying) {
      return;
    }
    const cues = entries
      .slice(from)
      .map((entry: any) => cueForEntry(entry, state))
      .filter(Boolean);
    // Reconnection can deliver a whole round: play only the most recent event.
    const cue = cues[cues.length - 1];
    if (cue) {
      playSound(cue);
    }
  };
  emitter.on("state", receiveState);
  emitter.on("gamelog", (event) => {
    if (event?.data?.state) {
      receiveState(event.data.state);
    }
  });
}

export function mountSoundTests(emitter: { emit: (event: string, value: any) => unknown }): void {
  const panel = document.createElement("details");
  panel.style.cssText =
    "position:relative;z-index:5;padding:10px 16px;margin:8px;background:#172638;color:#f0f4f8;border:1px solid #56718a;border-radius:8px;font:14px system-ui";
  const summary = document.createElement("summary");
  summary.textContent = "Playtest tools · sounds";
  panel.append(summary);
  const label = document.createElement("label");
  label.style.margin = "10px";
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = true;
  toggle.onchange = () => {
    setSoundEnabled(toggle.checked);
    emitter.emit("preferences", { sound: toggle.checked });
  };
  label.append(toggle, " Game sounds");
  panel.append(label);
  for (const [name, cue] of Object.entries(soundCues)) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = cue.label;
    button.style.cssText =
      "margin:8px 4px;padding:7px 12px;color:#f0f4f8;background:#294663;border:1px solid #7391ad;border-radius:5px;cursor:pointer";
    button.onclick = () => playSound(name);
    panel.append(button);
  }
  document.body.prepend(panel);
}
function cueForEntry(entry: string, state: any): string | undefined {
  if (/\b(federation|fedtile)\b/.test(entry)) {
    return "federation";
  }
  if (/\bup\s/.test(entry)) {
    return "research";
  }
  if (/\b(gaiaFormTransdim|build gf|action power[23])\b/.test(entry)) {
    return "terraform";
  }
  if (/\bbuild\s/.test(entry)) {
    const mine = entry.match(/\bbuild m ([^\s.]+)/);
    const faction = entry.trim().split(/\s+/)[0];
    const player = state.players?.find((p: any) => p.faction === faction);
    if (mine && player && Array.isArray(state.map)) {
      try {
        const map = SpaceMap.fromData(state.map);
        const hex = map.grid.get(map.parse(mine[1]));
        const planet = hex?.data.planet;
        if (
          planet &&
          ![Planet.Gaia, Planet.Transdim, Planet.Lost, Planet.Empty, factionPlanet(player.faction)].includes(planet) &&
          hex.data.player === player.player
        ) {
          return "terraform";
        }
      } catch {
        return "build";
      }
    }
    return "build";
  }
  if (/\b(explore|spaceshipAction|examineArtifact)\b/.test(entry)) {
    return "ship";
  }
  if (/\bcharge\s/.test(entry)) {
    return "charge";
  }
  return undefined;
}
