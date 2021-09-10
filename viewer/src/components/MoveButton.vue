<template>
  <div class="move-button">
    <Booster
      v-if="button.booster"
      class="mb-1 mr-1"
      @click.native="handleClick"
      :booster="button.booster"
      highlighted
    />
    <BoardAction v-else-if="button.boardAction" :action="button.boardAction" class="mb-1 mr-1" transform="scale(1.3)" />
    <SpecialAction
      v-else-if="button.specialAction"
      class="mb-1 mr-1"
      :action="[button.specialAction]"
      :player="player"
    />
    <TechTile v-else-if="button.tech" class="mb-1 mr-1" :pos="button.tech" :count-override="1" />
    <b-btn
      v-else-if="button.times === undefined"
      :variant="button.warning ? 'warning' : 'secondary'"
      :class="['mr-2', 'mb-2', 'move-button', { 'symbol-button': button.conversion, active: this.isActiveButton }]"
      @click="handleClick"
      @mouseenter="hover"
      @mouseleave="leave"
      :title="button.tooltip"
      v-b-tooltip.html
    >
      <template>
        <ButtonContent :button="button" :customLabel="customLabel" />
      </template>
    </b-btn>
    <b-dropdown
      :variant="button.warning ? 'warning' : 'secondary'"
      :class="['mr-2', 'mb-2', 'move-button', { 'symbol-button': button.conversion }]"
      v-else
      split
      right
      :title="button.tooltip"
      v-b-tooltip.html
      @click="handleRangeClick(button.times[0])"
    >
      <template #button-content>
        <ButtonContent :button="button" :customLabel="customLabel" />
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
import { BuildWarning, GaiaHex, HighlightHex, Player, SpaceMap } from "@gaia-project/engine";
import { ButtonData, HexSelection } from "../data";
import Booster from "./Booster.vue";
import TechTile from "./TechTile.vue";
import ButtonContent from "./Resources/ButtonContent.vue";
import BoardAction from "./BoardAction.vue";
import SpecialAction from "./SpecialAction.vue";
import { customHexSelection } from "../logic/commands";

type EmitCommandParams = { disappear?: boolean; times?: number; warnings?: BuildWarning[] };

@Component({
  components: {
    Booster,
    TechTile,
    ButtonContent,
    BoardAction,
    SpecialAction,
  },
})
export default class MoveButton extends Vue {
  @Prop()
  public button!: ButtonData;

  private subscription: () => {} | null = null;
  private modalShow = false;
  private customLabel = "";
  private startingHex = null; // For range command

  private rangePreselect: number = null;

  modalCancel(arg: string) {
    this.button.modal.show(false);
    this.$emit("cancel");
  }

  subscribe(action: string, callback: any) {
    action = "gaiaViewer/" + action;

    this.unsubscribe();
    this.$store.commit("gaiaViewer/activeButton", this.button);

    this.subscription = (this.$store as any).subscribeAction(({ type, payload }) => {
      if (type !== action) {
        return;
      }

      if (!this.isActiveButton) {
        return;
      }

      console.log(type, payload);

      callback(payload);
    });
  }

  subscribeHexClick(callback: (hex: GaiaHex, highlight: HighlightHex) => void) {
    this.subscribe("hexClick", payload => {
      callback(payload.hex, payload.highlight);
    });
  }

  subscribeFinal(action: string) {
    this.subscribe(action, (button) => {
      this.handleButtonClick(button);
    });
    this.emitCommand(null, { disappear: false });
  }

  unsubscribe() {
    if (this.subscription) {
      this.subscription();
    }
  }

  destroyed() {
    this.unsubscribe();
  }

