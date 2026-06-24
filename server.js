import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

// Serve static assets from public/
app.use(express.static(path.join(__dirname, 'public')));

// Proxy endpoint to bypass CORS issues in frontend browser fetch
app.get('/api/waffle', async (req, res) => {
  try {
    const response = await fetch('https://election69.event360plus.com/webhook/waffle');
    if (!response.ok) {
      throw new Error(`Failed to fetch webhook: ${response.statusText}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching webhook:', error);
    res.status(500).json({ error: 'Failed to fetch webhook data' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
