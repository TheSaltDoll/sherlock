// State Variables
let manifest = {};
let foundLeads = new Set(); 
let collectedLetters = new Set();
let currentCase = "";
let currentDisplayedImages = []; 
let leadRequirements = {}; 

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
    
    const leadCode = `${numberPart}${lettersPart}`;

    const caseFiles = manifest[currentCase] || [];
    const matches = caseFiles.filter(filename => filename.startsWith(searchPrefix));

    if (matches.length > 0) {
        displayImages(matches);
        setStatus(`Found ${matches.length} file(s) for ${rawInput}.`);
        
        if (!foundLeads.has(leadCode)) {
            foundLeads.add(leadCode);
            updateLeadsList(); 
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

// --- UPDATED IMAGE DISPLAY LOGIC ---
function displayImages(filenames) {
    imageArea.innerHTML = ""; 
    currentDisplayedImages = filenames; 
    
    filenames.forEach(file => {
        // Check for Gatekeeper Tag: "_req_"
        if (file.includes('_req_')) {
            createGatedContent(file);
        } else {
            // Normal Image
            const img = document.createElement('img');
            img.src = `${currentCase}/${file}`;
            img.alt = file;
            imageArea.appendChild(img);
        }
    });
}

function createGatedContent(filename) {
    // 1. Parse filename: "NW-0237_req_A-OR-B.png" -> "A-OR-B"
    // Use regex to capture text between "_req_" and the file extension
    const match = filename.match(/_req_(.+?)\./); 
    if (!match) return; // Fail safe
    
    const ruleString = match[1]; // e.g., "A", "A-OR-B", "A-AND-B"
    
    // 2. Create Container
    const container = document.createElement('div');
    container.className = "gated-container";
    
    // 3. Create Button
    const btn = document.createElement('button');
    btn.className = "gate-btn";
    
    // Format label: Replace dashes with spaces for readability
    const readableRule = ruleString.replace(/-/g, ' '); 
    btn.textContent = `Open Clue (Requires: ${readableRule})`;

    // 4. Button Logic
    btn.onclick = () => {
        if (checkRequirement(ruleString)) {
            // Success: Remove button, show image
            container.innerHTML = ""; // clear button
            
            const img = document.createElement('img');
            img.src = `${currentCase}/${filename}`;
            img.className = "revealed-img"; // Adds animation
            
            container.appendChild(img);
            // We append the container back to imageArea? 
            // No, container is ALREADY in imageArea. We just updated its content.
        } else {
            // Failure
            alert(`You do not have the required evidence: ${readableRule}`);
        }
    };

    container.appendChild(btn);
    imageArea.appendChild(container);
}

function checkRequirement(ruleString) {
    // 1. OR Logic (A-OR-B)
    if (ruleString.includes('-OR-')) {
        const parts = ruleString.split('-OR-');
        // Returns true if User has AT LEAST ONE of the letters
        return parts.some(letter => collectedLetters.has(letter));
    }
    
    // 2. AND Logic (A-AND-B)
    if (ruleString.includes('-AND-')) {
        const parts = ruleString.split('-AND-');
        // Returns true ONLY if User has ALL letters
        return parts.every(letter => collectedLetters.has(letter));
    }
    
    // 3. Single Letter (A)
    return collectedLetters.has(ruleString);
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

function updateLeadsList() {
    leadCount.textContent = foundLeads.size;
    leadsList.innerHTML = "";
    
    const sortedLeads = Array.from(foundLeads).sort((a, b) => {
        return parseInt(a) - parseInt(b);
    });

    sortedLeads.forEach(lead => {
        const li = document.createElement('li');
        li.className = "lead-item";

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
            e.stopPropagation(); 
            addRequirement(lead);
        };

        header.appendChild(spanCode);
        header.appendChild(addBtn);
        li.appendChild(header);

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
        updateLeadsList(); 
        saveGameState();
    }
}

function removeRequirement(lead, letterToRemove) {
    if (!leadRequirements[lead]) return;

    if (confirm(`Remove requirement for Letter ${letterToRemove}?`)) {
        leadRequirements[lead] = leadRequirements[lead].filter(l => l !== letterToRemove);
        updateLeadsList(); 
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
        reqs: leadRequirements 
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
    if (state.reqs) leadRequirements = state.reqs; 

    if (state.images && state.images.length > 0) {
        displayImages(state.images);
    }
    
    updateLeadsList(); 
    updateLettersList();
    setStatus("Previous session restored.");
}

init();
