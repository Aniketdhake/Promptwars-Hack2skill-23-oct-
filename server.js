/**
 * FreshLoop - Transparent Food-Rescue Planner
 * PromptWars 2026 Hackathon
 */

const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security and request size limits
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Food safety constant reminder
const FOOD_SAFETY_NOTICE =
  'Food safety notice: Expiration and best-by dates are guidelines, not absolute guarantees of safety. Always inspect food for signs of spoilage (odor, discoloration, unusual texture, mold) before preparing and consuming.';

/**
 * Health & Configuration Check
 */
app.get('/api/health', (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  res.json({
    status: 'ok',
    appName: 'FreshLoop',
    geminiConfigured: hasKey,
    serverTime: new Date().toISOString(),
    notice: FOOD_SAFETY_NOTICE
  });
});

/**
 * Deterministic / Rule-Based Rescue Planner Fallback
 * Used when Gemini API is unconfigured, offline, or returns an error.
 * Tailored for Indian kitchens without assuming unlisted spices or ingredients.
 */
function generateOfflineRescuePlan(items, preference, mealType) {
  // Sort items by expiration date ascending (soonest first, safely handling invalid dates)
  const sorted = [...items].sort((a, b) => {
    const da = new Date(a.expirationDate).getTime();
    const db = new Date(b.expirationDate).getTime();
    if (isNaN(da) && isNaN(db)) return 0;
    if (isNaN(da)) return 1;
    if (isNaN(db)) return -1;
    return da - db;
  });

  const soonestItems = sorted.slice(0, Math.min(sorted.length, preference === 'quickest' ? 3 : 5));

  // Determine key ingredients and names
  const urgentNames = soonestItems.map(i => i.name.trim());
  const primaryItem = soonestItems[0];
  const secondaryItem = soonestItems[1] || primaryItem;

  const usedPantryItemIds = soonestItems.map(i => i.id);
  const usedIngredients = soonestItems.map(item => {
    const qty = Number(item.quantity) || 1;
    const amountUsed = Math.max(1, Math.round(qty * 0.75 * 10) / 10);
    return {
      id: item.id,
      name: item.name,
      amountUsed: `${amountUsed} ${item.unit || 'portion'}`.trim(),
      expirationDate: item.expirationDate,
      note: 'Inspected for freshness prior to cooking'
    };
  });

  // Check what ingredients and spices the user actually has in their pantry
  const allNamesLower = items.map(i => i.name.toLowerCase()).join(' ');
  const userHasOil = allNamesLower.includes('oil') || allNamesLower.includes('tel') || allNamesLower.includes('ghee') || allNamesLower.includes('butter');
  const userHasSalt = allNamesLower.includes('salt') || allNamesLower.includes('namak');
  const userHasJeera = allNamesLower.includes('jeera') || allNamesLower.includes('cumin');
  const userHasHaldi = allNamesLower.includes('haldi') || allNamesLower.includes('turmeric');

  // ONLY list staples if the user actually listed them in their inventory
  const assumedStaples = [];
  if (userHasOil) assumedStaples.push('Cooking oil / ghee (from your pantry)');
  if (userHasSalt) assumedStaples.push('Salt (from your pantry)');
  if (userHasJeera) assumedStaples.push('Jeera / Cumin (from your pantry)');
  if (userHasHaldi) assumedStaples.push('Haldi / Turmeric (from your pantry)');

  const oilNote = userHasOil ? 'Warm a spoon of oil/ghee from your pantry in a tawa or kadai.' : 'Warm a dry tawa or pan (or use a splash of water for cooking without oil).';
  const saltNote = userHasSalt ? 'Season with a pinch of your pantry salt.' : 'Note: No salt listed in pantry; relying purely on natural ingredient flavors.';

  let title = '';
  let prepMinutes = 10;
  let cookMinutes = 15;
  let instructions = [];

  const urgentLower = urgentNames.map(n => n.toLowerCase()).join(' ');

  // Detect familiar Indian ingredients
  const hasPoha = urgentLower.includes('poha');
  const hasLeftoverDal = urgentLower.includes('cooked dal') || urgentLower.includes('dal (leftover') || urgentLower.includes('leftover dal');
  const hasLeftoverRoti = urgentLower.includes('roti') || urgentLower.includes('chapati');
  const hasRice = urgentLower.includes('rice') || urgentLower.includes('chawal');
  const hasDal = urgentLower.includes('dal') || urgentLower.includes('moong') || urgentLower.includes('toor') || urgentLower.includes('masoor');
  const hasPalak = urgentLower.includes('palak') || urgentLower.includes('spinach');
  const hasPaneer = urgentLower.includes('paneer');
  const hasPotato = urgentLower.includes('potato') || urgentLower.includes('aloo');
  const hasOnion = urgentLower.includes('onion') || urgentLower.includes('pyaz');
  const hasTomato = urgentLower.includes('tomato') || urgentLower.includes('tamatar');
  const hasDahi = urgentLower.includes('dahi') || urgentLower.includes('curd') || urgentLower.includes('yogurt');
  const hasAtta = urgentLower.includes('atta') || urgentLower.includes('flour');

  if (preference === 'quickest') {
    prepMinutes = 5;
    cookMinutes = 10;

    if (hasLeftoverRoti && (hasDahi || hasPaneer || hasLeftoverDal || hasTomato)) {
      title = `Quick Warm Roti Roll with ${primaryItem.name}`;
      instructions = [
        `Check your soon-dated items (${primaryItem.name}, ${secondaryItem.name}) for fresh aroma and texture.`,
        `${oilNote}`,
        `Gently warm the roti on the tawa for 1-2 minutes until soft and pliable.`,
        `Layer your soonest ingredients (${urgentNames.slice(0, 3).join(', ')}) in the center.`,
        `${saltNote}`,
        `Roll tightly and enjoy immediately while warm.`
      ];
    } else if (hasPoha && (hasPotato || hasOnion || hasTomato)) {
      title = `15-Minute Kanda/Batata Poha with ${primaryItem.name}`;
      instructions = [
        `Rinse the poha in drinking water using a colander and set aside to soften.`,
        `Finely chop the soon-dated ${urgentNames.slice(0, 2).join(' and ')}.`,
        `${oilNote} Sauté the vegetables for 4-5 minutes until tender.`,
        `Gently toss the softened poha into the pan with your ingredients.`,
        `${saltNote}`,
        `Cover and steam on low flame for 2 minutes before serving.`
      ];
    } else if (hasLeftoverDal && hasRice) {
      title = `Quick Homestyle Dal-Chawal Warmup`;
      instructions = [
        `Inspect the leftover cooked dal and rice thoroughly before heating.`,
        `Gently reheat the cooked dal in a small pan, adding 2-3 spoons of drinking water if thickened.`,
        `Warm the rice alongside or steam together in a covered pot for 3-4 minutes.`,
        `Pair with any soon-dated ${urgentNames.filter(n => !n.toLowerCase().includes('dal') && !n.toLowerCase().includes('rice')).join(', ') || 'accompaniment'}.`,
        `Serve piping hot.`
      ];
    } else if (hasDahi && hasRice) {
      title = `Quick Comforting Dahi-Chawal (Curd Rice)`;
      instructions = [
        `Verify that the dahi (curd) and rice are fresh and chilled properly.`,
        `In a bowl, gently mix the rice with fresh dahi until creamy.`,
        `${saltNote}`,
        `Garnish with any soon-dated ingredients (${urgentNames.slice(0, 2).join(', ')}).`,
        `Enjoy immediately as a cooling, light meal.`
      ];
    } else {
      title = `Quick Tawa-Rescue Sabzi with ${primaryItem.name}`;
      instructions = [
        `Inspect ${primaryItem.name} and other soon-dated produce (${urgentNames.join(', ')}).`,
        `Chop ingredients into small, uniform pieces for fast cooking.`,
        `${oilNote}`,
        `Add your soon-dated vegetables to the pan, stirring on medium-high heat for 6-8 minutes until tender-crisp.`,
        `${saltNote}`,
        `Serve hot with available staples.`
      ];
    }
  } else {
    // Preference: 'most_soon' (Maximize rescue of urgent Indian kitchen perishables)
    prepMinutes = 10;
    cookMinutes = 20;

    if (hasPalak && (hasPaneer || hasPotato)) {
      const partner = hasPaneer ? 'Paneer' : 'Aloo';
      title = `Homestyle ${partner}-Palak Sabzi with ${urgentNames.slice(0, 2).join(' & ')}`;
      instructions = [
        `Thoroughly wash and inspect the palak (spinach) leaves and ${partner}. Discard any wilted portions.`,
        `Blanch or finely chop the palak. Dice the ${partner} into bite-sized cubes.`,
        `${oilNote}`,
        `Sauté the ${partner} and soon-dated ingredients (${urgentNames.slice(0, 3).join(', ')}) for 5-6 minutes until softened.`,
        `Add the chopped palak and cook for 4-5 minutes until rich and combined.`,
        `${saltNote}`,
        `Serve warm with roti, rice, or as a standalone rescue bowl.`
      ];
    } else if ((hasDal || hasLeftoverDal) && hasRice) {
      title = `One-Pot Nourishing Khichdi with ${urgentNames.slice(0, 2).join(' & ')}`;
      instructions = [
        `Inspect your soon-dated ingredients (${urgentNames.join(', ')}).`,
        `Rinse the dal and rice with drinking water until clean.`,
        `In a pot or pressure cooker, combine dal, rice, and 3 cups of water.`,
        `Add diced ${urgentNames.slice(0, 3).join(', ')} directly into the pot for maximum vegetable rescue.`,
        `${oilNote}`,
        `${saltNote}`,
        `Simmer covered for 15-18 minutes (or 2-3 whistles) until soft, wholesome, and comforting.`
      ];
    } else if (hasAtta && (hasPotato || hasPalak || hasLeftoverDal)) {
      title = `Homestyle Sabzi-Roti Rescue Meal with ${primaryItem.name}`;
      instructions = [
        `Inspect the soon-dated ${urgentNames.join(', ')} for freshness.`,
        `Knead atta with drinking water into a pliable dough. Let rest for 5 minutes.`,
        `${oilNote}`,
        `Prepare your soon-dated filling or sabzi with (${urgentNames.slice(0, 3).join(', ')}), cooking until soft and tender.`,
        `${saltNote}`,
        `Roll out round rotis/parathas and roast on a hot tawa for 1-2 minutes per side until puffed and golden.`,
        `Serve the fresh rotis hot alongside the cooked rescue preparation.`
      ];
    } else if (hasPoha && (hasPotato || hasOnion || hasTomato)) {
      title = `Wholesome Batata-Poha Rescue Plate`;
      instructions = [
        `Inspect and gently rinse the poha in drinking water; set aside in a strainer.`,
        `Dice your soon-dated produce (${urgentNames.join(', ')}).`,
        `${oilNote}`,
        `Sauté the potatoes and vegetables on medium heat for 6-8 minutes until tender throughout.`,
        `Fold in the softened poha gently so the flakes remain intact.`,
        `${saltNote}`,
        `Steam covered on low heat for 3 minutes before enjoying.`
      ];
    } else {
      title = `Hearty Homestyle Kitchen-Rescue Sabzi with ${urgentNames.slice(0, 2).join(' & ')}`;
      instructions = [
        `Inspect your soonest-expiring items (${urgentNames.join(', ')}). Check aroma and texture.`,
        `Chop firmer ingredients (like potatoes/gourds) small, and delicate items (like greens) separately.`,
        `${oilNote}`,
        `Cook the firm vegetables first with a splash of water for 7-8 minutes until tender.`,
        `Add delicate perishables (${urgentNames.slice(0, 2).join(', ')}) during the final 4-5 minutes.`,
        `${saltNote}`,
        `Plate hot. No unlisted spices or ingredients assumed.`
      ];
    }
  }

  const rescueReason = `Prioritizes your soonest-expiring items: ${urgentNames.map(n => `"${n}"`).join(', ')} to ensure they are used in a practical Indian home meal before their listed dates.`;

  return {
    source: 'fallback',
    sourceLabel: 'Offline Rule-Based Rescue Plan (Gemini Unavailable)',
    plan: {
      title,
      preferenceUsed: preference,
      mealType: mealType || 'any',
      prepTimeMinutes: prepMinutes,
      cookTimeMinutes: cookMinutes,
      servings: 2,
      rescueReason,
      usedPantryItemIds,
      usedIngredients,
      assumedStaples,
      instructions,
      safetyNotice: FOOD_SAFETY_NOTICE
    }
  };
}

