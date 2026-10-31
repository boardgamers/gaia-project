<template>
  <div :class="[...classes, 'old-ui-game']" id="root">
    <b-modal id="chart-button" title="Victory Points, Resources, and more" size="xl">
      <Charts />
    </b-modal>
    <Rules id="rules" />
    <div class="game-chat-button-host game-chat-button-host--fallback"></div>

    <div v-if="analysisNotice || analysisPendingRestore" class="row">
      <div class="col-12">
        <AnalysisPanel
          :active="analysisMode"
          :notice="analysisNotice"
          :pending-restore="analysisPendingRestore"
          @dismiss-notice="dismissAnalysisNotice"
          @restore="restoreAnalysisLine"
          @discard-restore="discardPendingAnalysisLine"
        />
      </div>
    </div>

    <b-modal
      id="premove-history"
      v-model="premoveHistoryVisible"
      title="Premoves"
      size="lg"
      ok-only
      ok-title="Close"
      dialog-class="gaia-viewer-modal"
    >
      <PremoveQueue
        v-if="premoveHistoryVisible"
        :plan="myPremovePlan"
        :costs="premoveCosts"
        :notice-storage-key="premoveNoticeStorageKey"
        :move-history="premoveNoticeHistory"
        :pending="!!$store.state.pendingPlan"
        :active="analysisMode"
        :queue-enabled="premoveAvailable"
        :can-preview="!replayData && (analysisMode || analysisOffered)"
        @exit="exitAnalysisMode"
        @view="viewPremoves"
        @cancel="cancelPremoves"
      />
    </b-modal>
    <div v-if="$store.state.planError" class="alert alert-warning" role="status">{{ $store.state.planError }}</div>
    <template v-if="uiMode === 'graphical'">
      <div class="row" v-if="!ended">
        <div class="col-12">
          <SilentAuctionSummary />
          <PreferenceSplitSummary />
          <SetupStatus />

          <PreferenceSplitBid @command="handleCommand" />
          <SilentAuctionBid @command="handleCommand" />

          <Commands
            v-if="setupActionsAtTop && showCommands"
            :actions-enabled="canPlay"
            :auto-charge-enabled="!replayData && !$store.state.preferences.analysis"
            @command="handleCommand"
            :currentMove="currentMove"
            :hide-spacer="true"
            :analysis-mode="analysisMode"
            :analysis-offered="analysisOffered && !replayData"
            :take-back-offered="takeBackOffered"
            @analysis-start="enterAnalysisMode"
            @analysis-exit="exitAnalysisMode"
            :analysis-status="analysisStatus"
            :analysis-move-count="analysisAppliedEntries.filter((entry) => entry.kind === 'move').length"
            :analysis-can-edit="!!(analysisEntries.length || currentMove || analysisPendingCharge || analysisUndo)"
            :analysis-can-undo-charge="
              analysisPendingCharge > 0 ||
              (!analysisEdit && analysisAppliedEntries[analysisAppliedEntries.length - 1]?.kind === 'adjust')
            "
            :analysis-committable-moves="analysisCommittableMoves.length"
            :analysis-commit-plan="analysisCommitPlan"
            :analysis-faction-choices="analysisFactionChoices"
            :analysis-line-summaries="analysisLineSummaries"
            :analysis-active-line="analysisActiveLine"
            :premove-plan="myPremovePlan"
            :analysis-entries="analysisEntries"
            :analysis-played="analysisPlayed[analysisActiveLine] || []"
            :analysis-blocked-reason="analysisBlockedReason"
            :analysis-move-costs="analysisMoveCosts"
            :analysis-applied-count="analysisEdit ? analysisEdit.appliedCount : analysisAppliedCount"
            :analysis-editing-index="analysisEdit ? analysisEdit.index : -1"
            :analysis-inserting-move="!!analysisEdit && analysisEdit.mode === 'insert'"
            @analysis-insert-move="insertAnalysisMove"
            @analysis-remove-entry="removeAnalysisEntry"
            @analysis-edit-move="startAnalysisMoveEdit"
            @analysis-cancel-edit="cancelAnalysisMoveEdit"
            @analysis-restart-edit="restartAnalysisMoveEdit"
            @analysis-seed-faction="seedAnalysisFaction"
            @analysis-commit="commitAnalysisLine"
            @analysis-charge="chargeAnalysisPower"
            @analysis-undo-charge="undoAnalysisCharge"
            @analysis-undo="undoLastAnalysisEntry"
            @analysis-reset="resetAnalysisLine"
            @analysis-select-line="selectAnalysisLine"
            @analysis-add-line="addAnalysisLine"
            @analysis-close-line="closeAnalysisLine"
            @sticky-bar-height="stickyBarHeight = $event"
          />

          <FactionBrowser v-if="setupActionsAtTop" :on-turn="canPlay" />
        </div>
      </div>
      <div v-if="hasMap" class="old-board-row">
        <SpaceMap class="old-space-map" />
        <div class="old-research-panel">
          <svg v-if="!engine.options.lostFleet" class="old-research-board" :viewBox="`0 0 ${scoringX + 90} 450`">
            <ResearchBoard :height="450" ref="researchBoard" />
            <ScoringBoard height="450" width="90" :x="scoringX" />
          </svg>
          <ResearchBoard v-else class="old-research-board" :height="550" ref="researchBoard" />
        </div>
      </div>
      <LostFleetShips v-if="engine.options.lostFleet" class="old-fleet-ships" />
      <div class="row mt-2">
        <TurnOrder v-if="!ended && engine.players.length > 0" class="col-md-4 order-4 order-md-1" />
        <div :class="commandsColumnClass">
          <Commands
            @command="handleCommand"
            v-if="showCommands && !setupActionsAtTop"
            :actions-enabled="canPlay"
            :auto-charge-enabled="!replayData && !$store.state.preferences.analysis"
            :currentMove="currentMove"
            :hide-spacer="true"
            :analysis-mode="analysisMode"
            :analysis-offered="analysisOffered && !replayData"
            :take-back-offered="takeBackOffered"
            @analysis-start="enterAnalysisMode"
            @analysis-exit="exitAnalysisMode"
            :analysis-status="analysisStatus"
            :analysis-move-count="analysisAppliedEntries.filter((entry) => entry.kind === 'move').length"
            :analysis-can-edit="!!(analysisEntries.length || currentMove || analysisPendingCharge || analysisUndo)"
            :analysis-can-undo-charge="
              analysisPendingCharge > 0 ||
              (!analysisEdit && analysisAppliedEntries[analysisAppliedEntries.length - 1]?.kind === 'adjust')
            "
            :analysis-committable-moves="analysisCommittableMoves.length"
            :analysis-commit-plan="analysisCommitPlan"
            :analysis-faction-choices="analysisFactionChoices"
            :analysis-line-summaries="analysisLineSummaries"
            :analysis-active-line="analysisActiveLine"
            :premove-plan="myPremovePlan"
            :analysis-entries="analysisEntries"
            :analysis-played="analysisPlayed[analysisActiveLine] || []"
            :analysis-blocked-reason="analysisBlockedReason"
            :analysis-move-costs="analysisMoveCosts"
            :analysis-applied-count="analysisEdit ? analysisEdit.appliedCount : analysisAppliedCount"
            :analysis-editing-index="analysisEdit ? analysisEdit.index : -1"
            :analysis-inserting-move="!!analysisEdit && analysisEdit.mode === 'insert'"
            @analysis-insert-move="insertAnalysisMove"
            @analysis-remove-entry="removeAnalysisEntry"
            @analysis-edit-move="startAnalysisMoveEdit"
            @analysis-cancel-edit="cancelAnalysisMoveEdit"
            @analysis-restart-edit="restartAnalysisMoveEdit"
            @analysis-seed-faction="seedAnalysisFaction"
            @analysis-commit="commitAnalysisLine"
            @analysis-charge="chargeAnalysisPower"
            @analysis-undo-charge="undoAnalysisCharge"
            @analysis-undo="undoLastAnalysisEntry"
            @analysis-reset="resetAnalysisLine"
            @analysis-select-line="selectAnalysisLine"
            @analysis-add-line="addAnalysisLine"
            @analysis-close-line="closeAnalysisLine"
            @sticky-bar-height="stickyBarHeight = $event"
          />

          <div v-else-if="offlineMirrorWaiting" class="text-muted small">
            Waiting for {{ turnPlayer.name || "the other player" }}. This is your offline copy of an online game, so you
            play only your own seats here; their move arrives the next time you open the game with a connection.
          </div>

          <FactionBrowser v-if="!setupActionsAtTop" :on-turn="canPlay" />
        </div>
      </div>
      <AdvancedLog
        class="col-12 order-last mt-4"
        :currentMove="currentMove"
        :hideLog.sync="hideLog"
        v-if="logPlacement === 'top'"
      />
      <div class="row mt-2">
        <template v-if="sessionPlayer === undefined">
          <PlayerInfo
            v-for="player in orderedPlayers"
            :player="player"
            :reference-engine="player.player !== analysisSeat ? analysisReferenceEngine : undefined"
            :key="player.player"
            class="col-md-6 order-6"
          />
        </template>
        <template v-else>
          <PlayerInfo :player="sessionPlayer" class="col-md-6 order-3" />
          <PlayerInfo
            v-for="player in orderedPlayers.filter((pl) => pl !== sessionPlayer)"
            :player="player"
            :reference-engine="analysisReferenceEngine"
            :key="player.player"
            class="col-md-6 order-6"
          />
        </template>

        <Pool class="col-12 order-10 mt-4" />
        <AdvancedLog
          class="col-12 order-last mt-4"
          :currentMove="currentMove"
          :hideLog.sync="hideLog"
          v-if="logPlacement === 'bottom'"
        />
      </div>
    </template>
    <div v-else class="d-flex flex-column">
      <SetupStatus v-if="!ended" />
      <SpaceMap
        v-if="hasMap"
        :class="['mb-1', 'space-map', 'col-md-7']"
        :analysis-offered="analysisOffered"
        :analysis-active="analysisMode"
        :analysis-can-edit="analysisAppliedEntries.length > 0"
        @analysis-toggle="toggleAnalysisMode"
        @analysis-undo="undoLastAnalysisEntry"
        @analysis-reset="resetAnalysisLine"
      />
      <AdvancedLog :currentMove="currentMove" :hideLog.sync="hideLog" v-if="logPlacement === 'top'" />
      <Commands
        @command="handleCommand"
        v-if="showCommands"
        :actions-enabled="canPlay"
        :auto-charge-enabled="!replayData && !$store.state.preferences.analysis"
        :currentMove="currentMove"
        :hide-spacer="true"
        @sticky-bar-height="stickyBarHeight = $event"
        :analysis-mode="analysisMode"
        :analysis-offered="analysisOffered && !replayData"
        :take-back-offered="takeBackOffered"
        @analysis-start="enterAnalysisMode"
        @analysis-exit="exitAnalysisMode"
        :analysis-status="analysisStatus"
        :analysis-move-count="analysisAppliedEntries.filter((entry) => entry.kind === 'move').length"
        :analysis-can-edit="!!(analysisEntries.length || currentMove || analysisPendingCharge || analysisUndo)"
        :analysis-can-undo-charge="
          analysisPendingCharge > 0 ||
          (!analysisEdit && analysisAppliedEntries[analysisAppliedEntries.length - 1]?.kind === 'adjust')
        "
        :analysis-committable-moves="analysisCommittableMoves.length"
        :analysis-commit-plan="analysisCommitPlan"
        :analysis-faction-choices="analysisFactionChoices"
        :analysis-line-summaries="analysisLineSummaries"
        :analysis-active-line="analysisActiveLine"
        :premove-plan="myPremovePlan"
        :analysis-entries="analysisEntries"
        :analysis-played="analysisPlayed[analysisActiveLine] || []"
        :analysis-blocked-reason="analysisBlockedReason"
        :analysis-move-costs="analysisMoveCosts"
        :analysis-applied-count="analysisEdit ? analysisEdit.appliedCount : analysisAppliedCount"
        :analysis-editing-index="analysisEdit ? analysisEdit.index : -1"
        :analysis-inserting-move="!!analysisEdit && analysisEdit.mode === 'insert'"
        @analysis-insert-move="insertAnalysisMove"
        @analysis-remove-entry="removeAnalysisEntry"
        @analysis-edit-move="startAnalysisMoveEdit"
        @analysis-cancel-edit="cancelAnalysisMoveEdit"
        @analysis-restart-edit="restartAnalysisMoveEdit"
        @analysis-seed-faction="seedAnalysisFaction"
        @analysis-commit="commitAnalysisLine"
        @analysis-charge="chargeAnalysisPower"
        @analysis-undo-charge="undoAnalysisCharge"
        @analysis-undo="undoLastAnalysisEntry"
        @analysis-reset="resetAnalysisLine"
        @analysis-select-line="selectAnalysisLine"
        @analysis-add-line="addAnalysisLine"
        @analysis-close-line="closeAnalysisLine"
      />
      <Table :players="orderedPlayers" />
      <AdvancedLog :currentMove="currentMove" :hideLog.sync="hideLog" v-if="logPlacement === 'bottom'" />
    </div>

    <div
      class="mobile-sticky-actions-spacer"
      :style="{ '--sticky-bar-height': totalStickyFooterHeight + 'px' }"
      aria-hidden="true"
    ></div>
  </div>
