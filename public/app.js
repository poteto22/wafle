// State Management
let cellsState = Array(50).fill(null);
let partiesState = {};
let nextSyncTime = 10; // 10 seconds
let countdownTimer = null;
let countdownStep = 0.1; // step size in seconds (100ms interval)
let countdownCurrent = 10;
let isFetching = false;

// DOM Elements cache
let waffleGrid = null;
let partyList = null;
let lastUpdatedSpan = null;
let countdownBar = null;
let countdownNumber = null;
let liveDot = null;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  waffleGrid = document.getElementById('waffle-grid');
  partyList = document.getElementById('party-list');
  lastUpdatedSpan = document.getElementById('last-updated');
  countdownBar = document.getElementById('countdown-bar');
  countdownNumber = document.getElementById('countdown-number');
  liveDot = document.getElementById('live-dot');

  // Initialize the 50 waffle cells in the grid
  initializeGrid();

  // Initial fetch
  fetchData();

  // Start the countdown timer loop
  startCountdown();
});

// Create 50 cell elements
function initializeGrid() {
  waffleGrid.innerHTML = '';
  for (let i = 0; i < 50; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.id = `cell-${i}`;
    // Initialize state cache
    cellsState[i] = { party: 'ว่าง', color: '#cbd5e1' };
    cell.style.backgroundColor = cellsState[i].color;
    cell.style.setProperty('--cell-color', cellsState[i].color);
    waffleGrid.appendChild(cell);
  }
}

// Start countdown visual timer
function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownCurrent = 10;
  updateCountdownUI();

  countdownTimer = setInterval(() => {
    if (isFetching) return;

    countdownCurrent -= countdownStep;
    if (countdownCurrent <= 0) {
      countdownCurrent = 0;
      updateCountdownUI();
      fetchData();
    } else {
      updateCountdownUI();
    }
  }, countdownStep * 1000);
}

// Update the countdown bar and label
function updateCountdownUI() {
  const percentage = (countdownCurrent / 10) * 100;
  if (countdownBar) countdownBar.style.transform = `scaleX(${percentage / 100})`;
  if (countdownNumber) countdownNumber.textContent = `${Math.ceil(countdownCurrent)}s`;
}

// Fetch data from local Express server API
async function fetchData() {
  if (isFetching) return;
  isFetching = true;
  
  // Visual loading feedback (subtle pulse on live dot)
  if (liveDot) {
    liveDot.style.backgroundColor = '#f59e0b';
    liveDot.style.boxShadow = '0 0 8px #f59e0b';
  }

  try {
    const response = await fetch('/api/waffle');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    
    // Process and render data
    updateWaffleChart(data);
    updatePartyList(data);
    updateLastSyncTime();
    
    // Restore LIVE color
    if (liveDot) {
      liveDot.style.backgroundColor = '#ef4444';
      liveDot.style.boxShadow = '0 0 8px #ef4444';
    }
  } catch (error) {
    console.error('Error fetching waffle data:', error);
    // Display error indicator on live dot
    if (liveDot) {
      liveDot.style.backgroundColor = '#374151';
      liveDot.style.boxShadow = 'none';
    }
  } finally {
    isFetching = false;
    startCountdown();
  }
}

// Distribute parties across 50 cells and trigger flash updates
function updateWaffleChart(data) {
  // Construct the new list of 50 cells based on party seat allocations
  const newCellsAllocation = [];
  
  data.forEach(item => {
    const count = parseInt(item.count) || 0;
    const color = item.colorCode || '#ddddcc';
    const partyName = item.party || 'ไม่ระบุ';
    
    for (let s = 0; s < count; s++) {
      newCellsAllocation.push({ party: partyName, color: color });
    }
  });

  // If counts do not total exactly 50, pad or truncate
  while (newCellsAllocation.length < 50) {
    newCellsAllocation.push({ party: 'ว่าง', color: '#cbd5e1' });
  }
  if (newCellsAllocation.length > 50) {
    newCellsAllocation.length = 50;
  }

  // Compare previous states with new allocations
  for (let i = 0; i < 50; i++) {
    const prevCell = cellsState[i];
    const newCell = newCellsAllocation[i];
    const cellEl = document.getElementById(`cell-${i}`);

    if (!cellEl) continue;

    // Trigger flash update ONLY if the color/party changed
    if (!prevCell || prevCell.party !== newCell.party || prevCell.color !== newCell.color) {
      // Set colors
      cellEl.style.backgroundColor = newCell.color;
      cellEl.style.setProperty('--cell-color', newCell.color);
      
      // Set custom property for flash color so the glow matches the party's color
      cellEl.style.setProperty('--flash-color', newCell.color);
      
      // Apply CSS flash class
      cellEl.classList.remove('flash-update');
      // Trigger reflow to restart animation if it was already playing
      void cellEl.offsetWidth;
      cellEl.classList.add('flash-update');

      // Listen for animation end to clean up the class
      cellEl.addEventListener('animationend', () => {
        cellEl.classList.remove('flash-update');
      }, { once: true });

      // Save to state cache
      cellsState[i] = newCell;
    }
  }
}

