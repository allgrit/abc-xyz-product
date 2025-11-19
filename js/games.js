(function () {
  /* ====================== ЗМЕЙКА ====================== */
  const SnakeGame = (function () {
    const canvas = document.getElementById("snakeCanvas");
    const ctx = canvas.getContext("2d");

    const gridSize = 20;
    const tileCount = canvas.width / gridSize;
    const initialSpeed = 120;

    const scoreEl = document.getElementById("snakeScore");
    const highScoreEl = document.getElementById("snakeHighScore");
    const statusEl = document.getElementById("snakeStatus");
    const startBtn = document.getElementById("snakeStartBtn");
    const pauseBtn = document.getElementById("snakePauseBtn");

    let snake = [];
    let direction = { x: 1, y: 0 };
    let nextDirection = { x: 1, y: 0 };
    let food = { x: 0, y: 0 };
    let score = 0;
    const HIGH_SCORE_KEY = "snakeHighScore";
    let highScore = 0;
    let loopId = null;
    let speed = initialSpeed;
    let isPaused = false;
    let isRunning = false;
    let isGameOver = false;

    function newGameState() {
      snake = [
        { x: Math.floor(tileCount / 2), y: Math.floor(tileCount / 2) }
      ];
      direction = { x: 1, y: 0 };
      nextDirection = { x: 1, y: 0 };
      score = 0;
      speed = initialSpeed;
      isPaused = false;
      isGameOver = false;
      scoreEl.textContent = "0";
      statusEl.textContent = "";
      spawnFood();
    }

    function spawnFood() {
      while (true) {
        const x = Math.floor(Math.random() * tileCount);
        const y = Math.floor(Math.random() * tileCount);
        const onSnake = snake.some(s => s.x === x && s.y === y);
        if (!onSnake) {
          food = { x, y };
          return;
        }
      }
    }

    function setDirectionFromKey(key) {
      if (!isRunning || isGameOver) return;
      if (key === "ArrowUp" || key === "w" || key === "W") {
        if (direction.y === 1) return;
        nextDirection = { x: 0, y: -1 };
      } else if (key === "ArrowDown" || key === "s" || key === "S") {
        if (direction.y === -1) return;
        nextDirection = { x: 0, y: 1 };
      } else if (key === "ArrowLeft" || key === "a" || key === "A") {
        if (direction.x === 1) return;
        nextDirection = { x: -1, y: 0 };
      } else if (key === "ArrowRight" || key === "d" || key === "D") {
        if (direction.x === -1) return;
        nextDirection = { x: 1, y: 0 };
      }
    }

    function update() {
      if (!isRunning || isPaused || isGameOver) return;

      direction = nextDirection;
      const head = snake[0];
      const newHead = {
        x: head.x + direction.x,
        y: head.y + direction.y
      };

      if (
        newHead.x < 0 ||
        newHead.x >= tileCount ||
        newHead.y < 0 ||
        newHead.y >= tileCount
      ) {
        endGame();
        return;
      }

      if (snake.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
        endGame();
        return;
      }

      snake.unshift(newHead);

      if (newHead.x === food.x && newHead.y === food.y) {
        score += 1;
        scoreEl.textContent = score.toString();
        if (score > highScore) {
          highScore = score;
          highScoreEl.textContent = highScore.toString();
          try {
            localStorage.setItem(HIGH_SCORE_KEY, highScore.toString());
          } catch (e) {
            // noop: localStorage может быть недоступен (например, в приватном режиме)
          }
        }
        speed = Math.max(60, speed - 3);
        spawnFood();
        restartLoop();
      } else {
        snake.pop();
      }
    }

    function draw() {
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(30, 64, 175, 0.15)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= tileCount; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridSize + 0.5, 0);
        ctx.lineTo(i * gridSize + 0.5, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * gridSize + 0.5);
        ctx.lineTo(canvas.width, i * gridSize + 0.5);
        ctx.stroke();
      }

      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      const foodPx = food.x * gridSize;
      const foodPy = food.y * gridSize;
      ctx.roundRect(foodPx + 3, foodPy + 3, gridSize - 6, gridSize - 6, 5);
      ctx.fill();

      for (let i = 0; i < snake.length; i++) {
        const seg = snake[i];
        const px = seg.x * gridSize;
        const py = seg.y * gridSize;

        if (i === 0) {
          const grad = ctx.createLinearGradient(px, py, px + gridSize, py + gridSize);
          grad.addColorStop(0, "#22c55e");
          grad.addColorStop(1, "#16a34a");
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = "#15803d";
        }

        ctx.beginPath();
        ctx.roundRect(px + 2, py + 2, gridSize - 4, gridSize - 4, 6);
        ctx.fill();
      }

      if (isGameOver) {
        ctx.fillStyle = "rgba(15,23,42,0.75)";
        ctx.fillRect(0, canvas.height / 2 - 36, canvas.width, 72);
        ctx.fillStyle = "#e5e7eb";
        ctx.textAlign = "center";
        ctx.font = "18px system-ui, sans-serif";
        ctx.fillText("Игра окончена", canvas.width / 2, canvas.height / 2 - 4);
        ctx.font = "13px system-ui, sans-serif";
        ctx.fillStyle = "#9ca3af";
        ctx.fillText(
          "Нажмите «Старт / перезапуск», чтобы попробовать ещё раз",
          canvas.width / 2,
          canvas.height / 2 + 18
        );
      }
    }

    function loop() {
      update();
      draw();
    }

    function startLoop() {
      if (loopId !== null) return;
      loopId = setInterval(loop, speed);
    }

    function restartLoop() {
      if (loopId !== null) {
        clearInterval(loopId);
        loopId = null;
      }
      loopId = setInterval(loop, speed);
    }

    function stopLoop() {
      if (loopId !== null) {
        clearInterval(loopId);
        loopId = null;
      }
    }

    function endGame() {
      isGameOver = true;
      isRunning = false;
      stopLoop();
      statusEl.innerHTML = "<strong>Игра окончена.</strong> Нажмите «Старт / перезапуск», чтобы начать заново.";
    }

    document.addEventListener("keydown", (e) => {
      setDirectionFromKey(e.key);
    });

    startBtn.addEventListener("click", () => {
      newGameState();
      stopLoop();
      isRunning = true;
      isPaused = false;
      pauseBtn.textContent = "⏸ Пауза";
      startLoop();
    });

    pauseBtn.addEventListener("click", () => {
      if (!isRunning || isGameOver) return;
      isPaused = !isPaused;
      if (isPaused) {
        statusEl.textContent = "Пауза. Нажмите «Пауза» ещё раз, чтобы продолжить.";
        pauseBtn.textContent = "▶ Продолжить";
      } else {
        statusEl.textContent = "";
        pauseBtn.textContent = "⏸ Пауза";
      }
    });

    function loadHighScore() {
      try {
        const stored = localStorage.getItem(HIGH_SCORE_KEY);
        if (stored) {
          highScore = parseInt(stored, 10) || 0;
          highScoreEl.textContent = highScore.toString();
        }
      } catch (e) {
        highScore = 0;
      }
    }

    function init() {
      loadHighScore();
      newGameState();
      isRunning = false;
      isPaused = false;
      stopLoop();
      draw();
      statusEl.textContent = "Нажмите «Старт / перезапуск», чтобы начать игру.";
    }

    function softPause() {
      if (isRunning && !isGameOver) {
        isPaused = true;
        isRunning = false;
        stopLoop();
        statusEl.textContent = "Игра приостановлена при переключении вкладки.";
        pauseBtn.textContent = "▶ Продолжить";
      }
    }

    function redrawIdle() {
      draw();
    }

    return {
      init,
      softPause,
      redrawIdle
    };
  })();

  /* ================== МУРАВЬИНАЯ КОЛОНИЯ ================== */
  const AntGame = (function () {
    const canvas = document.getElementById("antsCanvas");
    const ctx = canvas.getContext("2d");

    const cellSize = 4;
    const cols = canvas.width / cellSize;
    const rows = canvas.height / cellSize;

    const antsCountTarget = 80;
    const evaporation = 0.975;
    const deposit = 1.2;

    const foodEl = document.getElementById("antsFood");
    const tickEl = document.getElementById("antsTick");
    const countEl = document.getElementById("antsCount");
    const modeEl = document.getElementById("antsModeLabel");
    const statusEl = document.getElementById("antsStatus");
    const startBtn = document.getElementById("antsStartBtn");
    const pauseBtn = document.getElementById("antsPauseBtn");
    const resetBtn = document.getElementById("antsResetBtn");

    let pheromone = [];
    let ants = [];
    let foodSources = [];
    let nest = { x: Math.floor(cols / 2), y: Math.floor(rows / 2) };
    let tick = 0;
    let foodDelivered = 0;
    let loopId = null;
    let isRunning = false;
    let isPaused = false;

    function createGrid() {
      pheromone = [];
      for (let y = 0; y < rows; y++) {
        const row = new Float32Array(cols);
        pheromone.push(row);
      }
    }

    function spawnFoodSources() {
      foodSources = [];
      const attempts = 3;
      for (let i = 0; i < attempts; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.floor(Math.min(cols, rows) / 3 + Math.random() * 10);
        const x = Math.min(
          cols - 3,
          Math.max(2, Math.floor(nest.x + Math.cos(angle) * dist))
        );
        const y = Math.min(
          rows - 3,
          Math.max(2, Math.floor(nest.y + Math.sin(angle) * dist))
        );
        foodSources.push({
          x,
          y,
          amount: 80 + Math.floor(Math.random() * 50)
        });
      }
    }

    function spawnAnts() {
      ants = [];
      for (let i = 0; i < antsCountTarget; i++) {
        ants.push({
          x: nest.x + (Math.random() < 0.5 ? 0 : 1),
          y: nest.y + (Math.random() < 0.5 ? 0 : 1),
          hasFood: false
        });
      }
    }

    function inBounds(x, y) {
      return x >= 0 && x < cols && y >= 0 && y < rows;
    }

    function getFoodAt(x, y) {
      for (let src of foodSources) {
        if (Math.abs(src.x - x) <= 1 && Math.abs(src.y - y) <= 1 && src.amount > 0) {
          return src;
        }
      }
      return null;
    }

    function stepAnt(ant) {
      if (ant.hasFood) {
        if (ant.x === nest.x && ant.y === nest.y) {
          ant.hasFood = false;
          foodDelivered += 1;
          foodEl.textContent = foodDelivered.toString();
          return;
        }

        const dx = nest.x - ant.x;
        const dy = nest.y - ant.y;

        let stepX = 0;
        let stepY = 0;

        if (Math.abs(dx) > 0) stepX = dx > 0 ? 1 : -1;
        if (Math.abs(dy) > 0 && Math.random() < 0.7) {
          stepY = dy > 0 ? 1 : -1;
        }

        let nx = ant.x + stepX;
        let ny = ant.y + stepY;

        if (!inBounds(nx, ny)) {
          nx = ant.x;
          ny = ant.y;
        }

        ant.x = nx;
        ant.y = ny;

        pheromone[ny][nx] += deposit;
        return;
      }

      const src = getFoodAt(ant.x, ant.y);
      if (src && src.amount > 0) {
        src.amount -= 1;
        ant.hasFood = true;
        return;
      }

      let bestVal = -1;
      const candidates = [];

      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          const nx = ant.x + ox;
          const ny = ant.y + oy;
          if (!inBounds(nx, ny)) continue;
          const val = pheromone[ny][nx] + Math.random() * 0.05;
          if (val > bestVal) {
            bestVal = val;
            candidates.length = 0;
            candidates.push({ x: nx, y: ny });
          } else if (Math.abs(val - bestVal) < 0.02) {
            candidates.push({ x: nx, y: ny });
          }
        }
      }

      let target;
      if (bestVal > 0.05 && Math.random() < 0.8) {
        target = candidates[Math.floor(Math.random() * candidates.length)];
      } else {
        const dirs = [
          { x: 1, y: 0 }, { x: -1, y: 0 },
          { x: 0, y: 1 }, { x: 0, y: -1 },
          { x: 1, y: 1 }, { x: -1, y: 1 },
          { x: 1, y: -1 }, { x: -1, y: -1 }
        ];
        for (let i = 0; i < 5; i++) {
          const d = dirs[Math.floor(Math.random() * dirs.length)];
          const nx = ant.x + d.x;
          const ny = ant.y + d.y;
          if (inBounds(nx, ny)) {
            target = { x: nx, y: ny };
            break;
          }
        }
        if (!target) return;
      }

      ant.x = target.x;
      ant.y = target.y;
    }

    function evaporate() {
      for (let y = 0; y < rows; y++) {
        const row = pheromone[y];
        for (let x = 0; x < cols; x++) {
          row[x] *= evaporation;
          if (row[x] < 0.001) row[x] = 0;
        }
      }
    }

    function update() {
      if (!isRunning || isPaused) return;
      tick += 1;
      tickEl.textContent = tick.toString();

      for (let i = 0; i < ants.length; i++) {
        stepAnt(ants[i]);
      }
      evaporate();
    }

    function draw() {
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const v = pheromone[y][x];
          if (v > 0.01) {
            const alpha = Math.min(0.35, v * 0.02);
            ctx.fillStyle = "rgba(59,130,246," + alpha.toFixed(3) + ")";
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        }
      }

      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.arc(
        nest.x * cellSize + cellSize / 2,
        nest.y * cellSize + cellSize / 2,
        8,
        0,
        Math.PI * 2
      );
      ctx.fill();

      for (let src of foodSources) {
        if (src.amount <= 0) continue;
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(
          (src.x - 1) * cellSize,
          (src.y - 1) * cellSize,
          cellSize * 3,
          cellSize * 3
        );
      }

      for (let ant of ants) {
        ctx.fillStyle = ant.hasFood ? "#f97316" : "#e5e7eb";
        ctx.fillRect(
          ant.x * cellSize + 1,
          ant.y * cellSize + 1,
          cellSize - 2,
          cellSize - 2
        );
      }
    }

    function loop() {
      for (let i = 0; i < 2; i++) {
        update();
      }
      draw();
    }

    function startLoop() {
      if (loopId !== null) return;
      loopId = setInterval(loop, 80);
    }

    function stopLoop() {
      if (loopId !== null) {
        clearInterval(loopId);
        loopId = null;
      }
    }

    function resetWorld() {
      createGrid();
      spawnFoodSources();
      spawnAnts();
      tick = 0;
      foodDelivered = 0;
      foodEl.textContent = "0";
      tickEl.textContent = "0";
      countEl.textContent = ants.length.toString();
    }

    startBtn.addEventListener("click", () => {
      if (!isRunning) {
        isRunning = true;
        isPaused = false;
        modeEl.textContent = "Работает";
        statusEl.textContent = "";
        startLoop();
      }
    });

    pauseBtn.addEventListener("click", () => {
      if (!isRunning) return;
      isPaused = !isPaused;
      if (isPaused) {
        modeEl.textContent = "Пауза";
        statusEl.textContent = "Симуляция на паузе.";
      } else {
        modeEl.textContent = "Работает";
        statusEl.textContent = "";
      }
    });

    resetBtn.addEventListener("click", () => {
      stopLoop();
      resetWorld();
      isRunning = false;
      isPaused = false;
      modeEl.textContent = "Ожидание";
      statusEl.textContent = "Сброшено. Нажмите «Старт / продолжить», чтобы запустить симуляцию.";
      draw();
    });

    function initIdle() {
      resetWorld();
      isRunning = false;
      isPaused = false;
      modeEl.textContent = "Ожидание";
      statusEl.textContent = "Нажмите «Старт / продолжить», чтобы запустить симуляцию.";
      stopLoop();
      draw();
    }

    function softPause() {
      if (isRunning && !isPaused) {
        isPaused = true;
        modeEl.textContent = "Пауза";
        statusEl.textContent = "Симуляция приостановлена при переключении вкладки.";
      }
    }

    function redrawIdle() {
      draw();
    }

    return {
      initIdle,
      softPause,
      redrawIdle
    };
  })();

  /* ================== ПЕРЕКЛЮЧАТЕЛЬ ИГР ================== */
  const tabs = document.querySelectorAll(".game-tab");
  const panels = document.querySelectorAll(".game-panel");

  function setActiveGame(name) {
    tabs.forEach(btn => {
      const active = btn.getAttribute("data-game") === name;
      btn.classList.toggle("active", active);
    });
    panels.forEach(panel => {
      const id = panel.id === "snakePanel" ? "snake" : "ants";
      panel.classList.toggle("active", id === name);
    });

    if (name === "snake") {
      AntGame.softPause();
      SnakeGame.redrawIdle();
    } else {
      SnakeGame.softPause();
      AntGame.redrawIdle();
    }
  }

  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      const game = btn.getAttribute("data-game");
      setActiveGame(game);
    });
  });

  SnakeGame.init();
  AntGame.initIdle();
  setActiveGame("snake");
})();
