// State Variables
let manifest = {};
let foundLeads = new Set(); 
let collectedLetters = new Set();
let currentCase = "";
let currentDisplayedImages = []; 
let leadRequirements = {}; // NEW: Objects { "237NW": ["A", "B"] }

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
const btnReset = document.getElementById('btn-reset');

// Initialize
async function init() {
    for (let i = 1; i <= 10; i++) {
        const opt = document.createElement('option');
        const val = `Case${i.toString().padStart(2, '0')}`;
        opt.value = val;
        opt.textContent = `Case ${i}`;
        caseSelect.appendChild(opt);
    }

    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error("Could not load data.json");
        manifest = await response.json();
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
    setStatus(`Selected ${currentCase}.`);
    saveGameState();
});

btnReset.addEventListener('click', () => {
    if(confirm("Are you sure you want to delete all progress?")) {
        localStorage.removeItem('detectiveSaveData');
        location.reload(); 
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

    const match = rawInput.match(/^(\d+)([A-Z]+)$/);
    if (!match) {
        setStatus("Invalid format. Use Number then Letters (e.g., 237NW).", true);
        return;
    }

    const numberPart = match[1];
    const lettersPart = match[2];
    const paddedNumber = numberPart.padStart(4, '0');
    const searchPrefix = `${lettersPart}-${paddedNumber}`;
    
    // Standardize input for storage (e.g. "237NW")
    const leadCode = `${numberPart}${lettersPart}`;

    const caseFiles = manifest[currentCase] || [];
    const matches = caseFiles.filter(filename => filename.startsWith(searchPrefix));

    if (matches.length > 0) {
        displayImages(matches);
        setStatus(`Found ${matches.length} file(s) for ${rawInput}.`);
        
        if (!foundLeads.has(leadCode)) {
            foundLeads.add(leadCode);
            updateLeadsList(); // Re-draw list
        }
        locationInput.value = ""; 
        saveGameState(); 
    } else {
        setStatus("There is no lead at this location.", true);
        imageArea.innerHTML = '<div class="placeholder-text">There is no lead at this location.</div>';
        currentDisplayedImages = []; 
        saveGameState();
    }
}

function displayImages(filenames) {
    imageArea.innerHTML = ""; 
    currentDisplayedImages = filenames; 
    
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
            saveGameState(); 
        } else {
            setStatus(`Letter ${letter} already recorded.`);
        }
        letterInput.value = "";
    } else {
        setStatus("Please enter a single letter A-Z.", true);
    }
}

// --- UPDATED LIST RENDERER ---
function updateLeadsList() {
    leadCount.textContent = foundLeads.size;
    leadsList.innerHTML = "";
    
    // Sort leads naturally so 2NW comes before 10NW
    const sortedLeads = Array.from(foundLeads).sort((a, b) => {
        return parseInt(a) - parseInt(b);
    });

    sortedLeads.forEach(lead => {
        // Container
        const li = document.createElement('li');
        li.className = "lead-item";

        // Top Row: Lead Name + Add Button
        const header = document.createElement('div');
        header.className = "lead-header";

        const spanCode = document.createElement('span');
        spanCode.className = "lead-code";
        spanCode.textContent = lead;
        spanCode.onclick = () => {
            locationInput.value = lead;
            handleSearch();
        };

        const addBtn = document.createElement('button');
        addBtn.className = "add-req-btn";
        addBtn.textContent = "+ Req";
        addBtn.title = "Add a letter requirement";
        addBtn.onclick = (e) => {
            e.stopPropagation(); // Don't trigger search
            addRequirement(lead);
        };

        header.appendChild(spanCode);
        header.appendChild(addBtn);
        li.appendChild(header);

        // Bottom Row: Badges
        if (leadRequirements[lead] && leadRequirements[lead].length > 0) {
            const reqContainer = document.createElement('div');
            reqContainer.className = "req-container";

            leadRequirements[lead].forEach(reqLetter => {
                const badge = document.createElement('span');
                badge.className = "req-badge";
                badge.textContent = `Need: ${reqLetter}`;
                badge.title = "Click to mark as resolved";
                badge.onclick = (e) => {
                    e.stopPropagation();
                    removeRequirement(lead, reqLetter);
                };
                reqContainer.appendChild(badge);
            });
            li.appendChild(reqContainer);
        }

        leadsList.appendChild(li);
    });
}

// --- NEW REQUIREMENT LOGIC ---

function addRequirement(lead) {
    const letter = prompt(`What letter is required for ${lead}? (Enter A-Z)`);
    if (!letter) return;

    const cleanLetter = letter.trim().toUpperCase();
    if (!/^[A-Z]$/.test(cleanLetter)) {
        alert("Please enter a single letter.");
        return;
    }

    if (!leadRequirements[lead]) {
        leadRequirements[lead] = [];
    }

    if (!leadRequirements[lead].includes(cleanLetter)) {
        leadRequirements[lead].push(cleanLetter);
        leadRequirements[lead].sort();
        updateLeadsList(); // Refresh display
        saveGameState();
    }
}

function removeRequirement(lead, letterToRemove) {
    if (!leadRequirements[lead]) return;

    if (confirm(`Remove requirement for Letter ${letterToRemove}?`)) {
        leadRequirements[lead] = leadRequirements[lead].filter(l => l !== letterToRemove);
        updateLeadsList(); // Refresh display
        saveGameState();
    }
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

function saveGameState() {
    const state = {
        case: currentCase,
        leads: Array.from(foundLeads),
        letters: Array.from(collectedLetters),
        images: currentDisplayedImages,
        reqs: leadRequirements // NEW: Save requirements
    };
    localStorage.setItem('detectiveSaveData', JSON.stringify(state));
}

function loadGameState() {
    const savedJSON = localStorage.getItem('detectiveSaveData');
    if (!savedJSON) return; 

    const state = JSON.parse(savedJSON);
    
    if (state.case) {
        currentCase = state.case;
        caseSelect.value = state.case;
    }
    
    if (state.leads) foundLeads = new Set(state.leads);
    if (state.letters) collectedLetters = new Set(state.letters);
    if (state.reqs) leadRequirements = state.reqs; // NEW: Load requirements

    if (state.images && state.images.length > 0) {
        displayImages(state.images);
    }
    
    updateLeadsList(); // Refresh sidebar to show loaded reqs
    updateLettersList();
    setStatus("Previous session restored.");
}

init();