// Fallback for missing party logo images
function handleLogoError(imgEl, fallbackColor) {
  const container = imgEl.parentElement;
  if (container) {
    container.innerHTML = `<div class="party-logo-fallback" style="background-color: ${fallbackColor}; width: 100%; height: 100%; border-radius: 50%;"></div>`;
  }
}
window.handleLogoError = handleLogoError;

// Dynamically generate and update the party legend list on the right
function updatePartyList(data) {
  // Sum total seats from data to calculate percentage accurately
  const totalSeats = data.reduce((acc, curr) => acc + (parseInt(curr.count) || 0), 0) || 50;
  
  // Sort data descending by seat count
  const sortedData = [...data].sort((a, b) => (parseInt(b.count) || 0) - (parseInt(a.count) || 0));

  // Check if we need to regenerate HTML or just update values
  const hasItems = partyList.querySelectorAll('.party-item').length > 0;

  if (!hasItems) {
    partyList.innerHTML = '';
    sortedData.forEach((party, index) => {
      const percentage = ((party.count / totalSeats) * 100).toFixed(1);
      
      const itemEl = document.createElement('div');
      itemEl.className = 'party-item';
      itemEl.id = `party-item-${index}`;
      
      itemEl.innerHTML = `
        <div class="party-logo-container" id="party-logo-container-${index}">
          <img class="party-logo" src="/image/${encodeURIComponent(party.party)}.jpg" alt="${party.party}" onerror="handleLogoError(this, '${party.colorCode || '#cccccc'}')">
        </div>
        <div class="party-info">
          <div class="party-name-row">
            <span class="party-name" id="party-name-${index}">${party.party}</span>
            <div class="party-stats">
              <span class="party-count" id="party-count-${index}">${party.count}</span>
              <span class="party-seats-label">ที่นั่ง</span>
              <span class="party-percentage" id="party-pct-${index}">(${percentage}%)</span>
            </div>
          </div>
          <div class="party-progress-track">
            <div class="party-progress-fill" id="party-bar-${index}" style="background-color: ${party.colorCode || '#cccccc'}; width: ${percentage}%"></div>
          </div>
        </div>
      `;
      partyList.appendChild(itemEl);
      
      // Save initial count to state cache
      partiesState[party.party] = party.count;
    });
  } else {
    // If the list is already drawn, update the counts, labels, and bars smoothly
    sortedData.forEach((party, index) => {
      const prevCount = partiesState[party.party];
      const countEl = document.getElementById('party-count-' + index);
      const pctEl = document.getElementById('party-pct-' + index);
      const barEl = document.getElementById('party-bar-' + index);
      const nameEl = document.getElementById('party-name-' + index);
      const logoContainerEl = document.getElementById('party-logo-container-' + index);

      if (countEl && pctEl && barEl) {
        const percentage = ((party.count / totalSeats) * 100).toFixed(1);
        
        // If the party at this rank has changed, update its name, logo, and bar color
        if (nameEl && nameEl.textContent !== party.party) {
          nameEl.textContent = party.party;
          if (logoContainerEl) {
            logoContainerEl.innerHTML = `<img class="party-logo" src="/image/${encodeURIComponent(party.party)}.jpg" alt="${party.party}" onerror="handleLogoError(this, '${party.colorCode || '#cccccc'}')">`;
          }
          barEl.style.backgroundColor = party.colorCode || '#cccccc';
        }

        // If count has changed, trigger a text pulse animation
        if (prevCount !== party.count) {
          countEl.textContent = party.count;
          countEl.classList.remove('updated');
          void countEl.offsetWidth; // trigger reflow
          countEl.classList.add('updated');
          
          countEl.addEventListener('animationend', () => {
            countEl.classList.remove('updated');
          }, { once: true });

          partiesState[party.party] = party.count;
        }
        
        pctEl.textContent = `(${percentage}%)`;
        barEl.style.width = `${percentage}%`;
      }
    });
  }
}

// Helper to format/display current sync time
function updateLastSyncTime() {
  if (!lastUpdatedSpan) return;
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  lastUpdatedSpan.textContent = `${hours}:${minutes}:${seconds}`;
}

// Mode Selection Handler: toggles between TV aspect layout and Literal 10px Cell layout
function setMode(mode) {
  const body = document.body;
  const btnTv = document.getElementById('btn-tv-mode');
  const btnActual = document.getElementById('btn-actual-mode');

  if (mode === 'tv') {
    body.classList.remove('actual-mode');
    body.classList.add('tv-mode');
    if (btnTv) btnTv.classList.add('active');
    if (btnActual) btnActual.classList.remove('active');
  } else if (mode === 'actual') {
    body.classList.remove('tv-mode');
    body.classList.add('actual-mode');
    if (btnTv) btnTv.classList.remove('active');
    if (btnActual) btnActual.classList.add('active');
  }
}

// Make setMode globally accessible
window.setMode = setMode;
