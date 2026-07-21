<template>
  <transition name="notif-modal">
    <div v-if="open" class="notif-backdrop" @click.self="$emit('close')">
      <div class="notif-card" role="dialog" aria-modal="true" aria-label="Notification settings">
        <header class="notif-card__head">
          <span class="notif-card__title"
            ><span class="notif-card__bell" aria-hidden="true">🔔</span> Notifications</span
          >
          <button type="button" class="notif-card__close" aria-label="Close" @click="$emit('close')">&times;</button>
        </header>

        <div class="notif-card__body">
          <!-- Device master switch. A push subscription is bound to THIS device, so this one can't
               be global — it's per device you play on. -->
          <div class="notif-hero" :class="{ 'notif-hero--on': pushEnabled }">
            <div class="notif-hero__text">
              <div class="notif-hero__label">Notifications on this device</div>
              <div class="notif-hero__sub">
                {{ pushEnabled ? "This device is registered." : "Turn on to get pushes here." }}
              </div>
            </div>
            <label class="switch" :class="{ 'switch--busy': deviceBusy }">
              <input type="checkbox" :checked="pushEnabled" :disabled="deviceBusy" @change="toggleDevice" />
              <span class="switch__track"><span class="switch__thumb"></span></span>
            </label>
          </div>
          <p
            v-if="deviceStatus"
            class="notif-status"
            :class="deviceStatusOk ? 'notif-status--ok' : 'notif-status--warn'"
          >
            {{ deviceStatus }}
          </p>
          <p class="notif-hint">These preferences apply to all your games and every device.</p>

          <!-- Snooze -->
          <section class="notif-sect">
            <div class="notif-sect__label">Pause everything</div>
            <div v-if="snoozeActive" class="notif-snooze-active">
              <span
                >Paused until <strong>{{ snoozeLabel }}</strong></span
              >
              <button type="button" class="notif-link" @click="clearSnooze">Resume now</button>
            </div>
            <div v-else class="notif-pills">
              <button
                v-for="opt in snoozeOptions"
                :key="opt.days"
                type="button"
                class="notif-pill"
                @click="snoozeDays(opt.days)"
              >
                {{ opt.label }}
              </button>
            </div>
          </section>

          <!-- Categories -->
          <section class="notif-sect">
            <div class="notif-sect__label">Notify me about</div>
            <label v-for="cat in categories" :key="cat.key" class="notif-row">
              <span>{{ cat.label }}</span>
              <span class="switch">
                <input type="checkbox" :checked="prefs[cat.key]" @change="onToggle(cat.key, $event.target.checked)" />
                <span class="switch__track"><span class="switch__thumb"></span></span>
              </span>
            </label>
          </section>

          <!-- Turn reminder -->
          <section class="notif-sect">
            <label class="notif-row notif-row--head">
              <span>Remind me if I haven't moved</span>
              <span class="switch">
                <input
                  type="checkbox"
                  :checked="prefs.reminders_enabled"
                  @change="onToggle('reminders_enabled', $event.target.checked)"
                />
                <span class="switch__track"><span class="switch__thumb"></span></span>
              </span>
            </label>
            <div v-if="prefs.reminders_enabled" class="notif-panel">
              <label class="notif-field">
                <span>Every</span>
                <select v-model.number="prefs.reminder_interval_hours" @change="save">
                  <option v-for="opt in intervalOptions" :key="opt.value" :value="opt.value">{{ opt.text }}</option>
                </select>
              </label>
              <label class="notif-field">
                <span>Up to</span>
                <select v-model.number="prefs.reminder_max_count" @change="save">
                  <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
                </select>
                <span>time{{ prefs.reminder_max_count === 1 ? "" : "s" }} a turn</span>
              </label>
            </div>
          </section>

          <!-- Quiet hours -->
          <section class="notif-sect">
            <label class="notif-row notif-row--head">
              <span>Quiet hours <small class="notif-muted">(your time)</small></span>
              <span class="switch">
                <input
                  type="checkbox"
                  :checked="prefs.quiet_hours_enabled"
                  @change="onToggle('quiet_hours_enabled', $event.target.checked)"
                />
                <span class="switch__track"><span class="switch__thumb"></span></span>
              </span>
            </label>
            <div v-if="prefs.quiet_hours_enabled" class="notif-panel">
              <label class="notif-field">
                <span>From</span>
                <select v-model.number="prefs.quiet_start_hour" @change="save">
                  <option v-for="h in 24" :key="h - 1" :value="h - 1">{{ formatHour(h - 1) }}</option>
                </select>
                <span>to</span>
                <select v-model.number="prefs.quiet_end_hour" @change="save">
                  <option v-for="h in 24" :key="h - 1" :value="h - 1">{{ formatHour(h - 1) }}</option>
                </select>
              </label>
              <p class="notif-panel__note">No reminders overnight — they resume in the morning.</p>
            </div>
          </section>

          <p v-if="saveError" class="notif-status notif-status--warn">Couldn't save: {{ saveError }}</p>
        </div>
      </div>
    </div>
  </transition>
</template>

