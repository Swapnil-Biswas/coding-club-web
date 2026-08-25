"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";

// Retro Web Audio Synthesizer (Zero-dependency SFX)
function createSynth() {
  if (typeof window === "undefined") return null;
  const AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
  if (!AudioContext) return null;
  const ctx = new AudioContext();

  return {
    ctx,
    beep: (freq = 440, type: OscillatorType = "sine", duration = 0.1, gain = 0.05) => {
      try {
        if (ctx.state === "suspended") ctx.resume();
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        g.gain.setValueAtTime(gain, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch {}
    },
    alarm: () => {
      try {
        if (ctx.state === "suspended") ctx.resume();
        const now = ctx.currentTime;
        for (let i = 0; i < 4; i++) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 587, now + i * 0.12);
          g.gain.setValueAtTime(0.1, now + i * 0.12);
          g.gain.exponentialRampToValueAtTime(0.001, now + (i + 1) * 0.12);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(now + i * 0.12);
          osc.stop(now + (i + 1) * 0.12);
        }
      } catch {}
    },
    explosion: () => {
      try {
        if (ctx.state === "suspended") ctx.resume();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.8);
        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.8);
      } catch {}
    },
    rickroll: () => {
      try {
        if (ctx.state === "suspended") ctx.resume();
        const notes = [
          { f: 370, d: 0.15 },
          { f: 415, d: 0.15 },
          { f: 493, d: 0.2 },
          { f: 415, d: 0.2 },
          { f: 622, d: 0.35 },
          { f: 622, d: 0.35 },
          { f: 554, d: 0.5 },
        ];
        let t = ctx.currentTime;
        notes.forEach(({ f, d }) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "square";
          osc.frequency.setValueAtTime(f, t);
          g.gain.setValueAtTime(0.06, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + d);
          t += d * 0.9;
        });
      } catch {}
    },
  };
}

const INITIAL_LOGS = [
  "[00:00.012] [WARN] INTRUSION DETECTED: Unauthorized access to restricted route /admin",
  "[00:00.045] [SCAN] ANALYZING THREAT SIGNATURE: Method = 'Typing /admin in browser address bar'",
  "[00:00.089] [TARGET] ASSET: Imaginary super-secret admin panel",
  "[00:00.142] [EVAL] ATTACKER SKILL LEVEL: 0.00001 / 100 [RANK: SCRIPT KIDDIE]",
  "[00:00.198] [FIREWALL] STATUS: Chuckling quietly in the corner",
  "[00:00.250] [TRACE] COMPLETE: Host identified as 'Student with 47 open Chrome tabs'",
  "[00:00.312] [DEFENSE] COUNTERMEASURES: Maximum emotional damage initialized.",
  "[00:00.380] [INFO] NOTICE: Real club admins don't leave control panels on /admin. Good luck guessing.",
];

const SURVEILLANCE_FRAMES = [
  `
     .--------.
    /  .-.  .-.  \\    [LIVE SURVEILLANCE FEED]
   |  ( O )( O )  |   STATUS: TARGET LOCATED
   |     (_)      |   ACTION: Squinting at URL bar
    \\  .______.  /    THREAT: 0.00% (Harmless)
     '----------'     CLOWN_LEVEL: CRITICAL
  `,
  `
     .--------.
    /  > .  . <  \\    [LIVE SURVEILLANCE FEED]
   |  ( - )( - )  |   STATUS: REALIZING MISTAKE
   |     (_)      |   ACTION: Sweating nervously
    \\   \\____/   /    THREAT: -10.0% (Defeated)
     '----------'     HEART_RATE: 160 BPM
  `,
  `
     .--------.
    /  ^ .  . ^  \\    [LIVE SURVEILLANCE FEED]
   |  ( O )( O )  |   STATUS: SEARCHING STACKOVERFLOW
   |     (_)      |   ACTION: Looking for exploit scripts
    \\  .======.  /    THREAT: 0.00% (No hope)
     '----------'     SUGGESTION: Go study for exams
  `,
];

const MUSHROOM_CLOUD_ART = `
               _.-^^---....,,--_
            _--                  --_
           <                        >)
           |                         |
            \\._                   _./
               \`\`\`--. . , ; .--'''
                     | |   |
                  .-=||  | |=-.
                  \`-=#$%&%$#=-'
                     | ;  :|
            _____.,-#%&$@%#&#~,._____
`;

interface TerminalEntry {
  text: string;
  isError?: boolean;
  isSuccess?: boolean;
  isHighlight?: boolean;
  isPrompt?: boolean;
  promptPath?: string;
}

