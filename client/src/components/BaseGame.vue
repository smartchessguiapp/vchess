<template lang="pug">
.row
  .col-sm-12.col-md-10.col-md-offset-1.col-lg-8.col-lg-offset-2
    input#modalEog.modal(type="checkbox")
    div(role="dialog" aria-labelledby="eogMessage")
      .card.smallpad.small-modal.text-center
        label.modal-close(for="modalEog")
        h3#eogMessage.section {{ endgameMessage }}
    Board(:vr="vr" :last-move="lastMove" :analyze="analyze"
      :user-color="gameInfo.mycolor" :orientation="orientation"
      :vname="vname" @play-move="play")
    .button-group
      button(@click="() => play()") Play
      button(@click="() => undo()") Undo
      button(@click="flip") Flip
      button(@click="gotoBegin") GotoBegin
      button(@click="gotoEnd") GotoEnd
    #fenDiv.section-content(v-if="showFen && !!vr")
      p#fenString.text-center {{ vr.getFen() }}
    #pgnDiv.section-content
      a#download(href="#")
      .button-group
        button#downloadBtn(@click="download") {{ st.tr["Download PGN"] }}
        button Import game
    //MoveList(v-if="showMoves"
      :moves="moves" :cursor="cursor" @goto-move="gotoMove")
</template>

<script>
import Board from "@/components/Board.vue";
//import MoveList from "@/components/MoveList.vue";
import { store } from "@/store";
import { getSquareId } from "@/utils/squareId";

