async function render() {
  const { lastCheck } = await chrome.storage.local.get(["lastCheck"]);
  const el = document.getElementById("result");
  if (!lastCheck) return; // default text already in HTML
  el.innerHTML = `
    <p><strong>URL:</strong> ${lastCheck.url}</p>
    <p><strong>Host:</strong> ${lastCheck.hostname}</p>
    <p><strong>Risk:</strong> ${lastCheck.level} (${lastCheck.score}/100)</p>
    <ul>${lastCheck.reasons.map(r => `<li>${r}</li>`).join("")}</ul>
  `;
}
render();
