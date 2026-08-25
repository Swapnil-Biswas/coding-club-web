import { Router } from 'express';
import { getGlobalHighScore, recordScoreIfHighest } from './service.js';

export const arcadeRouter = Router();

// GET /arcade/highscore - fetch current all-time global record
arcadeRouter.get('/highscore', (_req, res) => {
  try {
    const record = getGlobalHighScore();
    res.json({
      score: record.score,
      player_name: record.player_name,
      created_at: record.created_at,
    });
  } catch (error) {
    console.error('[arcade] failed to fetch high score', error);
    res.status(500).json({ error: 'Failed to fetch arcade high score' });
  }
});

// POST /arcade/highscore - submit a score to check if it beats global high score
arcadeRouter.post('/highscore', (req, res) => {
  try {
    const { score, player_name } = req.body ?? {};
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      res.status(400).json({ error: 'Valid numeric score is required' });
      return;
    }

    const result = recordScoreIfHighest(score, player_name);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process score';
    res.status(400).json({ error: message });
  }
});
