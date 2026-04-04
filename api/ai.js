export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, text, fileBase64, mimeType } = req.body;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_KEY) return res.status(500).json({ error: 'API key not configured' });

  const isQuiz = action === 'quiz';

  const prompts = {
    summary: `Внимательно изучи предоставленный учебный материал и составь чёткое краткое содержание.
Выдели: главную тему, ключевые понятия, важные факты и выводы.
Пиши по-русски, ясно и структурированно. Не проси дополнительных материалов.`,

    quiz: `Изучи предоставленный учебный материал и создай викторину из 5 вопросов на русском языке.
Вопросы основаны ТОЛЬКО на материале. Не проси дополнительных материалов.
Верни валидный JSON объект со следующей структурой (без каких-либо пояснений, только JSON):
{
  "questions": [
    {
      "q": "текст вопроса",
      "options": ["вариант 1", "вариант 2", "вариант 3", "вариант 4"],
      "correct": 0,
      "explanation": "объяснение правильного ответа"
    }
  ]
}`
  };

  const prompt = prompts[isQuiz ? 'quiz' : 'summary'];
  const parts = [];

  if (fileBase64 && mimeType) {
    parts.push({ inlineData: { data: fileBase64, mimeType } });
    parts.push({ text: prompt });
  } else if (text && text.trim()) {
    parts.push({ text: `Учебный материал:\n\n${text}\n\n---\n\n${prompt}` });
  } else {
    return res.status(400).json({ error: 'Предоставь текст или загрузи файл' });
  }

  const generationConfig = { temperature: 0.4, maxOutputTokens: 2000 };
  if (isQuiz) generationConfig.responseMimeType = 'application/json';

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });
    }

    let result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (isQuiz) {
      const match = result.match(/\{[\s\S]*\}/);
      if (match) result = match[0];
    }

    res.status(200).json({ result });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
