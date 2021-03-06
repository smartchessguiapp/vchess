<template lang="pug">
main
  .row
    .col-sm-12.col-md-10.col-md-offset-1.col-lg-8.col-lg-offset-2
      .button-group
        button(@click="clickReadRules()") {{ st.tr["Rules"] }}
        button(
          v-show="!gameInProgress"
          @click="startGame('auto')"
        )
          | {{ st.tr["Example game"] }}
        button(
          v-show="!gameInProgress"
          @click="startGame('versus')"
        )
          | {{ st.tr["Practice"] }}
        button(
          v-show="gameInProgress"
          @click="stopGame()"
        )
          | {{ st.tr["Stop game"] }}
        button(
          v-if="showAnalyzeBtn"
          @click="gotoAnalyze()"
        )
          | {{ st.tr["Analysis mode"] }}
  .row
    .col-sm-12.col-md-8.col-md-offset-2.col-lg-6.col-lg-offset-3
      div(
        v-show="display=='rules'"
        v-html="content"
      )
  ComputerGame(
    ref="compgame"
    v-show="display=='computer'"
    :game-info="gameInfo"
    @game-stopped="gameStopped"
  )
</template>

<script>
import ComputerGame from "@/components/ComputerGame.vue";
import { store } from "@/store";
import { getDiagram } from "@/utils/printDiagram";
import { CompgameStorage } from "@/utils/compgameStorage";
export default {
  name: "my-rules",
  components: {
    ComputerGame
  },
  data: function() {
    return {
      st: store.state,
      display: "rules",
      gameInProgress: false,
      // variables passed to ComputerGame:
      gameInfo: {
        vname: "",
        mode: "versus",
      },
      V: null,
    };
  },
  watch: {
    $route: function(newRoute) {
      this.re_setVariant(newRoute.params["vname"]);
    }
  },
  created: function() {
    // NOTE: variant cannot be set before store is initialized
    this.re_setVariant(this.$route.params["vname"]);
  },
  computed: {
    showAnalyzeBtn: function() {
      return !!this.V && this.V.CanAnalyze;
    },
    content: function() {
      if (!this.gameInfo.vname) return ""; //variant not set yet
      // (AJAX) Request to get rules content (plain text, HTML)
      return (
        require(
          "raw-loader!@/translations/rules/" +
          this.gameInfo.vname + "/" +
          this.st.lang + ".pug"
        )
        // Next two lines fix a weird issue after last update (2019-11)
        .replace(/\\n/g, " ")
        .replace(/\\"/g, '"')
        .replace('module.exports = "', "")
        .replace(/"$/, "")
        .replace(/(fen:)([^:]*):/g, this.replaceByDiag)
      );
    }
  },
  methods: {
    clickReadRules: function() {
      if (this.display != "rules") this.display = "rules";
      else if (this.gameInProgress) this.display = "computer";
    },
    parseFen(fen) {
      const fenParts = fen.split(" ");
      return {
        position: fenParts[0],
        marks: fenParts[1],
        orientation: fenParts[2],
        shadow: fenParts[3]
      };
    },
    // Method to replace diagrams in loaded HTML
    replaceByDiag: function(match, p1, p2) {
      const args = this.parseFen(p2);
      return getDiagram(args);
    },
    re_setVariant: async function(vname) {
      await import("@/variants/" + vname + ".js")
      .then((vModule) => {
        this.V = window.V = vModule[vname + "Rules"];
        this.gameInfo.vname = vname;
      })
      .catch((err) => {
        // Soon after component creation, st.tr might be uninitialized.
        // Set a timeout to let a chance for the message to show translated.
        const text = "Mispelled variant name";
        setTimeout(() => {
          alert(this.st.tr[text] || text);
          this.$router.replace("/variants");
        }, 500);
      });
    },
    startGame: function(mode) {
      if (this.gameInProgress) return;
      this.gameInProgress = true;
      this.display = "computer";
      this.gameInfo.mode = mode;
      if (this.gameInfo.mode == "versus") {
        CompgameStorage.get(this.gameInfo.vname, (game) => {
          // NOTE: game might be null
          this.$refs["compgame"].launchGame(game);
        });
      } else {
        this.$refs["compgame"].launchGame();
      }
    },
    // user wants to stop the game:
    stopGame: function() {
      this.$refs["compgame"].gameOver("?", "Undetermined result");
    },
    // The game is effectively stopped:
    gameStopped: function() {
      this.gameInProgress = false;
      if (this.gameInfo.mode == "versus")
        CompgameStorage.remove(this.gameInfo.vname);
    },
    gotoAnalyze: function() {
      this.$router.push(
        "/analyse/" + this.gameInfo.vname +
        "/?fen=" + V.GenRandInitFen(this.st.settings.randomness)
      );
    }
  }
};
</script>

<!-- NOTE: not scoped here, because HTML is injected (TODO) -->
<style lang="sass">
.warn
  padding: 3px
  color: red
  background-color: lightgrey
  font-weight: bold

figure.diagram-container
  margin: 15px 0 15px 0
  text-align: center
  width: 100%
  display: block
  .diagram
    display: block
    width: 50%
    min-width: 240px
    margin-left: auto
    margin-right: auto
  .diag12
    float: left
    width: 40%
    margin-left: calc(10% - 20px)
    margin-right: 40px
    @media screen and (max-width: 630px)
      float: none
      margin: 0 auto 10px auto
  .diag22
    float: left
    width: 40%
    margin-right: calc(10% - 20px)
    @media screen and (max-width: 630px)
      float: none
      margin: 0 auto
  figcaption
    display: block
    clear: both
    padding-top: 5px
    font-size: 0.8em

p.boxed
  background-color: #FFCC66
  padding: 5px

.bigfont
  font-size: 1.2em

.bold
  font-weight: bold

.stageDelimiter
  color: purple

// To show (new) pieces, and/or there values...
figure.showPieces > img
  width: 50px

figure.showPieces > figcaption
  color: #6C6C6C

.section-title
  padding: 0

.section-title > h4
  padding: 5px

ol, ul:not(.browser-default)
  padding-left: 20px

ul:not(.browser-default)
  margin-top: 5px

ul:not(.browser-default) > li
  list-style-type: disc
</style>
