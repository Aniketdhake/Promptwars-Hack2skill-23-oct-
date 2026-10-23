# FreshLoop 🍲

> **PromptWars 2026 Hackathon Entry**  
> A transparent food-rescue planner that helps people cook food before its listed date.

---

## 🌿 Overview & Philosophy

FreshLoop is **not a generic recipe chatbot**. It is an intentional, transparent food-rescue assistant engineered to address household food waste by focusing directly on dates, urgency, and verified action.

### Honest Tracking Principles
- **No Unmeasured Claims:** FreshLoop does not invent estimated dollar savings, fictitious CO₂ reductions, or unverified safety guarantees.
- **Action-Gated Confirmation:** Pantry items and rescued counts are **only** logged and deducted when the user clicks **"Confirm Meal Made"** after actually cooking the meal.
- **Food Safety Awareness:** Expiration and best-by dates are quality indicators, not definitive safety guarantees. FreshLoop reminds users to always inspect smell, texture, color, and appearance before cooking.
- **Transparent Fallback:** When the Gemini API is offline, rate-limited, or unconfigured, FreshLoop clearly identifies its offline rule-based rescue plan so users always know the source of their recipe.

---

## ✨ Core Features

1. **Pantry Inventory with Urgency Sorting:**
   - Track items with quantity, unit, category, and expiration/best-by dates.
   - Dynamic urgency badges:
     - 🔴 **Past listed date** (Inspect carefully)
     - 🟠 **Expires today / &le; 2 days** (Urgent rescue)
     - 🟡 **3–5 days left** (Upcoming)
     - 🟢 **6+ days left** (Safe)
   - Real-time search and sorting (Soonest Expiring, Latest, Category, A–Z).
   - Instant sample pantry loader for rapid testing and demonstrations.

2. **Indian Household Practicality & Familiar Options:**
   - **Tailored Everyday Categories:**
     - 🌾 **Grains & staples**: rice, atta, poha, suji
     - 🥣 **Dal & pulses**: toor dal, moong dal, masoor dal, chana
     - 🥔 **Vegetables / sabzi ingredients**: potato, onion, tomato, bhindi, spinach
     - 🥛 **Dairy**: milk, dahi, paneer
     - 🍲 **Ready food & leftovers**: roti, cooked dal, cooked sabzi
     - 📦 **Other / Custom**: custom category input supported
   - **Familiar Kitchen Units**: `kg`, `g`, `packet`, `pieces`, `bunch`, `katori / cup`, `litres / ml`, or custom.
   - **No Unlisted Ingredients Assumed**: FreshLoop never assumes spices, oils, or ghee are available unless the user explicitly listed them in the pantry!
   - **Familiar Indian Meal Options**: Recommends authentic dishes such as *poha*, *dal-chawal*, *khichdi*, *palak-paneer*, or *sabzi-roti* only when available ingredients support them.

3. **Targeted Rescue Meal Planner:**
   - **Preference Toggle:**
     - 🎯 **Use Most Soon-Dated Items**: Maximizes the number of soonest-expiring items rescued in one cohesive dish.
     - ⚡ **Quickest Meal**: Focuses on rapid prep and cook time (&le; 20 minutes) using urgent ingredients.
   - **Structured Gemini Integration**:
     - Uses Google Gemini API with strict structured JSON schemas (`responseMimeType: "application/json"`).
     - Validates that returned ingredient IDs strictly match existing pantry inventory.
     - Transparently labeled source pill indicating whether the plan was crafted by Gemini or the offline rule-based engine.

3. **Confirmed Impact & Rescue Log:**
   - Tracks **Confirmed Meals Cooked** and **Confirmed Ingredients Rescued**.
   - Maintains an auditable chronological log of verified recipes made.

4. **Warm Kitchen Visual Design:**
   - Built with a warm, distinctive kitchen palette: deep forest green, citrus lime, soft apricot, and warm parchment tones.
   - Expressive serif display typography with clean, accessible sans-serif UI elements.
   - **Zero external fonts or CDN assets** for maximum privacy, speed, and offline resilience.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher (Tested on Node v24.22.1)
- **PowerShell** (Windows) or terminal (macOS/Linux)

---

### 1. Configure Environment Variables (Optional)

FreshLoop includes a `.env.example` file. Create a `.env` file to add your Gemini API key:

```powershell
Copy-Item .env.example .env
```

Open `.env` and add your Google Gemini API key:
```env
GEMINI_API_KEY=AIzaSy...your_actual_key_here
PORT=3000
```

> **Note:** If `GEMINI_API_KEY` is omitted or empty, FreshLoop automatically activates its **Offline Rule-Based Rescue Planner**, fully preserving functionality without breaking!

---

### 2. Install Dependencies

In PowerShell, run:
```powershell
npm.cmd install
```
*(On non-Windows systems, run `npm install`)*

---

### 3. Start FreshLoop

Run the following exact command in PowerShell:

```powershell
npm.cmd start
```

Or run Node directly:
```powershell
node server.js
```

---

### 4. Open the App

Navigate to:
```
http://localhost:3000
```

---

## 🧪 Testing the Workflow

1. Click **"🌱 Load Sample Pantry"** in the top bar to populate realistic perishables (Baby Spinach, Greek Yogurt, Sourdough Bread, Eggs, etc.).
2. Choose your rescue preference:
   - Select **"Use Most Soon-Dated Items"** or **"Quickest Meal"**.
3. Click **"✨ Generate Rescue Plan"**.
4. Observe the structured recipe:
   - Notice the **Source Badge** (e.g., `✦ Gemini Rescue Plan` or `⚙ Offline Rule-Based Plan`).
   - Read the **Why this meal was chosen** callout highlighting the soonest-expiring ingredients.
   - Inspect the cross-checked pantry ingredient list and step-by-step instructions.
5. Click **"🍳 Confirm Meal Made & Deduct Items"**:
   - The used items will be deducted from your pantry inventory.
   - The verified count of **Confirmed Meals Cooked** and **Ingredients Rescued** increments in the impact section.
   - A new record appears in your **Confirmed Cooking History**.

---

## 🔒 Food Safety & Privacy

- **Input validation & Request Limits:** Backend uses `express.json({ limit: '50kb' })` and enforces a 15-second AbortController timeout.
- **Key Safety:** `GEMINI_API_KEY` is loaded strictly on the server and is never exposed to browser client code. `.env` is ignored by `.gitignore`.
- **Food Safety Notice:** *Expiration and best-by dates reflect quality estimates, not absolute guarantees of safety. Users should always inspect food for unusual odor, texture, discoloration, or mold before cooking.*
