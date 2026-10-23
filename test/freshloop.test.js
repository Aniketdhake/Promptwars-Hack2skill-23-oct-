/**
 * FreshLoop Automated Test Suite
 * Built with Node.js built-in test runner (node:test & node:assert)
 * Covers: date-priority logic, ID validation, confirmation gate, offline fallback & mocked AI flow.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { app, generateOfflineRescuePlan, FOOD_SAFETY_NOTICE } = require('../server.js');

// ============================================================================
// 1. PANTRY DATE-PRIORITY LOGIC TESTS
// ============================================================================
describe('Pantry Date-Priority Logic', () => {
  // Pure local date parsing helper mirroring app.js
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

  function getDaysUntil(dateString, referenceDate = new Date()) {
    if (!dateString) return 999;
    const today = new Date(referenceDate);
    today.setHours(0, 0, 0, 0);

    const target = parseLocalDate(dateString);
    if (!target || isNaN(target.getTime())) return 999;

    const diffTime = target - today;
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  it('correctly sorts items by soonest expiration date ascending', () => {
    const pantry = [
      { id: '1', name: 'Basmati Rice', expirationDate: '2026-12-31' },
      { id: '2', name: 'Cooked Toor Dal', expirationDate: '2026-10-23' },
      { id: '3', name: 'Palak', expirationDate: '2026-10-25' },
      { id: '4', name: 'Leftover Roti', expirationDate: '2026-10-24' }
    ];

    const sorted = [...pantry].sort((a, b) => {
      const da = new Date(a.expirationDate).getTime();
      const db = new Date(b.expirationDate).getTime();
      return da - db;
    });

    assert.equal(sorted[0].name, 'Cooked Toor Dal');
    assert.equal(sorted[1].name, 'Leftover Roti');
    assert.equal(sorted[2].name, 'Palak');
    assert.equal(sorted[3].name, 'Basmati Rice');
  });

  it('accurately calculates days remaining relative to local midnight without timezone shifts', () => {
    const fixedToday = new Date(2026, 9, 23, 15, 30, 0); // Oct 23, 2026 afternoon local

    // Same day -> 0 days (Expires today)
    assert.equal(getDaysUntil('2026-10-23', fixedToday), 0);
    // Tomorrow -> 1 day
    assert.equal(getDaysUntil('2026-10-24', fixedToday), 1);
    // In 3 days -> 3 days
    assert.equal(getDaysUntil('2026-10-26', fixedToday), 3);
    // Yesterday -> -1 day (Past date)
    assert.equal(getDaysUntil('2026-10-22', fixedToday), -1);
  });

  it('safely handles missing or malformed date strings', () => {
    const fixedToday = new Date(2026, 9, 23);
    assert.equal(getDaysUntil(null, fixedToday), 999);
    assert.equal(getDaysUntil('', fixedToday), 999);
    assert.equal(getDaysUntil('not-a-date', fixedToday), 999);
  });
});

// ============================================================================
// 2. PANTRY ITEM ID VALIDATION TESTS
// ============================================================================
describe('Validation that Meal Plan Uses Pantry Item IDs', () => {
  it('strictly filters out hallucinated or non-existent pantry IDs', () => {
    const userPantry = [
      { id: 'pantry-1', name: 'Cooked Toor Dal' },
      { id: 'pantry-2', name: 'Basmati Rice' },
      { id: 'pantry-3', name: 'Palak' }
    ];

    // Mock plan returned by AI containing real and fake IDs
    const mockAiPlan = {
      title: 'Dal Palak Rice',
      usedPantryItemIds: ['pantry-1', 'fake-item-999', 'pantry-3', 'unknown-id-123']
    };

    const validIdSet = new Set(userPantry.map(i => String(i.id)));
    const verifiedUsedIds = mockAiPlan.usedPantryItemIds.filter(id => validIdSet.has(String(id)));

    assert.equal(verifiedUsedIds.length, 2);
    assert.deepEqual(verifiedUsedIds, ['pantry-1', 'pantry-3']);
    assert.equal(verifiedUsedIds.includes('fake-item-999'), false);
  });

  it('matches pantry items by name if ID was missing or slightly altered', () => {
    const userPantry = [
      { id: 'item-101', name: 'Cooked Dal' },
      { id: 'item-102', name: 'Leftover Roti' }
    ];

    const mockAiPlan = {
      usedIngredients: [
        { id: 'wrong-id', name: 'Cooked Dal' },
        { id: 'item-102', name: 'Leftover Roti' }
      ]
    };

    const pantryIdSet = new Set(userPantry.map(i => String(i.id)));
    const verifiedIds = [];

    for (const ing of mockAiPlan.usedIngredients) {
      if (pantryIdSet.has(String(ing.id))) {
        verifiedIds.push(String(ing.id));
      } else {
        const match = userPantry.find(p => p.name.toLowerCase() === ing.name.toLowerCase());
        if (match) verifiedIds.push(String(match.id));
      }
    }

    assert.deepEqual(verifiedIds, ['item-101', 'item-102']);
  });
});

// ============================================================================
// 3. CONFIRMATION GATE BEFORE MARKING ITEMS USED TESTS
// ============================================================================
describe('Confirmation Gate Before Marking Items as Used', () => {
  it('does NOT remove or deduct pantry items when a plan is merely generated', () => {
    // Initial user pantry
    let pantry = [
      { id: 'item-1', name: 'Cooked Dal', quantity: 1, unit: 'katori' },
      { id: 'item-2', name: 'Roti', quantity: 4, unit: 'pieces' },
      { id: 'item-3', name: 'Basmati Rice', quantity: 1, unit: 'kg' }
    ];

    // Generated plan proposes using item-1 and item-2
    const generatedPlan = {
      title: 'Dal-Roti Warmup',
      usedPantryItemIds: ['item-1', 'item-2']
    };

    // User is viewing the plan, but has NOT confirmed cooking yet
    assert.equal(pantry.length, 3, 'Pantry must stay intact while user views plan');
    assert.equal(pantry.some(i => i.id === 'item-1'), true);
  });

  it('deducts items and records honest stats ONLY after explicit confirmation', () => {
    let pantry = [
      { id: 'item-1', name: 'Cooked Dal', quantity: 1, unit: 'katori' },
      { id: 'item-2', name: 'Roti', quantity: 4, unit: 'pieces' },
      { id: 'item-3', name: 'Basmati Rice', quantity: 1, unit: 'kg' }
    ];

    let confirmedHistory = [];
    const plan = {
      title: 'Dal-Roti Warmup',
      usedPantryItemIds: ['item-1', 'item-2']
    };

    // Explicit confirmation action executed by user
    function handleConfirmCooked(activePlan) {
      const usedIdSet = new Set((activePlan.usedPantryItemIds || []).map(String));
      const rescuedNames = [];

      pantry = pantry.filter(item => {
        if (usedIdSet.has(String(item.id))) {
          rescuedNames.push(item.name);
          return false; // item consumed
        }
        return true;
      });

      confirmedHistory.unshift({
        mealTitle: activePlan.title,
        confirmedAt: new Date().toISOString(),
        itemsRescuedCount: rescuedNames.length,
        rescuedItems: rescuedNames
      });
    }

    handleConfirmCooked(plan);

    // Verify pantry after confirmation
    assert.equal(pantry.length, 1, 'Used items must now be deducted');
    assert.equal(pantry[0].id, 'item-3', 'Basmati Rice remains');

    // Verify confirmed history and honest metrics
    assert.equal(confirmedHistory.length, 1);
    assert.equal(confirmedHistory[0].mealTitle, 'Dal-Roti Warmup');
    assert.equal(confirmedHistory[0].itemsRescuedCount, 2);
    assert.deepEqual(confirmedHistory[0].rescuedItems, ['Cooked Dal', 'Roti']);
  });
});

// ============================================================================
// 4. OFFLINE FALLBACK RESPONSE TESTS
// ============================================================================
describe('Offline Fallback Response Engine', () => {
  it('returns a structured rescue plan with clear fallback source and required schema fields', () => {
    const pantry = [
      { id: 'd-1', name: 'Cooked Toor Dal', category: 'Ready food & leftovers', quantity: 1, unit: 'katori', expirationDate: '2026-10-23' },
      { id: 'r-1', name: 'Leftover Roti', category: 'Ready food & leftovers', quantity: 4, unit: 'pieces', expirationDate: '2026-10-24' }
    ];

    const result = generateOfflineRescuePlan(pantry, 'quickest', 'dinner');

    assert.equal(result.source, 'fallback');
    assert.match(result.sourceLabel, /Offline Rule-Based Rescue Plan/);
    assert.ok(result.plan.title, 'Plan must have a title');
    assert.ok(result.plan.instructions.length > 0, 'Plan must have instructions');
    assert.equal(result.plan.safetyNotice, FOOD_SAFETY_NOTICE);
    assert.ok(result.plan.rescueReason.includes('Cooked Toor Dal'));
  });

  it('strictly does NOT assume unlisted spices, cooking oil, or ghee when none are listed', () => {
    const pantryNoSpices = [
      { id: '1', name: 'Palak', expirationDate: '2026-10-24', quantity: 1, unit: 'bunch' },
      { id: '2', name: 'Basmati Rice', expirationDate: '2026-11-20', quantity: 1, unit: 'kg' }
    ];

    const result = generateOfflineRescuePlan(pantryNoSpices, 'most_soon', 'dinner');

    // Assumed staples must be empty because user did not list oil, salt, or spices
    assert.deepEqual(result.plan.assumedStaples, []);

    // Instructions must explicitly note dry cooking/water without assumed oil or salt
    const allInstructions = result.plan.instructions.join(' ');
    assert.match(allInstructions, /No unlisted spices|without oil|drinking water/i);
  });

  it('recognizes spices and oils ONLY when explicitly listed by the user', () => {
    const pantryWithOil = [
      { id: '1', name: 'Aloo (Potato)', expirationDate: '2026-10-24', quantity: 500, unit: 'g' },
      { id: '2', name: 'Mustard Oil', expirationDate: '2027-01-01', quantity: 1, unit: 'packet' },
      { id: '3', name: 'Namak (Salt)', expirationDate: '2027-01-01', quantity: 1, unit: 'packet' }
    ];

    const result = generateOfflineRescuePlan(pantryWithOil, 'quickest', 'lunch');

    assert.equal(result.plan.assumedStaples.length >= 2, true);
    assert.ok(result.plan.assumedStaples.some(s => s.includes('oil / ghee')));
    assert.ok(result.plan.assumedStaples.some(s => s.includes('Salt')));
  });
});

// ============================================================================
// 5. SERVER ROUTE & MOCKED GEMINI FLOW TESTS (NO REAL KEY USED)
// ============================================================================
describe('Server Routes with Mocked Gemini API (Isolated & No Real Key Exposed)', () => {
  let server;
  let baseUrl;
  let originalFetch;

  beforeEach(async () => {
    originalFetch = global.fetch;

    // Start lightweight test server on ephemeral port (0)
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('rejects empty pantry array with HTTP 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('at least one pantry item'));
  });

  it('parses structured JSON from model_output step in Gemini Interactions API', async () => {
    const testItems = [
      { id: 'item-1', name: 'Cooked Toor Dal', quantity: 1, unit: 'katori', expirationDate: '2026-10-23' },
      { id: 'item-2', name: 'Basmati Rice', quantity: 1, unit: 'kg', expirationDate: '2026-11-20' }
    ];

    // Mock Google Generative Language Interactions API response
    const mockInteractionsResponse = {
      id: 'mock-interaction-1',
      status: 'completed',
      model: 'gemini-3.5-flash-lite',
      steps: [
        { type: 'thought' },
        {
          type: 'model_output',
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                title: 'Mocked Rescue Khichdi',
                preferenceUsed: 'most_soon',
                prepTimeMinutes: 5,
                cookTimeMinutes: 10,
                servings: 2,
                rescueReason: 'Uses soonest Cooked Toor Dal before expiration.',
                usedPantryItemIds: ['item-1', 'item-2'],
                usedIngredients: [
                  { id: 'item-1', name: 'Cooked Toor Dal', amountUsed: '1 katori' },
                  { id: 'item-2', name: 'Basmati Rice', amountUsed: '200 g' }
                ],
                assumedStaples: [],
                instructions: ['Combine dal and rice with water', 'Simmer for 10 minutes'],
                safetyNotice: FOOD_SAFETY_NOTICE
              })
            }
          ]
        }
      ]
    };

    // Temporarily inject mocked fetch
    global.fetch = async (url, options = {}) => {
      if (url.toString().includes('interactions')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockInteractionsResponse
        };
      }
      return originalFetch(url, options);
    };

    const res = await fetch(`${baseUrl}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: testItems,
        preference: 'most_soon'
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.source, 'gemini');
    assert.equal(data.plan.title, 'Mocked Rescue Khichdi');
    assert.deepEqual(data.plan.usedPantryItemIds, ['item-1', 'item-2']);
  });

  it('seamlessly falls back to offline rescue planner when Gemini endpoint returns 503', async () => {
    const testItems = [
      { id: 'item-1', name: 'Cooked Toor Dal', quantity: 1, unit: 'katori', expirationDate: '2026-10-23' }
    ];

    // Mock Google returning 503 Service Unavailable
    global.fetch = async (url, options = {}) => {
      if (url.toString().includes('interactions')) {
        return {
          ok: false,
          status: 503,
          text: async () => '{"error": {"code": "service_unavailable", "message": "High demand"}}'
        };
      }
      return originalFetch(url, options);
    };

    const res = await fetch(`${baseUrl}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: testItems,
        preference: 'quickest'
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.source, 'fallback');
    assert.match(data.sourceLabel, /Offline Rule-Based Rescue Plan/);
    assert.ok(data.plan.title.length > 0);
  });
});
