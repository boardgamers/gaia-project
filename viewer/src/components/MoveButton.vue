<template>
  <div class="move-button" :key="key">
    <Booster
      v-if="button.booster"
      class="mb-1 mr-1"
      @click.native="controller.handleButtonClick(button)"
      :booster="button.booster"
      highlighted
    />
    <BoardAction v-else-if="button.boardAction" :action="button.boardAction" class="mb-1 mr-1" transform="scale(1.3)" />
    <SpecialAction
      v-else-if="button.specialAction && !button.autoClick"
      class="mb-1 mr-1"
      :action="[button.specialAction]"
      :player="player"
    />
    <TechTile
      v-else-if="button.tech"
      class="mb-1 mr-1"
      :pos="button.tech.pos"
      :tile-override="button.tech.tile"
      :shortcut="true"
      :command-override="button.tech.commandOverride"
      :count-override="1"
    />
    <b-btn
      v-else-if="button.times === undefined"
      :variant="variant"
      :class="['mr-2', 'mb-2', 'move-button', { active }]"
      @click="controller.handleButtonClick(button)"
      @mouseenter="hover"
      @mouseleave="leave"
      :title="button.tooltip"
      v-b-tooltip.html
    >
      <template>
        <ResourcesText :content="label" />
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
        <ResourcesText :content="label" />
      </template>
      <b-dropdown-item v-for="i in button.times" :key="i" @click="handleRangeClick(i)">{{ i }}</b-dropdown-item>
    </b-dropdown>
    <b-modal
      v-if="button.modal"
      v-model="modalShow"
      size="lg"
      @ok="handleOK"
      @hide="modalCancel"
      dialog-class="gaia-viewer-modal"
      :title="button.modal.title"
      ok-title="OK, I pick this one!"
    >
      <div v-html="button.modal.content"></div>
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
import { callOnShow, resourcesTextLabel } from "../logic/buttons/utils";
import { enabledButtonWarnings } from "../data/warnings";
import ResourcesText from "./Resources/ResourcesText.vue";

@Component({
  components: {
    ResourcesText,
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
    return resourcesTextLabel(this.button);
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
    return enabledButtonWarnings(this.button, this.$store.state.preferences).length > 0 && this.warningPreference !== WarningsPreference.Tooltip ? "warning" : "secondary";
  }
}
</script>

<style lang="scss">
.move-button {
  display: flex;
}

.active {
  background-color: var(--primary) !important;
  color: white !important;
}

.warning {
  background-color: var(--warning);
}
</style>
