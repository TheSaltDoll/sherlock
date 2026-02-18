// State Variables
let manifest = {};
let foundLeads = new Set(); 
let failedVisits = new Set();
let revealedMore = new Set();
let collectedLetters = new Set();
let removedLetters = new Set();
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
const failCount = document.getElementById('fail-count');
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
        console.log("Manifest loaded successfully.");
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

// --- LOGIC FUNCTIONS ---

function handleSearch() {
    if (!currentCase) {
        setStatus("Please select a case first.", true);
        return;
    }

    const rawInput = locationInput.value.trim().toUpperCase();
    if (!rawInput) return;

    // Parse Input — support both "237NW" (number+letters) and "A1" (letters+number)
    let numberPart, lettersPart;
    
    const matchNumFirst = rawInput.match(/^(\d+)([A-Z]+)$/);
    const matchLetFirst = rawInput.match(/^([A-Z]+)(\d+)$/);
    
    if (matchNumFirst) {
        numberPart = matchNumFirst[1];
        lettersPart = matchNumFirst[2];
    } else if (matchLetFirst) {
        lettersPart = matchLetFirst[1];
        numberPart = matchLetFirst[2];
    } else {
        setStatus("Invalid format. Use Number+Letters (e.g., 237NW) or Letters+Number (e.g., A1).", true);
        return;
    }

    const paddedNumber = numberPart.padStart(4, '0');
    
    // Prefix: "NW-0237"
    const searchPrefix = `${lettersPart}-${paddedNumber}`;
    const leadCode = `${numberPart}${lettersPart}`;

    const caseFiles = manifest[currentCase] || [];

    // --- FIX: Improved Filtering Logic ---
    const matches = caseFiles.filter(filename => {
        const lowerName = filename.toLowerCase();
        const lowerPrefix = searchPrefix.toLowerCase();

        // 1. Must start with the prefix (e.g. "nw-0042")
        if (!lowerName.startsWith(lowerPrefix)) return false;

        // 2. Prevent Partial Number Matches (e.g. searching "42" shouldn't find "425")
        // We check the character immediately following our search term.
        const charAfter = lowerName.charAt(lowerPrefix.length);

        // If the next character is a DIGIT, it's a false match (e.g. 0042 vs 00425)
        if (charAfter >= '0' && charAfter <= '9') {
            return false;
        }

        // If it's NOT a digit, it is valid! 
        // This accepts: "a" (nw-0042a), "." (nw-0042.png), "_" (nw-0042_req...)
        return true;
    });

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
        if (!failedVisits.has(leadCode)) {
            failedVisits.add(leadCode);
            updateFailCount();
        }
        saveGameState();
    }
}

function displayImages(filenames) {
    imageArea.innerHTML = ""; 
    currentDisplayedImages = filenames; 
    
    filenames.forEach(file => {
        // Strict check for "_req_" to identify buttons
        const isGated = /_req_/i.test(file);

        if (isGated) {
            createGatedContent(file);
        } else {
            // Normal Image (includes 'a', 'b', 'c' files)
            const img = document.createElement('img');
            img.src = `${currentCase}/${file}`;
            img.alt = file;
            imageArea.appendChild(img);
        }
    });
}

function createGatedContent(filename) {
    // Regex matches "_req_" followed by the rule string
    const match = filename.match(/_req_(.+?)\./i); 
    if (!match) return; 
    
    const ruleString = match[1]; 
    const ruleUpper = ruleString.toUpperCase();
    
    // Determine if MORE is involved
    const hasMore = /\bMORE\b/.test(ruleUpper);
    
    // Strip MORE (and surrounding AND/OR) to get the pure letter requirement
    const letterRule = ruleString
        .replace(/-AND-MORE|MORE-AND-|-OR-MORE|MORE-OR-|MORE/gi, '')
        .trim();
    
    const hasLetterReq = letterRule.length > 0;

    const container = document.createElement('div');
    container.className = "gated-container";
    
    // If this MORE file was already revealed, show it immediately
    if (hasMore && revealedMore.has(filename)) {
        // Still need to check letter requirements
        if (hasLetterReq && !checkRequirement(letterRule)) {
            // Letters no longer met (e.g. player removed a letter) — show as gated
        } else {
            const img = document.createElement('img');
            img.src = `${currentCase}/${filename}`;
            img.className = "revealed-img";
            container.appendChild(img);
            imageArea.appendChild(container);
            return;
        }
    }
    
    const btn = document.createElement('button');
    btn.className = "gate-btn";
    
    if (hasMore && !hasLetterReq) {
        // Pure MORE — just a "read on" button
        btn.textContent = "Read on...";
    } else if (hasMore && hasLetterReq) {
        // Combined: letter requirement + MORE
        const readableRule = formatRule(letterRule);
        btn.textContent = `Read on... (Requires: ${readableRule})`;
    } else {
        // Standard gated content, no MORE
        const readableRule = formatRule(ruleString);
        btn.textContent = `Open Clue (Requires: ${readableRule})`;
    }

    btn.onclick = () => {
        // Check letter requirements if any
        if (hasLetterReq && !checkRequirement(letterRule)) {
            const readableRule = formatRule(letterRule);
            alert(`You do not have the required evidence: ${readableRule}`);
            return;
        }
        
        // Reveal the image
        container.innerHTML = ""; 
        const img = document.createElement('img');
        img.src = `${currentCase}/${filename}`;
        img.className = "revealed-img"; 
        container.appendChild(img);
        
        // Track MORE reveals for persistence
        if (hasMore) {
            revealedMore.add(filename);
            saveGameState();
        }
    };

    container.appendChild(btn);
    imageArea.appendChild(container);
}

