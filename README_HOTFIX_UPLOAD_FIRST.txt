Night Wardens Visual Hotfix v2

This package fixes the plain/unstyled page problem and the blank storefront problem.

UPLOAD INSTRUCTIONS:
1. Upload EVERYTHING in this zip to the root of your GitHub Pages repo.
2. Do not upload only the HTML files. The assets folder must upload too.
3. After GitHub finishes deploying, open:
   https://nightwardens.github.io/NightWardensCharacterSheet/storefront.html?v=hotfix-2
4. On your phone, use the browser menu and reload/refresh once.

WHAT WAS FIXED:
- Storefront now has inline emergency CSS, so it will not appear as plain black text on white even if CSS cache is stale.
- Storefront now includes static fallback product cards, so products appear even if Firebase or JavaScript fails.
- Store script now understands both squareUrl and squareLink.
- Store script now understands both coverUrl and coverImageUrl.
- Store script now understands Firestore documents with type instead of category.
- Service worker now clears old caches instead of serving stale files.

IMPORTANT:
If it still looks old, it is almost certainly browser/GitHub cache. Visit with ?v=hotfix-2 at the end.
