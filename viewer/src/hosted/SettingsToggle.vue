<template>
  <label class="settings-toggle" @click.stop>
    <span class="settings-toggle__label">{{ label }}</span>
    <span class="settings-toggle__switch">
      <input
        type="checkbox"
        class="settings-toggle__input"
        :checked="checked"
        @change="onChange"
      />
      <span class="settings-toggle__track" aria-hidden="true">
        <span class="settings-toggle__knob"></span>
      </span>
    </span>
  </label>
</template>

<script lang="ts">
import Vue from "vue";

/** A single iOS-style on/off row for a `<b-dropdown>` settings menu (owner request: "a visible
 * toggle like on iphone" instead of a plain text item whose label swaps between two states).
 * Deliberately NOT a `b-dropdown-item-button` - those close the dropdown on click, which is wrong
 * for a switch you might want to flip more than one of in the same visit; `@click.stop` on the
 * root keeps a tap here from reaching the dropdown's own outside-click-style auto-close handling,
 * so the menu stays open exactly like an iOS settings sheet does while you toggle things. A real
 * `<input type="checkbox">` under the hood (visually hidden, driven by the track/knob spans next to
 * it) rather than a hand-rolled clickable div, so it's still keyboard/screen-reader accessible. */
export default Vue.extend({
  name: "SettingsToggle",
  props: {
    label: { type: String, required: true },
    checked: { type: Boolean, default: false },
  },
  methods: {
    onChange(event: Event) {
      this.$emit("change", (event.target as HTMLInputElement).checked);
    },
  },
});
</script>

<style lang="scss" scoped>
.settings-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.4rem 1.25rem;
  margin: 0;
  cursor: pointer;
  font-weight: 400;
  color: inherit;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }
}

.settings-toggle__input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.settings-toggle__switch {
  flex-shrink: 0;
  display: inline-flex;
}

.settings-toggle__track {
  display: inline-block;
  position: relative;
  width: 2.4rem;
  height: 1.4rem;
  border-radius: 999px;
  background: #c7c7cc;
  transition: background 0.15s ease-out;
}

.settings-toggle__knob {
  position: absolute;
  top: 0.125rem;
  left: 0.125rem;
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  transition: transform 0.15s ease-out;
}

.settings-toggle__input:checked + .settings-toggle__track {
  background: #2f6fed;
}

.settings-toggle__input:checked + .settings-toggle__track .settings-toggle__knob {
  transform: translateX(1rem);
}

.settings-toggle__input:focus-visible + .settings-toggle__track {
  box-shadow: 0 0 0 2px rgba(47, 111, 237, 0.5);
}
</style>
