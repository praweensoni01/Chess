const socket = io();
const chess = new Chess();

const boardElement = document.querySelector(".chessboard");
const infosec = document.querySelector(".infosec");
const roomInfo = document.getElementById("roomInfo");
const msgSection = document.getElementById("msgSection");
const msgInp = document.getElementById("msgInp");
const sendBtn = document.getElementById("sendBtn");

let draggedPiece = null;
let sourceSquare = null;
let selectedSquare = null;
let playerRole = null;
let isGameOver = false;

const renderBoard = () => {
  const board = chess.board();
  boardElement.innerHTML = "";

  board.forEach((row, rowIndex) => {
    row.forEach((square, colIndex) => {
      const squareElement = document.createElement("div");
      squareElement.classList.add("square", (rowIndex + colIndex) % 2 === 0 ? "light" : "dark");
      squareElement.dataset.row = rowIndex;
      squareElement.dataset.col = colIndex;

      if (square) {
        const piece = document.createElement("div");
        piece.classList.add("piece", square.color === "w" ? "white" : "black");
        piece.innerText = getPieceUnicode(square);
        piece.draggable = (playerRole === square.color);
        piece.addEventListener("dragstart", (e) => {
          if (piece.draggable) {
            draggedPiece = piece;
            sourceSquare = { row: rowIndex, col: colIndex };
            e.dataTransfer.setData("text/plain", "");
          }
        });
        piece.addEventListener("dragend", () => {
          draggedPiece = null;
          sourceSquare = null;
        });
        squareElement.appendChild(piece);
      }

      squareElement.addEventListener("dragover", (e) => e.preventDefault());
      squareElement.addEventListener("drop", (e) => {
        e.preventDefault();
        if (draggedPiece) {
          const target = {
            row: parseInt(squareElement.dataset.row),
            col: parseInt(squareElement.dataset.col),
          };
          handleMove(sourceSquare, target);
        }
      });
      
      if (selectedSquare && selectedSquare.row === rowIndex && selectedSquare.col === colIndex) {
        squareElement.classList.add("selected");
      }

      squareElement.addEventListener("click", () => {
        const row = parseInt(squareElement.dataset.row);
        const col = parseInt(squareElement.dataset.col);

        const square = chess.board()[row][col];

        if (selectedSquare) {
          const from = `${String.fromCharCode(97 + selectedSquare.col)}${8 - selectedSquare.row}`;
          const to = `${String.fromCharCode(97 + col)}${8 - row}`;

          const movingPiece = chess.get(from);
          const isPromotionMove =
            movingPiece?.type === 'p' &&
            ((movingPiece.color === 'w' && to[1] === '8') ||
              (movingPiece.color === 'b' && to[1] === '1'));

          const move = {
            from,
            to,
            ...(isPromotionMove && { promotion: 'q' }),
          };

          socket.emit("move", move);
          selectedSquare = null; 
        } else if (square && playerRole === square.color) {
          selectedSquare = { row, col };
        }
      });

      boardElement.appendChild(squareElement);
    });
  });

  if (playerRole === "b") {
    boardElement.classList.add("flipped");
  } else {
    boardElement.classList.remove("flipped");
  }
};

const getPieceUnicode = (piece) => {
  const map = {
    p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
    P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔"
  };
  return map[piece.color === "w" ? piece.type.toUpperCase() : piece.type] || "";
};

const handleMove = (source, target) => {
  if (isGameOver) return;
  const from = `${String.fromCharCode(97 + source.col)}${8 - source.row}`;
  const to = `${String.fromCharCode(97 + target.col)}${8 - target.row}`;

  const movingPiece = chess.get(from);
  const isPromotionMove =
    movingPiece?.type === 'p' &&
    ((movingPiece.color === 'w' && to[1] === '8') ||
      (movingPiece.color === 'b' && to[1] === '1'));

  const move = {
    from,
    to,
    ...(isPromotionMove && { promotion: 'q' }),
  };

  socket.emit("move", move);
};


