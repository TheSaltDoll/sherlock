// State Variables
let manifest = {};
let foundLeads = new Set(); // Stores location codes that worked
let collectedLetters = new Set();
let currentCase = "";

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
    resetBoard();
    setStatus(`Selected ${currentCase}. Enter a location.`);
});

// Logic Functions

function handleSearch() {
    if (!currentCase) {
        setStatus("Please select a case first.", true);
        return;
    }

    const rawInput = locationInput.value.trim().toUpperCase();
    if (!rawInput) return;

    // Parse Input (Expects Number then Letters, e.g. "237NW")
    // Regex: Matches digits at start, then letters
    const match = rawInput.match(/^(\d+)([A-Z]+)$/);
    
    if (!match) {
        setStatus("Invalid format. Use Number then Letters (e.g., 237NW).", true);
        return;
    }

    const numberPart = match[1];
    const lettersPart = match[2];

    // Format target: [two-letters]-[4-digit-number]
    // e.g., NW-0237
    const paddedNumber = numberPart.padStart(4, '0');
    const searchPrefix = `${lettersPart}-${paddedNumber}`;

    // Search in Manifest
    const caseFiles = manifest[currentCase] || [];
    
    // Find all files that start with the searchPrefix
    // This catches "NW-0237.png", "NW-0237a.png", "NW-0237b.png"
    const matches = caseFiles.filter(filename => filename.startsWith(searchPrefix));

    if (matches.length > 0) {
        // Success
        displayImages(matches);
        setStatus(`Found ${matches.length} file(s) for ${rawInput}.`);
        
        if (!foundLeads.has(rawInput)) {
            foundLeads.add(rawInput);
            updateLeadsList();
        }
        locationInput.value = ""; // Clear input
    } else {
        // Failure
        setStatus("There is no lead at this location.", true);
        imageArea.innerHTML = '<div class="placeholder-text">There is no lead at this location.</div>';
    }
}

function displayImages(filenames) {
    imageArea.innerHTML = ""; // Clear current view
    
    filenames.forEach(file => {
        const img = document.createElement('img');
        img.src = `${currentCase}/${file}`;
        img.alt = file;
        img.onerror = () => { img.style.display = 'none'; }; // Hide if broken
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
            locationInput.value = lead; // Put back in box
            handleSearch(); // Re-trigger search
        };
        leadsList.appendChild(li);
    });
}

function updateLettersList() {
    lettersList.innerHTML = "";
    // Sort alphabetically
    const sorted = Array.from(collectedLetters).sort();
    
    sorted.forEach(char => {
        const badge = document.createElement('div');
        badge.className = 'letter-badge';
        badge.textContent = char;
        lettersList.appendChild(badge);
    });
}

function resetBoard() {
    foundLeads.clear();
    collectedLetters.clear();
    updateLeadsList();
    updateLettersList();
    imageArea.innerHTML = '<div class="placeholder-text">New case started. Good luck.</div>';
    locationInput.value = "";
    letterInput.value = "";
}

function setStatus(msg, isError = false) {
    statusMsg.textContent = msg;
    statusMsg.style.color = isError ? '#ff6b6b' : 'var(--accent-color)';
    statusMsg.style.borderColor = isError ? '#ff6b6b' : '#444';
}

// Run on load
init();
