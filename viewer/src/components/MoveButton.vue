<template>
  <div class="move-button" :key="key">
    <b-btn
      v-if="button.times === undefined"
      :variant="variant"
      :class="['mr-2', 'mb-2', 'move-button', { active }]"
      @click="controller.handleButtonClick(button)"
      @mouseenter="hover"
      @mouseleave="leave"
      :title="button.tooltip"
      v-b-tooltip.html
    >
      <template>
        <RichTextView :content="label" />
      </template>
    </b-btn>
    <b-dropdown
      :variant="variant"
      :class="['mr-2', 'mb-2', 'move-button']"
      v-else
      split
      right
      :title="button.tooltip"
      v-b-tooltip.html
      @click="handleRangeClick(button.times[0])"
    >
      <template #button-content>
        <RichTextView :content="label" />
      </template>
      <b-dropdown-item v-for="i in button.times" :key="i" @click="handleRangeClick(i)">{{ i }}</b-dropdown-item>
    </b-dropdown>
    <b-modal
      v-if="button.modal"
      v-model="modalShow"
      lazy
      size="lg"
      @ok="handleOK"
      @hide="modalCancel"
      dialog-class="gaia-viewer-modal"
      :title="button.modal.title"
      :ok-title="button.modal.okTitle || 'OK, I pick this one!'"
    >
      <component :is="button.modal.component" v-if="button.modal.component" v-bind="button.modal.props" />
      <div v-else v-html="button.modal.content"></div>
    </b-modal>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Player } from "@gaia-project/engine";
import { ButtonData, WarningsPreference } from "../data";
import Booster from "./Booster.vue";
import TechTile from "./TechTile.vue";
import BoardAction from "./BoardAction.vue";
import SpecialAction from "./SpecialAction.vue";
import { CommandController, MoveButtonController } from "../logic/buttons/types";
import { callOnShow, buttonRichTextLabel } from "../logic/buttons/utils";
import { enabledButtonWarnings } from "../data/warnings";
import { isTypingTarget } from "../logic/typing-target";
import RichTextView from "./Resources/RichTextView.vue";

@Component({
  components: {
    RichTextView,
    Booster,
    TechTile,
    BoardAction,
    SpecialAction,
  },
})
export default class MoveButton extends Vue implements MoveButtonController {
  @Prop()
  public button!: ButtonData;

  @Prop()
  public controller: CommandController;

  private modalShow = false;

  public key = "key"; //only to force re-render

  private rangePreselect: number = null;

  mounted() {
    const keyListener = (e) => {
      // The caret is in a text field (a chat composer, a bid box, the notes pad) - those keystrokes
      // are the user typing, not a move shortcut. See logic/typing-target.ts.
      if (isTypingTarget(e.target)) {
        return;
      }
      const b = this.button;
      if (b.hide) {
        return;
      }

      if (this.modalShow) {
        if (!b.modal.canActivate()) {
          return false;
        }
        if (e.key == "Enter") {
          this.handleOK();
          return false;
        }
      }

      const primary = document.getElementsByClassName("btn btn-primary");
      if (e.key == "Enter") {
        if (primary.length > 0) {
          (primary[0] as HTMLElement).click();
          return;
        }
      }
      if (primary.length > 0) {
        // we're showing a modal dialog
        return false;
      }

      if (b.shortcuts?.includes(e.key)) {
        if (this.rangePreselect) {
          this.handleRangeClick(this.rangePreselect ?? b.times[0]);
        } else {
          this.controller.handleButtonClick(b);
        }
      } else if (b.times && isFinite(Number(e.key))) {
        this.rangePreselect = Number(e.key);
      }
    };
    window.addEventListener("keydown", keyListener);
    this.$on("hook:beforeDestroy", () => window.removeEventListener("keydown", keyListener));
  }

  updated() {
    this.button.buttonController = this;

    if (!this.button.hide) {
      callOnShow(this.button);
    }
  }
  modalCancel(arg: string) {
    this.button.modal.show(false);
    this.$emit("cancel");
  }

  setButton(b: ButtonData, key: string) {
    this.button = b;
    this.key = key; //forces re-render
  }

  setModalShow(value: boolean) {
    this.modalShow = value;
  }

  handleOK() {
    const b = this.button;
    b.modal.show(false);
    this.controller.emitButtonCommand(b);
  }

  handleRangeClick(times: number) {
    this.controller.emitButtonCommand(this.button, null, { times });
  }

  get player(): Player {
    const engine = this.$store.state.data;
    return engine.player(engine.currentPlayer);
  }

  get active() {
    return this.controller.isActiveButton(this.button);
  }

  get label() {
    return buttonRichTextLabel(this.button);
  }

  hover() {
    this.button.hover?.enter(this.button);
  }

  leave() {
    this.button.hover?.leave(this.button);
  }

  get warningPreference(): WarningsPreference {
    return this.$store.state.preferences.warnings;
  }

  get variant(): string {
    return enabledButtonWarnings(this.button, this.$store.state.preferences).length > 0 &&
      this.warningPreference !== WarningsPreference.Tooltip
      ? "warning"
      : "secondary";
  }
}
</script>

<style lang="scss">
.move-button {
  display: flex;
}

.move-button.active {
  background-color: var(--primary) !important;
  color: white !important;
}

.warning {
  background-color: var(--warning);
}
</style>
