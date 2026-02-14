const el = id => document.getElementById(id);

async function suggest(query) {
  try {
    const res = await fetch('/api/suggest', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ query })
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function renderRecipe(r) {
  if (!r) return '<p>No suggestion available.</p>';
  return `
    <h2>${r.name}</h2>
    ${r.source ? `<p><em>Source: ${r.source}${r.sourceUrl ? ` — <a href="${r.sourceUrl}" target="_blank" rel="noopener">view</a>` : ''}</em></p>` : ''}
    <p><strong>Ingredients:</strong></p>
    <ul>${r.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>
    <p><strong>Steps:</strong></p>
    <ol>${r.steps.map(s => `<li>${s}</li>`).join('')}</ol>
  `;
}

async function onAsk() {
  const q = el('query').value.trim();
  const out = el('result');
  out.innerHTML = '<p>Thinking...</p>';
  const data = await suggest(q);
  if (!data.ok) {
    out.innerHTML = `<p>Error: ${data.error || data.message}</p>`;
    return;
  }
  if (data.suggestion) {
    out.innerHTML = renderRecipe(data.suggestion);
  } else {
    out.innerHTML = `<p>${data.message || 'No suggestion'}</p>`;
  }
}

document.getElementById('ask').addEventListener('click', onAsk);
document.getElementById('query').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') onAsk();
});
