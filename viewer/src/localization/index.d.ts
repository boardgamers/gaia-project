import type { TutorialMount } from "@boardgamers/protocol/tutorial";
export interface Localization {
  readonly locale: string;
  translate(text: string): string;
  readonly ready: Promise<boolean>;
  setLocale(locale: unknown): Promise<boolean>;
  setState(state: unknown): void;
  setNames(names: unknown[]): void;
  refresh(): void;
  destroy(): void;
}
export const catalogs: Record<string, Record<string, string>>;
export const languages: Record<string, string>;
export function resolveLocale(value: unknown): string;
export function translateText(text: string, locale?: string): string;
export function mountLocalization(target: Element, locale?: unknown): Localization;
export function localizeTutorial(mount: TutorialMount): TutorialMount;

export function loadLocale(locale: unknown): Promise<string>;
