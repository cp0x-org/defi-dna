import './style.css'

const APP_NAME = 'defi DNA'

function render(root: HTMLElement): void {
  root.innerHTML = `
    <main class="page">
      <h1>${APP_NAME}</h1>
      <p>Neutral aggregator of DeFi risk feeds — verbatim, side by side, no composite score.</p>
      <p class="hint">Project scaffold. Edit <code>src/main.ts</code> to start building.</p>
    </main>
  `
}

const root = document.querySelector<HTMLDivElement>('#app')

if (!root) {
  throw new Error('Root element #app was not found')
}

render(root)
