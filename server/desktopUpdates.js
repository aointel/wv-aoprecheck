import express from 'express';
const router = express.Router();

// Stub for desktop updates - not currently used
router.get('/api/desktop-updates', (req, res) => {
  res.json({ message: 'Desktop updates not configured' });
});

export default router;