export default {
  name: 'my-base-game',
  components: {
    Board,
    //MoveList,
  },
  // "vr": VariantRules object, describing the game state + rules
  // fenStart, players, mycolor
  props: ["vname","analyze","vr","gameInfo"],
  data: function() {
    return {
      st: store.state,
      // NOTE: all following variables must be reset at the beginning of a game
      endgameMessage: "",
      orientation: "w",
      score: "*", //'*' means 'unfinished'
      moves: [],
      cursor: -1, //index of the move just played
      lastMove: null,
    };
  },
  watch: {
    // gameInfo (immutable once set) changes when a new game starts
    "gameInfo": function() {
      // Reset all variables
      this.endgameMessage = "";
      this.orientation = this.gameInfo.mycolor || "w"; //default orientation for observed games
      this.score = this.gameInfo.score; //mutable (if initially "*")
      this.moves = this.gameInfo.moves; //TODO: this is mutable; make a copy instead
      const L = this.moves.length;
      this.cursor = L-1;
      this.lastMove = (L > 0 ? this.moves[L-1]  : null);
    },
    analyze: function() {
      if (this.analyze)
      {
        // Switched to analyze mode: game is over
        this.endGame("*");
      }
    },
  },
  computed: {
    showMoves: function() {
      return true;
      //return window.innerWidth >= 768;
    },
    showFen: function() {
      return this.vname != "Dark" || this.score != "*";
    },
  },
  methods: {
    setEndgameMessage: function(score) {
      let eogMessage = "Undefined";
      switch (score)
      {
        case "1-0":
          eogMessage = translations["White win"];
          break;
        case "0-1":
          eogMessage = translations["Black win"];
          break;
        case "1/2":
          eogMessage = translations["Draw"];
          break;
        case "?":
          eogMessage = "Unfinished";
          break;
      }
      this.endgameMessage = eogMessage;
    },
    download: function() {
      const content = this.getPgn();
      // Prepare and trigger download link
      let downloadAnchor = document.getElementById("download");
      downloadAnchor.setAttribute("download", "game.pgn");
      downloadAnchor.href = "data:text/plain;charset=utf-8," + encodeURIComponent(content);
      downloadAnchor.click();
    },
    getPgn: function() {
      let pgn = "";
      pgn += '[Site "vchess.club"]\n';
      pgn += '[Variant "' + this.vname + '"]\n';
      pgn += '[Date "' + getDate(new Date()) + '"]\n';
      pgn += '[White "' + this.gameInfo.players[0] + '"]\n';
      pgn += '[Black "' + this.gameInfo.players[1] + '"]\n';
      pgn += '[Fen "' + this.gameInfo.fenStart + '"]\n';
      pgn += '[Result "' + this.score + '"]\n\n';
      let counter = 1;
      let i = 0;
      while (i < this.moves.length)
      {
        pgn += (counter++) + ".";
        for (let color of ["w","b"])
        {
          let move = "";
          while (i < this.moves.length && this.moves[i].color == color)
            move += this.moves[i++].notation[0] + ",";
          move = move.slice(0,-1); //remove last comma
          pgn += move + (i < this.moves.length-1 ? " " : "");
        }
      }
      return pgn + "\n";
    },
    showScoreMsg: function(score) {
      this.setEndgameMessage(score);
      let modalBox = document.getElementById("modalEog");
      modalBox.checked = true;
      setTimeout(() => { modalBox.checked = false; }, 2000);
    },
    endGame: function(score) {
      this.score = score;
      this.showScoreMsg(score);
      this.$emit("game-over");
    },
    animateMove: function(move) {
      let startSquare = document.getElementById(getSquareId(move.start));
      let endSquare = document.getElementById(getSquareId(move.end));
      let rectStart = startSquare.getBoundingClientRect();
      let rectEnd = endSquare.getBoundingClientRect();
      let translation = {x:rectEnd.x-rectStart.x, y:rectEnd.y-rectStart.y};
      let movingPiece =
        document.querySelector("#" + getSquareId(move.start) + " > img.piece");
      // HACK for animation (with positive translate, image slides "under background")
      // Possible improvement: just alter squares on the piece's way...
      const squares = document.getElementsByClassName("board");
      for (let i=0; i<squares.length; i++)
      {
        let square = squares.item(i);
        if (square.id != getSquareId(move.start))
          square.style.zIndex = "-1";
      }
      movingPiece.style.transform = "translate(" + translation.x + "px," +
        translation.y + "px)";
      movingPiece.style.transitionDuration = "0.2s";
      movingPiece.style.zIndex = "3000";
      setTimeout( () => {
        for (let i=0; i<squares.length; i++)
          squares.item(i).style.zIndex = "auto";
        movingPiece.style = {}; //required e.g. for 0-0 with KR swap
        this.play(move);
      }, 250);
    },
    play: function(move, programmatic) {
      let navigate = !move;
      // Forbid playing outside analyze mode when cursor isn't at moves.length-1
      // (except if we receive opponent's move, human or computer)
      if (!navigate && !this.analyze && !programmatic
        && this.cursor < this.moves.length-1)
      {
        return;
      }
      if (navigate)
      {
        if (this.cursor == this.moves.length-1)
          return; //no more moves
        move = this.moves[this.cursor+1];
      }
      if (!!programmatic) //computer or (remote) human opponent
      {
        if (this.cursor < this.moves.length-1)
          this.gotoEnd(); //required to play the move
        return this.animateMove(move);
      }
      // Not programmatic, or animation is over
      if (!move.notation)
        move.notation = this.vr.getNotation(move);
      if (!move.color)
        move.color = this.vr.turn;
      this.vr.play(move);
      this.cursor++;
      this.lastMove = move;
      if (!move.fen)
        move.fen = this.vr.getFen();
      if (this.st.settings.sound == 2)
        new Audio("/sounds/move.mp3").play().catch(err => {});
      if (!navigate && (this.score == "*" || this.analyze))
      {
        // Stack move on movesList at current cursor
        if (this.cursor == this.moves.length)
          this.moves.push(move);
        else
          this.moves = this.moves.slice(0,this.cursor).concat([move]);
      }
      // Is opponent in check?
      this.incheck = this.vr.getCheckSquares(this.vr.turn);
      const score = this.vr.getCurrentScore();
      if (score != "*")
      {
        if (!this.analyze)
          this.endGame(score);
        else //just show score on screen (allow undo)
          this.showScoreMsg(score);
      }
      if (!this.analyze)
        this.$emit("newmove", move); //post-processing (e.g. computer play)
    },
    undo: function(move) {
      let navigate = !move;
      if (navigate)
      {
        if (this.cursor < 0)
          return; //no more moves
        move = this.moves[this.cursor];
      }
      this.vr.undo(move);
      this.cursor--;
      this.lastMove = (this.cursor >= 0 ? this.moves[this.cursor] : undefined);
      if (this.st.settings.sound == 2)
        new Audio("/sounds/undo.mp3").play().catch(err => {});
      this.incheck = this.vr.getCheckSquares(this.vr.turn);
      if (!navigate)
        this.moves.pop();
    },
    gotoMove: function(index) {
      this.vr.re_init(this.moves[index].fen);
      this.cursor = index;
      this.lastMove = this.moves[index];
    },
    gotoBegin: function() {
      this.vr.re_init(this.fenStart);
      this.cursor = -1;
      this.lastMove = null;
    },
    gotoEnd: function() {
      this.gotoMove(this.moves.length-1);
    },
    flip: function() {
      this.orientation = V.GetNextCol(this.orientation);
    },
  },
};
</script>