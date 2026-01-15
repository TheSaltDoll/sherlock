// State Variables
let manifest = {};
let foundLeads = new Set(); 
let collectedLetters = new Set();
let currentCase = "";
let currentDisplayedImages = []; // New: track what is currently on screen

// DOM Elements
const caseSelect = document.getElementById('case-select');
const locationInput = document.getElementById('location-input');
const btnSearch = document.getElementById('btn-search');
const letterInput = document.getElementById('letter-input');
const btnAddLetter = document.getElementById('btn-add-letter');
const statusMsg = document.getElementById('status-message');
const imageArea = document.getElementById('image-display-area');
const leadsList = document.getElementById('leads-list');
const lettersList = document.getElementById('letters-list');
const leadCount = document.getElementById('lead-count');
const btnReset = document.getElementById('btn-reset'); // New Button

// Initialize
async function init() {
    // Populate Case Selector
    for (let i = 1; i <= 10; i++) {
        const opt = document.createElement('option');
        const val = `Case${i.toString().padStart(2, '0')}`;
        opt.value = val;
        opt.textContent = `Case ${i}`;
        caseSelect.appendChild(opt);
    }

    // Load Manifest
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error("Could not load data.json");
        manifest = await response.json();
        console.log("Manifest loaded:", manifest);
        
        // ONLY Load saved state after manifest is ready
        loadGameState(); 
    } catch (err) {
        setStatus("Error: Run generate_manifest.py to create data.json!", true);
    }
}

// Event Listeners
btnSearch.addEventListener('click', handleSearch);
locationInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') handleSearch() });

btnAddLetter.addEventListener('click', handleAddLetter);
letterInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') handleAddLetter() });

caseSelect.addEventListener('change', (e) => {
    currentCase = e.target.value;
    // We do NOT reset board here automatically anymore, 
    // because we might be reloading a saved state.
    // Instead, we just save the new case selection.
    setStatus(`Selected ${currentCase}.`);
    saveGameState();
});

btnReset.addEventListener('click', () => {
    if(confirm("Are you sure you want to delete all progress?")) {
        localStorage.removeItem('detectiveSaveData');
        location.reload(); // Reload page to clear everything
    }
});

// Logic Functions

function handleSearch() {
    if (!currentCase) {
        setStatus("Please select a case first.", true);
        return;
    }

    const rawInput = locationInput.value.trim().toUpperCase();
    if (!rawInput) return;

    // Parse Input
    const match = rawInput.match(/^(\d+)([A-Z]+)$/);
    
    if (!match) {
        setStatus("Invalid format. Use Number then Letters (e.g., 237NW).", true);
        return;
    }

    const numberPart = match[1];
    const lettersPart = match[2];
    const paddedNumber = numberPart.padStart(4, '0');
    const searchPrefix = `${lettersPart}-${paddedNumber}`;

    const caseFiles = manifest[currentCase] || [];
    const matches = caseFiles.filter(filename => filename.startsWith(searchPrefix));

    if (matches.length > 0) {
        displayImages(matches);
        setStatus(`Found ${matches.length} file(s) for ${rawInput}.`);
        
        if (!foundLeads.has(rawInput)) {
            foundLeads.add(rawInput);
            updateLeadsList();
        }
        locationInput.value = ""; 
        saveGameState(); // Save progress
    } else {
        setStatus("There is no lead at this location.", true);
        imageArea.innerHTML = '<div class="placeholder-text">There is no lead at this location.</div>';
        currentDisplayedImages = []; // Clear current view tracking
        saveGameState();
    }
}

function displayImages(filenames) {
    imageArea.innerHTML = ""; 
    currentDisplayedImages = filenames; // Track these files for saving
    
    filenames.forEach(file => {
        const img = document.createElement('img');
        img.src = `${currentCase}/${file}`;
        img.alt = file;
        img.onerror = () => { img.style.display = 'none'; }; 
        imageArea.appendChild(img);
    });
}

function handleAddLetter() {
    const letter = letterInput.value.trim().toUpperCase();
    if (letter && /^[A-Z]$/.test(letter)) {
        if (!collectedLetters.has(letter)) {
            collectedLetters.add(letter);
            updateLettersList();
            setStatus(`Added letter: ${letter}`);
            saveGameState(); // Save progress
        } else {
            setStatus(`Letter ${letter} already recorded.`);
        }
        letterInput.value = "";
    } else {
        setStatus("Please enter a single letter A-Z.", true);
    }
}

function updateLeadsList() {
    leadCount.textContent = foundLeads.size;
    leadsList.innerHTML = "";
    
    foundLeads.forEach(lead => {
        const li = document.createElement('li');
        li.textContent = lead;
        li.onclick = () => {
            locationInput.value = lead; 
            handleSearch(); 
        };
        leadsList.appendChild(li);
    });
}

function updateLettersList() {
    lettersList.innerHTML = "";
    const sorted = Array.from(collectedLetters).sort();
    
    sorted.forEach(char => {
        const badge = document.createElement('div');
        badge.className = 'letter-badge';
        badge.textContent = char;
        lettersList.appendChild(badge);
    });
}

function setStatus(msg, isError = false) {
    statusMsg.textContent = msg;
    statusMsg.style.color = isError ? '#ff6b6b' : 'var(--accent-color)';
    statusMsg.style.borderColor = isError ? '#ff6b6b' : '#444';
}

// --- SAVE/LOAD SYSTEM ---

function saveGameState() {
    const state = {
        case: currentCase,
        leads: Array.from(foundLeads),      // Convert Set to Array
        letters: Array.from(collectedLetters), // Convert Set to Array
        images: currentDisplayedImages      // What is currently on screen
    };
    localStorage.setItem('detectiveSaveData', JSON.stringify(state));
}

function loadGameState() {
    const savedJSON = localStorage.getItem('detectiveSaveData');
    if (!savedJSON) return; // No save found, do nothing

    const state = JSON.parse(savedJSON);
    
    // Restore variables
    if (state.case) {
        currentCase = state.case;
        caseSelect.value = state.case;
    }
    
    if (state.leads) {
        foundLeads = new Set(state.leads);
        updateLeadsList();
    }
    
    if (state.letters) {
        collectedLetters = new Set(state.letters);
        updateLettersList();
    }

    if (state.images && state.images.length > 0) {
        displayImages(state.images);
    }
    
    setStatus("Previous session restored.");
}

// Run on load
init();