// === Socket connection Events ===
const roomId = prompt("Enter Room ID to join (if you not provide room name then it will auto named):");

if (!roomId) {
  socket.emit("joinRandomMatch", { username: CONFIG.username, userId: CONFIG.userId });
} else {
  socket.emit("joinRoom", { roomId, username: CONFIG.username, userId: CONFIG.userId });
}

socket.on("roomId", (roomId) => {
  roomInfo.innerText = roomId;
});

socket.on("opponentName", (name) => {
  document.getElementById("opponent").innerText = name;
});

socket.on("playerRole", (role) => {
  playerRole = role;
  infosec.innerText = `You are playing as ${role === "w" ? "White" : "Black"}`;
  renderBoard();
});

socket.on("spectatorRole", (msg) => {
  infosec.innerText = msg;
  msgInp.style.display = "none";
  sendBtn.style.display = "none";
  renderBoard();
});

let time;
let timerDiv = document.getElementById('timer');
socket.on("timer", (remainingTime) => {
  time = remainingTime;
})
const timer = setInterval(() => {
  time--;
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  timerDiv.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  if (time <= 0) {
    clearInterval(timer);
    timerDiv.textContent = "Time's Up!";
  }
}, 1000);


socket.on("boardState", (fen) => {
  chess.load(fen);
  const isYourTurn = (chess.turn() === playerRole);
  if (isYourTurn) {
    boardElement.classList.add("yourTurn");
  } else {
    boardElement.classList.remove("yourTurn");
  }
  renderBoard();
});

socket.on("move", (move) => {
  chess.move(move);
  renderBoard();
});

socket.on("ischeck", (val) => {
  if (val) infosec.innerText = "Check!";
});


socket.on("invalidMove", (move) => {
  infosec.innerText = `Invalid move: ${move.from} → ${move.to}`;
});

socket.on("gameResult", (result) => {
  isGameOver = true;
  const gameOverMessage = `Game Over! Winner: ${result.winnerName} (${result.winnerColor === 'w' ? 'White' : 'Black'})`;
  if (result.type === "checkmate") {
    infosec.innerText = gameOverMessage;
    alert(`Checkmate! Winner is ${result.winnerName}`);
  } else if (result.type === "draw") {
    infosec.innerText = "Game is draw!!";
    alert("Game is a draw!");
  }
});


socket.on("WPO", () => {
  infosec.innerText = "White Player Disconnected";
});

socket.on("BPO", () => {
  infosec.innerText = "Black Player Disconnected";
});

// Chat function
// Send message
let msgSend = false;
sendBtn.addEventListener('click', () => {
  if (msgInp.value) {
    if (!msgSend) {
      document.getElementById('chatInfo').style.display = "none";
      msgSend = true;
    }
    socket.emit('SRUCM', msgInp.value);
    const chatMsg = `<li class="pt-1">
    <p class="text-sm text-gray-300 text-right pr-4">${msgInp.value}</p>
    </li>`
    msgSection.innerHTML += chatMsg;
    msgInp.value = '';
  }
})

msgInp.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && msgInp.value.trim()) {
    sendBtn.click();
  }
});

//received message
socket.on("SSUCM", (msg) => {
  const chatMsg = `<li class="pt-1">
                    <p class="text-green-400">${msg}</p>
                  </li>`
  msgSection.innerHTML += chatMsg;
  // window.scrollTo(0, document.body.scrollHeight);
  // msgSection.scrollTop = msgSection.scrollHeight;
});

document.querySelectorAll(".emoji").forEach(el => {
  el.addEventListener("click", () => {
    const emoji = el.textContent;

    socket.emit('SRUCM', emoji);

    const chatMsg = `<li class="pt-1 text-right pr-4 text-gray-300">
      <p class="text-lg">${emoji}</p>
    </li>`;
    msgSection.innerHTML += chatMsg;
    msgSection.scrollTop = msgSection.scrollHeight;
  });
});


renderBoard();