/**
 * Call Gemini API with Structured JSON Output
 * Tailored for practical Indian households without assuming unlisted ingredients.
 */
async function generateGeminiRescuePlan(items, preference, mealType, apiKey) {
  // Sort items to provide clear context of upcoming dates
  const sorted = [...items].sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));

  const promptItems = sorted.map(item => ({
    id: String(item.id),
    name: String(item.name).trim(),
    quantity: `${item.quantity} ${item.unit || ''}`.trim(),
    category: item.category || 'General',
    expirationDate: item.expirationDate
  }));

  const systemInstruction = `You are FreshLoop's transparent Food-Rescue Planner designed specifically for Indian households. Your core mission is to help people use food before its listed date. You are NOT a generic recipe chatbot.

MANDATORY RULES:
1. Suggest familiar Indian home meals (such as poha, dal-chawal, khichdi, sabzi-roti, tadka dal, paneer bhurji, aloo-palak, roti roll, etc.) ONLY when the user's available pantry ingredients actually support them!
2. CRITICAL INGREDIENT & SPICE POLICY: Do NOT assume spices or other ingredients (such as cooking oil, mustard oil, ghee, butter, salt, turmeric/haldi, jeera/cumin, mustard seeds, garam masala, chillies, etc.) are available unless the user has explicitly listed them in their pantry inventory!
   - If salt, oil, or spices are NOT in the pantry list, do NOT add them. Describe cooking using only the listed items and drinking water (e.g. boiling, gentle steaming, dry-roasting on tawa, or assembling ready items).
   - In "assumedStaples", return ONLY staples the user explicitly has in their pantry list, or an empty list [] if they have none. State clearly that no unlisted spices or oils are assumed.
3. Select ingredients that are expiring soonest, prioritizing items near or past their listed date.
4. User preference is "${preference}":
   - "most_soon": maximize the use of the soonest-expiring perishables (e.g., leftover dal, cooked roti, palak, dahi, vegetables) in one cohesive home meal.
   - "quickest": design a fast, low-effort meal (prep + cook <= 20 minutes) using urgent items.
5. ONLY select items that actually exist in the provided pantry list. Match their exact "id".
6. Provide a short, direct rescueReason explaining which soon-dated items are saved and why.
7. Do NOT make unmeasured claims about money saved, CO2 prevented, or guaranteed safety.
8. Include a clear, honest food safety reminder: dates are quality indicators, so perishables must always be inspected (smell, color, texture) before cooking.`;

  const inputPrompt = `Current pantry items sorted by expiration date:\n${JSON.stringify(promptItems, null, 2)}\n\nUser Meal Preference: ${preference}\nTarget Meal Type: ${mealType || 'any'}\nCreate ONE structured meal plan rescuing the soonest-expiring ingredients.`;

  const responseSchema = {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Name of the rescue dish' },
      preferenceUsed: { type: 'string', description: 'most_soon or quickest' },
      prepTimeMinutes: { type: 'integer', description: 'Estimated prep time in minutes' },
      cookTimeMinutes: { type: 'integer', description: 'Estimated cook time in minutes' },
      servings: { type: 'integer', description: 'Number of servings' },
      rescueReason: {
        type: 'string',
        description: 'Short direct reason explaining which soonest items it rescues'
      },
      usedPantryItemIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of exact pantry item IDs used from the user inventory'
      },
      usedIngredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            amountUsed: { type: 'string' },
            expirationDate: { type: 'string' },
            note: { type: 'string' }
          },
          required: ['id', 'name', 'amountUsed']
        }
      },
      assumedStaples: {
        type: 'array',
        items: { type: 'string' },
        description: 'Common household staples assumed available'
      },
      instructions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Clear step-by-step cooking instructions'
      },
      safetyNotice: {
        type: 'string',
        description: 'Food safety reminder on sensory checks'
      }
    },
    required: [
      'title',
      'prepTimeMinutes',
      'cookTimeMinutes',
      'rescueReason',
      'usedPantryItemIds',
      'usedIngredients',
      'instructions'
    ]
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * Helper to execute one call to the Interactions API
   */
  async function executeInteraction(modelName) {
    const requestBody = {
      model: modelName,
      system_instruction: systemInstruction,
      input: inputPrompt,
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: responseSchema
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/interactions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      console.log(`[FreshLoop] Attempted ${modelName} -> HTTP status ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        const err = new Error(`Interactions API (${modelName}) returned ${response.status}: ${errorText}`);
        err.status = response.status;
        throw err;
      }

      const data = await response.json();
      return { data, model: modelName };
    } catch (err) {
      clearTimeout(timeoutId);
      if (!err.status) {
        console.warn(`[FreshLoop] Attempted ${modelName} -> network/timeout error: ${err.message}`);
      }
      throw err;
    }
  }

  // Execute model attempt using gemini-3.5-flash-lite
  let rawResult = null;

  try {
    // Attempt 1 with gemini-3.5-flash-lite
    rawResult = await executeInteraction('gemini-3.5-flash-lite');
  } catch (err1) {
    const status1 = err1.status;

    // Do NOT retry on client/auth/not-found errors (400, 401, 403, 404)
    if ([400, 401, 403, 404].includes(status1)) {
      console.warn(`[FreshLoop] gemini-3.5-flash-lite returned HTTP ${status1}. Client/Auth error - no retry attempted.`);
      throw err1;
    }

    if (status1 === 503) {
      console.log('[FreshLoop] gemini-3.5-flash-lite returned HTTP 503 (service_unavailable). Retrying once after about 1 second...');
      await sleep(1000);

      try {
        // Attempt 2 (Retry once after short delay)
        rawResult = await executeInteraction('gemini-3.5-flash-lite');
      } catch (err2) {
        console.warn(`[FreshLoop] gemini-3.5-flash-lite retry failed (HTTP ${err2.status || 'error'}). Engaging labelled offline rescue planner.`);
        throw err2;
      }
    } else {
      console.warn(`[FreshLoop] gemini-3.5-flash-lite failed with error: ${err1.message}. Engaging labelled offline rescue planner.`);
      throw err1;
    }
  }

  const { data, model: activeModel } = rawResult;

  // Adapt response parsing to the Interactions API: read text from model_output step
  let outputText = '';
  const modelOutputStep = (data.steps || []).find(s => s.type === 'model_output');
  if (modelOutputStep) {
    if (Array.isArray(modelOutputStep.content)) {
      outputText = modelOutputStep.content
        .map(part => (typeof part === 'string' ? part : part?.text || ''))
        .join('');
    } else if (typeof modelOutputStep.content === 'string') {
      outputText = modelOutputStep.content;
    } else if (modelOutputStep.content?.text) {
      outputText = modelOutputStep.content.text;
    } else if (modelOutputStep.text) {
      outputText = modelOutputStep.text;
    }
  }

  // Fallback search across steps if not found above
  if (!outputText && Array.isArray(data.steps)) {
    for (const step of data.steps) {
      if (Array.isArray(step.content)) {
        outputText = step.content.map(p => p?.text || '').join('');
        if (outputText) break;
      }
    }
  }

  if (!outputText) {
    throw new Error(`No model_output text found in Interactions API response from ${activeModel}.`);
  }

  const parsedPlan = JSON.parse(outputText);

  // Verify that all usedPantryItemIds actually exist in the user's pantry
  const pantryIdSet = new Set(items.map(i => String(i.id)));
  const verifiedUsedIds = (parsedPlan.usedPantryItemIds || [])
    .map(String)
    .filter(id => pantryIdSet.has(id));

  // If IDs didn't match, attempt matching by item name
  if (verifiedUsedIds.length === 0) {
    for (const usedIng of parsedPlan.usedIngredients || []) {
      const matchedItem = items.find(
        i => i.name.toLowerCase().trim() === (usedIng.name || '').toLowerCase().trim()
      );
      if (matchedItem && !verifiedUsedIds.includes(String(matchedItem.id))) {
        verifiedUsedIds.push(String(matchedItem.id));
        usedIng.id = String(matchedItem.id);
      }
    }
  }

  parsedPlan.usedPantryItemIds = verifiedUsedIds;
  parsedPlan.safetyNotice = parsedPlan.safetyNotice || FOOD_SAFETY_NOTICE;

  console.log(`[FreshLoop] Successfully produced AI meal plan using model ${activeModel}.`);

  return {
    source: 'gemini',
    sourceLabel: `Gemini (${activeModel}) Rescue Plan`,
    plan: parsedPlan
  };
}

/**
 * POST /api/plan
 * Generates a meal plan using soonest-expiring ingredients
 */
app.post('/api/plan', async (req, res) => {
  try {
    const { items, preference = 'most_soon', mealType = 'any' } = req.body;

    // Validation
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Please provide at least one pantry item to generate a rescue plan.'
      });
    }

    if (items.length > 100) {
      return res.status(400).json({
        error: 'Pantry item limit exceeded. Maximum 100 items per request.'
      });
    }

    // Sanitize item objects
    const sanitizedItems = items.map((it, idx) => ({
      id: String(it.id || `item-${idx}`),
      name: String(it.name || 'Unnamed ingredient').slice(0, 100),
      quantity: Number(it.quantity) || 1,
      unit: String(it.unit || 'units').slice(0, 30),
      category: String(it.category || 'Other').slice(0, 50),
      expirationDate: String(it.expirationDate || new Date().toISOString().slice(0, 10))
    }));

    const validPref = ['most_soon', 'quickest'].includes(preference) ? preference : 'most_soon';
    const validMealType = ['any', 'breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)
      ? mealType
      : 'any';

    const apiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');

    if (apiKey) {
      try {
        const geminiResult = await generateGeminiRescuePlan(
          sanitizedItems,
          validPref,
          validMealType,
          apiKey
        );
        return res.json(geminiResult);
      } catch (geminiError) {
        console.warn('[FreshLoop] Gemini call failed, engaging offline rescue planner:', geminiError.message);
        const fallbackResult = generateOfflineRescuePlan(sanitizedItems, validPref, validMealType);
        fallbackResult.fallbackReason = `Gemini call failed (${geminiError.message}). Seamlessly switched to offline food-rescue engine.`;
        return res.json(fallbackResult);
      }
    } else {
      // No API key configured: cleanly return labeled offline fallback
      const fallbackResult = generateOfflineRescuePlan(sanitizedItems, validPref, validMealType);
      fallbackResult.fallbackReason =
        'No GEMINI_API_KEY detected in .env. Showing transparent offline rule-based rescue plan.';
      return res.json(fallbackResult);
    }
  } catch (err) {
    console.error('[FreshLoop] Unexpected error in /api/plan:', err);
    res.status(500).json({
      error: 'An unexpected error occurred while generating the rescue plan.',
      details: err.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(` FreshLoop Server Running`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(` Gemini Key: ${process.env.GEMINI_API_KEY ? 'Configured' : 'Offline / Fallback Mode'}`);
  console.log(`=================================================`);
});
