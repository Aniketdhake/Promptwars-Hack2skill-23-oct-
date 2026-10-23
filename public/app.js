/**
 * FreshLoop - Client Application Logic
 * PromptWars 2026 Hackathon
 */

// Storage Keys
const PANTRY_STORAGE_KEY = 'freshloop_pantry_v1';
const HISTORY_STORAGE_KEY = 'freshloop_confirmed_history_v1';

// Category Emoji Map (Supports Indian Kitchen Categories & Legacy Data)
const CATEGORY_ICONS = {
  // Indian Household Categories
  'Grains & staples': '🌾',
  'Dal & pulses': '🥣',
  'Vegetables / sabzi ingredients': '🥔',
  'Dairy': '🥛',
  'Ready food & leftovers': '🍲',
  'Other / Custom': '📦',
  // Preserving legacy categories for backwards compatibility
  'Produce': '🥬',
  'Dairy & Eggs': '🥚',
  'Bakery & Bread': '🍞',
  'Meat & Seafood': '🐟',
  'Grains & Pasta': '🍚',
  'Canned & Pantry': '🥫',
  'Other': '🍽️'
};

// Application State
const state = {
  pantry: [],
  history: [],
  activePlan: null,
  geminiActive: false,
  searchQuery: '',
  sortBy: 'soonest',
  preference: 'most_soon',
  mealType: 'any'
};

// DOM Elements
const elements = {
  // Status & Actions
  connectionStatus: document.getElementById('connectionStatus'),
  quickSampleBtn: document.getElementById('quickSampleBtn'),
  emptySampleBtn: document.getElementById('emptySampleBtn'),

  // Add Item Form
  toggleAddFormBtn: document.getElementById('toggleAddFormBtn'),
  closeAddFormBtn: document.getElementById('closeAddFormBtn'),
  cancelAddBtn: document.getElementById('cancelAddBtn'),
  addItemCard: document.getElementById('addItemCard'),
  addItemForm: document.getElementById('addItemForm'),
  itemName: document.getElementById('itemName'),
  itemCategory: document.getElementById('itemCategory'),
  customCategoryRow: document.getElementById('customCategoryRow'),
  customCategoryInput: document.getElementById('customCategoryInput'),
  itemQuantity: document.getElementById('itemQuantity'),
  itemUnit: document.getElementById('itemUnit'),
  customUnitRow: document.getElementById('customUnitRow'),
  customUnitInput: document.getElementById('customUnitInput'),
  itemExpDate: document.getElementById('itemExpDate'),
  itemNotes: document.getElementById('itemNotes'),

  // Inventory & Filter
  pantrySearchInput: document.getElementById('pantrySearchInput'),
  pantrySortSelect: document.getElementById('pantrySortSelect'),
  pantryList: document.getElementById('pantryList'),
  pantryEmptyState: document.getElementById('pantryEmptyState'),
  urgentCount: document.getElementById('urgentCount'),
  upcomingCount: document.getElementById('upcomingCount'),
  freshCount: document.getElementById('freshCount'),
  totalPantryCount: document.getElementById('totalPantryCount'),

  // Planner
  prefRadios: document.querySelectorAll('input[name="mealPreference"]'),
  prefCards: document.querySelectorAll('.pref-card'),
  mealTypeSelect: document.getElementById('mealTypeSelect'),
  generatePlanBtn: document.getElementById('generatePlanBtn'),
  planPlaceholder: document.getElementById('planPlaceholder'),
  planCard: document.getElementById('planCard'),
  planSourceBadge: document.getElementById('planSourceBadge'),
  planTitle: document.getElementById('planTitle'),
  planPrepTime: document.getElementById('planPrepTime'),
  planCookTime: document.getElementById('planCookTime'),
  planServings: document.getElementById('planServings'),
  planRescueReason: document.getElementById('planRescueReason'),
  planUsedIngredientsList: document.getElementById('planUsedIngredientsList'),
  planStaplesList: document.getElementById('planStaplesList'),
  staplesSection: document.getElementById('staplesSection'),
  planInstructionsList: document.getElementById('planInstructionsList'),
  planSafetyText: document.getElementById('planSafetyText'),
  confirmCookedBtn: document.getElementById('confirmCookedBtn'),
  discardPlanBtn: document.getElementById('discardPlanBtn'),

  // Impact & History
  confirmedMealsCount: document.getElementById('confirmedMealsCount'),
  confirmedItemsCount: document.getElementById('confirmedItemsCount'),
  activePantryCount: document.getElementById('activePantryCount'),
  historyList: document.getElementById('historyList'),
  historyEmpty: document.getElementById('historyEmpty'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),

  // Notifications
  toastContainer: document.getElementById('toastContainer')
};

