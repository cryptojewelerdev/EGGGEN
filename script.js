/**
 * Egg Preview Generator
 * 
 * This script handles the loading of egg part manifests and
 * renders the selected egg parts in real-time preview.
 * It also includes functionality to save the generated preview as an image.
 */

// Global state to store manifest data
let manifestData = null;
let currentSelections = {
    Top: { metal: 'Luna', colorway: 'Ice', part: '' },
    Shoulder: { metal: 'Luna', colorway: 'Ice', part: '' },
    Belly: { metal: 'Luna', colorway: 'Ice', part: '' },
    Bottom: { metal: 'Luna', colorway: 'Ice', part: '' }
};

// DOM elements for dropdowns
const zones = ['Top', 'Shoulder', 'Belly', 'Bottom'];

/**
 * Initialize the application when the DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Egg Preview Generator initialized');
    
    setupEventListeners();
    loadManifest();
    
    const exportButton = document.getElementById('export-btn');
    if (exportButton) {
        exportButton.addEventListener('click', savePreview);
    } else {
        console.error("Export button not found.");
    }
});

/**
 * Set up event listeners for all dropdown controls
 */
function setupEventListeners() {
    zones.forEach(zone => {
        const metalDropdown = document.getElementById(`${zone.toLowerCase()}-metal`);
        const colorwayDropdown = document.getElementById(`${zone.toLowerCase()}-colorway`);
        const partDropdown = document.getElementById(`${zone.toLowerCase()}-part`);
        
        if (metalDropdown) metalDropdown.addEventListener('change', (e) => handleSelectionChange(zone, 'metal', e.target.value));
        if (colorwayDropdown) colorwayDropdown.addEventListener('change', (e) => handleSelectionChange(zone, 'colorway', e.target.value));
        if (partDropdown) partDropdown.addEventListener('change', (e) => handleSelectionChange(zone, 'part', e.target.value));
    });
}

/**
 * Handle changes in selection dropdowns
 */
function handleSelectionChange(zone, type, value) {
    currentSelections[zone][type] = value;
    if (type === 'metal' || type === 'colorway') {
        updatePartDropdown(zone); // This will also trigger renderEgg if a part is auto-selected
    }
    renderEgg(); // Always render on any change
}

/**
 * Load the manifest.json file containing available egg parts
 */
async function loadManifest() {
    try {
        const response = await fetch('/EggPartsLibrary/manifest.json');
        if (!response.ok) {
            throw new Error(`Failed to load manifest: ${response.status} ${response.statusText}`);
        }
        manifestData = await response.json();
        console.log('Manifest loaded:', manifestData);
        
        zones.forEach(zone => {
            updatePartDropdown(zone, true); // Pass true for initial load
        });
        renderEgg(); // Initial render after populating dropdowns
    } catch (error) {
        console.error('Error loading manifest:', error);
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.innerHTML = `
                <div class="text-red-400 p-4 rounded-md bg-red-900/50 border border-red-700">
                    <p class="font-bold text-lg">Error Loading Parts Manifest</p>
                    <p class="text-sm mt-1">Could not load <code>manifest.json</code>.</p>
                    <p class="text-xs mt-2">Please ensure the file is available at <code>/EggPartsLibrary/manifest.json</code> and is correctly formatted.</p>
                </div>
            `;
             loadingIndicator.style.display = 'flex';
        }
    }
}

/**
 * Update the parts dropdown for a specific zone based on selected metal and colorway
 */
function updatePartDropdown(zone, isInitialLoad = false) {
    const partDropdown = document.getElementById(`${zone.toLowerCase()}-part`);
    if (!partDropdown) return;

    const metal = currentSelections[zone].metal;
    const colorway = currentSelections[zone].colorway;
    
    partDropdown.innerHTML = '<option value="">Select a part...</option>';
    
    if (!manifestData) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "Manifest not loaded...";
        option.disabled = true;
        partDropdown.appendChild(option);
        return;
    }
    
    try {
        const availableParts = manifestData[zone]?.[metal]?.[colorway] || [];
        
        availableParts.forEach(part => {
            const option = document.createElement('option');
            option.value = part;
            option.textContent = part.replace(/\.png$/i, '').replace(/_/g, ' '); // Remove .png and replace underscores
            partDropdown.appendChild(option);
        });
        
        if (availableParts.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No parts for this combo";
            option.disabled = true;
            partDropdown.appendChild(option);
            currentSelections[zone].part = ''; // Reset part if none available
        } else {
            // If a part is already selected and still available, keep it. Otherwise, select the first.
            if (availableParts.includes(currentSelections[zone].part)) {
                partDropdown.value = currentSelections[zone].part;
            } else if (isInitialLoad && availableParts.length > 0) { 
                // On initial load, if no specific part is pre-selected but parts are available,
                // do not auto-select to allow user to make the first choice.
                // currentSelections[zone].part = availableParts[0]; // Optionally auto-select first part
                // partDropdown.value = availableParts[0];
                currentSelections[zone].part = ''; // Default to "Select a part..."
                partDropdown.value = "";
            } else if (availableParts.length > 0) {
                 // If not initial load, and current part is invalid, auto-select first available
                currentSelections[zone].part = availableParts[0];
                partDropdown.value = availableParts[0];
            }
             else {
                currentSelections[zone].part = '';
                partDropdown.value = "";
            }
        }
    } catch (error) {
        console.error(`Error updating parts dropdown for ${zone}:`, error);
    }
}