<script lang="ts">
import Vue from "vue";
import { disablePushNotifications, enablePushNotifications } from "./push";
import { SupabaseClient } from "./supabase-client";
import {
  DEFAULT_NOTIFICATION_PREFS,
  isSnoozeActive,
  loadNotificationPrefs,
  NotificationPrefs,
  saveNotificationPrefs,
  snoozeFromNow,
} from "./notification-prefs";

// The boolean-valued preference keys — the only ones driven by a plain on/off switch.
type BoolPrefKey =
  | "turn_pushes"
  | "chat_pushes"
  | "invite_pushes"
  | "finished_pushes"
  | "reminders_enabled"
  | "quiet_hours_enabled";

export default Vue.extend({
  name: "NotificationSettings",
  props: {
    open: { type: Boolean, default: false },
    client: { type: Object, required: true },
    userId: { type: String, required: true },
    pushEnabled: { type: Boolean, default: false },
  },
  data() {
    return {
      // Seeded with defaults so the form renders full-size instantly (no "small then big" flash);
      // reload() then swaps in the saved values in place.
      prefs: { ...DEFAULT_NOTIFICATION_PREFS } as NotificationPrefs,
      loaded: false,
      deviceBusy: false,
      deviceStatus: "" as string,
      deviceStatusOk: false,
      saveError: "" as string,
      categories: [
        { key: "turn_pushes", label: "Your turn" },
        { key: "chat_pushes", label: "New chat messages" },
        { key: "invite_pushes", label: "Game invites" },
        { key: "finished_pushes", label: "Game finished" },
      ] as { key: BoolPrefKey; label: string }[],
      intervalOptions: [
        { value: 12, text: "12 hours" },
        { value: 24, text: "24 hours" },
        { value: 48, text: "48 hours" },
      ],
      snoozeOptions: [
        { label: "1 day", days: 1 },
        { label: "3 days", days: 3 },
        { label: "1 week", days: 7 },
        { label: "2 weeks", days: 14 },
      ],
    };
  },
  computed: {
    snoozeActive(): boolean {
      return isSnoozeActive(this.prefs.snooze_until);
    },
    snoozeLabel(): string {
      if (!this.prefs.snooze_until) {
        return "";
      }
      // Days-to-weeks scale, so show the date (weekday + month + day), not a time of day.
      return new Date(this.prefs.snooze_until).toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    },
  },
  watch: {
    open(nowOpen: boolean) {
      if (nowOpen) {
        this.reload();
        document.addEventListener("keydown", this.onKeydown);
      } else {
        document.removeEventListener("keydown", this.onKeydown);
      }
    },
  },
  created() {
    // Only load when actually shown - the form already renders full-size from defaults, so there's
    // no size flash to pre-empt, and this avoids a DB round-trip for a modal that's usually mounted
    // closed.
    if (this.open) {
      this.reload();
    }
  },
  beforeDestroy() {
    document.removeEventListener("keydown", this.onKeydown);
  },
  methods: {
    onKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        this.$emit("close");
      }
    },
    formatHour(h: number): string {
      const period = h < 12 ? "am" : "pm";
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      return `${hour12} ${period}`;
    },
    async reload() {
      this.saveError = "";
      const loaded = await loadNotificationPrefs(this.client as SupabaseClient, this.userId);
      this.prefs = loaded;
      this.loaded = true;
    },
    async onToggle(key: BoolPrefKey, checked: boolean) {
      this.prefs[key] = checked;
      await this.save();
    },
    async save() {
      if (!this.loaded) {
        return;
      }
      await this.$nextTick();
      const error = await saveNotificationPrefs(this.client as SupabaseClient, this.userId, this.prefs);
      this.saveError = error ?? "";
    },
    async snoozeDays(days: number) {
      this.prefs.snooze_until = snoozeFromNow(days * 24);
      await this.save();
    },
    async clearSnooze() {
      this.prefs.snooze_until = null;
      await this.save();
    },
    // Owns the per-device subscribe/unsubscribe so it can show inline status instead of a
    // window.alert, then tells the parent to refresh its own pushEnabled (for the bell colour).
    async toggleDevice() {
      if (this.deviceBusy) {
        return;
      }
      this.deviceBusy = true;
      const message = this.pushEnabled
        ? await disablePushNotifications(this.client as SupabaseClient)
        : await enablePushNotifications(this.client as SupabaseClient, this.userId);
      this.deviceBusy = false;
      this.deviceStatus = message;
      // Treat the two known success strings as OK; anything else (blocked, unusable, error) is a warning.
      this.deviceStatusOk =
        /enabled|disabled/i.test(message) && !/can't|couldn't|blocked|unusable|failed/i.test(message);
      this.$emit("push-changed");
    },
  },
});
</script>

<style lang="scss" scoped>
.notif-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1060;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(2px);
}