export default function AdminHoneypotPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [commandInput, setCommandInput] = useState("");
  const [currentPath, setCurrentPath] = useState("~");
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [commandHistoryList, setCommandHistoryList] = useState<string[]>([]);
  const [terminalHistory, setTerminalHistory] = useState<TerminalEntry[]>([
    { text: "Last login: " + new Date().toUTCString().replace("GMT", "IST") + " on ttys001", isHighlight: false },
    { text: "macOS Sonoma 14.5 (Darwin 23.5.0 arm64) — BMSIT Apple Silicon Mainframe", isHighlight: true },
    { text: "Type 'help' for shell commands or browse with 'ls -la', 'cat', 'cd'.", isHighlight: false },
  ]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [scanlines, setScanlines] = useState(true);
  const [nukeActive, setNukeActive] = useState(false);
  const [nukeCountdown, setNukeCountdown] = useState<number | null>(null);
  const [hackerName, setHackerName] = useState("");
  const [certGenerated, setCertGenerated] = useState(false);
  const [camFrame, setCamFrame] = useState(0);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [matrixActive, setMatrixActive] = useState(false);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);
  const [isTerminalFullscreen, setIsTerminalFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"zsh" | "logs">("zsh");

  // Simulated Virtual Filesystem
  const [vfs, setVfs] = useState<{ [path: string]: { [name: string]: { type: "file" | "dir"; content?: string; size?: number } } }>({
    "~": {
      "secrets.txt": { type: "file", content: "Did you really think we would leave plaintext secrets here? Go solve Two Sum.", size: 76 },
      "admin_passwords.env": { type: "file", content: "ADMIN_KEY=nice_try_diddy\nDB_PASS=never_gonna_give_you_up\nROOT_KEY=418_im_a_teapot\nFLAG=BMSIT{url_bar_is_not_an_exploit}", size: 128 },
      "bmsit_mainframe.py": { type: "file", content: "# BMSIT Mainframe v4.20\nimport time\nprint('Initializing quantum firewall...')\ntime.sleep(1)\nraise PermissionError('Skill issue: User attempted /admin access')", size: 164 },
      "two_sum.cpp": { type: "file", content: "#include <iostream>\n// TODO: Solve this before attempting to hack NASA\nint main() {\n    std::cout << \"Practice DSA!\" << std::endl;\n    return 0;\n}", size: 142 },
      "flag.txt": { type: "file", content: "BMSIT{n1c3_try_scr1pt_k1dd13_g0_j01n_c0d1ng_club}", size: 48 },
      ".zshrc": { type: "file", content: "# Oh-My-Zsh Configuration\nZSH_THEME=\"robbyrussell\"\nplugins=(git brew zsh-syntax-highlighting)\nalias hack=\"echo 'Nice try diddy'\"", size: 120 },
      ".zsh_history": { type: "file", content: "1  how to hack nasa with html\n2  download free ram 2026\n3  mr robot theme 10 hours loop\n4  curl http://localhost:3000/admin\n5  brew install intelligence", size: 190 },
      "homework_dont_open": { type: "dir" },
      "node_modules": { type: "dir" },
      "Applications": { type: "dir" },
    },
    "~/homework_dont_open": {
      "anime_memes.txt": { type: "file", content: "Caught in 4K resolution. Go study for internals.", size: 48 },
      "real_grades_leak.csv": { type: "file", content: "Subject,Grade\nData Structures,A+\nOperating Systems,A+\nURL Guessing,F-", size: 72 },
    },
    "~/node_modules": {
      "is-even": { type: "dir" },
      "left-pad": { type: "dir" },
      "heavy-payload.bin": { type: "file", content: "Binary file contains 4.2 Gigabytes of pure bloat.", size: 4294967296 },
    },
    "~/Applications": {
      "Xcode.app": { type: "dir" },
      "Chrome.app": { type: "dir" },
      "VSCode.app": { type: "dir" },
    },
    "/etc": {
      "passwd": { type: "file", content: "root:x:0:0:root:/var/root:/bin/zsh\nkiddie:x:501:20:Script Kiddie:/Users/kiddie:/bin/zsh\nadmin:x:502:20:President:/Users/admin:/bin/zsh", size: 140 },
      "shadow": { type: "file", content: "root:$6$rounds=50000$super_secret_hash_dont_look:19420:0:99999:7:::\nadmin:$6$rounds=50000$nice_try_bro_go_read_a_book:19420:0:99999:7:::", size: 175 },
      "hosts": { type: "file", content: "127.0.0.1\tlocalhost\n127.0.0.1\tbmsit-honeypot\n", size: 45 },
    },
  });

  const synthRef = useRef<ReturnType<typeof createSynth> | null>(null);
  const terminalBodyRef = useRef<HTMLDivElement>(null);
  const matrixCanvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const getSynth = useCallback(() => {
    if (!synthRef.current) {
      synthRef.current = createSynth();
    }
    return synthRef.current;
  }, []);

  // Initial streaming log animation
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < INITIAL_LOGS.length) {
        setLogs((prev) => [...prev, INITIAL_LOGS[index]]);
        if (soundEnabled) {
          getSynth()?.beep(300 + index * 80, "sine", 0.05, 0.03);
        }
        index++;
      } else {
        clearInterval(interval);
      }
    }, 280);
    return () => clearInterval(interval);
  }, [soundEnabled, getSynth]);

  // Surveillance camera animation
  useEffect(() => {
    const camInterval = setInterval(() => {
      setCamFrame((prev) => (prev + 1) % SURVEILLANCE_FRAMES.length);
    }, 1800);
    return () => clearInterval(camInterval);
  }, []);

  // Internal terminal container scroll (never scrolls whole page)
  useEffect(() => {
    if (terminalBodyRef.current && !matrixActive) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [terminalHistory, matrixActive]);

  // Canvas Matrix Digital Rain Animation
  useEffect(() => {
    if (!matrixActive) return;
    const canvas = matrixCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    const height = (canvas.height = 380);

    const characters = "0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜﾊﾞﾋﾞﾌﾞﾍﾞﾎﾞ";
    const fontSize = 14;
    const columns = Math.floor(width / fontSize);
    const drops: number[] = Array.from({ length: columns }, () => Math.floor(Math.random() * -50));

    const draw = () => {
      ctx.fillStyle = "rgba(18, 18, 24, 0.12)";
      ctx.fillRect(0, 0, width, height);

      ctx.font = `${fontSize}px "SF Mono", "Fira Code", monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = characters.charAt(Math.floor(Math.random() * characters.length));
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // Bright white lead drop
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 8;
        ctx.fillText(text, x, y);

        // Green trailing stream
        ctx.fillStyle = "#22c55e";
        ctx.shadowBlur = 2;
        const prevText = characters.charAt(Math.floor(Math.random() * characters.length));
        ctx.fillText(prevText, x, y - fontSize);

        if (y > height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [matrixActive]);

  // Nuke Sequence Engine
  const triggerNuke = useCallback(() => {
    setNukeActive(true);
    setNukeCountdown(5);
    setTerminalHistory((prev) => [
      ...prev,
      { text: "[ALERT: TACTICAL NUKE ARMED] INITIATING COUNTDOWN...", isError: true, isHighlight: true },
      { text: "T-MINUS 5 SECONDS TO TOTAL SYSTEM WIPE...", isError: true },
    ]);
  }, []);

  useEffect(() => {
    if (nukeCountdown === null) return;
    if (nukeCountdown > 0) {
      if (soundEnabled) getSynth()?.alarm();
      const timer = setTimeout(() => {
        setTerminalHistory((prev) => [
          ...prev,
          { text: `[WARN] T-MINUS ${nukeCountdown - 1} SECONDS...`, isError: true },
        ]);
        setNukeCountdown(nukeCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      if (soundEnabled) getSynth()?.explosion();
      setTerminalHistory((prev) => [
        ...prev,
        { text: MUSHROOM_CLOUD_ART, isHighlight: true },
        { text: "[DETONATION] 418: I'M A TEAPOT! DATABASE TOTAL SELF-DESTRUCTION COMPLETE.", isError: true, isHighlight: true },
        { text: "[REPORT] DAMAGE ASSESSMENT: 0 real servers harmed, 100% of attacker credibility atomized.", isSuccess: true },
        { text: "[NOTICE] Incident logged in security audit records.", isHighlight: true },
      ]);
      setNukeCountdown(null);
      setTimeout(() => setNukeActive(false), 2000);
    }
  }, [nukeCountdown, soundEnabled, getSynth]);

  // Command Execution Engine
  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const rawCmd = commandInput.trim();
    if (!rawCmd) return;

    if (soundEnabled) getSynth()?.beep(600, "square", 0.04, 0.04);

    setCommandHistoryList((prev) => [...prev, rawCmd]);
    setHistoryIndex(null);

    const parts = rawCmd.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    const argStr = args.join(" ");

    const newHistory: TerminalEntry[] = [
      ...terminalHistory,
      {
        text: rawCmd,
        isPrompt: true,
        promptPath: currentPath,
      },
    ];

    const currentDirFiles = vfs[currentPath] || {};

    switch (cmd) {
      case "help":
        newHistory.push(
          { text: "╭─ macOS Terminal Command Reference (zsh) ───────────────────────╮", isHighlight: true },
          { text: "│  ls [-la]         - List directory contents with BSD file info  │" },
          { text: "│  cd <dir>         - Change directory ('cd ..', 'cd ~', etc.)   │" },
          { text: "│  pwd              - Print working directory                     │" },
          { text: "│  cat <file>       - Concatenate and display file content        │" },
          { text: "│  touch <file>     - Create new simulated file                   │" },
          { text: "│  mkdir <dir>      - Create new simulated directory              │" },
          { text: "│  rm <file>        - Delete file (try 'rm -rf /')                │" },
          { text: "│  echo <text>      - Output text or string                       │" },
          { text: "│  whoami / id      - Display current user & group IDs            │" },
          { text: "│  uname -a         - Print Darwin kernel architecture            │" },
          { text: "│  sw_vers          - Display macOS version information           │" },
          { text: "│  top / ps aux     - Show real-time process list                 │" },
          { text: "│  ping <host>      - Transmit ICMP echo requests                 │" },
          { text: "│  curl / wget      - Transfer data from URL                      │" },
          { text: "│  brew <cmd>       - Homebrew package manager simulation         │" },
          { text: "│  matrix / cmatrix - Launch streaming digital rain visualizer    │" },
          { text: "│  nuke             - Arm tactical mainframe self-destruct        │" },
          { text: "│  passwords        - Dump admin credentials                      │" },
          { text: "│  hack / bypass    - Execute 1-click penetration test            │" },
          { text: "│  skills           - Audit security skill metrics                │" },
          { text: "│  history          - Command history                             │" },
          { text: "│  date / uptime    - System uptime and current timestamp         │" },
          { text: "│  git status       - Check working tree status                   │" },
          { text: "│  bmsit            - Coding Club BMSIT information               │" },
          { text: "│  clear (⌘K)       - Clear terminal scrollback                   │" },
          { text: "│  exit / q         - Return to home page                         │" },
          { text: "╰─────────────────────────────────────────────────────────────────╯", isHighlight: true }
        );
        break;

      case "ls":
      case "dir": {
        const isLong = args.includes("-l") || args.includes("-la") || args.includes("-al");
        const fileNames = Object.keys(currentDirFiles);

        if (fileNames.length === 0) {
          newHistory.push({ text: "(empty directory)" });
        } else if (isLong) {
          newHistory.push({ text: `total ${fileNames.length * 4}` });
          fileNames.forEach((name) => {
            const item = currentDirFiles[name];
            const isDir = item.type === "dir";
            const perms = isDir ? "drwxr-xr-x" : "-rw-r--r--@";
            const size = (item.size || 1024).toString().padStart(6, " ");
            newHistory.push({
              text: `${perms}   1 kiddie  staff   ${size}  Aug 24 15:40 ${isDir ? name + "/" : name}`,
              isSuccess: isDir,
            });
          });
        } else {
          const formatted = fileNames
            .map((f) => (currentDirFiles[f].type === "dir" ? `${f}/` : f))
            .join("   ");
          newHistory.push({ text: formatted, isSuccess: true });
        }
        break;
      }

      case "pwd":
        newHistory.push({ text: currentPath.replace("~", "/Users/kiddie") });
        break;

      case "cd": {
        const target = args[0] || "~";
        if (target === "~" || target === "") {
          setCurrentPath("~");
        } else if (target === ".." || target === "../") {
          if (currentPath.includes("/")) {
            const parent = currentPath.substring(0, currentPath.lastIndexOf("/"));
            setCurrentPath(parent || "~");
          } else {
            setCurrentPath("/");
          }
        } else if (target === "/" || target === "/etc") {
          if (vfs[target]) {
            setCurrentPath(target);
          } else {
            newHistory.push({ text: `zsh: cd: permission denied: ${target}`, isError: true });
          }
        } else {
          const resolvedPath = currentPath === "~" ? `~/${target}` : `${currentPath}/${target}`;
          if (vfs[resolvedPath] || currentDirFiles[target]?.type === "dir") {
            setCurrentPath(resolvedPath);
          } else if (currentDirFiles[target]?.type === "file") {
            newHistory.push({ text: `zsh: cd: not a directory: ${target}`, isError: true });
          } else {
            newHistory.push({ text: `zsh: cd: no such file or directory: ${target}`, isError: true });
          }
        }
        break;
      }

      case "cat": {
        if (!args[0]) {
          newHistory.push({ text: "cat: missing file operand", isError: true });
          break;
        }
        const filename = args[0];
        const file = currentDirFiles[filename];
        if (file) {
          if (file.type === "dir") {
            newHistory.push({ text: `cat: ${filename}: Is a directory`, isError: true });
          } else {
            newHistory.push({ text: file.content || "", isHighlight: true });
          }
        } else if (filename === "/etc/passwd" || filename === "/etc/shadow" || filename === "/etc/hosts") {
          const etcFile = vfs["/etc"]?.[filename.replace("/etc/", "")];
          if (etcFile) newHistory.push({ text: etcFile.content || "", isHighlight: true });
        } else {
          newHistory.push({ text: `cat: ${filename}: No such file or directory`, isError: true });
        }
        break;
      }

      case "touch": {
        if (!args[0]) {
          newHistory.push({ text: "touch: missing file operand", isError: true });
          break;
        }
        const newFile = args[0];
        setVfs((prev) => ({
          ...prev,
          [currentPath]: {
            ...prev[currentPath],
            [newFile]: { type: "file", content: `Created on macOS at ${new Date().toLocaleTimeString()}`, size: 32 },
          },
        }));
        newHistory.push({ text: `Created file '${newFile}' successfully.`, isSuccess: true });
        break;
      }

      case "mkdir": {
        if (!args[0]) {
          newHistory.push({ text: "mkdir: missing operand", isError: true });
          break;
        }
        const newDir = args[0];
        const newDirPath = currentPath === "~" ? `~/${newDir}` : `${currentPath}/${newDir}`;
        setVfs((prev) => ({
          ...prev,
          [currentPath]: {
            ...prev[currentPath],
            [newDir]: { type: "dir" },
          },
          [newDirPath]: {},
        }));
        newHistory.push({ text: `Created directory '${newDir}/'`, isSuccess: true });
        break;
      }

      case "rm": {
        if (rawCmd.includes("-rf /") || rawCmd.includes("-rf *")) {
          triggerNuke();
          newHistory.push({ text: "[ALERT] RM -RF / DETECTED! INITIATING SIP CORE PANIC...", isError: true });
        } else if (!args[0]) {
          newHistory.push({ text: "rm: missing operand", isError: true });
        } else {
          const target = args.find((a) => !a.startsWith("-")) || "";
          if (currentDirFiles[target]) {
            setVfs((prev) => {
              const updated = { ...prev[currentPath] };
              delete updated[target];
              return { ...prev, [currentPath]: updated };
            });
            newHistory.push({ text: `Removed '${target}'`, isSuccess: true });
          } else {
            newHistory.push({ text: `rm: cannot remove '${target}': No such file or directory`, isError: true });
          }
        }
        break;
      }

      case "echo":
        newHistory.push({ text: argStr || "" });
        break;

      case "whoami":
        newHistory.push({ text: "kiddie (uid=501(kiddie) gid=20(staff) groups=20(staff),12(everyone),61(localaccounts))" });
        break;

      case "id":
        newHistory.push({ text: "uid=501(kiddie) gid=20(staff) groups=20(staff),12(everyone),61(localaccounts),100(scriptkiddies)" });
        break;

      case "uname":
      case "uname -a":
        newHistory.push({ text: "Darwin bmsit-macbook-pro.local 23.5.0 Darwin Kernel Version 23.5.0: root:xnu-10063.121.3~5/RELEASE_ARM64_T6000 arm64" });
        break;

      case "sw_vers":
        newHistory.push(
          { text: "ProductName:\t\tmacOS", isHighlight: true },
          { text: "ProductVersion:\t\t14.5 (Sonoma)" },
          { text: "BuildVersion:\t\t23F79" }
        );
        break;

      case "hostname":
        newHistory.push({ text: "bmsit-macbook-pro.local" });
        break;

      case "date":
        newHistory.push({ text: new Date().toString() });
        break;

      case "uptime":
        newHistory.push({ text: " 15:45  up 420 days,  1:37, 2 users, load averages: 0.12 0.08 0.05 (Apple M3 Max)" });
        break;

      case "brew":
        newHistory.push(
          { text: "==> Homebrew 4.3.0", isSuccess: true },
          { text: "==> Searching for formula 'admin-exploit'..." },
          { text: "Error: No available formula or cask with the name 'admin-exploit'." },
          { text: "Did you mean: 'leetcode-cli' or 'how-to-program'?" }
        );
        break;

      case "ps":
      case "ps aux":
      case "top":
      case "htop":
        newHistory.push(
          { text: "PID   TT  STAT      TIME COMMAND", isHighlight: true },
          { text: "  1   ??  Ss    12:45.02 /sbin/launchd" },
          { text: " 69   s0  S+     0:00.04 /bin/clown --browser-url-bar" },
          { text: "420   ??  R    128:42.10 /Applications/Google Chrome.app (47 Tabs)" },
          { text: "1337  s0  S+     0:01.00 python3 hack_the_world.py (Stuck on IndentationError)" },
          { text: "9999  ??  Ss     4:20.00 /usr/local/bin/coding-club-service (Healthy)" }
        );
        break;

      case "kill":
      case "kill -9":
        newHistory.push({ text: `kill: process terminated. Ego sub-routine exited with SIGKILL.`, isError: true });
        break;

      case "ping": {
        const host = args[0] || "127.0.0.1";
        newHistory.push(
          { text: `PING ${host} (${host}): 56 data bytes` },
          { text: `64 bytes from ${host}: icmp_seq=0 ttl=64 time=0.038 ms` },
          { text: `64 bytes from ${host}: icmp_seq=1 ttl=64 time=0.042 ms` },
          { text: `64 bytes from ${host}: icmp_seq=2 ttl=64 time=0.039 ms` },
          { text: `--- ${host} ping statistics ---` },
          { text: `3 packets transmitted, 3 packets received, 0.0% packet loss (Self-Doxxed)` }
        );
        break;
      }

      case "curl":
      case "wget": {
        const targetUrl = args[0] || "http://localhost:3000/admin";
        newHistory.push(
          { text: `HTTP/2 418 I'm a Teapot` },
          { text: `server: cloudflare-bmsit` },
          { text: `content-type: application/json` },
          { text: `{"error": "ACCESS_DENIED", "roast": "Curled ${targetUrl} without authorization."}`, isError: true }
        );
        break;
      }

      case "git":
      case "git status":
        newHistory.push(
          { text: "On branch main", isSuccess: true },
          { text: "Your branch is up to date with 'origin/main'." },
          { text: "Untracked files: (use 'git add <file>...' to include)" },
          { text: "  hopes_and_dreams.py\n  failed_exploits/" }
        );
        break;

      case "matrix":
      case "cmatrix":
        setMatrixActive(true);
        if (soundEnabled) getSynth()?.beep(880, "triangle", 0.1, 0.05);
        newHistory.push({ text: "[*] Matrix Digital Rain Engaged. Press 'ESC', 'q', or click Exit Matrix to exit.", isSuccess: true });
        break;

      case "nuke":
        triggerNuke();
        break;

      case "sudo":
      case "sudo su":
      case "sudo -i":
        newHistory.push(
          { text: "Password: *********", isHighlight: true },
          { text: "kiddie is not in the sudoers file. This incident will be reported via Apple Push Notifications to your parents.", isError: true }
        );
        break;

      case "passwords":
        newHistory.push(
          { text: "--- macOS Keychain Dump ---", isHighlight: true },
          { text: "admin@bmsit.in: pbkdf2$sha512$100000$nice_try_bro_we_use_bcrypt_with_salted_rounds" },
          { text: "root:          never_gonna_give_you_up_never_gonna_let_you_down" },
          { text: "[*] Access denied. Real admins don't keep passwords lying around here. Nice try.", isSuccess: true }
        );
        break;

      case "hack":
        newHistory.push(
          { text: "[*] Injecting quantum SQL payload into macOS Metal framework...", isHighlight: true },
          { text: "[*] Overclocking Apple M3 Max Neural Engine...", isHighlight: true },
          { text: "[!] ERROR: Access Denied! Firewall responded: 'Bro, please go solve Two Sum first.'", isError: true }
        );
        break;

      case "bypass":
        newHistory.push(
          { text: "[*] Attempting Gatekeeper bypass via port 1337...", isHighlight: true },
          { text: "[!] FAILED: The only thing bypassed today was common sense.", isError: true }
        );
        break;

      case "skills":
        newHistory.push(
          { text: "APPLE CYBERSECURITY AUDIT REPORT:", isHighlight: true },
          { text: "  • URL Guessing: [██████████] 100% (Flawless)" },
          { text: "  • Actual Security Knowledge: [░░░░░░░░░░] 0% (Missing)" },
          { text: "  • Mr. Robot Quotes Memorized: [██████████] 100%" },
          { text: "  • LeetCode Easy Solved: [█░░░░░░░░░] 1% (Gave up on arrays)" }
        );
        break;

      case "bmsit":
        newHistory.push(
          { text: "Coding Club BMSIT is the premier student developer community.", isSuccess: true },
          { text: "Instead of probing random URLs, come build real open-source software, hackathons, and systems with us." },
          { text: "Visit the home page or click 'Join Us' to get involved." }
        );
        break;

      case "python":
      case "python3":
      case "node":
        newHistory.push({
          text: `Python 3.12.3 (main, May 2026) [Clang 15.0.0 (clang-1500.3.9.4)] on darwin\n>>> import hack\nModuleNotFoundError: No module named 'hack'. Go study programming.`,
          isHighlight: true,
        });
        break;

      case "clear":
        setTerminalHistory([]);
        setCommandInput("");
        return;

      case "exit":
      case "q":
        if (matrixActive) {
          setMatrixActive(false);
          newHistory.push({ text: "Exited Matrix mode." });
        } else if (typeof window !== "undefined") {
          window.location.href = "/";
        }
        return;

      default:
        newHistory.push({
          text: `zsh: command not found: ${cmd}. Type 'help' to see available macOS terminal commands.`,
          isError: true,
        });
        break;
    }

    setTerminalHistory(newHistory);
    setCommandInput("");
  };

  // Handle Arrow Up / Down command history navigation & Tab completion
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistoryList.length === 0) return;
      const nextIndex = historyIndex === null ? commandHistoryList.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setCommandInput(commandHistoryList[nextIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === null) return;
      if (historyIndex < commandHistoryList.length - 1) {
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        setCommandInput(commandHistoryList[nextIndex]);
      } else {
        setHistoryIndex(null);
        setCommandInput("");
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const currentFiles = Object.keys(vfs[currentPath] || {});
      const match = currentFiles.find((f) => f.startsWith(commandInput.trim()));
      if (match) {
        setCommandInput(match);
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setTerminalHistory([]);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      e.preventDefault();
      setTerminalHistory((prev) => [
        ...prev,
        { text: commandInput + "^C", isPrompt: true, promptPath: currentPath },
      ]);
      setCommandInput("");
    }
  };

  // Fake database download
  const handleDownloadPasswords = () => {
    if (soundEnabled) getSynth()?.rickroll();
    const content = `========================================================================
BMSIT CODING CLUB SYSTEM ACCESS LOG
CLASSIFIED AUDIT RECORD // LEVEL 99 SECURITY IDENTIFIER
========================================================================

                 .-''''''-.
               .'          '.
              /   O      O   \\
             :                :
             |                |
             :    .------.    :
              \\  '  ____  '  /
               '.          .'
                 '-......-'
                 [ TARGET RECORD LOCATED ]

Authentication Record:
Username: admin@bmsit.in
Password: NEVER_GONNA_GIVE_YOU_UP_NEVER_GONNA_LET_YOU_DOWN

------------------------------------------------------------------------
SECURITY ADVISORY // CODING CLUB ENGINEERING TEAM:
------------------------------------------------------------------------
1. Authentic platforms enforce cryptographic session validation, role tiers,
   and strict origin verification — routes are not exposed publicly on /admin.
2. Administrative control is reserved for verified core leadership.
3. To learn modern web architecture, distributed systems, and security engineering,
   participate in Coding Club BMSIT workshops and hackathons.

Portal: https://codingclub.bmsit.in
========================================================================
`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ADMIN_SECURITY_AUDIT_DUMP.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy fake exploit
  const handleCopyExploit = () => {
    if (soundEnabled) getSynth()?.beep(800, "triangle", 0.08, 0.05);
    const exploitCode = `curl -X POST https://codingclub.bmsit.in/admin --data '{"exploit": "typing_admin_in_url", "skill_level": 0}' # Result: 418 I'm a Teapot`;
    navigator.clipboard.writeText(exploitCode);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2500);
  };

  const displayName = useMemo(() => hackerName.trim() || "Anonymous Penetration Tester", [hackerName]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08080a",
        color: "#d0d0d5",
        fontFamily: '"SF Mono", "Menlo", "Monaco", "Fira Code", monospace',
        position: "relative",
        overflowX: "hidden",
        paddingBottom: "80px",
      }}
    >
      {/* Inline styles for macOS Terminal, Pixel TV scanlines, Nuke Shake, and CRT glow */}
      <style>{`
        @keyframes tvScanlineFlow {
          0% {
            background-position: 0 0, 0 0;
          }
          100% {
            background-position: 0 100px, 0 50px;
          }
        }

        @keyframes tvFlickerJitter {
          0%, 100% {
            opacity: 1;
            transform: translate(0, 0);
          }
          48% {
            opacity: 0.97;
            transform: translate(0.5px, -0.3px);
          }
          50% {
            opacity: 0.88;
            transform: translate(-0.8px, 0.5px);
          }
          52% {
            opacity: 0.98;
            transform: translate(0, 0);
          }
          85% {
            opacity: 1;
          }
          86% {
            opacity: 0.92;
            transform: translate(-0.5px, 0);
          }
          87% {
            opacity: 1;
            transform: translate(0, 0);
          }
        }

        @keyframes crtPhosphorPulse {
          0%, 100% {
            filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.45));
          }
          50% {
            filter: drop-shadow(0 0 22px rgba(255, 255, 255, 0.75));
          }
        }

        @keyframes crtRedPhosphorPulse {
          0%, 100% {
            filter: drop-shadow(0 0 15px rgba(239, 68, 68, 0.6)) drop-shadow(0 0 30px rgba(239, 68, 68, 0.35));
          }
          50% {
            filter: drop-shadow(0 0 28px rgba(239, 68, 68, 0.95)) drop-shadow(0 0 50px rgba(239, 68, 68, 0.55));
          }
        }

        @keyframes nukeScreenShake {
          0% { transform: translate(0, 0) rotate(0deg); }
          20% { transform: translate(-4px, 4px) rotate(-0.5deg); }
          40% { transform: translate(4px, -3px) rotate(0.5deg); }
          60% { transform: translate(-3px, -2px) rotate(-0.3deg); }
          80% { transform: translate(3px, 3px) rotate(0.3deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }

        @keyframes macCursorBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }

        .nuke-shaking {
          animation: nukeScreenShake 0.12s infinite;
        }

        .pixel-tv-white {
          background-image: 
            repeating-linear-gradient(
              0deg,
              rgba(0, 0, 0, 0.82) 0px,
              rgba(0, 0, 0, 0.82) 3px,
              transparent 3px,
              transparent 6px
            ),
            linear-gradient(
              180deg,
              #ffffff 0%,
              #e2e8f0 40%,
              #cbd5e1 70%,
              #ffffff 100%
            );
          background-size: 100% 6px, 100% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          display: inline-block;
          animation: tvScanlineFlow 2.8s linear infinite, tvFlickerJitter 3.5s steps(1) infinite, crtPhosphorPulse 2.5s ease-in-out infinite;
          letter-spacing: -0.02em;
        }

        .pixel-tv-red {
          background-image: 
            repeating-linear-gradient(
              0deg,
              rgba(0, 0, 0, 0.85) 0px,
              rgba(0, 0, 0, 0.85) 3px,
              transparent 3px,
              transparent 6px
            ),
            linear-gradient(
              180deg,
              #f87171 0%,
              #ef4444 45%,
              #dc2626 75%,
              #f87171 100%
            );
          background-size: 100% 6px, 100% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          display: inline-block;
          animation: tvScanlineFlow 2.4s linear infinite, tvFlickerJitter 4s steps(1) infinite, crtRedPhosphorPulse 2.2s ease-in-out infinite;
          letter-spacing: -0.02em;
        }

        /* macOS Traffic Light Buttons */
        .mac-traffic-lights {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .mac-btn {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 0.5px solid rgba(0, 0, 0, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          position: relative;
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.4), 0 1px 2px rgba(0, 0, 0, 0.25);
          transition: transform 0.1s ease;
        }
        .mac-btn:active {
          transform: scale(0.92);
        }
        .mac-btn-close {
          background: #ff5f56;
          border-color: #e0443e;
        }
        .mac-btn-min {
          background: #ffbd2e;
          border-color: #dea123;
        }
        .mac-btn-max {
          background: #27c93f;
          border-color: #1aab29;
        }
        .mac-btn-glyph {
          opacity: 0;
          font-size: 8px;
          font-weight: 900;
          color: rgba(0, 0, 0, 0.65);
          transition: opacity 0.15s ease;
          line-height: 1;
          user-select: none;
        }
        .mac-traffic-lights:hover .mac-btn-glyph {
          opacity: 1;
        }

        /* macOS Terminal Scrollbar */
        .mac-terminal-body::-webkit-scrollbar {
          width: 7px;
        }
        .mac-terminal-body::-webkit-scrollbar-track {
          background: transparent;
        }
        .mac-terminal-body::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.18);
          border-radius: 10px;
        }
        .mac-terminal-body::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.32);
        }
      `}</style>

      {/* CRT Scanline overlay */}
      {scanlines && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 999,
            background: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03))",
            backgroundSize: "100% 3px, 6px 100%",
            opacity: 0.85,
          }}
        />
      )}

      {/* Top Warning Banner */}
      <div
        style={{
          background: "linear-gradient(90deg, #991b1b, #7f1d1d, #991b1b)",
          color: "#fff",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          borderBottom: "1px solid #ef4444",
          fontSize: "12px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          boxShadow: "0 0 20px rgba(239, 68, 68, 0.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              display: "inline-block",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "#ef4444",
              boxShadow: "0 0 10px #ef4444",
              animation: "pulse 1s infinite alternate",
            }}
          />
          <strong style={{ fontWeight: 800 }}>SECURITY NOTICE // HONEYPOT ENGAGED</strong>
          <span style={{ opacity: 0.8, fontSize: "11px" }}>[INCIDENT_ID: SCRIPT_KIDDIE_42069]</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) {
                const s = getSynth();
                s?.beep(500, "sine", 0.08, 0.05);
              }
            }}
            style={{
              background: soundEnabled ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "#fff",
              padding: "4px 10px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "11px",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>{soundEnabled ? "AUDIO: ON" : "AUDIO: MUTED"}</span>
          </button>

          <button
            onClick={() => setScanlines(!scanlines)}
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "#fff",
              padding: "4px 10px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "11px",
              fontFamily: "inherit",
            }}
          >
            {scanlines ? "CRT: ON" : "CRT: OFF"}
          </button>
        </div>
      </div>

      <div className={nukeActive ? "nuke-shaking" : ""} style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 24px" }}>
        
        {/* Main Title Section */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 16px",
              borderRadius: "20px",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#f87171",
              fontSize: "12px",
              marginBottom: "16px",
              letterSpacing: "0.1em",
            }}
          >
            <span style={{ color: "#ef4444", fontWeight: 700 }}>[!]</span>
            <span>UNAUTHORIZED ACCESS PROTOCOL ACTIVATED</span>
          </div>

          {/* Animated Pixel TV Title Text */}
          <h1
            style={{
              fontSize: "clamp(34px, 6.5vw, 68px)",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              marginBottom: "16px",
              lineHeight: 1.15,
              userSelect: "none",
            }}
          >
            <span className="pixel-tv-white">Nice Try,&nbsp;</span>
            <span className="pixel-tv-red">Mr. Robot.</span>
          </h1>

          <p
            style={{
              maxWidth: "680px",
              margin: "0 auto",
              fontSize: "15px",
              color: "#9ca3af",
              lineHeight: 1.6,
            }}
          >
            Did you really just type <code style={{ color: "#f87171", background: "rgba(239, 68, 68, 0.15)", padding: "2px 8px", borderRadius: "4px" }}>/admin</code> into your browser bar expecting an unlocked control panel in 2026?
            <br />
            If you&apos;re looking for our actual member tools or admin systems, keep guessing. No spoilers here.
          </p>
        </div>

        {/* Nuke Flash Alert */}
        {nukeCountdown !== null && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.25)",
              border: "2px solid #ef4444",
              borderRadius: "12px",
              padding: "24px",
              textAlign: "center",
              marginBottom: "32px",
              boxShadow: "0 0 40px rgba(239, 68, 68, 0.5)",
              animation: "pulse 0.4s infinite alternate",
            }}
          >
            <h2 style={{ color: "#ef4444", fontSize: "32px", fontWeight: 900, margin: 0, letterSpacing: "0.05em" }}>
              [ALERT] TACTICAL NUKE SEQUENCE ARMED: {nukeCountdown}s
            </h2>
            <p style={{ color: "#fca5a5", marginTop: "8px", fontSize: "14px", fontWeight: 600 }}>
              Detonating mainframe core... Screen shaking & emergency siren active.
            </p>
          </div>
        )}

        {/* Threat Dossier Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px",
            marginBottom: "32px",
          }}
        >
          {/* Dossier Card 1 */}
          <div
            style={{
              background: "rgba(18, 18, 22, 0.85)",
              border: "1px solid #27272a",
              borderRadius: "10px",
              padding: "20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <span style={{ fontSize: "12px", color: "#f87171", fontWeight: 700, letterSpacing: "0.08em" }}>
                // 01 INTRUDER TELEMETRY
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
              <div>
                <span style={{ color: "#71717a" }}>Attack Vector: </span>
                <span style={{ color: "#fca5a5" }}>URL Bar Guesswork</span>
              </div>
              <div>
                <span style={{ color: "#71717a" }}>Threat Score: </span>
                <span style={{ color: "#4ade80" }}>0.00 / 100 (Harmless)</span>
              </div>
              <div>
                <span style={{ color: "#71717a" }}>Target IP: </span>
                <span style={{ color: "#93c5fd" }}>127.0.0.1 (Self-Own)</span>
              </div>
              <div>
                <span style={{ color: "#71717a" }}>Active Exploit: </span>
                <span style={{ color: "#e4e4e7" }}>None (Pure optimism)</span>
              </div>
            </div>
          </div>

          {/* Dossier Card 2 */}
          <div
            style={{
              background: "rgba(18, 18, 22, 0.85)",
              border: "1px solid #27272a",
              borderRadius: "10px",
              padding: "20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <span style={{ fontSize: "12px", color: "#fbbf24", fontWeight: 700, letterSpacing: "0.08em" }}>
                // 02 DIAGNOSTIC AUDIT
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
              <div>
                <span style={{ color: "#71717a" }}>Coding Experience: </span>
                <span style={{ color: "#fcd34d" }}>Watched 1 YouTube Short</span>
              </div>
              <div>
                <span style={{ color: "#71717a" }}>Favorite Tool: </span>
                <span style={{ color: "#e4e4e7" }}>Inspect Element text edit</span>
              </div>
              <div>
                <span style={{ color: "#71717a" }}>Cyber Status: </span>
                <span style={{ color: "#f87171" }}>Caught in 4K resolution</span>
              </div>
              <div>
                <span style={{ color: "#71717a" }}>Prescribed Remedy: </span>
                <span style={{ color: "#86efac" }}>Practice LeetCode Easy</span>
              </div>
            </div>
          </div>

          {/* Dossier Card 3: Camera Feed */}
          <div
            style={{
              background: "rgba(18, 18, 22, 0.85)",
              border: "1px solid #27272a",
              borderRadius: "10px",
              padding: "16px 20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#ef4444", fontSize: "10px" }}>● REC</span>
                <span style={{ fontSize: "11px", color: "#a1a1aa" }}>SURVEILLANCE HUD</span>
              </div>
              <span style={{ fontSize: "10px", color: "#71717a" }}>CAM_01 // 60 FPS</span>
            </div>
            
            <pre
              style={{
                background: "#0d0d11",
                border: "1px solid #1f1f23",
                borderRadius: "6px",
                padding: "8px",
                fontSize: "11px",
                color: "#22c55e",
                lineHeight: "1.25",
                margin: 0,
                overflowX: "hidden",
              }}
            >
              {SURVEILLANCE_FRAMES[camFrame]}
            </pre>
          </div>
        </div>

        {/* Live Automated Breach Log Stream */}
        <div
          style={{
            background: "#0c0c10",
            border: "1px solid #27272a",
            borderRadius: "10px",
            padding: "16px 20px",
            marginBottom: "32px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", borderBottom: "1px solid #1f1f23", paddingBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }} />
              <span style={{ fontSize: "12px", color: "#e4e4e7", fontWeight: 700 }}>TELEMETRY LOGS (REAL-TIME AUDIT STREAM)</span>
            </div>
            <span style={{ fontSize: "11px", color: "#71717a" }}>LOG_LEVEL: VERBOSE</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#a1a1aa" }}>
            {logs.map((log, idx) => (
              <div key={idx} style={{ opacity: 0.95, wordBreak: "break-word" }}>
                {log}
              </div>
            ))}
          </div>
        </div>

        {/* REAL macOS Terminal Interface (iTerm2 / Warp / Terminal.app Vibe) */}
        <div
          style={{
            background: "rgba(18, 18, 24, 0.88)",
            backdropFilter: "blur(24px) saturate(190%)",
            WebkitBackdropFilter: "blur(24px) saturate(190%)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 28px 70px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.08)",
            marginBottom: "40px",
            position: "relative",
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            maxHeight: isTerminalCollapsed ? "44px" : isTerminalFullscreen ? "900px" : "600px",
          }}
        >
          {/* macOS Titlebar */}
          <div
            style={{
              background: "linear-gradient(180deg, rgba(45, 45, 52, 0.92) 0%, rgba(32, 32, 38, 0.92) 100%)",
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(0, 0, 0, 0.6)",
              userSelect: "none",
              cursor: "default",
            }}
          >
            {/* Traffic Lights */}
            <div className="mac-traffic-lights">
              <div
                className="mac-btn mac-btn-close"
                title="Close Window (Clear)"
                onClick={() => {
                  if (soundEnabled) getSynth()?.beep(400, "square", 0.05);
                  setTerminalHistory([]);
                }}
              >
                <span className="mac-btn-glyph">✕</span>
              </div>
              <div
                className="mac-btn mac-btn-min"
                title="Minimize Terminal"
                onClick={() => {
                  if (soundEnabled) getSynth()?.beep(550, "sine", 0.05);
                  setIsTerminalCollapsed(!isTerminalCollapsed);
                }}
              >
                <span className="mac-btn-glyph">─</span>
              </div>
              <div
                className="mac-btn mac-btn-max"
                title="Toggle Fullscreen"
                onClick={() => {
                  if (soundEnabled) getSynth()?.beep(700, "triangle", 0.05);
                  setIsTerminalFullscreen(!isTerminalFullscreen);
                  setIsTerminalCollapsed(false);
                }}
              >
                <span className="mac-btn-glyph">⤢</span>
              </div>
            </div>

            {/* macOS Centered Window Title */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                color: "#e2e8f0",
                fontWeight: 600,
                letterSpacing: "0.01em",
              }}
            >
              <span style={{ color: "#94a3b8" }}>//</span>
              <span>kiddie — zsh — 80x24</span>
              <span style={{ fontSize: "10px", color: "#94a3b8", background: "rgba(255,255,255,0.08)", padding: "1px 6px", borderRadius: "3px", marginLeft: "4px" }}>
                macOS ARM64
              </span>
            </div>

            {/* Right macOS Controls & Mode Switcher */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                onClick={() => setActiveTab(activeTab === "zsh" ? "logs" : "zsh")}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#cbd5e1",
                  padding: "3px 8px",
                  borderRadius: "5px",
                  fontSize: "10px",
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                {activeTab === "zsh" ? "Tab: zsh" : "Tab: audit.log"}
              </button>

              {matrixActive && (
                <button
                  onClick={() => setMatrixActive(false)}
                  style={{
                    background: "rgba(34, 197, 94, 0.2)",
                    border: "1px solid #22c55e",
                    color: "#86efac",
                    padding: "3px 8px",
                    borderRadius: "5px",
                    fontSize: "10px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  ✕ Exit Matrix
                </button>
              )}
            </div>
          </div>

          {/* Matrix Digital Rain Overlay Canvas */}
          {matrixActive && (
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "380px",
                background: "#08080c",
                overflow: "hidden",
              }}
            >
              <canvas ref={matrixCanvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
              <div
                style={{
                  position: "absolute",
                  bottom: "12px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(0,0,0,0.78)",
                  border: "1px solid #22c55e",
                  color: "#4ade80",
                  padding: "4px 14px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  pointerEvents: "none",
                  boxShadow: "0 0 15px rgba(34, 197, 94, 0.3)",
                }}
              >
                [LIVE DIGITAL RAIN] Type &apos;q&apos; or click Exit Matrix to return
              </div>
            </div>
          )}

          {/* Terminal Body */}
          {!matrixActive && !isTerminalCollapsed && (
            <div
              ref={terminalBodyRef}
              className="mac-terminal-body"
              onClick={() => inputRef.current?.focus()}
              style={{
                padding: "18px 20px",
                minHeight: isTerminalFullscreen ? "500px" : "300px",
                maxHeight: isTerminalFullscreen ? "650px" : "380px",
                overflowY: "auto",
                fontSize: "13px",
                lineHeight: 1.65,
                background: "rgba(12, 12, 16, 0.95)",
              }}
            >
              {terminalHistory.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    marginBottom: item.isPrompt ? "2px" : "4px",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {item.isPrompt ? (
                    <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "6px" }}>
                      <span style={{ color: "#38bdf8", fontWeight: 700 }}>kiddie@bmsit-macbook</span>
                      <span style={{ color: "#fbbf24" }}>{item.promptPath || currentPath}</span>
                      <span style={{ color: "#f43f5e", fontWeight: 700 }}>%</span>
                      <span style={{ color: "#f1f5f9" }}>{item.text}</span>
                    </div>
                  ) : (
                    <span
                      style={{
                        color: item.isError
                          ? "#f87171"
                          : item.isSuccess
                          ? "#4ade80"
                          : item.isHighlight
                          ? "#facc15"
                          : "#cbd5e1",
                      }}
                    >
                      {item.text}
                    </span>
                  )}
                </div>
              ))}

              {/* Active macOS Shell Prompt & Input */}
              <form
                onSubmit={handleCommand}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginTop: "6px",
                }}
              >
                <span style={{ color: "#38bdf8", fontWeight: 700 }}>kiddie@bmsit-macbook</span>
                <span style={{ color: "#fbbf24" }}>{currentPath}</span>
                <span style={{ color: "#f43f5e", fontWeight: 700 }}>%</span>
                <div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: "220px", position: "relative" }}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Try 'ls -la', 'cat secrets.txt', 'matrix', 'nuke', 'whoami', 'help'..."
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      color: "#f8fafc",
                      fontFamily: "inherit",
                      fontSize: "13px",
                      outline: "none",
                      padding: 0,
                    }}
                  />
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      width: "8px",
                      height: "1.1em",
                      background: "#38bdf8",
                      marginLeft: "2px",
                      animation: "macCursorBlink 1s infinite",
                    }}
                  />
                </div>
              </form>
            </div>
          )}

          {/* macOS Terminal Footer Bar */}
          {!isTerminalCollapsed && (
            <div
              style={{
                background: "rgba(20, 20, 26, 0.95)",
                padding: "8px 16px",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "11px",
                color: "#64748b",
              }}
            >
              <div style={{ display: "flex", gap: "14px" }}>
                <span>// zsh (utf-8)</span>
                <span>[UP/DOWN] History</span>
                <span>[TAB] Autocomplete</span>
                <span>[CMD+K] Clear</span>
              </div>
              <div style={{ color: "#94a3b8" }}>
                Coding Club BMSIT Mainframe
              </div>
            </div>
          )}
        </div>

        {/* Honeypot Interactive Action Toolkit */}
        <div style={{ marginBottom: "48px" }}>
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 800,
              color: "#ffffff",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            <span style={{ color: "#f87171" }}>//</span>
            <span>DIAGNOSTIC ACTIONS & SYSTEM OPERATIONS</span>
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
            }}
          >
            {/* Action 1: Animated Matrix Rain */}
            <button
              onClick={() => {
                setMatrixActive(true);
                if (soundEnabled) getSynth()?.beep(880, "triangle", 0.1, 0.05);
              }}
              style={{
                background: "rgba(34, 197, 94, 0.1)",
                border: "1px solid rgba(34, 197, 94, 0.35)",
                borderRadius: "8px",
                padding: "16px",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.2s ease",
                color: "inherit",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(34, 197, 94, 0.35)")}
            >
              <div style={{ fontSize: "11px", color: "#4ade80", fontWeight: 700, marginBottom: "8px", letterSpacing: "0.08em" }}>[ 01 // VISUALIZER ]</div>
              <strong style={{ color: "#ffffff", fontSize: "14px", display: "block", marginBottom: "4px" }}>
                Launch Matrix Digital Rain
              </strong>
              <span style={{ fontSize: "12px", color: "#a1a1aa", lineHeight: 1.4, display: "block" }}>
                Chaining streaming green numbers and katakana live in the terminal.
              </span>
            </button>

            {/* Action 2: Nuke */}
            <button
              onClick={triggerNuke}
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                borderRadius: "8px",
                padding: "16px",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.2s ease",
                color: "inherit",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#ef4444")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.35)")}
            >
              <div style={{ fontSize: "11px", color: "#f87171", fontWeight: 700, marginBottom: "8px", letterSpacing: "0.08em" }}>[ 02 // DETONATION ]</div>
              <strong style={{ color: "#ffffff", fontSize: "14px", display: "block", marginBottom: "4px" }}>
                Tactical Self-Destruct
              </strong>
              <span style={{ fontSize: "12px", color: "#a1a1aa", lineHeight: 1.4, display: "block" }}>
                Screen shake, siren alarms, countdown, and mushroom cloud detonation.
              </span>
            </button>

            {/* Action 3: Download Database */}
            <button
              onClick={handleDownloadPasswords}
              style={{
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.35)",
                borderRadius: "8px",
                padding: "16px",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.2s ease",
                color: "inherit",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#f59e0b")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(245, 158, 11, 0.35)")}
            >
              <div style={{ fontSize: "11px", color: "#f59e0b", fontWeight: 700, marginBottom: "8px", letterSpacing: "0.08em" }}>[ 03 // EXFILTRATION ]</div>
              <strong style={{ color: "#ffffff", fontSize: "14px", display: "block", marginBottom: "4px" }}>
                Download Security Credentials (.SQL)
              </strong>
              <span style={{ fontSize: "12px", color: "#a1a1aa", lineHeight: 1.4, display: "block" }}>
                Retrieve the raw plaintext credentials file from the mainframe.
              </span>
            </button>

            {/* Action 4: Copy 1-Click Exploit */}
            <button
              onClick={handleCopyExploit}
              style={{
                background: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.35)",
                borderRadius: "8px",
                padding: "16px",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.2s ease",
                color: "inherit",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.35)")}
            >
              <div style={{ fontSize: "11px", color: "#60a5fa", fontWeight: 700, marginBottom: "8px", letterSpacing: "0.08em" }}>[ 04 // PAYLOAD ]</div>
              <strong style={{ color: "#ffffff", fontSize: "14px", display: "block", marginBottom: "4px" }}>
                {copiedPayload ? "[ COPIED TO CLIPBOARD ]" : "Copy cURL Exploit Payload"}
              </strong>
              <span style={{ fontSize: "12px", color: "#a1a1aa", lineHeight: 1.4, display: "block" }}>
                Copy the cURL command to simulate server requests from terminal.
              </span>
            </button>
          </div>
        </div>

        {/* Certificate of Script Kiddie Excellence */}
        <div
          style={{
            background: "rgba(18, 18, 24, 0.9)",
            border: "1px solid #3f3f46",
            borderRadius: "12px",
            padding: "28px",
            marginBottom: "48px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <span style={{ color: "#f59e0b", fontSize: "12px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>[ ACADEMIC AUDIT RECORD ]</span>
            <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#fff", marginTop: "8px", marginBottom: "4px" }}>
              Official Script Kiddie Diploma Generator
            </h3>
            <p style={{ fontSize: "13px", color: "#9ca3af" }}>
              Commemorate this penetration testing incident with your personalized verification certificate.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              maxWidth: "500px",
              margin: "0 auto 24px",
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              value={hackerName}
              onChange={(e) => setHackerName(e.target.value)}
              placeholder="Enter your handle (e.g. Neo / CyberNinja)..."
              style={{
                flex: 1,
                minWidth: "220px",
                background: "#09090b",
                border: "1px solid #3f3f46",
                borderRadius: "6px",
                padding: "10px 14px",
                color: "#fff",
                fontSize: "13px",
                fontFamily: "inherit",
                outline: "none",
              }}
            />
            <button
              onClick={() => {
                setCertGenerated(true);
                if (soundEnabled) getSynth()?.rickroll();
              }}
              style={{
                background: "#ffffff",
                color: "#000000",
                border: "none",
                borderRadius: "6px",
                padding: "10px 18px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Generate Diploma
            </button>
          </div>

          {certGenerated && (
            <div
              style={{
                background: "#09090d",
                border: "2px dashed #f59e0b",
                borderRadius: "10px",
                padding: "32px",
                maxWidth: "700px",
                margin: "0 auto",
                textAlign: "center",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "16px",
                  fontSize: "11px",
                  color: "#f59e0b",
                  border: "1px solid #f59e0b",
                  padding: "2px 8px",
                  borderRadius: "4px",
                }}
              >
                VERIFIED LEGIT
              </div>

              <span style={{ fontSize: "11px", color: "#a1a1aa", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                BMS INSTITUTE OF TECHNOLOGY & MANAGEMENT
              </span>

              <h4
                style={{
                  fontSize: "22px",
                  fontWeight: 900,
                  color: "#f59e0b",
                  marginTop: "10px",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                DIPLOMA IN ADVANCED URL BAR NAVIGATION
              </h4>

              <p style={{ fontSize: "13px", color: "#d4d4d8", fontStyle: "italic", marginBottom: "16px" }}>
                This credential is conferred upon:
              </p>

              <div
                style={{
                  fontSize: "26px",
                  fontWeight: 800,
                  color: "#ffffff",
                  textDecoration: "underline",
                  textUnderlineOffset: "6px",
                  marginBottom: "16px",
                }}
              >
                {displayName}
              </div>

              <p style={{ fontSize: "13px", color: "#9ca3af", maxWidth: "540px", margin: "0 auto 24px", lineHeight: 1.5 }}>
                For demonstrating exceptional optimism by navigating directly to <strong style={{ color: "#fff" }}>/admin</strong> and
                expecting unauthenticated administrative access without credentials, authorization tokens, or cryptographic sessions.
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-end",
                  borderTop: "1px solid #27272a",
                  paddingTop: "16px",
                  fontSize: "11px",
                  color: "#71717a",
                }}
              >
                <div>
                  <div style={{ fontStyle: "italic", color: "#d4d4d8" }}>Chief Clown Officer</div>
                  <div>Security Janitor</div>
                </div>
                <div style={{ color: "#f59e0b", fontWeight: 700 }}>
                  DATE: {new Date().toLocaleDateString("en-GB")}
                </div>
                <div>
                  <div style={{ fontStyle: "italic", color: "#d4d4d8" }}>Terminal Mainframe</div>
                  <div>BMSIT Coding Club</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Real Call to Action / Escape Hatch */}
        <div
          style={{
            background: "linear-gradient(180deg, rgba(24, 24, 27, 0.8), rgba(9, 9, 11, 0.95))",
            border: "1px solid #27272a",
            borderRadius: "12px",
            padding: "36px 24px",
            textAlign: "center",
          }}
        >
          <h3 style={{ fontSize: "22px", fontWeight: 800, color: "#ffffff", marginBottom: "10px" }}>
            Want to learn how to build and secure modern software?
          </h3>
          <p style={{ fontSize: "14px", color: "#a1a1aa", maxWidth: "600px", margin: "0 auto 24px", lineHeight: 1.6 }}>
            Coding Club BMSIT is where developers, designers, and security enthusiasts come together to build open-source projects, organize hackathons, and learn systems engineering.
          </p>

          <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/"
              style={{
                background: "#ffffff",
                color: "#000000",
                padding: "10px 24px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>[ Back to Home ]</span>
            </Link>

            <Link
              href="/events"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#ffffff",
                padding: "10px 24px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>View Events</span>
            </Link>

            <Link
              href="/join"
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#f87171",
                padding: "10px 24px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>Join Club -&gt;</span>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
