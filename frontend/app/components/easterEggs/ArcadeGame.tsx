"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { arcadeSound } from "../../lib/easterEggs/soundSynth";
import { api } from "../../lib/api";

interface Bullet {
  x: number;
  y: number;
  vy: number;
  fromPlayer: boolean;
}

interface Enemy {
  x: number;
  y: number;
  width: number;
  height: number;
  type: number; // 0 = bug, 1 = node, 2 = boss
  color: string;
  points: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export default function ArcadeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [personalHighScore, setPersonalHighScore] = useState(0);
  const [globalHighScore, setGlobalHighScore] = useState(1337);
  const [globalLeader, setGlobalLeader] = useState("BMSIT_ROOT");
  const [wave, setWave] = useState(1);
  const [lives, setLives] = useState(3);
  const [gameState, setGameState] = useState<"playing" | "gameover" | "victory">("playing");
  const [soundMuted, setSoundMuted] = useState(false);

  // Global Record Submission State
  const [playerNameInput, setPlayerNameInput] = useState("");
  const [recordSubmitted, setRecordSubmitted] = useState(false);
  const [isSubmittingRecord, setIsSubmittingRecord] = useState(false);

  // References for live 60fps loop state without re-render lag
  const gameStateRef = useRef<"playing" | "gameover" | "victory">("playing");
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const waveRef = useRef(1);
  const globalHighRef = useRef(1337);

  // Player position
  const playerRef = useRef({
    x: 280,
    y: 380,
    width: 28,
    height: 18,
    speed: 5.5,
    isShooting: false,
    lastShot: 0,
  });

  const keysRef = useRef<{ [key: string]: boolean }>({});
  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const enemyDirRef = useRef<number>(1);
  const enemySpeedRef = useRef<number>(1);
  const enemyLastShotRef = useRef<number>(0);
  const screenShakeRef = useRef(0);

  // 1. Fetch Global High Score from DB and Personal High Score from LocalStorage
  const fetchGlobalScore = useCallback(async () => {
    try {
      const res = await api<{ score: number; player_name: string }>("/arcade/highscore");
      if (res && typeof res.score === "number") {
        setGlobalHighScore(res.score);
        setGlobalLeader(res.player_name || "BMSIT_ROOT");
        globalHighRef.current = res.score;
      }
    } catch {
      // Fallback baseline
    }
  }, []);

  useEffect(() => {
    fetchGlobalScore();

    try {
      const savedPersonal = localStorage.getItem("bmsit_arcade_personal_highscore");
      if (savedPersonal) {
        const val = parseInt(savedPersonal, 10);
        if (!isNaN(val)) setPersonalHighScore(val);
      }
      const savedName = localStorage.getItem("bmsit_arcade_player_name");
      if (savedName) {
        setPlayerNameInput(savedName);
      }
    } catch {}
  }, [fetchGlobalScore]);

  const spawnEnemies = useCallback((currentWave: number) => {
    const rows = 4;
    const cols = 8;
    const list: Enemy[] = [];
    const spacingX = 50;
    const spacingY = 32;
    const startX = 60;
    const startY = 50;

    const colors = ["#f43f5e", "#38bdf8", "#4ade80", "#fbbf24"];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const type = r === 0 ? 2 : r === 1 ? 1 : 0;
        const color = colors[r % colors.length];
        const points = type === 2 ? 300 : type === 1 ? 200 : 100;

        list.push({
          x: startX + c * spacingX,
          y: startY + r * spacingY,
          width: 24,
          height: 18,
          type,
          color,
          points,
        });
      }
    }