</template>

<script lang="ts">
import { Component } from "vue-property-decorator";
import CurrentGame from "../../../viewer/src/components/Game.vue";
import LostFleetShips from "./LostFleetShips.vue";
import PlayerInfo from "./PlayerInfo.vue";
import Pool from "./Pool.vue";
import ResearchBoard from "./ResearchBoard.vue";
import ScoringBoard from "./ScoringBoard.vue";
import SpaceMap from "./SpaceMap.vue";
@Component({ components: { Pool, SpaceMap, PlayerInfo, ResearchBoard, ScoringBoard, LostFleetShips } })
export default class Game extends CurrentGame {
  get scoringX() {
    return this.engine.expansions ? 505 : 385;
  }
}
</script>
<style lang="scss">
.old-ui-game .old-board-row {
  display: flex;
  align-items: start;
  gap: 8px;
}
.old-ui-game .old-space-map {
  flex: 1 1 55%;
  width: 55%;
  min-width: 0;
  height: auto;
  max-height: 550px;
}
.old-ui-game .old-research-panel {
  flex: 1 1 45%;
  width: 45%;
  min-width: 0;
  touch-action: pan-y pinch-zoom;
}
.old-ui-game .old-research-board {
  width: 100%;
  max-height: 550px;
  height: auto;
}
.old-ui-game .old-fleet-ships .lost-fleet-ships__boards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
@media (max-width: 767px) {
  .old-ui-game .old-board-row {
    display: block;
  }
  .old-ui-game .old-space-map,
  .old-ui-game .old-research-panel {
    width: 100%;
  }
  .old-ui-game .old-fleet-ships .lost-fleet-ships__boards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