/**
 * Render the egg preview based on current selections
 */
function renderEgg() {
    const previewCanvasDiv = document.getElementById('preview-canvas');
    const loadingIndicator = document.getElementById('loading-indicator');
    if (!previewCanvasDiv || !loadingIndicator) return;

    // Clear previous images with fade-out
    Array.from(previewCanvasDiv.querySelectorAll('img.egg-part-image')).forEach(img => {
        img.classList.add('fade-out');
        img.addEventListener('transitionend', () => img.remove(), { once: true });
    });
    
    loadingIndicator.style.display = 'flex'; // Show loading indicator

    const zonesOrder = ['Bottom', 'Belly', 'Shoulder', 'Top'];
    const partsToRender = zonesOrder
        .map((zone, index) => {
            const { metal, colorway, part } = currentSelections[zone];
            if (part) {
                return {
                    zone,
                    path: `/EggPartsLibrary/${zone}/${metal}/${colorway}/${part}`,
                    zIndex: index + 1 
                };
            }
            return null;
        })
        .filter(partInfo => partInfo !== null);

    if (partsToRender.length === 0) {
        loadingIndicator.innerHTML = `<p class="text-gray-400">Select components to preview your egg</p>`;
        return;
    }
    
    loadingIndicator.innerHTML = `<p class="text-gray-400">Loading preview...</p>`;

    let imagesLoadedCount = 0;
    partsToRender.forEach(partInfo => {
        const img = new Image();
        img.src = partInfo.path;
        img.alt = `${partInfo.zone} Layer - ${partInfo.path.split('/').pop()}`;
        img.className = 'egg-part-image opacity-0'; // Base classes, opacity-0 for fade-in
        img.style.zIndex = partInfo.zIndex;

        img.onload = () => {
            previewCanvasDiv.appendChild(img);
            // Force reflow before adding class to trigger transition
            void img.offsetWidth; 
            img.classList.remove('opacity-0');
            
            imagesLoadedCount++;
            if (imagesLoadedCount === partsToRender.length) {
                loadingIndicator.style.display = 'none';
            }
        };
        
        img.onerror = () => {
            console.error(`Error loading image: ${partInfo.path}`);
            // Display an error image placeholder within the preview
            const errorPlaceholder = document.createElement('div');
            errorPlaceholder.className = 'egg-part-image flex items-center justify-center text-xs text-red-400 bg-red-900/30 p-2 text-center';
            errorPlaceholder.style.zIndex = partInfo.zIndex;
            errorPlaceholder.textContent = `Error: ${partInfo.zone} part (${partInfo.path.split('/').pop()}) failed to load.`;
            previewCanvasDiv.appendChild(errorPlaceholder);

            imagesLoadedCount++;
            if (imagesLoadedCount === partsToRender.length) {
                loadingIndicator.style.display = 'none';
            }
        };
    });
}


/**
 * Save the current preview as an 800x800 PNG image.
 */
async function savePreview() {
    const zonesOrder = ['Bottom', 'Belly', 'Shoulder', 'Top'];
    const imagePathsToLoad = zonesOrder
        .map(zone => {
            const { metal, colorway, part } = currentSelections[zone];
            if (part) {
                return `/EggPartsLibrary/${zone}/${metal}/${colorway}/${part}`;
            }
            return null;
        })
        .filter(path => path !== null);

    if (imagePathsToLoad.length === 0) {
        alert('Please select at least one component to save the preview.');
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Ensure canvas is clear

    const loadImage = (src) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            // IMPORTANT: For cross-origin images on canvas if assets are on a different domain (not relevant for /EggPartsLibrary local paths)
            // img.crossOrigin = 'Anonymous'; 
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(new Error(`Failed to load image: ${src}. Error: ${err}`));
            img.src = src;
        });
    };

    try {
        // Load all images. Promise.all ensures all onload events have fired.
        const loadedImages = await Promise.all(imagePathsToLoad.map(loadImage));

        // Draw images onto the canvas in the order they were loaded (which is Bottom to Top)
        loadedImages.forEach(img => {
            // Ensure images fill the canvas; adjust if aspect ratio needs preservation differently
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height); 
        });

        // Convert canvas to data URL and trigger download
        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'egg_preview.png';
        link.href = dataURL;
        document.body.appendChild(link); // Required for Firefox
        link.click();
        document.body.removeChild(link); // Clean up

        console.log('Preview saved successfully as egg_preview.png');

    } catch (error) {
        console.error('Error saving preview:', error);
        alert(`Failed to save preview. One or more images could not be loaded. Please check console for details. \nError: ${error.message}`);
    }
}
