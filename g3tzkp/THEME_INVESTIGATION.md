# Theme Switching Investigation

## Problem
User reports themes don't visually update when selected in Settings.

## Root Cause Analysis

### Issue 1: Hardcoded CSS in index.css
```css
body {
  background-color: #010401;  /* HARDCODED */
  color: #00f3ff;             /* HARDCODED */
}
```

**Fix Applied**: Changed to use CSS variables:
```css
body {
  background-color: var(--color-background, #010401);
  color: var(--color-text, #00f3ff);
}
```

### Issue 2: Hardcoded Tailwind Classes in Components
App.tsx has 38+ instances of hardcoded color classes like:
- `bg-black`
- `bg-[#000000]`
- `text-[#00f3ff]`
- `text-cyan-400`

**Problem**: These Tailwind classes override CSS variables and don't respond to theme changes.

**Solution Options**:
1. ✅ **Immediate**: Keep hardcoded classes but ensure CSS variables work for major elements
2. ❌ **Long-term**: Refactor all components to use CSS variable classes (massive effort)

### Issue 3: Theme Application Timing
`themeStore.ts` applies theme on load:
```typescript
if (typeof window !== 'undefined') {
  useThemeStore.getState().applyTheme();
}
```

**Verification Needed**:
- Check if `applyTheme()` is called when theme changes in Settings
- Verify CSS custom properties are set in DevTools
- Check if Tailwind's hardcoded classes are the bottleneck

## Current Implementation

### themeStore.ts - Theme Definitions
```typescript
const themes = {
  g3tzkp: { primary: '#00f3ff', secondary: '#4caf50', background: '#000000' },
  'tensor-blue': { primary: '#1e90ff', secondary: '#00ced1', background: '#000428' },
  multivectoral: { primary: '#8a2be2', secondary: '#00bfff', background: '#0a0a12' }
};
```

### applyTheme() Function
```typescript
applyTheme: (themeId) => {
  const theme = themes[themeId];
  const root = document.documentElement;
  
  // Set CSS custom properties
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });
  
  // Set body styles directly
  document.body.style.backgroundColor = theme.colors.background;
  document.body.style.color = theme.colors.text;
  
  // Set #root element
  const appElement = document.getElementById('root');
  if (appElement) {
    appElement.style.backgroundColor = theme.colors.background;
    appElement.style.color = theme.colors.text;
  }
}
```

## Testing Steps for User

1. Open browser DevTools (F12)
2. Go to Settings → Appearance
3. Click different theme buttons
4. Check Console for: `[Theme] Applied theme: [name]` with colors object
5. Inspect Elements tab → Check:
   - `document.documentElement` should have CSS vars: `--color-primary`, `--color-background`, etc.
   - `body` element should have inline `style="background-color: ..."` changing
   - `#root` element should have inline style changing
6. **If variables are set but colors don't change**: Hardcoded Tailwind classes are overriding

## Next Steps if Still Broken

### Option A: Force Theme Application to All Major Containers
Add theme classes to main containers in App.tsx:
```typescript
<div 
  className="main-container" 
  style={{
    backgroundColor: currentTheme.colors.background,
    color: currentTheme.colors.text
  }}
>
```

### Option B: Create Theme-Aware Tailwind Utilities
Generate dynamic Tailwind classes that read from CSS variables.

### Option C: Aggressive Inline Styling
Apply inline styles to every major component based on theme state.

## Recommendation
**Test with DevTools first** to confirm CSS variables are being set. If they are, the issue is Tailwind overrides. If they aren't being set, the issue is in `applyTheme()` logic or Settings modal not calling `setTheme()`.
