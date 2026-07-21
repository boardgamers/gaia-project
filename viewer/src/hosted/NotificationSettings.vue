<template>
  <InfoModal :open="open" title="Notifications" @close="$emit('close')">
    <div class="notif-settings">
      <!-- Device master switch: a push subscription is bound to THIS device, so this can't be a
           global setting - it's enabled per device you play from. -->
      <div class="notif-settings__device">
        <div>
          <div class="font-weight-bold">Notifications on this device</div>
          <div class="text-muted small">
            {{
              pushEnabled
                ? "This device is registered. Enable separately on any other device you use."
                : "Turn on to receive pushes on this device."
            }}
          </div>
        </div>
        <b-button
          size="sm"
          :variant="pushEnabled ? 'success' : 'outline-secondary'"
          :disabled="pushBusy"
          @click="pushEnabled ? $emit('disable-push') : $emit('enable-push')"
        >
          {{ pushEnabled ? "On" : "Off" }}
        </b-button>
      </div>

      <div v-if="!pushEnabled" class="notif-settings__hint text-muted small">
        These preferences apply to all your games and devices, but you won't receive anything until at least one device
        is turned on above.
      </div>

      <hr />

      <div v-if="loading" class="text-muted small py-2">Loading your preferences…</div>
      <template v-else>
        <!-- Snooze / pause everything -->
        <div class="notif-settings__section">
          <div class="notif-settings__section-title">Pause everything</div>
          <div v-if="snoozeActive" class="notif-settings__snooze-active small">
            Paused until {{ snoozeLabel }}.
            <b-button size="sm" variant="link" class="p-0 align-baseline" @click="clearSnooze">Resume now</b-button>
          </div>
          <div v-else class="notif-settings__snooze-buttons">
            <b-button size="sm" variant="outline-secondary" @click="snooze(1)">1 hour</b-button>
            <b-button size="sm" variant="outline-secondary" @click="snooze(8)">8 hours</b-button>
            <b-button size="sm" variant="outline-secondary" @click="snooze(24)">Until tomorrow</b-button>
          </div>
        </div>

        <hr />

        <!-- Per-category toggles -->
        <div class="notif-settings__section">
          <div class="notif-settings__section-title">Notify me about</div>
          <b-form-checkbox v-model="prefs.turn_pushes" switch @change="save">Your turn</b-form-checkbox>
          <b-form-checkbox v-model="prefs.chat_pushes" switch @change="save">New chat messages</b-form-checkbox>
          <b-form-checkbox v-model="prefs.invite_pushes" switch @change="save">Game invites</b-form-checkbox>
          <b-form-checkbox v-model="prefs.finished_pushes" switch @change="save">Game finished</b-form-checkbox>
        </div>

        <hr />

        <!-- Recurring turn reminder (opt-in) -->
        <div class="notif-settings__section">
          <b-form-checkbox v-model="prefs.reminders_enabled" switch @change="save">
            <span class="notif-settings__section-title">Remind me if I haven't moved</span>
          </b-form-checkbox>
          <div v-if="prefs.reminders_enabled" class="notif-settings__subfields">
            <label class="notif-settings__field">
              <span>Remind me every</span>
              <b-form-select
                v-model.number="prefs.reminder_interval_hours"
                :options="intervalOptions"
                size="sm"
                @change="save"
              />
            </label>
            <label class="notif-settings__field">
              <span>Up to</span>
              <b-form-select
                v-model.number="prefs.reminder_max_count"
                :options="maxCountOptions"
                size="sm"
                @change="save"
              />
              <span>times per turn</span>
            </label>
          </div>
        </div>

        <hr />

        <!-- Quiet hours -->
        <div class="notif-settings__section">
          <b-form-checkbox v-model="prefs.quiet_hours_enabled" switch @change="save">
            <span class="notif-settings__section-title">Quiet hours (your local time)</span>
          </b-form-checkbox>
          <div class="text-muted small">Reminders pause overnight and resume the next morning.</div>
          <div v-if="prefs.quiet_hours_enabled" class="notif-settings__subfields">
            <label class="notif-settings__field">
              <span>From</span>
              <b-form-select v-model.number="prefs.quiet_start_hour" :options="hourOptions" size="sm" @change="save" />
              <span>to</span>
              <b-form-select v-model.number="prefs.quiet_end_hour" :options="hourOptions" size="sm" @change="save" />
            </label>
          </div>
        </div>

        <div v-if="saveError" class="text-danger small mt-2">Couldn't save: {{ saveError }}</div>
      </template>
    </div>
  </InfoModal>
</template>

<script lang="ts">
import Vue from "vue";
import InfoModal from "./InfoModal.vue";
import { SupabaseClient } from "./supabase-client";
import {
  DEFAULT_NOTIFICATION_PREFS,
  isSnoozeActive,
  loadNotificationPrefs,
  NotificationPrefs,
  saveNotificationPrefs,
  snoozeFromNow,
} from "./notification-prefs";

export default Vue.extend({
  name: "NotificationSettings",
  components: { InfoModal },
  props: {
    open: { type: Boolean, default: false },
    client: { type: Object, required: true },
    userId: { type: String, required: true },
    pushEnabled: { type: Boolean, default: false },
    pushBusy: { type: Boolean, default: false },
  },
  data() {
    return {
      prefs: { ...DEFAULT_NOTIFICATION_PREFS } as NotificationPrefs,
      loading: true,
      saveError: "" as string,
      hourOptions: Array.from({ length: 24 }, (_, h) => ({ value: h, text: this.formatHour(h) })),
      intervalOptions: [
        { value: 12, text: "12 hours" },
        { value: 24, text: "24 hours" },
        { value: 48, text: "48 hours" },
      ],
      maxCountOptions: [1, 2, 3, 4, 5].map((n) => ({ value: n, text: String(n) })),
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
      return new Date(this.prefs.snooze_until).toLocaleString([], {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      });
    },
  },
  watch: {
    open(nowOpen: boolean) {
      if (nowOpen) {
        this.reload();
      }
    },
  },
  created() {
    if (this.open) {
      this.reload();
    }
  },
  methods: {
    formatHour(h: number): string {
      const period = h < 12 ? "am" : "pm";
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      return `${hour12}:00 ${period}`;
    },
    async reload() {
      this.loading = true;
      this.saveError = "";
      this.prefs = await loadNotificationPrefs(this.client as SupabaseClient, this.userId);
      this.loading = false;
    },
    async save() {
      // b-form-checkbox @change fires before v-model has necessarily flushed in some Vue versions;
      // $nextTick guarantees this.prefs reflects the new value before we persist it.
      await this.$nextTick();
      const error = await saveNotificationPrefs(this.client as SupabaseClient, this.userId, this.prefs);
      this.saveError = error ?? "";
    },
    async snooze(hours: number) {
      this.prefs.snooze_until = snoozeFromNow(hours);
      await this.save();
    },
    async clearSnooze() {
      this.prefs.snooze_until = null;
      await this.save();
    },
  },
});
</script>

<style lang="scss" scoped>
.notif-settings__device {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.notif-settings__hint {
  margin-top: 0.5rem;
}

.notif-settings__section + .notif-settings__section {
  margin-top: 0.75rem;
}

.notif-settings__section-title {
  font-weight: 600;
}

.notif-settings__subfields {
  margin-top: 0.4rem;
  padding-left: 0.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.notif-settings__field {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  font-size: 0.9rem;

  select {
    width: auto;
    min-width: 5.5rem;
  }
}

.notif-settings__snooze-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

hr {
  margin: 0.75rem 0;
}
</style>
