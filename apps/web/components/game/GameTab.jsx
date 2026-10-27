"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, Sparkles, Trophy } from "lucide-react";

const GAME_WIDTH = 960;
const GAME_HEIGHT = 420;
const GROUND_Y = 332;
const PLAYER_X = 166;
const BEST_SCORE_KEY = "football-dash-best-score";

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawCloud(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.beginPath();
  ctx.arc(0, 10, 17, 0, Math.PI * 2);
  ctx.arc(19, 0, 23, 0, Math.PI * 2);
  ctx.arc(43, 11, 17, 0, Math.PI * 2);
  ctx.rect(0, 10, 43, 18);
  ctx.fill();
  ctx.restore();
}

function drawCone(ctx, obstacle) {
  const { x, width, height } = obstacle;
  const top = GROUND_Y - height;
  ctx.save();
  ctx.shadowColor = "rgba(94, 24, 28, 0.16)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#b4232a";
  ctx.beginPath();
  ctx.moveTo(x + width * 0.5, top);
  ctx.lineTo(x + width, GROUND_Y - 3);
  ctx.quadraticCurveTo(x + width, GROUND_Y, x + width - 5, GROUND_Y);
  ctx.lineTo(x + 5, GROUND_Y);
  ctx.quadraticCurveTo(x, GROUND_Y, x, GROUND_Y - 3);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#fffaf7";
  ctx.beginPath();
  ctx.moveTo(x + width * 0.34, top + height * 0.42);
  ctx.lineTo(x + width * 0.66, top + height * 0.42);
  ctx.lineTo(x + width * 0.79, top + height * 0.61);
  ctx.lineTo(x + width * 0.21, top + height * 0.61);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#8f1720";
  roundedRect(ctx, x - 5, GROUND_Y - 5, width + 10, 9, 4);
  ctx.fill();
  ctx.restore();
}

function drawHurdle(ctx, obstacle) {
  const { x, width, height } = obstacle;
  const top = GROUND_Y - height;
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "#b4232a";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(x + 5, GROUND_Y - 2);
  ctx.lineTo(x + 12, top + 7);
  ctx.moveTo(x + width - 5, GROUND_Y - 2);
  ctx.lineTo(x + width - 12, top + 7);
  ctx.stroke();
  ctx.lineWidth = 15;
  ctx.strokeStyle = "#fffaf7";
  ctx.beginPath();
  ctx.moveTo(x + 9, top + 8);
  ctx.lineTo(x + width - 9, top + 8);
  ctx.stroke();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#b4232a";
  ctx.beginPath();
  ctx.moveTo(x + 9, top + 8);
  ctx.lineTo(x + 27, top + 8);
  ctx.moveTo(x + width - 27, top + 8);
  ctx.lineTo(x + width - 9, top + 8);
  ctx.stroke();
  ctx.restore();
}