    enemiesRef.current = list;
    enemySpeedRef.current = 1 + currentWave * 0.25;
    enemyDirRef.current = 1;
  }, []);

  const resetGame = useCallback(() => {
    scoreRef.current = 0;
    livesRef.current = 3;
    waveRef.current = 1;
    bulletsRef.current = [];
    particlesRef.current = [];
    playerRef.current.x = 280;

    setScore(0);
    setLives(3);
    setWave(1);
    setGameState("playing");
    gameStateRef.current = "playing";
    setRecordSubmitted(false);

    spawnEnemies(1);
  }, [spawnEnemies]);

  // Handle Input Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }

      const key = e.key.toLowerCase();
      if (
        key === "arrowleft" ||
        key === "arrowright" ||
        key === "a" ||
        key === "d" ||
        key === " " ||
        key === "arrowup" ||
        key === "w"
      ) {
        e.preventDefault();
        keysRef.current[key] = true;
      }
      if (key === " " || key === "arrowup" || key === "w") {
        playerRef.current.isShooting = true;
      }
      if (key === "r" && gameStateRef.current === "gameover") {
        resetGame();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current[key] = false;
      if (key === " " || key === "arrowup" || key === "w") {
        playerRef.current.isShooting = false;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [resetGame]);

  // Initial Enemy Spawn
  useEffect(() => {
    spawnEnemies(1);
  }, [spawnEnemies]);

  // Submit New Global High Score to DB
  const handleSaveGlobalScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRecord || recordSubmitted) return;
    setIsSubmittingRecord(true);

    const playerName = (playerNameInput.trim() || "Anonymous Hero").substring(0, 24);

    try {
      localStorage.setItem("bmsit_arcade_player_name", playerName);
    } catch {}

    try {
      const res = await api<{ success: boolean; isNewRecord: boolean; score: number; player_name: string }>(
        "/arcade/highscore",
        {
          method: "POST",
          body: {
            score: scoreRef.current,
            player_name: playerName,
          },
        }
      );

      if (res && res.success) {
        arcadeSound.powerUp();
        setGlobalHighScore(res.score);
        setGlobalLeader(res.player_name);
        globalHighRef.current = res.score;
        setRecordSubmitted(true);
      }
    } catch (err) {
      console.error("Failed to save global record", err);
    } finally {
      setIsSubmittingRecord(false);
    }
  };

  // Main Canvas Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const width = 560;
    const height = 420;
    canvas.width = width;
    canvas.height = height;

    const createExplosion = (x: number, y: number, color: string, count = 12) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 3.5;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 20 + Math.random() * 15,
          color,
        });
      }
    };

    const loop = (timestamp: number) => {
      // 1. Update Game State
      if (gameStateRef.current === "playing") {
        const player = playerRef.current;

        // Player movement
        if (keysRef.current["arrowleft"] || keysRef.current["a"]) {
          player.x = Math.max(10, player.x - player.speed);
        }
        if (keysRef.current["arrowright"] || keysRef.current["d"]) {
          player.x = Math.min(width - player.width - 10, player.x + player.speed);
        }

        // Player shooting
        if (player.isShooting && timestamp - player.lastShot > 240) {
          player.lastShot = timestamp;
          bulletsRef.current.push({
            x: player.x + player.width / 2 - 2,
            y: player.y - 4,
            vy: -7,
            fromPlayer: true,
          });
          arcadeSound.laser();
        }

        // Enemy movement
        const enemies = enemiesRef.current;
        let shouldDrop = false;

        for (const enemy of enemies) {
          enemy.x += enemyDirRef.current * enemySpeedRef.current;
          if (
            (enemyDirRef.current > 0 && enemy.x + enemy.width > width - 20) ||
            (enemyDirRef.current < 0 && enemy.x < 20)
          ) {
            shouldDrop = true;
          }
        }

        if (shouldDrop) {
          enemyDirRef.current *= -1;
          for (const enemy of enemies) {
            enemy.y += 12;
            if (enemy.y + enemy.height >= player.y) {
              // Enemy reached player floor -> Game Over
              livesRef.current = 0;
              setLives(0);
              gameStateRef.current = "gameover";
              setGameState("gameover");
              arcadeSound.gameOver();

              // Update personal best in local
              if (scoreRef.current > personalHighScore) {
                setPersonalHighScore(scoreRef.current);
                try {
                  localStorage.setItem("bmsit_arcade_personal_highscore", scoreRef.current.toString());
                } catch {}
              }
            }
          }
        }

        // Enemy shooting
        if (enemies.length > 0 && timestamp - enemyLastShotRef.current > Math.max(800, 1800 - waveRef.current * 150)) {
          enemyLastShotRef.current = timestamp;
          const randomEnemy = enemies[Math.floor(Math.random() * enemies.length)];
          bulletsRef.current.push({
            x: randomEnemy.x + randomEnemy.width / 2,
            y: randomEnemy.y + randomEnemy.height,
            vy: 4 + waveRef.current * 0.4,
            fromPlayer: false,
          });
        }

        // Update Bullets
        bulletsRef.current = bulletsRef.current.filter((b) => {
          b.y += b.vy;

          // Check if bullet off screen
          if (b.y < 0 || b.y > height) return false;

          // Check collisions
          if (b.fromPlayer) {
            // Check hit against enemies
            for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
              const e = enemiesRef.current[i];
              if (
                b.x >= e.x &&
                b.x <= e.x + e.width &&
                b.y >= e.y &&
                b.y <= e.y + e.height
              ) {
                // Enemy hit!
                createExplosion(e.x + e.width / 2, e.y + e.height / 2, e.color, 14);
                arcadeSound.hit();
                enemiesRef.current.splice(i, 1);
                scoreRef.current += e.points;
                setScore(scoreRef.current);

                // Update personal high score in local storage
                if (scoreRef.current > personalHighScore) {
                  setPersonalHighScore(scoreRef.current);
                  try {
                    localStorage.setItem("bmsit_arcade_personal_highscore", scoreRef.current.toString());
                  } catch {}
                }

                // Check wave clear
                if (enemiesRef.current.length === 0) {
                  waveRef.current += 1;
                  setWave(waveRef.current);
                  arcadeSound.powerUp();
                  spawnEnemies(waveRef.current);
                }

                return false; // Remove bullet
              }
            }
          } else {
            // Check hit against player
            if (
              b.x >= player.x &&
              b.x <= player.x + player.width &&
              b.y >= player.y &&
              b.y <= player.y + player.height
            ) {
              // Player hit!
              createExplosion(player.x + player.width / 2, player.y + player.height / 2, "#ef4444", 20);
              arcadeSound.hit();
              screenShakeRef.current = 10;
              livesRef.current -= 1;
              setLives(livesRef.current);

              if (livesRef.current <= 0) {
                gameStateRef.current = "gameover";
                setGameState("gameover");
                arcadeSound.gameOver();

                // Update personal high score in local storage
                if (scoreRef.current > personalHighScore) {
                  setPersonalHighScore(scoreRef.current);
                  try {
                    localStorage.setItem("bmsit_arcade_personal_highscore", scoreRef.current.toString());
                  } catch {}
                }
              }
              return false; // Remove bullet
            }
          }

          return true;
        });

        // Update Particles
        particlesRef.current = particlesRef.current.filter((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 1 / p.maxLife;
          return p.life > 0;
        });
      }

      // 2. Render Loop
      ctx.save();

      // Screen shake effect
      if (screenShakeRef.current > 0) {
        const shakeX = (Math.random() - 0.5) * screenShakeRef.current;
        const shakeY = (Math.random() - 0.5) * screenShakeRef.current;
        ctx.translate(shakeX, shakeY);
        screenShakeRef.current -= 0.8;
      }

      // Clear with deep phosphor black
      ctx.fillStyle = "#08080c";
      ctx.fillRect(0, 0, width, height);

      // Draw subtle background cyber grid
      ctx.strokeStyle = "rgba(56, 189, 248, 0.05)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw Enemies
      for (const e of enemiesRef.current) {
        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 6;

        // Draw retro bug pixel art
        if (e.type === 2) {
          // Boss node (Diamond)
          ctx.beginPath();
          ctx.moveTo(e.x + e.width / 2, e.y);
          ctx.lineTo(e.x + e.width, e.y + e.height / 2);
          ctx.lineTo(e.x + e.width / 2, e.y + e.height);
          ctx.lineTo(e.x, e.y + e.height / 2);
          ctx.closePath();
          ctx.fill();
        } else if (e.type === 1) {
          // Fast node (Hex)
          ctx.fillRect(e.x + 3, e.y, e.width - 6, e.height);
          ctx.fillRect(e.x, e.y + 4, e.width, e.height - 8);
        } else {
          // Classic space bug
          ctx.fillRect(e.x + 4, e.y, e.width - 8, e.height);
          ctx.fillRect(e.x, e.y + 3, e.width, e.height - 6);
          ctx.fillRect(e.x + 2, e.y + e.height - 2, 4, 3);
          ctx.fillRect(e.x + e.width - 6, e.y + e.height - 2, 4, 3);
        }
      }

      // Draw Player Defender Ship
      if (livesRef.current > 0) {
        const p = playerRef.current;
        ctx.fillStyle = "#38bdf8";
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 10;

        // Ship body
        ctx.beginPath();
        ctx.moveTo(p.x + p.width / 2, p.y);
        ctx.lineTo(p.x + p.width, p.y + p.height);
        ctx.lineTo(p.x + p.width / 2, p.y + p.height - 4);
        ctx.lineTo(p.x, p.y + p.height);
        ctx.closePath();
        ctx.fill();

        // Ship Core Engine Glow
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(p.x + p.width / 2 - 2, p.y + 6, 4, 6);
      }

      // Draw Bullets
      for (const b of bulletsRef.current) {
        if (b.fromPlayer) {
          ctx.fillStyle = "#38bdf8";
          ctx.shadowColor = "#38bdf8";
          ctx.shadowBlur = 8;
          ctx.fillRect(b.x, b.y, 4, 10);
        } else {
          ctx.fillStyle = "#ef4444";
          ctx.shadowColor = "#ef4444";
          ctx.shadowBlur = 8;
          ctx.fillRect(b.x - 1, b.y, 3, 8);
        }
      }

      // Draw Particles
      for (const p of particlesRef.current) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fillRect(p.x, p.y, 3, 3);
      }
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;

      // Draw CRT Overlay Scanlines
      ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
      for (let y = 0; y < height; y += 4) {
        ctx.fillRect(0, y, width, 1.5);
      }

      ctx.restore();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [personalHighScore, spawnEnemies]);

  const hasBeatenGlobal = score > globalHighScore;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        color: "#ffffff",
        fontFamily: '"SF Mono", "Fira Code", monospace',
        userSelect: "none",
      }}
    >
      {/* HUD Header */}
      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          padding: "8px 16px",
          background: "#0f0f16",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderBottom: "none",
          borderRadius: "8px 8px 0 0",
          fontSize: "11px",
          letterSpacing: "0.04em",
        }}
      >
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
          <div>
            <span style={{ color: "#94a3b8" }}>SCORE: </span>
            <strong style={{ color: "#38bdf8" }}>{score.toString().padStart(6, "0")}</strong>
          </div>
          <div>
            <span style={{ color: "#94a3b8" }}>PERSONAL BEST: </span>
            <strong style={{ color: "#a855f7" }}>{personalHighScore.toString().padStart(6, "0")}</strong>
          </div>
          <div>
            <span style={{ color: "#94a3b8" }}>GLOBAL RECORD: </span>
            <strong style={{ color: "#f59e0b" }}>
              {globalHighScore.toString().padStart(6, "0")} ({globalLeader})
            </strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div>
            <span style={{ color: "#94a3b8" }}>WAVE: </span>
            <strong style={{ color: "#4ade80" }}>{wave}</strong>
          </div>
          <div>
            <span style={{ color: "#94a3b8" }}>SHIELDS: </span>
            <span style={{ color: "#f43f5e", letterSpacing: "2px" }}>
              {"▲ ".repeat(Math.max(0, lives))}
            </span>
          </div>
          <button
            onClick={() => {
              const muted = arcadeSound.toggleMute();
              setSoundMuted(muted);
            }}
            style={{
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: soundMuted ? "#94a3b8" : "#38bdf8",
              padding: "2px 6px",
              borderRadius: "4px",
              fontSize: "10px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {soundMuted ? "MUTED" : "AUDIO ON"}
          </button>
        </div>
      </div>

      {/* Canvas Container with Game Over & Global Record Overlay */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "560px",
          aspectRatio: "560 / 420",
          background: "#08080c",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "inset 0 0 40px rgba(0, 0, 0, 0.9), 0 0 30px rgba(56, 189, 248, 0.15)",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
          }}
        />

        {/* Game Over Screen */}
        {gameState === "gameover" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(8, 8, 14, 0.92)",
              backdropFilter: "blur(6px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              padding: "24px",
              textAlign: "center",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div
              style={{
                color: "#ef4444",
                fontSize: "26px",
                fontWeight: 900,
                letterSpacing: "0.08em",
                textShadow: "0 0 20px rgba(239, 68, 68, 0.8)",
              }}
            >
              [ SYSTEM OVERRUN ]
            </div>

            <div style={{ color: "#cbd5e1", fontSize: "14px" }}>
              Final Defense Score: <strong style={{ color: "#38bdf8" }}>{score}</strong>
            </div>

            {/* NEW GLOBAL RECORD PROMPT */}
            {hasBeatenGlobal ? (
              <div
                style={{
                  background: "rgba(245, 158, 11, 0.12)",
                  border: "1px solid #f59e0b",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  maxWidth: "420px",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                <div style={{ color: "#f59e0b", fontSize: "13px", fontWeight: 800, marginBottom: "4px" }}>
                  ★ NEW GLOBAL HIGH SCORE RECORD!
                </div>
                <div style={{ color: "#fde68a", fontSize: "11px", marginBottom: "10px" }}>
                  You surpassed {globalLeader}&apos;s record of {globalHighScore} pts!
                </div>

                {!recordSubmitted ? (
                  <form onSubmit={handleSaveGlobalScore} style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="text"
                      maxLength={24}
                      value={playerNameInput}
                      onChange={(e) => setPlayerNameInput(e.target.value)}
                      placeholder="Enter your hacker handle..."
                      style={{
                        flex: 1,
                        background: "#08080c",
                        border: "1px solid #f59e0b",
                        borderRadius: "4px",
                        padding: "6px 10px",
                        color: "#fff",
                        fontSize: "12px",
                        fontFamily: "inherit",
                        outline: "none",
                      }}
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingRecord}
                      style={{
                        background: "#f59e0b",
                        color: "#000",
                        border: "none",
                        borderRadius: "4px",
                        padding: "6px 14px",
                        fontSize: "11px",
                        fontWeight: 800,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {isSubmittingRecord ? "SAVING..." : "SAVE RECORD"}
                    </button>
                  </form>
                ) : (
                  <div style={{ color: "#4ade80", fontSize: "12px", fontWeight: 700 }}>
                    ✓ RECORD RECORDED TO BMSIT MAINFRAME DB!
                  </div>
                )}
              </div>
            ) : null}

            <button
              onClick={resetGame}
              style={{
                marginTop: "6px",
                background: "#38bdf8",
                color: "#08080c",
                border: "none",
                borderRadius: "6px",
                padding: "10px 24px",
                fontSize: "13px",
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: "inherit",
                letterSpacing: "0.05em",
                boxShadow: "0 0 20px rgba(56, 189, 248, 0.4)",
              }}
            >
              RESTART DEFENSE (R)
            </button>
          </div>
        )}
      </div>

      {/* Control Legend & Mobile Touch Controls */}
      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          background: "#0f0f16",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderTop: "none",
          borderRadius: "0 0 8px 8px",
          padding: "10px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          fontSize: "11px",
          color: "#64748b",
        }}
      >
        <div>
          <span>CONTROLS: </span>
          <strong style={{ color: "#cbd5e1" }}>[← / → / A / D]</strong> Move &nbsp;·&nbsp;
          <strong style={{ color: "#cbd5e1" }}>[SPACE / ↑]</strong> Fire
        </div>

        {/* Mobile touch control buttons */}
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onPointerDown={() => (keysRef.current["arrowleft"] = true)}
            onPointerUp={() => (keysRef.current["arrowleft"] = false)}
            onPointerLeave={() => (keysRef.current["arrowleft"] = false)}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#cbd5e1",
              padding: "6px 14px",
              borderRadius: "4px",
              fontSize: "12px",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            ◀ LEFT
          </button>
          <button
            onPointerDown={() => (keysRef.current["arrowright"] = true)}
            onPointerUp={() => (keysRef.current["arrowright"] = false)}
            onPointerLeave={() => (keysRef.current["arrowright"] = false)}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#cbd5e1",
              padding: "6px 14px",
              borderRadius: "4px",
              fontSize: "12px",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            RIGHT ▶
          </button>
          <button
            onPointerDown={() => (playerRef.current.isShooting = true)}
            onPointerUp={() => (playerRef.current.isShooting = false)}
            onPointerLeave={() => (playerRef.current.isShooting = false)}
            style={{
              background: "rgba(56, 189, 248, 0.2)",
              border: "1px solid #38bdf8",
              color: "#38bdf8",
              padding: "6px 16px",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            FIRE
          </button>
        </div>
      </div>
    </div>
  );
}
