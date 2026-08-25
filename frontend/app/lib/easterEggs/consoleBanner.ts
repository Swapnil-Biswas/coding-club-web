// DevTools Console CTF & Interactive Terminal Object for Coding Club BMSIT

function playChiptune(type: "success" | "beep" = "success") {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    if (type === "success") {
      const notes = [
        { f: 261.63, d: 0.08 }, // C4
        { f: 329.63, d: 0.08 }, // E4
        { f: 392.0, d: 0.08 },  // G4
        { f: 523.25, d: 0.16 }, // C5
        { f: 659.25, d: 0.25 }, // E5
      ];
      let t = ctx.currentTime;
      notes.forEach(({ f, d }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + d);
        t += d * 0.9;
      });
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    }
  } catch {}
}

declare global {
  interface Window {
    bmsit?: {
      help: () => void;
      solve: (flagOrAnswer?: string) => string;
      matrix: () => void;
      stats: () => void;
      about: () => string;
      sound: () => string;
      arcade: () => string;
      join: () => void;
    };
    __BMSIT_EASTER_OPEN_ARCADE__?: () => void;
  }
}

export function initConsoleEasterEgg() {
  if (typeof window === "undefined") return;
  const win = window as unknown as { __bmsit_console_mounted?: boolean };
  if (win.__bmsit_console_mounted) return;
  win.__bmsit_console_mounted = true;

  const headerStyle =
    "color: #22c55e; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 13px; font-weight: bold; background: #0c0c12; padding: 6px 12px; border-left: 4px solid #22c55e; border-radius: 2px;";
  const textStyle = "color: #94a3b8; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; line-height: 1.6;";
  const accentStyle = "color: #38bdf8; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; font-weight: bold;";
  const promptStyle = "color: #f59e0b; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; font-weight: bold;";

  console.log(
    `%c
   ____ ___  ____  ___ _   _  ____    ____ _    _   _ ____  
  / ___/ _ \\|  _ \\|_ _| \\ | |/ ___|  / ___| |  | | | | __ ) 
 | |  | | | | | | || ||  \\| | |  _  | |   | |  | | | |  _ \\ 
 | |__| |_| | |_| || || |\\  | |_| | | |___| |__| |_| | |_) |
  \\____\\___/|____/|___|_| \\_|\\____|  \\____|_____\\___/|____/ 
                                             BMSIT & M // BLR
`,
    "color: #38bdf8; font-family: monospace; font-weight: 800;"
  );

  console.log(
    "%c[!] BMSIT DEVTOOLS PROTOCOL ENGAGED",
    headerStyle
  );
  console.log(
    "%cLooking under the hood? We like how you think. Type %cbmsit.help()%c to inspect secret commands and puzzles.",
    textStyle,
    promptStyle,
    textStyle
  );

  window.bmsit = {
    help: () => {
      console.log("%c--- BMSIT Interactive Console Reference ---", headerStyle);
      console.log("%cbmsit.arcade()        %c- Launch retro Space Invaders arcade overlay", accentStyle, textStyle);
      console.log("%cbmsit.solve('answer') %c- Solve the cryptographic challenge", accentStyle, textStyle);
      console.log("%cbmsit.matrix()        %c- Stream Matrix digital rain into DevTools", accentStyle, textStyle);
      console.log("%cbmsit.stats()         %c- View club metrics, domains & infrastructure", accentStyle, textStyle);
      console.log("%cbmsit.sound()         %c- Test procedural 8-bit synthesizer audio", accentStyle, textStyle);
      console.log("%cbmsit.about()         %c- View club mission and engineering stack", accentStyle, textStyle);
      console.log("%cbmsit.join()          %c- Open the BMSIT Coding Club recruitment portal", accentStyle, textStyle);
      return "Type any function name followed by () to execute.";
    },

    solve: (input) => {
      if (!input) {
        console.log(
          "%c[CHALLENGE 01 // CIPHER DECODE]%c\nDecode this secret token in terminal or console:\n%cQk1TSVR7YzBkZV9jcmVhdGVfYzBsbGFiMHJhdGV9\n\n%cUsage: bmsit.solve('your_decoded_string')",
          promptStyle,
          textStyle,
          accentStyle,
          textStyle
        );
        return "Waiting for solution input...";
      }

      const clean = input.trim();
      if (
        clean === "BMSIT{c0de_create_c0llab0rate}" ||
        clean === "c0de_create_c0llab0rate" ||
        clean === "code create collaborate"
      ) {
        playChiptune("success");
        console.log(
          `%c
   ___________
  '._==_==_=_.'
  .-\\:      /-.     [ ACHIEVEMENT UNLOCKED ]
 | (|:.     |) |    CERTIFIED BMSIT CONSOLE HACKER
  '-|:.     |-'     Status: Verified 100% Legit
    \\::.    /
     '::. .'        "Welcome to the developer circle."
       ) (
     _.' '._
    '-------'
`,
          "color: #f59e0b; font-family: monospace; font-weight: bold;"
        );
        return "CONGRATULATIONS! You solved the BMSIT Console Challenge.";
      }

      playChiptune("beep");
      return "Incorrect flag. Hint: Try `atob('Qk1TSVR7YzBkZV9jcmVhdGVfYzBsbGFiMHJhdGV9')` in this console!";
    },

    matrix: () => {
      playChiptune("beep");
      const lines = [
        "01000011 01001111 01000100 01001001 01001110 01000111",
        "ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜﾊﾞﾋﾞﾌﾞﾍﾞﾎﾞ",
        "BMSIT_MAINFRAME // ACCESS_GRANTED // 127.0.0.1",
        "01000011 01001100 01010101 01000010 00100000 01000010",
        "ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜﾊﾞﾋﾞﾌﾞﾍﾞﾎﾞ",
      ];
      lines.forEach((l, i) => {
        setTimeout(() => {
          console.log(`%c[MATRIX] ${l}`, "color: #22c55e; font-family: monospace; font-weight: bold;");
        }, i * 150);
      });
      return "Matrix rain sequence initiated.";
    },

    stats: () => {
      console.table([
        { Domain: "Web Development", Lead: "Frontend & Full-Stack Core", Stack: "Next.js, TypeScript, Node.js" },
        { Domain: "App Development", Lead: "Mobile Engineering", Stack: "Flutter, React Native, Kotlin" },
        { Domain: "AI / ML", Lead: "Machine Intelligence", Stack: "PyTorch, LangChain, Python" },
        { Domain: "Cybersecurity", Lead: "SecOps & Defense", Stack: "CTF, Network Security, Cryptography" },
        { Domain: "Open Source", Lead: "Community & Systems", Stack: "Git, Linux, Rust, Go" },
      ]);
      return "Mainframe domain metrics loaded.";
    },

    arcade: () => {
      if (typeof window.__BMSIT_EASTER_OPEN_ARCADE__ === "function") {
        window.__BMSIT_EASTER_OPEN_ARCADE__();
        return "Konami Arcade triggered.";
      }
      return "Arcade listener ready.";
    },

    about: () => {
      return "Coding Club BMSIT is a student-driven developer community focused on open-source, hackathons, and systems engineering at BMS Institute of Technology & Management, Bengaluru.";
    },

    sound: () => {
      playChiptune("success");
      return "Procedural 8-bit chiptune audio played.";
    },

    join: () => {
      if (typeof window !== "undefined") {
        window.location.href = "/join";
      }
      return "Redirecting to /join...";
    },
  };
}
