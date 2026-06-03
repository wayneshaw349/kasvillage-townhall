const fs = require('fs');
const f = 'Workspace.tsx';
let s = fs.readFileSync(f, 'utf8');
let changes = 0;

// Add auto-save useEffect after the loadConfig useEffect
const afterLoadConfig = "console.log('[Workspace] Loaded config for', hostId);\n      } catch (e) { console.warn('[Workspace] Config load failed:', e); }\n    };\n    loadConfig();\n  }, []);";

if (s.includes(afterLoadConfig) && !s.includes('Auto-save config')) {
  const autoSave = `console.log('[Workspace] Loaded config for', hostId);
      } catch (e) { console.warn('[Workspace] Config load failed:', e); }
    };
    loadConfig();
  }, []);

  // Auto-save config to SecureStore on changes (persists across sessions)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const cfg = {
          brandName, storeDescription, storeCategory, logoUrl, logoShape,
          bannerStyle, bannerRecipe, coupons, socialLinks, commChannels,
          selectedFont: { id: selectedFont.id, name: selectedFont.name },
          selectedLayout: { id: selectedLayout.id, name: selectedLayout.name },
          stash,
          hostId, updatedAt: Date.now(),
        };
        await SecureStore.setItemAsync('storefront_' + hostId, JSON.stringify(cfg));
      } catch {}
    }, 1000); // debounce 1s
    return () => clearTimeout(timer);
  }, [brandName, storeDescription, storeCategory, logoUrl, logoShape, bannerStyle, bannerRecipe, coupons, socialLinks, commChannels, selectedFont, selectedLayout, stash]);`;

  s = s.replace(afterLoadConfig, autoSave);
  changes++;
  console.log('1: Added auto-save useEffect');
}

fs.writeFileSync(f, s);
console.log('Total:', changes);
