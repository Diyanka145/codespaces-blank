const express = require('express');
const path = require('path');
const app = express();
app.use(express.json());

const recipes = [
  {
    name: 'Spaghetti Bolognese',
    tags: ['spaghetti','pasta','beef','tomato'],
    ingredients: ['spaghetti', 'ground beef', 'onion', 'garlic', 'tomato sauce', 'olive oil', 'salt', 'pepper'],
    steps: [
      'Cook spaghetti according to package directions.',
      'Sauté onion and garlic in olive oil until softened.',
      'Add ground beef and brown.',
      'Stir in tomato sauce and simmer 10–15 minutes.',
      'Serve sauce over spaghetti.'
    ]
  },
  {
    name: 'Classic Pancakes',
    tags: ['pancakes','breakfast','flour','milk','egg'],
    ingredients: ['flour','milk','egg','baking powder','salt','sugar','butter'],
    steps: [
      'Mix dry ingredients in a bowl.',
      'Whisk milk and egg then combine with dry mix.',
      'Heat a pan and add butter, pour batter and cook until golden on both sides.'
    ]
  },
  {
    name: 'Chicken Curry',
    tags: ['chicken','curry','rice','spicy'],
    ingredients: ['chicken','onion','garlic','ginger','curry powder','coconut milk','oil','salt'],
    steps: [
      'Sauté onion, garlic and ginger.',
      'Add chicken and brown.',
      'Stir in curry powder, then add coconut milk and simmer until cooked through.'
    ]
  },
  {
    name: 'Caesar Salad',
    tags: ['salad','lettuce','parmesan','anchovy'],
    ingredients: ['romaine lettuce','parmesan','croutons','lemon','olive oil','anchovy (optional)'],
    steps: [
      'Toss lettuce with dressing of lemon, olive oil and grated parmesan.',
      'Top with croutons and extra parmesan.'
    ]
  },
  {
    name: 'Waffles',
    tags: ['waffles','breakfast','baking'],
    ingredients: ['flour', 'milk', 'egg', 'baking powder', 'sugar', 'butter', 'salt'],
    steps: [
      'In a bowl, whisk together flour, baking powder, sugar, and salt.',
      'In another bowl, beat the egg and mix with milk and melted butter.',
      'Combine wet and dry ingredients until just mixed.',
      'Preheat waffle iron and grease lightly.',
      'Pour batter into waffle iron and cook until golden and crisp.'
    ]
  },
  {
    name: 'Grilled Cheese Sandwich',
    tags: ['sandwich','cheese','bread','quick'],
    ingredients: ['bread','cheddar cheese','butter'],
    steps: [
      'Butter bread slices, place cheese between slices.',
      'Cook in a pan until bread is golden and cheese melted.'
    ]
  }
];

function scoreRecipe(query, recipe) {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  let score = 0;
  if (recipe.name.toLowerCase().includes(q)) score += 50;
  for (const t of recipe.tags) if (t.includes(q)) score += 20;
  for (const ing of recipe.ingredients) if (ing.toLowerCase().includes(q)) score += 10;
  const qWords = q.split(/\s+/);
  for (const w of qWords) {
    if (recipe.name.toLowerCase().includes(w)) score += 5;
  }
  return score;
}

async function tryFetchExternalRecipe(query) {
  if (!query) return null;
  if (!globalThis.fetch) return null;
  try {
    // Try several strategies to find a matching recipe online
    const trySearch = async (q) => {
      const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`;
      const r = await fetch(url, { method: 'GET' });
      if (!r.ok) return null;
      const j = await r.json();
      if (!j || !j.meals || !j.meals.length) return null;
      return j.meals[0];
    };

    let meal = await trySearch(query);
    if (!meal && query.endsWith('s')) meal = await trySearch(query.slice(0, -1));
    if (!meal && query.includes(' ')) meal = await trySearch(query.split(/\s+/)[0]);

    // If still not found, try searching by ingredient (filter returns limited meal objects)
    if (!meal) {
      const url2 = `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(query)}`;
      const r2 = await fetch(url2, { method: 'GET' });
      if (r2.ok) {
        const j2 = await r2.json();
        if (j2 && j2.meals && j2.meals.length) {
          // fetch full meal details by id
          const id = j2.meals[0].idMeal;
          const r3 = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${encodeURIComponent(id)}`);
          if (r3.ok) {
            const j3 = await r3.json();
            if (j3 && j3.meals && j3.meals.length) meal = j3.meals[0];
          }
        }
      }
    }

    if (!meal) return null;
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
      const ing = meal[`strIngredient${i}`];
      const measure = meal[`strMeasure${i}`];
      if (ing && ing.trim()) {
        const part = (measure && measure.trim()) ? `${measure.trim()} ${ing.trim()}` : ing.trim();
        ingredients.push(part);
      }
    }
    const steps = meal.strInstructions ? meal.strInstructions.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];
    return {
      name: meal.strMeal || query,
      ingredients,
      steps,
      source: 'TheMealDB',
      sourceUrl: meal.strSource || (meal.strYoutube || null)
    };
  } catch (err) {
    return null;
  }
}

app.post('/api/suggest', async (req, res) => {
  const query = (req.body && req.body.query) ? String(req.body.query).trim() : '';
  if (!query) {
    return res.json({ ok: true, message: 'Please provide a dish name or ingredient', suggestion: null });
  }

  // Try external recipe source first (more likely to handle arbitrary dishes)
  const external = await tryFetchExternalRecipe(query);
  if (external) {
    return res.json({ ok: true, suggestion: external });
  }

  // Fallback to local suggestions (only return if there's a positive score)
  const scored = recipes.map(r => ({ r, score: scoreRecipe(query, r) }))
    .filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score);
  if (scored.length === 0) {
    return res.json({ ok: true, suggestion: null, message: 'No online or local match found for that query.' });
  }

  return res.json({ ok: true, suggestion: scored[0].r, alternatives: scored.map(x => x.r) });
});

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
