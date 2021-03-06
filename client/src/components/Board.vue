<script>
import { getSquareId, getSquareFromId } from "@/utils/squareId";
import { ArrayFun } from "@/utils/array";
import { store } from "@/store";
export default {
  name: "my-board",
  // Last move cannot be guessed from here, and is required to highlight squares
  // vr: object to check moves, print board...
  // userColor is left undefined for an external observer
  props: [
    "vr",
    "lastMove",
    "analyze",
    "score",
    "incheck",
    "orientation",
    "userColor",
    "vname"
  ],
  data: function() {
    return {
      mobileBrowser: ("ontouchstart" in window),
      possibleMoves: [], //filled after each valid click/dragstart
      choices: [], //promotion pieces, or checkered captures... (as moves)
      selectedPiece: null, //moving piece (or clicked piece)
      start: null, //pixels coordinates + id of starting square (click or drag)
      click: "",
      clickTime: 0,
      settings: store.state.settings
    };
  },
  render(h) {
    if (!this.vr) {
      // Return empty div of class 'game' to avoid error when setting size
      return h("div", {
        class: {
          game: true
        }
      });
    }
    const [sizeX, sizeY] = [V.size.x, V.size.y];
    // Precompute hints squares to facilitate rendering
    let hintSquares = ArrayFun.init(sizeX, sizeY, false);
    this.possibleMoves.forEach(m => {
      hintSquares[m.end.x][m.end.y] = true;
    });
    // Also precompute in-check squares
    let incheckSq = ArrayFun.init(sizeX, sizeY, false);
    this.incheck.forEach(sq => {
      incheckSq[sq[0]][sq[1]] = true;
    });

    const lm = this.lastMove;
    const showLight = (
      this.settings.highlight &&
      ["all","highlight"].includes(V.ShowMoves)
    );
    const orientation = !V.CanFlip ? "w" : this.orientation;
    // Ensure that squares colors do not change when board is flipped
    const lightSquareMod = (sizeX + sizeY) % 2;
    const showPiece = (x, y) => {
      return (
        this.vr.board[x][y] != V.EMPTY &&
        (!this.vr.enlightened || this.analyze || this.score != "*" ||
          (!!this.userColor && this.vr.enlightened[this.userColor][x][y]))
      );
    };
    const inHighlight = (x, y) => {
      return showLight && !!lm && (
        (lm.end.x == x && lm.end.y == y) ||
        (lm.start.x == x && lm.start.y == y));
    };
    const inShadow = (x, y) => {
      return (
        !this.analyze &&
        this.score == "*" &&
        this.vr.enlightened &&
        (!this.userColor || !this.vr.enlightened[this.userColor][x][y])
      );
    };
    // Create board element (+ reserves if needed by variant)
    let elementArray = [];
    const gameDiv = h(
      "div",
      {
        class: {
          game: true,
          clearer: true
        }
      },
      [...Array(sizeX).keys()].map(i => {
        const ci = orientation == "w" ? i : sizeX - i - 1;
        return h(
          "div",
          {
            class: {
              row: true
            },
            style: { opacity: this.choices.length > 0 ? "0.5" : "1" }
          },
          [...Array(sizeY).keys()].map(j => {
            const cj = orientation == "w" ? j : sizeY - j - 1;
            let elems = [];
            if (showPiece(ci, cj)) {
              elems.push(
                h("img", {
                  class: {
                    piece: true,
                    ghost:
                      !!this.selectedPiece &&
                      this.selectedPiece.parentNode.id == "sq-" + ci + "-" + cj
                  },
                  attrs: {
                    src:
                      "/images/pieces/" +
                      this.vr.getPpath(
                        this.vr.board[ci][cj],
                        // Extra args useful for some variants:
                        this.userColor,
                        this.score,
                        this.orientation) +
                      V.IMAGE_EXTENSION
                  }
                })
              );
            }
            if (this.settings.hints && hintSquares[ci][cj]) {
              elems.push(
                h("img", {
                  class: {
                    "mark-square": true
                  },
                  attrs: {
                    src: "/images/mark.svg"
                  }
                })
              );
            }
            const lightSquare = (ci + cj) % 2 == lightSquareMod;
            return h(
              "div",
              {
                class: {
                  board: true,
                  ["board" + sizeY]: true,
                  "light-square": lightSquare,
                  "dark-square": !lightSquare,
                  [this.settings.bcolor]: true,
                  "in-shadow": inShadow(ci, cj),
                  "highlight-light": inHighlight(ci, cj) && lightSquare,
                  "highlight-dark": inHighlight(ci, cj) && !lightSquare,
                  "incheck-light": showLight && lightSquare && incheckSq[ci][cj],
                  "incheck-dark": showLight && !lightSquare && incheckSq[ci][cj]
                },
                attrs: {
                  id: getSquareId({ x: ci, y: cj })
                }
              },
              elems
            );
          })
        );
      })
    );
    if (!!this.vr.reserve) {
      const playingColor = this.userColor || "w"; //default for an observer
      const shiftIdx = playingColor == "w" ? 0 : 1;
      let myReservePiecesArray = [];
      for (let i = 0; i < V.RESERVE_PIECES.length; i++) {
        const qty = this.vr.reserve[playingColor][V.RESERVE_PIECES[i]];
        myReservePiecesArray.push(
          h(
            "div",
            {
              class: { board: true, ["board" + sizeY]: true },
              attrs: { id: getSquareId({ x: sizeX + shiftIdx, y: i }) },
              style: { opacity: qty > 0 ? 1 : 0.35 }
            },
            [
              h("img", {
                class: { piece: true, reserve: true },
                attrs: {
                  src:
                    "/images/pieces/" +
                    this.vr.getReservePpath(i, playingColor) +
                    ".svg"
                }
              }),
              h("sup", { class: { "reserve-count": true } }, [ qty ])
            ]
          )
        );
      }
      let oppReservePiecesArray = [];
      const oppCol = V.GetOppCol(playingColor);
      for (let i = 0; i < V.RESERVE_PIECES.length; i++) {
        const qty = this.vr.reserve[oppCol][V.RESERVE_PIECES[i]];
        oppReservePiecesArray.push(
          h(
            "div",
            {
              class: { board: true, ["board" + sizeY]: true },
              attrs: { id: getSquareId({ x: sizeX + (1 - shiftIdx), y: i }) },
              style: { opacity: qty > 0 ? 1 : 0.35 }
            },
            [
              h("img", {
                class: { piece: true, reserve: true },
                attrs: {
                  src:
                    "/images/pieces/" +
                    this.vr.getReservePpath(i, oppCol) +
                    ".svg"
                }
              }),
              h("sup", { class: { "reserve-count": true } }, [ qty ])
            ]
          )
        );
      }
      const myReserveTop = (
        (playingColor == 'w' && orientation == 'b') ||
        (playingColor == 'b' && orientation == 'w')
      );
      // Center reserves, assuming same number of pieces for each side:
      const nbReservePieces = myReservePiecesArray.length;
      const marginLeft = ((100 - nbReservePieces * (100 / sizeY)) / 2) + "%";
      const reserveTop =
        h(
          "div",
          {
            class: {
              game: true,
              "reserve-div": true
            },
            style: {
              "margin-left": marginLeft
            }
          },
          [
            h(
              "div",
              {
                class: {
                  row: true,
                  "reserve-row": true
                }
              },
              myReserveTop ? myReservePiecesArray : oppReservePiecesArray
            )
          ]
        );
      var reserveBottom =
        h(
          "div",
          {
            class: {
              game: true,
              "reserve-div": true
            },
            style: {
              "margin-left": marginLeft
            }
          },
          [
            h(
              "div",
              {
                class: {
                  row: true,
                  "reserve-row": true
                }
              },
              myReserveTop ? oppReservePiecesArray : myReservePiecesArray
            )
          ]
        );
      elementArray.push(reserveTop);
    }
    elementArray.push(gameDiv);
    if (!!this.vr.reserve) elementArray.push(reserveBottom);
    const boardElt = document.querySelector(".game");
    if (this.choices.length > 0 && !!boardElt) {
      // No choices to show at first drawing
      const squareWidth = boardElt.offsetWidth / sizeY;
      const offset = [boardElt.offsetTop, boardElt.offsetLeft];
      const maxNbeltsPerRow = Math.min(this.choices.length, sizeY);
      let topOffset = offset[0] + (sizeY / 2) * squareWidth - squareWidth / 2;
      let choicesHeight = squareWidth;
      if (this.choices.length >= sizeY) {
        // A second row is required (Eightpieces variant)
        topOffset -= squareWidth / 2;
        choicesHeight *= 2;
      }
      const choices = h(
        "div",
        {
          attrs: { id: "choices" },
          class: { row: true },
          style: {
            top: topOffset + "px",
            left:
              offset[1] +
              (squareWidth * Math.max(sizeY - this.choices.length, 0)) / 2 +
              "px",
            width: (maxNbeltsPerRow * squareWidth) + "px",
            height: choicesHeight + "px"
          }
        },
        [ h(
          "div",
          { },
          this.choices.map(m => {
            // A "choice" is a move
            const applyMove = (e) => {
              e.stopPropagation();
              // Force a delay between move is shown and clicked
              // (otherwise a "double-click" bug might occur)
              if (Date.now() - this.clickTime < 200) return;
              this.play(m);
              this.choices = [];
            };
            const onClick =
              this.mobileBrowser
                ? { touchend: applyMove }
                : { mouseup: applyMove };
            return h(
              "div",
              {
                class: {
                  board: true,
                  ["board" + sizeY]: true
                },
                style: {
                  width: (100 / maxNbeltsPerRow) + "%",
                  "padding-bottom": (100 / maxNbeltsPerRow) + "%"
                }
              },
              [
                h("img", {
                  attrs: {
                    src:
                      "/images/pieces/" +
                      this.vr.getPPpath(
                        m.appear[0].c + m.appear[0].p,
                        // Extra arg useful for some variants:
                        this.orientation) +
                      V.IMAGE_EXTENSION
                  },
                  class: { "choice-piece": true },
                  on: onClick
                })
              ]
            );
          })
        ) ]
      );
      elementArray.unshift(choices);
    }
    let onEvents = {};
    // NOTE: click = mousedown + mouseup
    if (this.mobileBrowser) {
      onEvents = {
        on: {
          touchstart: this.mousedown,
          touchmove: this.mousemove,
          touchend: this.mouseup
        }
      };
    } else {
      onEvents = {
        on: {
          mousedown: this.mousedown,
          mousemove: this.mousemove,
          mouseup: this.mouseup
        }
      };
    }
    return h("div", onEvents, elementArray);
  },
  methods: {
    mousedown: function(e) {
      e.preventDefault();
      if (!this.start) {
        // Start square must contain a piece.
        // NOTE: classList[0] is enough: 'piece' is the first assigned class
        if (e.target.classList[0] != "piece") return;
        let parent = e.target.parentNode; //surrounding square
        // Show possible moves if current player allowed to play
        const startSquare = getSquareFromId(parent.id);
        this.possibleMoves = [];
        const color = this.analyze ? this.vr.turn : this.userColor;
        if (this.vr.canIplay(color, startSquare))
          this.possibleMoves = this.vr.getPossibleMovesFrom(startSquare);
        // For potential drag'n drop, remember start coordinates
        // (to center the piece on mouse cursor)
        let rect = parent.getBoundingClientRect();
        this.start = {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.width / 2,
          id: parent.id
        };
        // Add the moving piece to the board, just after current image
        this.selectedPiece = e.target.cloneNode();
        Object.assign(
          this.selectedPiece.style,
          {
            position: "absolute",
            top: 0,
            display: "inline-block",
            zIndex: 3000
          }
        );
        parent.insertBefore(this.selectedPiece, e.target.nextSibling);
      } else {
        this.processMoveAttempt(e);
      }
    },
    mousemove: function(e) {
      if (!this.selectedPiece) return;
      e.preventDefault();
      // There is an active element: move it around
      const [offsetX, offsetY] =
        this.mobileBrowser
          ? [e.changedTouches[0].pageX, e.changedTouches[0].pageY]
          : [e.clientX, e.clientY];
      Object.assign(
        this.selectedPiece.style,
        {
          left: offsetX - this.start.x + "px",
          top: offsetY - this.start.y + "px"
        }
      );
    },
    mouseup: function(e) {
      if (!this.selectedPiece) return;
      e.preventDefault();
      // Drag'n drop. Selected piece is no longer needed:
      this.selectedPiece.parentNode.removeChild(this.selectedPiece);
      delete this.selectedPiece;
      this.selectedPiece = null;
      this.processMoveAttempt(e);
    },
    processMoveAttempt: function(e) {
      // Obtain the move from start and end squares
      const [offsetX, offsetY] =
        this.mobileBrowser
          ? [e.changedTouches[0].pageX, e.changedTouches[0].pageY]
          : [e.clientX, e.clientY];
      let landing = document.elementFromPoint(offsetX, offsetY);
      // Next condition: classList.contains(piece) fails because of marks
      while (landing.tagName == "IMG") landing = landing.parentNode;
      if (this.start.id == landing.id) {
        if (this.click == landing.id) {
          // Second click on same square: cancel current move
          this.possibleMoves = [];
          this.start = null;
          this.click = "";
        } else this.click = landing.id;
        return;
      }
      this.start = null;
      // OK: process move attempt, landing is a square node
      let endSquare = getSquareFromId(landing.id);
      let moves = this.findMatchingMoves(endSquare);
      this.possibleMoves = [];
      if (moves.length > 1) {
        this.clickTime = Date.now();
        this.choices = moves;
      } else if (moves.length == 1) this.play(moves[0]);
      // else: forbidden move attempt
    },
    findMatchingMoves: function(endSquare) {
      // Run through moves list and return the matching set (if promotions...)
      return (
        this.possibleMoves.filter(m => {
          return (endSquare[0] == m.end.x && endSquare[1] == m.end.y);
        })
      );
    },
    play: function(move) {
      this.$emit("play-move", move);
    }
  }
};
</script>