  mounted() {
    const keyListener = (e) => {
      if (this.button.hide) {
        return;
      }

      if (this.modalShow) {
        if (!this.button.modal.canActivate()) {
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

      if (this.button.shortcuts?.includes(e.key)) {
        if (this.rangePreselect) {
          this.handleRangeClick(this.rangePreselect ?? this.button.times[0]);
        } else {
          this.handleClick();
        }
      } else if (this.button.times && isFinite(Number(e.key))) {
        this.rangePreselect = Number(e.key);
      }
    };
    window.addEventListener("keydown", keyListener);
    this.$on("hook:beforeDestroy", () => window.removeEventListener("keydown", keyListener));
  }

  async handleClick() {
    await this.handleButtonClick(this.button, null);
  }

  async handleButtonClick(button: ButtonData, params?: EmitCommandParams) {
    if (button.hide) {
      console.log("click on hidden button, ignoring");
      return;
    }
    const warning = button.warning;
    if (warning) {
      try {
        const c = this.$createElement;
        const message = warning.body.length == 1 ? warning.body[0] :
          warning.body.map(w => c("ul", [c("li", [w])]));
        const okClicked = await this.$bvModal.msgBoxConfirm(message, {
          title: warning.title,
          headerClass: "warning",
          okTitle: warning.okButton?.label,
        });

        if (okClicked) {
          const action = warning.okButton?.action;
          if (action) {
            action();
            return;
          }
        } else {
          return;
        }
      } catch (err) {
        console.error(err);
        return;
      }
    }

    // Remove highlights caused by another button
    if (!this.isActiveButton) {
      this.$store.commit("gaiaViewer/clearContext");
    }

    if (button.hexes && !this.isActiveButton) {
      this.highlightHexes(button.hexes);
    }

    if (button.researchTiles) {
      this.$store.commit("gaiaViewer/highlightResearchTiles", button.researchTiles);
      this.subscribeFinal("researchClick");
    } else if (button.techs) {
      this.$store.commit("gaiaViewer/highlightTechs", button.techs);
      this.subscribeFinal("techClick");
    } else if (button.specialActions) {
      this.$store.commit("gaiaViewer/highlightSpecialActions", button.specialActions);
      this.subscribeFinal("specialActionClick");
    } else if (button.boardActions) {
      this.$store.commit("gaiaViewer/highlightBoardActions", button.boardActions);
      this.subscribeFinal("boardActionClick");
    } else if (button.hexes?.selectAnyHex) {
      if (button.rotation) {
        if (this.isActiveButton) {
          const rotations = [...this.$store.state.gaiaViewer.context.rotation.entries()];
          for (const rotation of rotations) {
            rotation[1] %= 6;
          }
          this.emitButtonCommand(button, [].concat(...rotations.filter((r) => !!r[1])).join(" "));
          return;
        }

        this.subscribeHexClick((hex) => this.$store.commit("gaiaViewer/rotate", hex));
        this.customLabel = "Sector rotations finished";
      } else {
        this.selectAnyButton(button);
      }
    } else if (button.handler) {
      button.handler();
    } else if (button.modal) {
      this.modalShow = true;
      button.modal.show(true);
    } else {
      if (button.hexes) {
        //generic hex selection, that's why it's last
        this.subscribeHexClick((hex, highlight) => {
          if (button.needConfirm) {
            this.highlightHexes({ hexes: new Map<GaiaHex, HighlightHex>([[hex, {}]]) });
          }

          this.emitCommand(hex.toString(), { warnings: highlight.warnings });
        });
        return;
      }

      if (button.needConfirm) {
        this.emitButtonCommand(button, null, { disappear: false });
      } else {
        this.emitButtonCommand(button, null, params);
      }
    }
  }

  private selectAnyButton(button: ButtonData) {
    // If already the active button, end the selection
    if (this.isActiveButton) {
      button.command = [...this.$store.state.gaiaViewer.context.highlighted.hexes.hexes.keys()]
        .map((hex) => hex.toString())
        .join(",");
      this.emitButtonCommand(button);
      return;
    }

    this.customLabel = button.label + " - End selection";

    this.subscribeHexClick((hex) => {
      const highlighted = this.$store.state.gaiaViewer.context.highlighted.hexes.hexes;

      if (highlighted.has(hex)) {
        highlighted.delete(hex);
      } else {
        highlighted.set(hex, null);
      }

      const keys: GaiaHex[] = [...highlighted.keys()];
      this.highlightHexes(customHexSelection(new Map([...keys.map((key) => [key, null])] as any)));
    });
  }

  private highlightHexes(selection: HexSelection) {
    this.$store.commit("gaiaViewer/highlightHexes", selection);
  }

  handleRangeClick(times: number) {
    this.emitCommand(null, { times });
  }

  handleOK() {
    this.button.modal.show(false);
    this.emitCommand();
  }

  emitCommand(
    append?: string,
    params?: EmitCommandParams,
  ) {
    this.emitButtonCommand(this.button, append, params);
  }

  emitButtonCommand(
    button: ButtonData,
    append?: string,
    params?: EmitCommandParams,
  ) {
    console.log("emit command", button.command, append, params);

    if (button.needConfirm && append) {
      button.buttons[0].command = append;
    }

    params = Object.assign({}, { disappear: true, times: 1 }, params);
    const { disappear, times, warnings } = params;

    if (disappear) {
      this.unsubscribe();

      this.$store.commit("gaiaViewer/activeButton", null);
    }

    let commandBody: string[] = [];

    // Parse numbers, ie the command is executed X times, multiply
    // each number by X instead of repeating the command X times.
    let command = (button.command || "") + "";

    if (times && typeof times === "number") {
      // the \b is necessary for things like '1t-a3', so the 3 is not caught
      command = command.replace(/\b[0-9]+/g, (x) => "" + parseInt(x) * times);
    }

    command = command.replace(/\$times\b/g, "" + (times ?? 0));

    commandBody = [command, append].filter((x) => !!x);

    this.$emit("trigger", commandBody.join(" "), button, warnings);
  }

  get player(): Player {
    const engine = this.$store.state.gaiaViewer.data;
    return engine.player(engine.currentPlayer);
  }

  hover() {
    if (!this.button.hexes?.hover || this.$store.state.gaiaViewer.context.activeButton !== null) {
      return;
    }

    this.highlightHexes(this.button.hexes);
  }

  leave() {
    if (!this.button.hexes?.hover || this.$store.state.gaiaViewer.context.activeButton !== null) {
      return;
    }

    this.$store.commit("gaiaViewer/clearContext");
  }

  get isActiveButton() {
    return (
      this.$store.state.gaiaViewer.context.activeButton &&
      this.$store.state.gaiaViewer.context.activeButton.label === this.button.label
    );
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

.symbol-button > button {
  padding: 0.275rem 0.35rem 0.275rem 0.15rem;
}
</style>