// ============================================================================
// Date & Time Helpers
// ============================================================================

/**
 * Parse YYYY-MM-DD string into a timezone-safe local midnight Date object
 */
function parseLocalDate(dateString) {
  if (!dateString) return null;
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day, 0, 0, 0, 0);
  }
  const d = new Date(dateString);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get days between current local date and target date string (YYYY-MM-DD)
 */
function getDaysUntil(dateString) {
  if (!dateString) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = parseLocalDate(dateString);
  if (!target || isNaN(target.getTime())) return 999;

  const diffTime = target - today;
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format relative date display and urgency styling
 */
function getUrgencyInfo(dateString) {
  const days = getDaysUntil(dateString);

  if (days < 0) {
    const past = Math.abs(days);
    return {
      label: past === 1 ? 'Past date (1d ago)' : `Past date (${past}d ago)`,
      badgeClass: 'badge-past-date',
      cardClass: 'card-past-date',
      urgencyLevel: 'past'
    };
  } else if (days === 0) {
    return {
      label: 'Expires today!',
      badgeClass: 'badge-urgent',
      cardClass: 'card-urgent',
      urgencyLevel: 'urgent'
    };
  } else if (days <= 2) {
    return {
      label: `${days} day${days > 1 ? 's' : ''} left`,
      badgeClass: 'badge-urgent',
      cardClass: 'card-urgent',
      urgencyLevel: 'urgent'
    };
  } else if (days <= 5) {
    return {
      label: `${days} days left`,
      badgeClass: 'badge-upcoming',
      cardClass: 'card-upcoming',
      urgencyLevel: 'upcoming'
    };
  } else {
    return {
      label: `${days} days left`,
      badgeClass: 'badge-fresh',
      cardClass: 'card-fresh',
      urgencyLevel: 'fresh'
    };
  }
}

/**
 * Format ISO date string into readable short date
 */
function formatShortDate(dateString) {
  if (!dateString) return 'No date';
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return dateString;
  } catch (e) {
    return dateString;
  }
}

/**
 * Generate unique item ID
 */
function generateId() {
  return 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
}

// ============================================================================
// Sample Pantry Data
// ============================================================================

/**
 * Creates realistic pantry items with soonest dates relative to current day
 * Tailored for everyday Indian kitchens.
 */