function formatRule(ruleString) {
    return ruleString
        .replace(/__/g, (match, offset, string) => {
            const preceding = string.substring(0, offset);
            const count = (preceding.match(/__/g) || []).length;
            return count % 2 === 0 ? '(' : ')';
        })
        .replace(/-/g, ' ');
}

function checkRequirement(ruleString) {
    const rule = ruleString.toUpperCase();

    // Recursively resolve grouped sub-expressions marked by __...__
    function resolveGroups(expr) {
        // Replace innermost groups first (no nested __ inside)
        while (expr.includes('__')) {
            expr = expr.replace(/__([^_]+?)__/g, (match, inner) => {
                return evaluateExpr(inner) ? 'TRUE' : 'FALSE';
            });
        }
        return evaluateExpr(expr);
    }

    // Evaluate a flat expression (no groups remaining) — split by OR, then AND
    function evaluateExpr(expr) {
        // Split on OR first (lower precedence)
        if (expr.includes('-OR-') || expr.includes(' OR ')) {
            const parts = expr.split(/-OR-| OR /);
            return parts.some(part => evaluateExpr(part.trim()));
        }

        // Then AND (higher precedence)
        if (expr.includes('-AND-') || expr.includes(' AND ')) {
            const parts = expr.split(/-AND-| AND /);
            return parts.every(part => evaluateExpr(part.trim()));
        }

        // Single token
        return evalToken(expr.trim());
    }

    // Evaluate a single token: TRUE/FALSE literals, NOT-X, or plain letter
    function evalToken(token) {
        if (token === 'TRUE') return true;
        if (token === 'FALSE') return false;
        if (token.startsWith('NOT-')) {
            const letter = token.substring(4);
            return !collectedLetters.has(letter);
        }
        return collectedLetters.has(token);
    }

    return resolveGroups(rule);
}

// --- STANDARD FUNCTIONS ---

function handleAddLetter() {
    const letter = letterInput.value.trim().toUpperCase();
    if (letter && /^[A-Z]$/.test(letter)) {
        if (!collectedLetters.has(letter)) {
            collectedLetters.add(letter);
            removedLetters.delete(letter); // Clear from removed if re-adding
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

function updateFailCount() {
    failCount.textContent = failedVisits.size;
}

function updateLettersList() {
    lettersList.innerHTML = "";
    
    // Combine both sets and sort all letters together
    const allLetters = new Set([...collectedLetters, ...removedLetters]);
    const sorted = Array.from(allLetters).sort();
    
    sorted.forEach(char => {
        const badge = document.createElement('div');
        const isActive = collectedLetters.has(char);
        
        badge.className = isActive ? 'letter-badge' : 'letter-badge letter-removed';
        badge.textContent = char;
        
        if (isActive) {
            badge.title = 'Click to cross out';
            badge.onclick = () => {
                if (confirm(`Cross out letter ${char}?`)) {
                    collectedLetters.delete(char);
                    removedLetters.add(char);
                    updateLettersList();
                    setStatus(`Crossed out letter: ${char}`);
                    saveGameState();
                }
            };
        } else {
            badge.title = 'Click to restore';
            badge.onclick = () => {
                if (confirm(`Restore letter ${char}?`)) {
                    removedLetters.delete(char);
                    collectedLetters.add(char);
                    updateLettersList();
                    setStatus(`Restored letter: ${char}`);
                    saveGameState();
                }
            };
        }
        
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
        removedLetters: Array.from(removedLetters),
        images: currentDisplayedImages,
        reqs: leadRequirements,
        fails: Array.from(failedVisits),
        moreRevealed: Array.from(revealedMore)
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
    if (state.removedLetters) removedLetters = new Set(state.removedLetters);
    if (state.reqs) leadRequirements = state.reqs; 
    if (state.fails) failedVisits = new Set(state.fails);
    if (state.moreRevealed) revealedMore = new Set(state.moreRevealed);

    if (state.images && state.images.length > 0) {
        displayImages(state.images);
    }
    
    updateLeadsList(); 
    updateLettersList();
    updateFailCount();
    setStatus("Previous session restored.");
}

init();
