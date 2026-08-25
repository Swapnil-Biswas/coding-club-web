import { db } from '../db.js';

export interface ArcadeHighScoreRecord {
  id: number;
  score: number;
  player_name: string;
  created_at: string;
}

export function getGlobalHighScore(): ArcadeHighScoreRecord {
  const row = db
    .prepare<ArcadeHighScoreRecord>(
      `SELECT id, score, player_name, created_at FROM arcade_global_scores ORDER BY score DESC, id ASC LIMIT 1`
    )
    .get();

  if (row) {
    return row;
  }

  return {
    id: 0,
    score: 1337,
    player_name: 'BMSIT_ROOT',
    created_at: new Date().toISOString(),
  };
}

export function recordScoreIfHighest(score: number, rawPlayerName?: string): {
  success: boolean;
  isNewRecord: boolean;
  score: number;
  player_name: string;
  currentGlobalHigh: number;
} {
  // Validate and sanitize score
  const numScore = Math.floor(Number(score));
  if (!Number.isFinite(numScore) || numScore <= 0 || numScore > 10000000) {
    throw new Error('Invalid score value');
  }

  // Sanitize player name
  let cleanName = (rawPlayerName || 'BMSIT Anonymous').trim().replace(/[^a-zA-Z0-9_\- .]/g, '');
  if (!cleanName) cleanName = 'BMSIT Anonymous';
  if (cleanName.length > 24) cleanName = cleanName.substring(0, 24);

  const currentTop = getGlobalHighScore();

  if (numScore > currentTop.score) {
    db.prepare(`INSERT INTO arcade_global_scores (score, player_name) VALUES (?, ?)`).run(
      numScore,
      cleanName
    );

    return {
      success: true,
      isNewRecord: true,
      score: numScore,
      player_name: cleanName,
      currentGlobalHigh: numScore,
    };
  }

  return {
    success: false,
    isNewRecord: false,
    score: numScore,
    player_name: cleanName,
    currentGlobalHigh: currentTop.score,
  };
}