function createSamplePantry() {
  const now = new Date();
  const formatOffset = (offsetDays) => {
    const d = new Date();
    d.setDate(now.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };

  return [
    {
      id: generateId(),
      name: 'Cooked Toor Dal (Leftover)',
      category: 'Ready food & leftovers',
      quantity: 1,
      unit: 'katori / cup',
      expirationDate: formatOffset(0), // Today
      notes: 'Refrigerated bowl from yesterday dinner'
    },
    {
      id: generateId(),
      name: 'Roti / Chapati (Leftover)',
      category: 'Ready food & leftovers',
      quantity: 4,
      unit: 'pieces',
      expirationDate: formatOffset(1), // Tomorrow
      notes: 'Soft rotis, ideal for roll, upma, or reheating'
    },
    {
      id: generateId(),
      name: 'Palak (Fresh Spinach)',
      category: 'Vegetables / sabzi ingredients',
      quantity: 1,
      unit: 'bunch',
      expirationDate: formatOffset(2), // 2 days
      notes: 'Wash thoroughly before cooking'
    },
    {
      id: generateId(),
      name: 'Fresh Dahi (Curd)',
      category: 'Dairy',
      quantity: 1,
      unit: 'packet',
      expirationDate: formatOffset(2), // 2 days
      notes: 'Chilled pouch in fridge'
    },
    {
      id: generateId(),
      name: 'Fresh Paneer',
      category: 'Dairy',
      quantity: 200,
      unit: 'g',
      expirationDate: formatOffset(3), // 3 days
      notes: 'Soft paneer block'
    },
    {
      id: generateId(),
      name: 'Tamatar (Tomatoes)',
      category: 'Vegetables / sabzi ingredients',
      quantity: 500,
      unit: 'g',
      expirationDate: formatOffset(4), // 4 days
      notes: 'Ripe, ready for sabzi'
    },
    {
      id: generateId(),
      name: 'Aloo (Potatoes)',
      category: 'Vegetables / sabzi ingredients',
      quantity: 1,
      unit: 'kg',
      expirationDate: formatOffset(14), // 14 days
      notes: 'Stored in kitchen basket'
    },
    {
      id: generateId(),
      name: 'Poha (Flattened Rice)',
      category: 'Grains & staples',
      quantity: 500,
      unit: 'g',
      expirationDate: formatOffset(45), // 45 days
      notes: 'Medium-thick poha in jar'
    },
    {
      id: generateId(),
      name: 'Moong Dal',
      category: 'Dal & pulses',
      quantity: 1,
      unit: 'kg',
      expirationDate: formatOffset(60), // 60 days
      notes: 'Yellow split dal'
    },
    {
      id: generateId(),
      name: 'Basmati Rice',
      category: 'Grains & staples',
      quantity: 2,
      unit: 'kg',
      expirationDate: formatOffset(90), // 90 days
      notes: 'Everyday pantry grain'
    },
    {
      id: generateId(),
      name: 'Mustard Oil (Kacchi Ghani)',
      category: 'Other / Custom',
      quantity: 1,
      unit: 'litres / ml',
      expirationDate: formatOffset(120), // 120 days
      notes: 'Cooking oil'
    },
    {
      id: generateId(),
      name: 'Namak (Salt)',
      category: 'Other / Custom',
      quantity: 1,
      unit: 'packet',
      expirationDate: formatOffset(300), // 300 days
      notes: 'Pantry salt'
    }
  ];
}

// ============================================================================
// Persistence
// ============================================================================

function loadState() {
  try {
    const savedPantry = localStorage.getItem(PANTRY_STORAGE_KEY);
    if (savedPantry) {
      state.pantry = JSON.parse(savedPantry);
    } else {
      // Start with sample pantry on first run
      state.pantry = createSamplePantry();
      savePantry();
    }

    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (savedHistory) {
      state.history = JSON.parse(savedHistory);
    } else {
      state.history = [];
    }
  } catch (err) {
    console.warn('Error reading from localStorage:', err);
    state.pantry = createSamplePantry();
    state.history = [];
  }
}

function savePantry() {
  try {
    localStorage.setItem(PANTRY_STORAGE_KEY, JSON.stringify(state.pantry));
  } catch (err) {
    console.error('Failed to save pantry to localStorage:', err);
  }
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(state.history));
  } catch (err) {
    console.error('Failed to save history to localStorage:', err);
  }
}

// ============================================================================
// Server Connection & Health
// ============================================================================

async function checkServerHealth() {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Health check non-200');
    const data = await res.json();

    state.geminiActive = Boolean(data.geminiConfigured);

    if (state.geminiActive) {
      elements.connectionStatus.className = 'status-pill status-active';
      elements.connectionStatus.innerHTML = '<span class="status-dot"></span><span>Gemini Connected</span>';
      elements.connectionStatus.title = 'Gemini API key is configured and active';
    } else {
      elements.connectionStatus.className = 'status-pill status-fallback';
      elements.connectionStatus.innerHTML = '<span class="status-dot"></span><span>Offline Mode Ready</span>';
      elements.connectionStatus.title = 'No Gemini API key set; using built-in rule-based rescue engine';
    }
  } catch (err) {
    elements.connectionStatus.className = 'status-pill status-fallback';
    elements.connectionStatus.innerHTML = '<span class="status-dot"></span><span>Server Offline</span>';
    elements.connectionStatus.title = 'Could not contact backend server';
  }
}

// ============================================================================
// UI Notifications
// ============================================================================

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'warning' ? 'toast-warning' : ''}`;
  toast.innerHTML = `<span>${message}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 200ms ease';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// ============================================================================