<style lang="sass" scoped>
.game.reserve-div
  margin-bottom: 18px

.reserve-count
  padding-left: 40%

.reserve-row
  margin-bottom: 15px

// NOTE: no variants with reserve of size != 8

.game
  user-select: none
  width: 100%
  margin: 0
  .board
    cursor: pointer

#choices
  user-select: none
  margin: 0
  position: absolute
  z-index: 300
  overflow-y: inherit
  background-color: rgba(0,0,0,0)
  img
    cursor: pointer
    background-color: #e6ee9c
    &:hover
      background-color: skyblue
    &.choice-piece
      width: 100%
      height: auto
      display: block

img.ghost
  position: absolute
  opacity: 0.5
  top: 0

.incheck-light
  background-color: rgba(204, 51, 0, 0.7) !important
.incheck-dark
  background-color: rgba(204, 51, 0, 0.9) !important

.light-square.lichess
  background-color: #f0d9b5;
.dark-square.lichess
  background-color: #b58863;

.light-square.chesscom
  background-color: #e5e5ca;
.dark-square.chesscom
  background-color: #6f8f57;

.light-square.chesstempo
  background-color: #dfdfdf;
.dark-square.chesstempo
  background-color: #7287b6;

// TODO: no predefined highlight colors, but layers. How?

.light-square.lichess.highlight-light
  background-color: #cdd26a
.dark-square.lichess.highlight-dark
  background-color: #aaa23a

.light-square.chesscom.highlight-light
  background-color: #f7f783
.dark-square.chesscom.highlight-dark
  background-color: #bacb44

.light-square.chesstempo.highlight-light
  background-color: #9f9fff
.dark-square.chesstempo.highlight-dark
  background-color: #557fff

</style>