function drawFallbackFootball(ctx, x, y, radius, jumpHeight, elapsed) {
  const stride = Math.sin(elapsed * 18) * (jumpHeight < 2 ? 4 : 1);
  const shadowScale = Math.max(0.45, 1 - jumpHeight / 260);
  ctx.save();
  ctx.fillStyle = `rgba(128, 45, 48, ${0.18 * shadowScale})`;
  ctx.beginPath();
  ctx.ellipse(x, GROUND_Y + 3, 37 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#a52a30";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x - 12, y + radius * 0.73);
  ctx.lineTo(x - 15 + stride, y + radius + 11);
  ctx.moveTo(x + 12, y + radius * 0.73);
  ctx.lineTo(x + 15 - stride, y + radius + 11);
  ctx.stroke();
  ctx.fillStyle = "#fffaf7";
  ctx.beginPath();
  ctx.ellipse(x - 17 + stride, y + radius + 12, 9, 5, -0.15, 0, Math.PI * 2);
  ctx.ellipse(x + 17 - stride, y + radius + 12, 9, 5, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fffaf7";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.82, y + 4);
  ctx.quadraticCurveTo(x - radius - 12, y + 13 + stride * 0.3, x - radius - 7, y + 23 + stride * 0.3);
  ctx.moveTo(x + radius * 0.82, y + 4);
  ctx.quadraticCurveTo(x + radius + 12, y + 13 - stride * 0.3, x + radius + 7, y + 23 - stride * 0.3);
  ctx.stroke();
  ctx.strokeStyle = "#ead6cf";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.shadowColor = "rgba(104, 25, 31, 0.16)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = "#fffaf5";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius - 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#c52c35";
  ctx.beginPath();
  ctx.moveTo(x - 9, y - 24);
  ctx.lineTo(x + 11, y - 22);
  ctx.lineTo(x + 19, y - 7);
  ctx.lineTo(x + 5, y + 5);
  ctx.lineTo(x - 12, y - 1);
  ctx.lineTo(x - 17, y - 16);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 35, y - 8);
  ctx.lineTo(x - 26, y - 25);
  ctx.lineTo(x - 18, y - 18);
  ctx.lineTo(x - 19, y - 3);
  ctx.lineTo(x - 32, y + 5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 24, y + 5);
  ctx.lineTo(x + 39, y - 3);
  ctx.lineTo(x + 36, y + 18);
  ctx.lineTo(x + 20, y + 27);
  ctx.lineTo(x + 14, y + 14);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 17, y + 27);
  ctx.lineTo(x - 5, y + 14);
  ctx.lineTo(x + 9, y + 20);
  ctx.lineTo(x + 9, y + 37);
  ctx.lineTo(x - 7, y + 39);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "#ead6cf";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#38282b";
  ctx.beginPath();
  ctx.arc(x - 10, y + 3, 3.2, 0, Math.PI * 2);
  ctx.arc(x + 10, y + 3, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ef9a91";
  ctx.beginPath();
  ctx.arc(x - 17, y + 12, 4.2, 0, Math.PI * 2);
  ctx.arc(x + 17, y + 12, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#704148";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y + 7, 6.5, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.restore();
}

function drawAnimatedFootball(ctx, x, game, sprite, runSprite) {
  const airborne = game.jumpHeight > 0 || game.jumpVelocity > 0;
  // The source sheets have different transparent margins; size each source to the same visible ball diameter.
  const fallbackSize = 130;
  const jumpSize = 132;
  const runSize = 160;
  const frameWidth = sprite?.naturalWidth ? sprite.naturalWidth / 4 : 362;
  const frameHeight = sprite?.naturalHeight ? sprite.naturalHeight / 3 : 362;
  const fallbackTop = GROUND_Y - fallbackSize - game.jumpHeight;
  const running = game.status === "running";
  const fallbackFrame = running ? Math.floor(((game.animationTime * 1.08) % 1) * 4) : 0;
  const runFrameWidth = runSprite?.naturalWidth ? runSprite.naturalWidth / 3 : 362;
  // The authored run strip keeps the approved stride and closed-foot pose, then reverses the arm and leg phase.
  const runFrame = Math.floor(((game.animationTime * 1.44) % 1) * 3);

  ctx.save();
  const shadowScale = Math.max(0.45, 1 - game.jumpHeight / 260);
  ctx.fillStyle = `rgba(128, 45, 48, ${0.18 * shadowScale})`;
  ctx.beginPath();
  ctx.ellipse(x, GROUND_Y + 3, 44 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  if (sprite?.complete && sprite.naturalWidth > 0 && airborne) {
    const jumpFrame = Math.min(3, Math.floor(game.jumpAnimationTime / 0.16));
    const jumpTop = GROUND_Y - jumpSize - game.jumpHeight;
    ctx.drawImage(
      sprite,
      jumpFrame * frameWidth,
      2 * frameHeight,
      frameWidth,
      frameHeight,
      x - jumpSize / 2,
      jumpTop,
      jumpSize,
      jumpSize,
    );
    ctx.restore();
    return;
  }

  if (runSprite?.complete && runSprite.naturalWidth > 0) {
    const frame = running ? runFrame : 1;
    const scale = runSize / runFrameWidth;
    const runTop = GROUND_Y - runSize + 36 * scale;
    ctx.drawImage(
      runSprite,
      frame * runFrameWidth,
      0,
      runFrameWidth,
      runSprite.naturalHeight,
      x - runSize / 2,
      runTop,
      runSize,
      runSize,
    );
  } else if (sprite?.complete && sprite.naturalWidth > 0) {
    const motionRow = running ? 1 : 0;
    ctx.drawImage(
      sprite,
      fallbackFrame * frameWidth,
      motionRow * frameHeight,
      frameWidth,
      frameHeight,
      x - fallbackSize / 2,
      fallbackTop,
      fallbackSize,
      fallbackSize,
    );
  } else {
    drawFallbackFootball(ctx, x, fallbackTop + fallbackSize / 2, 50, game.jumpHeight, running ? game.animationTime : 0);
  }
  ctx.restore();
}

function drawGame(ctx, game, sprite, runSprite) {
  const sky = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  sky.addColorStop(0, "#fff9f6");
  sky.addColorStop(0.72, "#fff1ed");
  sky.addColorStop(1, "#f7e7e1");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  ctx.fillStyle = "rgba(196, 44, 53, 0.07)";
  ctx.beginPath();
  ctx.arc(790, 95, 54, 0, Math.PI * 2);
  ctx.fill();
  drawCloud(ctx, 104 - ((game.elapsed * 11) % 1080), 81, 0.8);
  drawCloud(ctx, 535 - ((game.elapsed * 7) % 1120), 122, 0.62);

  ctx.fillStyle = "#f4dcd8";
  ctx.fillRect(0, 207, GAME_WIDTH, 81);
  ctx.fillStyle = "#eccac7";
  ctx.fillRect(0, 207, GAME_WIDTH, 11);
  for (let x = 17; x < GAME_WIDTH; x += 34) {
    ctx.fillStyle = x % 3 === 0 ? "#c9656b" : "#fff8f4";
    ctx.beginPath();
    ctx.arc(x - ((game.elapsed * 15) % 34), 244 + (x % 5) * 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = x % 2 === 0 ? "#fff8f4" : "#d99291";
    ctx.beginPath();
    ctx.arc(x - ((game.elapsed * 15) % 34), 270 + (x % 7) * 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#fffaf7";
  ctx.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);
  ctx.fillStyle = "#c23840";
  ctx.fillRect(0, GROUND_Y, GAME_WIDTH, 7);
  ctx.fillStyle = "#efd1cc";
  ctx.fillRect(0, GROUND_Y + 7, GAME_WIDTH, 3);
  const lineOffset = (game.elapsed * game.speed * 0.75) % 86;
  ctx.fillStyle = "#e9b8b5";
  for (let x = -86 - lineOffset; x < GAME_WIDTH; x += 86) {
    roundedRect(ctx, x, GROUND_Y + 31, 42, 4, 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(183, 49, 55, 0.08)";
  ctx.fillRect(0, GROUND_Y + 68, GAME_WIDTH, 2);

  for (const obstacle of game.obstacles) {
    if (obstacle.kind === "hurdle") drawHurdle(ctx, obstacle);
    else drawCone(ctx, obstacle);
  }

  drawAnimatedFootball(ctx, PLAYER_X, game, sprite, runSprite);
}

function makeGame() {
  return {
    status: "ready",
    elapsed: 0,
    animationTime: 0,
    score: 0,
    speed: 310,
    jumpHeight: 0,
    jumpVelocity: 0,
    jumpAnimationTime: 0,
    spawnTimer: 1.25,
    obstacles: [],
    lastFrame: 0,
    lastShownScore: -1,
  };
}

export default function GameTab() {
  const canvasRef = useRef(null);
  const spriteRef = useRef(null);
  const runSpriteRef = useRef(null);
  const gameRef = useRef(makeGame());
  const statusRef = useRef("ready");
  const bestRef = useRef(0);
  const [status, setStatus] = useState("ready");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);

  const startGame = useCallback(() => {
    gameRef.current = { ...makeGame(), status: "running" };
    statusRef.current = "running";
    setStatus("running");
    setScore(0);
  }, []);

  const jump = useCallback(() => {
    const game = gameRef.current;
    if (game.status === "running" && game.jumpHeight <= 1) {
      game.jumpVelocity = 710;
    }
  }, []);

  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem(BEST_SCORE_KEY) || 0);
      if (Number.isFinite(stored) && stored > 0) {
        bestRef.current = stored;
        setBestScore(stored);
      }
    } catch {
      // The game still works when browser storage is disabled.
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return undefined;

    const sprite = new Image();
    sprite.onload = () => {
      spriteRef.current = sprite;
    };
    sprite.src = "/football-plush-sprites.png";

    const runSprite = new Image();
    runSprite.onload = () => {
      runSpriteRef.current = runSprite;
    };
    runSprite.src = "/football-run-cycle-aligned.png";

    const resizeCanvas = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(bounds.width * ratio));
      canvas.height = Math.max(1, Math.round(bounds.height * ratio));
    };
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    resizeCanvas();

    let frameId = 0;
    const tick = (time) => {
      const game = gameRef.current;
      const delta = game.lastFrame ? Math.min((time - game.lastFrame) / 1000, 0.04) : 0;
      game.lastFrame = time;
      game.animationTime += delta;

      if (game.status === "running") {
        game.elapsed += delta;
        if (game.jumpHeight > 0 || game.jumpVelocity > 0) game.jumpAnimationTime += delta;
        game.speed = Math.min(520, 310 + game.elapsed * 7.5);
        game.jumpHeight += game.jumpVelocity * delta;
        game.jumpVelocity -= 1850 * delta;
        if (game.jumpHeight <= 0) {
          game.jumpHeight = 0;
          game.jumpVelocity = 0;
          game.jumpAnimationTime = 0;
        }

        game.spawnTimer -= delta;
        if (game.spawnTimer <= 0) {
          const kind = Math.random() > 0.72 ? "hurdle" : "cone";
          const width = kind === "hurdle" ? 64 : 42;
          const height = kind === "hurdle" ? 48 : 51 + Math.random() * 13;
          game.obstacles.push({ x: GAME_WIDTH + 20, width, height, kind });
          game.spawnTimer = 1.12 + Math.random() * 0.75;
        }
        game.obstacles = game.obstacles
          .map((obstacle) => ({ ...obstacle, x: obstacle.x - game.speed * delta }))
          .filter((obstacle) => obstacle.x + obstacle.width > -12);

        game.score = Math.floor(game.elapsed * 10);
        if (game.score !== game.lastShownScore) {
          game.lastShownScore = game.score;
          setScore(game.score);
          if (game.score > bestRef.current) {
            bestRef.current = game.score;
            setBestScore(game.score);
            try {
              window.localStorage.setItem(BEST_SCORE_KEY, String(game.score));
            } catch {
              // Keep the current run playable without persistent storage.
            }
          }
        }

        const collision = game.obstacles.some((obstacle) =>
          obstacle.x < PLAYER_X + 23 &&
          obstacle.x + obstacle.width > PLAYER_X - 23 &&
          game.jumpHeight < obstacle.height * 0.78,
        );
        if (collision) {
          game.status = "over";
          statusRef.current = "over";
          setStatus("over");
          setScore(game.score);
        }
      }

      ctx.setTransform(canvas.width / GAME_WIDTH, 0, 0, canvas.height / GAME_HEIGHT, 0, 0);
      drawGame(ctx, game, spriteRef.current, runSpriteRef.current);
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, button, a, [contenteditable='true'], [role='textbox']")
      ) {
        return;
      }
      if (event.code !== "Space" && event.code !== "ArrowUp") {
        if (event.code === "KeyR") startGame();
        return;
      }
      event.preventDefault();
      if (statusRef.current !== "running") startGame();
      else jump();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [jump, startGame]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-primary">
            <Sparkles className="size-4" aria-hidden="true" />
            <span className="desk-type-meta font-semibold uppercase tracking-[0.14em]">A tiny football mini game</span>
          </div>
          <h1 className="desk-type-page">Little Football Dash</h1>
          <p className="mt-1 desk-type-body text-muted-foreground">Keep your little ball rolling. Jump over the training cones!</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm shadow-sm">
          <Trophy className="size-4 text-primary" aria-hidden="true" />
          <span className="text-muted-foreground">Best</span>
          <span className="font-semibold tabular-nums text-foreground">{bestScore}</span>
        </div>
      </header>

      <section
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-border bg-card shadow-sm"
        onPointerDown={(event) => {
          if (
            statusRef.current === "over" &&
            event.target instanceof Element &&
            event.target.closest("button")
          ) {
            return;
          }
          if (statusRef.current === "running") jump();
          else startGame();
        }}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border bg-white/80 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${status === "running" ? "animate-pulse bg-red-500" : "bg-red-200"}`} />
            <span className="desk-type-support font-medium text-muted-foreground">
              {status === "running" ? "RUNNING" : status === "over" ? "FULL TIME" : "CLICK ANYWHERE TO START"}
            </span>
          </div>
          <div className="rounded-full bg-surface-red-50 px-3 py-1 text-sm font-semibold tabular-nums text-primary">
            SCORE <span className="ml-1">{score}</span>
          </div>
        </div>

        <div className="relative min-h-0 w-full flex-1 overflow-hidden bg-[#fff7f4]">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 block h-full w-full touch-manipulation"
            aria-label="A cute red and white football runs along a training pitch. Click anywhere or press space to start, then click, tap, or press the up arrow to jump over cones."
          />

          {status === "over" ? (
            <div className="absolute inset-0 grid place-items-center bg-white/20 p-4 backdrop-blur-[2px]">
              <div className="w-full max-w-sm rounded-2xl border border-white/80 bg-white/90 p-6 text-center shadow-xl shadow-red-950/10 sm:p-7">
                <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-surface-red-100 text-2xl" aria-hidden="true">
                  ⚽
                </div>
                <h2 className="desk-type-section text-foreground">What a run!</h2>
                <p className="mt-1 desk-type-support text-muted-foreground">You scored {score}. Tap anywhere to try again.</p>
                <button
                  type="button"
                  onClick={startGame}
                  className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-red-900/15 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Play again
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-white px-4 py-3 sm:px-6">
          <p className="desk-type-support text-muted-foreground">
            <kbd className="rounded border border-border bg-surface-red-50 px-1.5 py-0.5 font-semibold text-foreground">Space</kbd>
            <span className="mx-1">or</span>
            <kbd className="rounded border border-border bg-surface-red-50 px-1.5 py-0.5 font-semibold text-foreground">↑</kbd>
            <span className="ml-2">to jump</span>
            <span className="mx-2 text-border-active">·</span>
            tap anywhere to jump
          </p>
          <p className="desk-type-meta text-muted-foreground">Every run is a fresh little challenge.</p>
        </div>
      </section>
    </div>
  );
}
