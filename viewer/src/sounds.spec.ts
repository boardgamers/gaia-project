import { EventEmitter } from "events";
import { describe, expect, it, vi } from "vitest";
import { installActionSounds, playSound, setSoundEnabled, soundCues } from "./sounds";
describe("game action sounds", () => {
  it("plays new actions and suppresses initial history, duplicates, mute and replay", async () => {
    const start = vi.fn();
    const node = () => ({
      connect: vi.fn(),
      start,
      stop: vi.fn(),
      frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    });
    class Audio {
      currentTime = 0;
      sampleRate = 44100;
      state = "running";
      destination = {};
      resume() {
        return Promise.resolve();
      }
      createGain = node;
      createOscillator = node;
      createBufferSource = node;
      createBiquadFilter = node;
      createBuffer(_channels: number, length: number) {
        return { getChannelData: () => new Float32Array(length) };
      }
    }
    vi.stubGlobal("AudioContext", Audio);
    const emitter = new EventEmitter();
    installActionSounds(emitter);
    setSoundEnabled(true);
    emitter.emit("state", { moveHistory: ["init 2 test", "terrans up terra"] });
    await Promise.resolve();
    expect(start).not.toHaveBeenCalled();
    const state = { moveHistory: ["init 2 test", "terrans up terra", "terrans up sci"] };
    emitter.emit("state", state);
    await Promise.resolve();
    expect(start).toHaveBeenCalled();
    start.mockClear();
    emitter.emit("state", state);
    emitter.emit("gamelog", { data: { state } });
    await Promise.resolve();
    expect(start).not.toHaveBeenCalled();
    emitter.emit("preferences", { sound: false });
    playSound("research");
    await Promise.resolve();
    expect(start).not.toHaveBeenCalled();
    emitter.emit("preferences", { sound: true });
    emitter.emit("replay:start");
    emitter.emit("state", { moveHistory: [...state.moveHistory, "terrans up eco"] });
    await Promise.resolve();
    expect(start).not.toHaveBeenCalled();
    emitter.emit("replay:end");
    emitter.emit("state", state);
    await Promise.resolve();
    expect(start).not.toHaveBeenCalled();
    for (const cue of Object.keys(soundCues)) {
      playSound(cue);
    }
    await Promise.resolve();
    expect(start).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
