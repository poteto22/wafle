import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

// Serve static assets from public/
app.use(express.static(path.join(__dirname, 'public')));

// Serve party logos from src/image/
app.use('/image', express.static(path.join(__dirname, 'src/image')));

// Serve candidate photos from src/candidates/
app.use('/candidates', express.static(path.join(__dirname, 'src/candidates')));

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

// Proxy endpoint for candidate details card
app.post('/api/getcard', express.json(), async (req, res) => {
  try {
    const { partiesName } = req.body;
    if (!partiesName) {
      return res.status(400).json({ error: 'partiesName is required' });
    }

    // Call the production webhook with partiesname as a query parameter (lowercase key) via POST
    const url = `https://election69.event360plus.com/webhook/getcard?partiesname=${encodeURIComponent(partiesName)}`;
    const response = await fetch(url, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch getcard webhook: ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching getcard webhook:', error);
    res.status(500).json({ error: 'Failed to fetch candidate cards' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
