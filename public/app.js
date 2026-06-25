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

  // Initialize fullscreen button functionality
  setupFullscreen();

  // Initialize modal event listeners
  setupModalListeners();
});

// Create 50 cell elements arranged in a hemicycle (semicircular parliament layout)
function initializeGrid() {
  waffleGrid.innerHTML = '';
  
  // Generate all 50 cell positions across 3 concentric rows
  const cells = [];
  const rowsConfig = [
    { seats: 13, radius: 50 }, // Inner row
    { seats: 17, radius: 71 }, // Middle row
    { seats: 20, radius: 92 }  // Outer row
  ];

  rowsConfig.forEach((rowOpt, rowIndex) => {
    const K = rowOpt.seats;
    const R = rowOpt.radius;
    for (let i = 0; i < K; i++) {
      // ปรับแก้บรรทัด 56-57 เป็นแบบนี้:
      const startDeg = 200; // มุมเริ่มต้นฝั่งซ้าย (ของเดิมคือ 180 ถ้าอยากให้โค้งลงล่างอีกให้ปรับเพิ่ม เช่น 190, 200)
      const endDeg = -20;   // มุมสิ้นสุดฝั่งขวา  (ของเดิมคือ 0 ถ้าอยากให้โค้งลงล่างอีกให้ปรับลด เช่น -10, -20)

      const startAngle = (startDeg * Math.PI) / 180;
      const endAngle = (endDeg * Math.PI) / 180;
const angle = startAngle - (i / (K - 1)) * (startAngle - endAngle);

      cells.push({
        rowIndex,
        seatIndex: i,
        angle,
        radius: R
      });
    }
  });

  // Sort cells by angle descending (from left to right) so parties group as pie-slices/columns
  cells.sort((a, b) => {
    if (Math.abs(a.angle - b.angle) < 0.001) {
      return b.radius - a.radius; // outer to inner
    }
    return b.angle - a.angle;
  });

  cells.forEach((cellData, index) => {
    const angle = cellData.angle;
    const R = cellData.radius;
    
    // Convert polar coordinates to Cartesian percentages
    // Multiply by 1/1.8 to counteract aspect-ratio stretching
    const x = 50 + (1 / 1.8) * R * Math.cos(angle);
    const y = 60 - R * Math.sin(angle);
    
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.id = `cell-${index}`;
    cell.style.left = `${x}%`;
    cell.style.top = `${y}%`;
    
    // Add click handler to fetch and show candidate card popup
    cell.addEventListener('click', () => {
      const state = cellsState[index];
      if (state && state.party && state.party !== 'ว่าง') {
        showCandidateCard(state.party);
      }
    });
    
    // Initialize state cache
    cellsState[index] = { party: 'ว่าง', color: '#cbd5e1', x, y };
    cell.style.backgroundColor = cellsState[index].color;
    cell.style.setProperty('--cell-color', cellsState[index].color);
    waffleGrid.appendChild(cell);
  });
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
      cellsState[i] = { ...prevCell, ...newCell };
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
      
      // Make the entire card item clickable to view candidates list
      itemEl.style.cursor = 'pointer';
      itemEl.addEventListener('click', () => {
        const nameEl = document.getElementById(`party-name-${index}`);
        if (nameEl) {
          showCandidateCard(nameEl.textContent);
        }
      });
      
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
      const barEl = document.getElementById('party-bar-' + index);
      const nameEl = document.getElementById('party-name-' + index);
      const logoContainerEl = document.getElementById('party-logo-container-' + index);

      if (countEl && barEl) {
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

// Setup floating fullscreen toggle button functionality
function setupFullscreen() {
  const btn = document.getElementById('fullscreen-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  });

  // Keep svg icon inside button in sync with fullscreen state
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 9H5v2h5v5h2v-7H10zm4 0h5v2h-5v5h-2v-7h2z"/>
        </svg>
      `;
      btn.title = "Exit Fullscreen";
    } else {
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5 5h5v2H7v3H5V5zm14 0h-5v2h3v3h2V5zM5 19h5v-2H7v-3H5v5zm14 0h-5v-2h3v-3h2v5z"/>
        </svg>
      `;
      btn.title = "Enter Fullscreen";
    }
  });
}

// Fetch and show candidate details popup card modal
async function showCandidateCard(partyName) {
  const modal = document.getElementById('popup-modal');
  const popupBody = document.getElementById('popup-body');
  const popupTitle = document.getElementById('popup-title');
  const popupLogo = document.getElementById('popup-party-logo');

  if (!modal || !popupBody || !popupTitle) return;

  // Show modal in loading state
  popupTitle.textContent = `ผู้สมัคร - ${partyName}`;
  popupLogo.src = `/image/${encodeURIComponent(partyName)}.jpg`;
  popupLogo.style.display = 'block';
  popupBody.innerHTML = '<div class="popup-loading">กำลังโหลดข้อมูลผู้สมัคร...</div>';
  modal.classList.remove('hidden');

  try {
    const response = await fetch('/api/getcard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ partiesName: partyName })
    });

    if (!response.ok) throw new Error('Network response was not ok');
    const candidates = await response.json();

    if (!candidates || candidates.length === 0) {
      popupBody.innerHTML = '<div class="popup-no-data">ไม่พบข้อมูลผู้สมัครสำหรับกลุ่มนี้</div>';
      return;
    }

    // Sort candidates by score descending (จากมากไปน้อย)
    candidates.sort((a, b) => Number(b.score) - Number(a.score));

    // Render candidate cards
    popupBody.innerHTML = candidates.map(c => {
      // Extract only the filename from Windows/Unix path (supporting both 'pic' and 'candidateImageUrl' keys)
      const imgPath = c.pic || c.candidateImageUrl;
      const imgFilename = imgPath ? imgPath.split(/[\\/]/).pop() : 'default.png';
      const localImgSrc = `/candidates/${encodeURIComponent(imgFilename)}`;
      
      return `
        <div class="candidate-row-card">
          <img class="candidate-avatar" src="${localImgSrc}" alt="${c.candidateName}" onerror="this.src='https://asset-election.nationtv.tv/2026/candidates/default.png'; this.onerror=null;">
          <div class="candidate-details">
            <div class="candidate-name-field">${c.candidateName}</div>
            <div class="candidate-meta-row">
              <span class="candidate-area">เขต${c.areaName}</span>
            </div>
            <div class="candidate-score-row">
              <span class="candidate-score-val">${Number(c.score).toLocaleString()} คะแนน</span>
              <span class="candidate-score-pct">(${c.scorePercent}%)</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Error fetching candidate data:', error);
    popupBody.innerHTML = '<div class="popup-error">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
  }
}

// Setup close modal event listeners
function setupModalListeners() {
  const modal = document.getElementById('popup-modal');
  const overlay = document.getElementById('popup-overlay');
  const closeBtn = document.getElementById('popup-close-btn');

  if (!modal) return;

  const closeModal = () => modal.classList.add('hidden');

  if (overlay) overlay.addEventListener('click', closeModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  
  // Close on ESC key press
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}
