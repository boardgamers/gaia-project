import Engine from "@gaia-project/engine";
import { LoadFromJsonType } from "./store";

export type SelfContainedLoad = {
  engineData: any;
  type: LoadFromJsonType;
  stopMove?: string;
};

function replayOptionsFromState(engineData: any) {
  const options = JSON.parse(JSON.stringify(engineData.options ?? {}));

  // Lost Fleet boards are derived from the init seed and expansion flag; exported
  // engine states also carry a concrete `options.map` snapshot, but replaying with
  // that snapshot trips the engine's guard against combining Lost Fleet with a
  // custom map configuration. Strip the generated map and let the engine rebuild
  // the Lost Fleet board from move history instead.
  if (options.lostFleet) {
    delete options.map;
  }

  return options;
}

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(base64Url: string): string {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  return padded + "=".repeat((4 - (padded.length % 4)) % 4);
}

function utf8ToBase64(value: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64");
  }

  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToUtf8(base64: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(base64, "base64").toString("utf8");
  }

  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizeLoadType(value?: string | null): LoadFromJsonType {
  switch (value) {
    case LoadFromJsonType.strictReplay:
      return LoadFromJsonType.strictReplay;
    case LoadFromJsonType.permissiveReplay:
      return LoadFromJsonType.permissiveReplay;
    default:
      return LoadFromJsonType.load;
  }
}

export function encodeEngineData(engineData: unknown): string {
  return toBase64Url(utf8ToBase64(JSON.stringify(engineData)));
}

export function decodeEngineData(encoded: string): any {
  return JSON.parse(base64ToUtf8(fromBase64Url(encoded)));
}

export function parseLoadFromQuery(search = ""): SelfContainedLoad | null {
  const params = new URLSearchParams(search);
  const state = params.get("state");
  if (!state) {
    return null;
  }

  return {
    engineData: decodeEngineData(state),
    type: normalizeLoadType(params.get("loadType") ?? params.get("type")),
    stopMove: params.get("stopMove") ?? undefined,
  };
}

export function loadEngineFromData(load: SelfContainedLoad): Engine {
  let { engineData } = load;
  const { type, stopMove } = load;
  if ("cancelled" in engineData) {
    engineData = (engineData as any).data;
  }

  let moveHistory = engineData.moveHistory;
  if (stopMove) {
    let index = Number(stopMove);
    if (Number.isNaN(index)) {
      index = moveHistory.indexOf(stopMove);
    }

    if (index < 0) {
      console.error("stop move not found", stopMove);
      console.log(moveHistory);
    } else {
      moveHistory = moveHistory.slice(0, index);
      console.log("loading game from index", index);
    }

    if (type === LoadFromJsonType.load) {
      console.error("cannot use load with stop move - using permissive replay instead", type);
      type = LoadFromJsonType.permissiveReplay;
    }
  }

  switch (type) {
    case LoadFromJsonType.load:
      return Engine.fromData(engineData);
    case LoadFromJsonType.strictReplay:
      return new Engine(moveHistory, replayOptionsFromState(engineData), null);
    case LoadFromJsonType.permissiveReplay:
      return new Engine(moveHistory, replayOptionsFromState(engineData), null, true);
    default:
      console.error("unknown replay type", type);
      return Engine.fromData(engineData);
  }
}

export function buildStateUrl(
  baseHref: string,
  engineData: unknown,
  type: LoadFromJsonType = LoadFromJsonType.load,
  stopMove?: string
): string {
  const url = new URL(baseHref, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  url.search = "";
  url.searchParams.set("state", encodeEngineData(engineData));
  if (type !== LoadFromJsonType.load) {
    url.searchParams.set("loadType", type);
  }
  if (stopMove) {
    url.searchParams.set("stopMove", stopMove);
  }
  return url.toString();
}