// Pantry Rendering & Operations
// ============================================================================

function renderPantry() {
  const { pantry, searchQuery, sortBy } = state;

  // Filter by search
  let filtered = pantry.filter(item => {
    if (!searchQuery) return true;
    return item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
           item.category.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Sort
  filtered.sort((a, b) => {
    if (sortBy === 'soonest') {
      return new Date(a.expirationDate) - new Date(b.expirationDate);
    } else if (sortBy === 'furthest') {
      return new Date(b.expirationDate) - new Date(a.expirationDate);
    } else if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    } else if (sortBy === 'category') {
      return a.category.localeCompare(b.category);
    }
    return 0;
  });

  // Update counts
  let urgent = 0;
  let upcoming = 0;
  let fresh = 0;

  pantry.forEach(item => {
    const days = getDaysUntil(item.expirationDate);
    if (days <= 2) urgent++;
    else if (days <= 5) upcoming++;
    else fresh++;
  });

  elements.urgentCount.textContent = urgent;
  elements.upcomingCount.textContent = upcoming;
  elements.freshCount.textContent = fresh;
  elements.totalPantryCount.textContent = pantry.length;
  elements.activePantryCount.textContent = pantry.length;

  // Render list or empty state
  elements.pantryList.innerHTML = '';

  if (filtered.length === 0) {
    elements.pantryList.hidden = true;
    elements.pantryEmptyState.hidden = false;
  } else {
    elements.pantryList.hidden = false;
    elements.pantryEmptyState.hidden = true;

    filtered.forEach(item => {
      const urgency = getUrgencyInfo(item.expirationDate);
      const icon = CATEGORY_ICONS[item.category] || '🍽️';

      const card = document.createElement('div');
      card.className = `pantry-card ${urgency.cardClass}`;
      card.setAttribute('role', 'listitem');
      card.setAttribute('data-id', item.id);

      card.innerHTML = `
        <div class="pantry-card-main">
          <div class="category-icon" title="${item.category}">
            ${icon}
          </div>
          <div class="item-details">
            <div class="item-title-row">
              <span class="item-name">${escapeHtml(item.name)}</span>
              <span class="item-qty">${item.quantity} ${escapeHtml(item.unit || '')}</span>
            </div>
            <div class="item-subtext">
              <span class="urgency-badge ${urgency.badgeClass}">
                ${urgency.label}
              </span>
              <span class="item-date-text">
                Date: ${formatShortDate(item.expirationDate)}
              </span>
              ${item.notes ? `<span class="item-notes-text">• ${escapeHtml(item.notes)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="pantry-card-actions">
          <button class="btn-remove-item" title="Remove item" aria-label="Remove ${escapeHtml(item.name)}">
            🗑️
          </button>
        </div>
      `;

      // Remove handler
      const removeBtn = card.querySelector('.btn-remove-item');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removePantryItem(item.id, item.name);
      });

      elements.pantryList.appendChild(card);
    });
  }
}

function removePantryItem(id, name) {
  state.pantry = state.pantry.filter(i => i.id !== id);
  savePantry();
  renderPantry();
  showToast(`Removed "${name}" from pantry.`, 'info');
}

function handleAddItem(e) {
  e.preventDefault();

  const name = elements.itemName.value.trim();
  let category = elements.itemCategory.value;
  if (category === 'Other / Custom') {
    const customCat = (elements.customCategoryInput.value || '').trim();
    category = customCat || 'Other / Custom';
  }

  const quantity = parseFloat(elements.itemQuantity.value);

  let unit = elements.itemUnit.value;
  if (unit === 'custom') {
    const customUnit = (elements.customUnitInput.value || '').trim();
    unit = customUnit || 'pieces';
  }

  const expirationDate = elements.itemExpDate.value;
  const notes = elements.itemNotes.value.trim();

  if (!name || isNaN(quantity) || quantity <= 0 || !expirationDate) {
    showToast('Please provide a valid name, quantity, and expiration date.', 'warning');
    return;
  }

  const newItem = {
    id: generateId(),
    name,
    category,
    quantity,
    unit,
    expirationDate,
    notes
  };

  state.pantry.unshift(newItem);
  savePantry();
  renderPantry();

  // Reset & close form
  elements.addItemForm.reset();
  elements.customCategoryRow.hidden = true;
  elements.customUnitRow.hidden = true;
  elements.itemExpDate.value = getTomorrowString();
  elements.addItemCard.hidden = true;
  elements.toggleAddFormBtn.setAttribute('aria-expanded', 'false');

  showToast(`Added "${name}" with date ${formatShortDate(expirationDate)}.`, 'info');
}

function getTomorrowString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================================
// Rescue Meal Planner Flow
// ============================================================================

async function generateMealPlan() {
  if (state.pantry.length === 0) {
    showToast('Your pantry is empty! Add items first to generate a rescue plan.', 'warning');
    return;
  }

  // Set loading state
  elements.generatePlanBtn.disabled = true;
  const spinner = elements.generatePlanBtn.querySelector('.btn-spinner');
  const label = elements.generatePlanBtn.querySelector('.btn-label');
  spinner.hidden = false;
  label.textContent = 'Crafting Rescue Plan...';

  try {
    const response = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: state.pantry,
        preference: state.preference,
        mealType: state.mealType
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with ${response.status}`);
    }

    const data = await response.json();

    // Verify structured plan data and cross-check ingredient IDs against pantry
    const plan = data.plan;
    if (!plan || !plan.title || !plan.instructions) {
      throw new Error('Received incomplete plan data structure from server.');
    }

    // Check that selected ingredient IDs exist in current pantry
    const pantryMap = new Map(state.pantry.map(i => [String(i.id), i]));
    const verifiedUsedIds = [];
    const verifiedUsedIngredients = [];

    (plan.usedIngredients || []).forEach(usedIng => {
      let matchedItem = pantryMap.get(String(usedIng.id));
      // Fallback: match by name if ID was altered
      if (!matchedItem) {
        matchedItem = state.pantry.find(
          i => i.name.toLowerCase().trim() === (usedIng.name || '').toLowerCase().trim()
        );
      }

      if (matchedItem) {
        verifiedUsedIds.push(matchedItem.id);
        verifiedUsedIngredients.push({
          ...usedIng,
          id: matchedItem.id,
          pantryItem: matchedItem
        });
      }
    });

    plan.usedPantryItemIds = verifiedUsedIds;
    plan.usedIngredients = verifiedUsedIngredients;

    // Store in active plan
    state.activePlan = {
      source: data.source,
      sourceLabel: data.sourceLabel,
      fallbackReason: data.fallbackReason,
      plan: plan
    };

    renderActivePlan();
    showToast(`Rescue plan generated: "${plan.title}"`, 'info');

    // Scroll smoothly to plan display area
    elements.planCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    console.error('Plan generation error:', err);
    showToast(`Could not generate plan: ${err.message}`, 'warning');
  } finally {
    elements.generatePlanBtn.disabled = false;
    spinner.hidden = true;
    label.textContent = '✨ Generate Rescue Plan';
  }
}

function renderActivePlan() {
  if (!state.activePlan) {
    elements.planPlaceholder.hidden = false;
    elements.planCard.hidden = true;
    return;
  }

  const { source, sourceLabel, fallbackReason, plan } = state.activePlan;

  elements.planPlaceholder.hidden = true;
  elements.planCard.hidden = false;

  // Source Badge
  if (source === 'gemini') {
    elements.planSourceBadge.className = 'plan-source-badge plan-source-gemini';
    elements.planSourceBadge.innerHTML = `✦ ${escapeHtml(sourceLabel || 'Gemini Rescue Plan')}`;
  } else {
    elements.planSourceBadge.className = 'plan-source-badge plan-source-fallback';
    elements.planSourceBadge.innerHTML = `⚙ ${escapeHtml(sourceLabel || 'Offline Rule-Based Plan')}`;
    if (fallbackReason) {
      elements.planSourceBadge.title = fallbackReason;
    }
  }

  elements.planTitle.textContent = plan.title;
  elements.planPrepTime.textContent = `⏱ Prep: ${plan.prepTimeMinutes || 10}m`;
  elements.planCookTime.textContent = `🔥 Cook: ${plan.cookTimeMinutes || 15}m`;
  elements.planServings.textContent = `👥 Servings: ${plan.servings || 2}`;

  elements.planRescueReason.textContent =
    plan.rescueReason || 'Combines your soonest-expiring items to prevent spoilage.';

  // Render used ingredients
  elements.planUsedIngredientsList.innerHTML = '';
  if (plan.usedIngredients && plan.usedIngredients.length > 0) {
    plan.usedIngredients.forEach(ing => {
      const li = document.createElement('li');
      li.className = 'used-ingredient-item';
      li.innerHTML = `
        <div class="used-ing-left">
          <span class="check-icon">✓</span>
          <strong>${escapeHtml(ing.name)}</strong>
          ${ing.pantryItem ? `<span class="item-date-text">(${getUrgencyInfo(ing.pantryItem.expirationDate).label})</span>` : ''}
        </div>
        <span class="used-ing-qty">${escapeHtml(ing.amountUsed || '1 portion')}</span>
      `;
      elements.planUsedIngredientsList.appendChild(li);
    });
  } else {
    elements.planUsedIngredientsList.innerHTML =
      '<li class="used-ingredient-item">Uses current pantry items</li>';
  }

  // Render pantry staples / spice verification
  elements.staplesSection.hidden = false;
  if (plan.assumedStaples && plan.assumedStaples.length > 0) {
    elements.planStaplesList.innerHTML = plan.assumedStaples
      .map(staple => `<span class="staple-tag">${escapeHtml(staple)}</span>`)
      .join('');
  } else {
    elements.planStaplesList.innerHTML =
      '<span class="staple-tag" style="background: var(--citrus-50); color: var(--forest-800); border-color: var(--citrus-300);">✓ No unlisted spices or oils assumed (strictly uses your listed pantry items and water)</span>';
  }

  // Render instructions
  elements.planInstructionsList.innerHTML = '';
  (plan.instructions || []).forEach(step => {
    const li = document.createElement('li');
    li.textContent = step;
    elements.planInstructionsList.appendChild(li);
  });

  // Food safety text
  elements.planSafetyText.textContent =
    plan.safetyNotice ||
    'Food safety notice: Dates indicate peak quality, not proven safety. Check smell, texture, and appearance before cooking.';
}

// ============================================================================
// Meal Confirmation & Impact Tracking
// ============================================================================

/**
 * Confirms the meal was prepared:
 * 1. Deducts / removes used ingredients from pantry.
 * 2. Logs confirmed rescue entry.
 * 3. Updates verified stats.
 * (Only tracks what user explicitly confirms).
 */
function handleConfirmCooked() {
  if (!state.activePlan) return;

  const plan = state.activePlan.plan;
  const usedIdSet = new Set((plan.usedPantryItemIds || []).map(String));
  const rescuedNames = [];

  // Deduct or remove confirmed items
  state.pantry = state.pantry.filter(item => {
    if (usedIdSet.has(String(item.id))) {
      rescuedNames.push(item.name);
      return false; // Remove fully consumed items
    }
    return true;
  });

  savePantry();
  renderPantry();

  // Record verified rescue in history
  const historyEntry = {
    id: generateId(),
    mealTitle: plan.title,
    confirmedAt: new Date().toISOString(),
    itemsRescuedCount: rescuedNames.length,
    rescuedItems: rescuedNames,
    preference: plan.preferenceUsed || state.preference
  };

  state.history.unshift(historyEntry);
  saveHistory();
  renderHistory();

  // Clear active plan
  const mealName = plan.title;
  state.activePlan = null;
  renderActivePlan();

  showToast(`🎉 Confirmed: "${mealName}" made! ${rescuedNames.length} ingredients rescued.`, 'info');
}

function discardPlan() {
  state.activePlan = null;
  renderActivePlan();
  showToast('Rescue plan discarded. No pantry items were changed.', 'info');
}

function renderHistory() {
  const { history } = state;

  // Compute verified totals
  const totalMeals = history.length;
  const totalItemsRescued = history.reduce((sum, h) => sum + (h.itemsRescuedCount || 0), 0);

  elements.confirmedMealsCount.textContent = totalMeals;
  elements.confirmedItemsCount.textContent = totalItemsRescued;

  elements.historyList.innerHTML = '';

  if (history.length === 0) {
    elements.historyList.hidden = true;
    elements.historyEmpty.hidden = false;
  } else {
    elements.historyList.hidden = false;
    elements.historyEmpty.hidden = true;

    history.forEach(entry => {
      const itemEl = document.createElement('div');
      itemEl.className = 'history-entry';

      const dateStr = new Date(entry.confirmedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      itemEl.innerHTML = `
        <div class="history-info">
          <strong>${escapeHtml(entry.mealTitle)}</strong>
          <div class="history-items-used">
            Rescued: ${entry.rescuedItems.map(escapeHtml).join(', ') || `${entry.itemsRescuedCount} item(s)`}
          </div>
        </div>
        <div class="history-timestamp">
          ${dateStr}
        </div>
      `;
      elements.historyList.appendChild(itemEl);
    });
  }
}

function clearHistory() {
  if (confirm('Clear your confirmed cooking history? This cannot be undone.')) {
    state.history = [];
    saveHistory();
    renderHistory();
    showToast('Confirmed history cleared.', 'info');
  }
}

// ============================================================================
// Utilities
// ============================================================================

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// Event Listeners & Initialization
// ============================================================================

function initEventListeners() {
  // Add item toggle form
  elements.toggleAddFormBtn.addEventListener('click', () => {
    const isHidden = elements.addItemCard.hidden;
    elements.addItemCard.hidden = !isHidden;
    elements.toggleAddFormBtn.setAttribute('aria-expanded', String(isHidden));
    if (isHidden) {
      elements.itemName.focus();
    }
  });

  elements.closeAddFormBtn.addEventListener('click', () => {
    elements.addItemCard.hidden = true;
    elements.toggleAddFormBtn.setAttribute('aria-expanded', 'false');
  });

  elements.cancelAddBtn.addEventListener('click', () => {
    elements.addItemCard.hidden = true;
    elements.toggleAddFormBtn.setAttribute('aria-expanded', 'false');
  });

  // Toggle custom inputs when "Other / Custom" category or "custom" unit is selected
  elements.itemCategory.addEventListener('change', () => {
    const isCustom = elements.itemCategory.value === 'Other / Custom';
    elements.customCategoryRow.hidden = !isCustom;
    if (isCustom) {
      elements.customCategoryInput.focus();
    }
  });

  elements.itemUnit.addEventListener('change', () => {
    const isCustom = elements.itemUnit.value === 'custom';
    elements.customUnitRow.hidden = !isCustom;
    if (isCustom) {
      elements.customUnitInput.focus();
    }
  });

  elements.addItemForm.addEventListener('submit', handleAddItem);

  // Quick sample loaders
  elements.quickSampleBtn.addEventListener('click', () => {
    state.pantry = createSamplePantry();
    savePantry();
    renderPantry();
    showToast('Loaded sample pantry with realistic upcoming dates!', 'info');
  });

  elements.emptySampleBtn.addEventListener('click', () => {
    state.pantry = createSamplePantry();
    savePantry();
    renderPantry();
    showToast('Loaded sample pantry with realistic upcoming dates!', 'info');
  });

  // Search & Sort
  elements.pantrySearchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderPantry();
  });

  elements.pantrySortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderPantry();
  });

  // Preference selection
  elements.prefRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.preference = e.target.value;
      elements.prefCards.forEach(card => card.classList.remove('selected'));
      radio.closest('.pref-card').classList.add('selected');
    });
  });

  elements.mealTypeSelect.addEventListener('change', (e) => {
    state.mealType = e.target.value;
  });

  // Plan generation
  elements.generatePlanBtn.addEventListener('click', generateMealPlan);

  // Plan confirmation & discard
  elements.confirmCookedBtn.addEventListener('click', handleConfirmCooked);
  elements.discardPlanBtn.addEventListener('click', discardPlan);

  // History
  elements.clearHistoryBtn.addEventListener('click', clearHistory);
}

// Bootstrap Application
function initApp() {
  elements.itemExpDate.value = getTomorrowString();
  loadState();
  initEventListeners();
  renderPantry();
  renderHistory();
  checkServerHealth();
}

document.addEventListener('DOMContentLoaded', initApp);