.notif-card {
  width: min(100%, 23rem);
  max-height: min(88vh, 42rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 1rem;
  background: #ffffff;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.28);
  border: 1px solid #e7ecf3;
}

.notif-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #eef1f6;
  background: linear-gradient(180deg, #fbfcff 0%, #f4f7fc 100%);
}

.notif-card__title {
  font-weight: 700;
  font-size: 1rem;
  color: #1f2a3d;
}

.notif-card__bell {
  margin-right: 0.3rem;
}

.notif-card__close {
  border: none;
  background: transparent;
  font-size: 1.5rem;
  line-height: 1;
  color: #9aa7ba;
  cursor: pointer;
  padding: 0 0.15rem;

  &:hover {
    color: #5b6675;
  }
}

.notif-card__body {
  padding: 0.85rem 1rem 1rem;
  overflow-y: auto;
}

/* Device hero */
.notif-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.8rem;
  border-radius: 0.7rem;
  border: 1px solid #e6ebf2;
  background: #f7f9fc;
  transition: background 0.15s, border-color 0.15s;
}

.notif-hero--on {
  border-color: #cfe4d6;
  background: linear-gradient(180deg, #f2fbf5 0%, #eef8f1 100%);
}

.notif-hero__label {
  font-weight: 600;
  color: #1f2a3d;
  font-size: 0.95rem;
}

.notif-hero__sub {
  font-size: 0.78rem;
  color: #7a8698;
  margin-top: 0.1rem;
}

.notif-status {
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
}

.notif-status--ok {
  color: #2e7d4f;
}

.notif-status--warn {
  color: #b23b3b;
}

.notif-hint {
  margin: 0.55rem 0 0;
  font-size: 0.76rem;
  color: #9aa7ba;
}

/* Sections */
.notif-sect {
  margin-top: 1rem;
  padding-top: 0.85rem;
  border-top: 1px solid #eef1f6;
}

.notif-sect__label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #9aa7ba;
  margin-bottom: 0.5rem;
}

.notif-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0;
  padding: 0.32rem 0.35rem;
  border-radius: 0.5rem;
  font-size: 0.92rem;
  color: #26313f;
  cursor: pointer;

  &:hover {
    background: #f5f7fb;
  }
}

.notif-row--head {
  font-weight: 600;
}

.notif-muted {
  color: #9aa7ba;
  font-weight: 400;
}

/* Sub-panel revealed under an enabled toggle */
.notif-panel {
  margin: 0.4rem 0 0.1rem 0.35rem;
  padding: 0.55rem 0.7rem;
  border-left: 2px solid #d5deea;
  background: #f8fafd;
  border-radius: 0 0.5rem 0.5rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.notif-panel__note {
  margin: 0.1rem 0 0;
  font-size: 0.74rem;
  color: #9aa7ba;
}

.notif-field {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  font-size: 0.88rem;
  color: #3a4658;

  select {
    appearance: none;
    -webkit-appearance: none;
    padding: 0.2rem 1.4rem 0.2rem 0.5rem;
    border: 1px solid #d5deea;
    border-radius: 0.45rem;
    background: #fff
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%237a8698' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E")
      no-repeat right 0.5rem center;
    font-size: 0.85rem;
    color: #26313f;
    cursor: pointer;

    &:focus {
      outline: none;
      border-color: #7aa7e6;
      box-shadow: 0 0 0 2px rgba(122, 167, 230, 0.25);
    }
  }
}

/* Snooze */
.notif-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.notif-pill {
  border: 1px solid #d5deea;
  background: #fff;
  border-radius: 999px;
  padding: 0.28rem 0.75rem;
  font-size: 0.82rem;
  color: #3a4658;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;

  &:hover {
    background: #eef3fb;
    border-color: #b9cae4;
  }
}

.notif-snooze-active {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.7rem;
  border-radius: 0.55rem;
  background: #fff6e8;
  border: 1px solid #f0d9b0;
  font-size: 0.85rem;
  color: #7a5a1e;
}

.notif-link {
  border: none;
  background: transparent;
  color: #2f6fd0;
  font-size: 0.83rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;

  &:hover {
    text-decoration: underline;
  }
}

/* iOS-style switch */
.switch {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  cursor: pointer;

  input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    cursor: pointer;
  }
}

.switch__track {
  width: 2.35rem;
  height: 1.35rem;
  border-radius: 999px;
  background: #cfd6e0;
  transition: background 0.18s ease;
  position: relative;
  flex: 0 0 auto;
}

.switch__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: calc(1.35rem - 4px);
  height: calc(1.35rem - 4px);
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.3);
  transition: transform 0.18s ease;
}

.switch input:checked + .switch__track {
  background: #34c759;
}

.switch input:checked + .switch__track .switch__thumb {
  transform: translateX(1rem);
}

.switch input:focus-visible + .switch__track {
  box-shadow: 0 0 0 3px rgba(52, 199, 89, 0.3);
}

.switch--busy {
  opacity: 0.55;
  pointer-events: none;
}

/* Modal open/close transition — no size flash, just a gentle fade + rise */
.notif-modal-enter-active,
.notif-modal-leave-active {
  transition: opacity 0.16s ease;

  .notif-card {
    transition: transform 0.18s ease, opacity 0.18s ease;
  }
}

.notif-modal-enter,
.notif-modal-leave-to {
  opacity: 0;

  .notif-card {
    transform: translateY(10px) scale(0.98);
    opacity: 0;
  }
}
</style>
