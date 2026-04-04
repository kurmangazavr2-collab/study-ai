export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, text, fileBase64, mimeType } = req.body;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_KEY) return res.status(500).json({ error: 'API key not configured' });

  const prompts = {
    summary: `Внимательно изучи этот учебный материал и составь чёткое краткое содержание. 
Выдели: главную тему, ключевые понятия, важные факты и выводы.
Пиши по-русски, ясно и структурированно. Используй короткие абзацы.`,

    quiz: `На основе этого учебного материала создай викторину из 5 вопросов.
Для каждого вопроса дай 4 варианта ответа.

Верни ТОЛЬКО JSON без markdown и пояснений:
{
  "questions": [
    {
      "q": "Вопрос?",
      "options": ["А", "Б", "В", "Г"],
      "correct": 0,
      "explanation": "Краткое объяснение"
    }
  ]
}

"correct" = индекс правильного ответа (0-3). Только JSON.`
  };

  const parts = [];

  if (fileBase64 && mimeType) {
    parts.push({ inlineData: { data: fileBase64, mimeType } });
  } else if (text) {
    parts.push({ text: 'Учебный материал:\n\n' + text });
  }

  parts.push({ text: prompts[action] || prompts.summary });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });
    }

    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.status(200).json({ result });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
