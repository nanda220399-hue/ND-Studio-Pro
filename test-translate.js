fetch('http://localhost:3000/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Halo dunia' })
}).then(res => res.json()).then(console.log).catch(console.error);
