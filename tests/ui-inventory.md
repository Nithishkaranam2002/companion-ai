# UI inventory

Every clickable or editable element on the live site, by page and account state, as found by the
audit crawler (`tests/e2e/audit.spec.ts`). Items under "›" live inside a menu or dialog opened by the
element before them. "Header/footer" items are shared by every page using that layout.

## `/`

| Element | Type | States | Does |
|---|---|---|---|
| page layout | layout | logged-out, demo, user, admin | fits the screen (no sideways scroll) |
| link "Skip to content" | button | logged-out, demo, user, admin | navigates → / |
| link "CompanionAI home" | link | logged-out, demo, user, admin | → / |
| link "How it works" | link | logged-out, demo, user, admin | → /#how-it-works |
| link "Safety" | link | logged-out, demo, user, admin | → /safety |
| link "Pricing" | link | logged-out, demo, user, admin | → /pricing |
| link "About" | link | logged-out, demo, user, admin | → /about |
| button "Change color theme" | button | logged-out, demo, user, admin | opens menu |
| button "Change color theme" › menuitemradio "Light" | button | logged-out, demo, user, admin | acts and closes its menu/dialog |
| button "Change color theme" › menuitemradio "Dark" | button | logged-out, demo, user, admin | acts and closes its menu/dialog |
| button "Change color theme" › menuitemradio "System" | button | logged-out, demo, user, admin | acts and closes its menu/dialog |
| link "Sign in" | link | logged-out | → /login |
| button "Try the demo" | button | logged-out | updates the page; navigates → /chat |
| link "988" | tel link | logged-out, demo, user, admin | tel:988 |
| button "Try it free — no sign-up" | button | logged-out, demo, user, admin | navigates → /chat |
| link "Create a free account" | link | logged-out, demo, user, admin | → /login; → /chat |
| link "See the full results" | link | logged-out, demo, user, admin | → /safety |
| link "How we keep you safe" | link | logged-out, demo, user, admin | → /safety |
| link "Call 988" | tel link | logged-out, demo, user, admin | tel:988 |
| link "Find a helpline worldwide" | external link | logged-out, demo, user, admin | new tab → https://findahelpline.com/ |
| button "Is CompanionAI a therapist or a medical service?" | button | logged-out, demo, user, admin | updates (aria-expanded=true data-state=open) |
| button "What happens if I mention self-harm or an emergency?" | button | logged-out, demo, user, admin | updates (aria-expanded=true data-state=open) |
| button "Where do the answers come from?" | button | logged-out, demo, user, admin | updates (aria-expanded=true data-state=open) |
| button "Do I need an account?" | button | logged-out, demo, user, admin | updates (aria-expanded=true data-state=open) |
| button "How is my data protected?" | button | logged-out, demo, user, admin | updates (aria-expanded=true data-state=open) |
| button "Is it free?" | button | logged-out, demo, user, admin | updates (aria-expanded=true data-state=open) |
| button "Start the demo" | button | logged-out, demo, user, admin | navigates → /chat |
| link "Chat" | link | logged-out, demo, user, admin | → /login?next=%2Fchat; → /chat |
| link "Mood tracker" | link | logged-out, demo, user, admin | → /login?next=%2Fmood; → /mood |
| link "Contact" | link | logged-out, demo, user, admin | → /contact |
| link "Privacy policy" | link | logged-out, demo, user, admin | → /privacy |
| link "Terms of service" | link | logged-out, demo, user, admin | → /terms |
| button "Open menu" | button | logged-out, demo, user, admin | opens dialog |
| button "Open menu" › link "How it works" | link | logged-out, demo, user, admin | → /#how-it-works |
| button "Open menu" › link "Safety" | link | logged-out, demo, user, admin | → /safety |
| button "Open menu" › link "Pricing" | link | logged-out, demo, user, admin | → /pricing |
| button "Open menu" › link "About" | link | logged-out, demo, user, admin | → /about |
| button "Open menu" › link "Sign in" | link | logged-out | → /login |
| button "Open menu" › button "Try the demo" | button | logged-out | navigates → /chat |
| button "Open menu" › button "Close" | button | logged-out, demo, user, admin | updates the page; acts and closes its menu/dialog |
| link "Open app" | link | demo, user, admin | → /chat |
| button "Open menu" › link "Open app" | link | demo, user, admin | → /chat |

## `/about`

| Element | Type | States | Does |
|---|---|---|---|
| page layout | layout | logged-out | fits the screen (no sideways scroll) |
| link "safety page" | link | logged-out | → /safety |
| link "Create a free account" | link | logged-out | → /login |
| link "Contact us" | link | logged-out | → /contact |

## `/admin`

| Element | Type | States | Does |
|---|---|---|---|
| page layout | layout | demo, user, admin | fits the screen (no sideways scroll) |
| link "Back to chat" | link | demo, user | → /chat |
| button "Refresh" | button | admin | updates the page |
| tab "Open (2)" | button | admin | moves focus to "radix-_r_0_-trigger-open"; moves focus to "radix-_r_4_-trigger-open" |
| tab "Resolved (1)" | button | admin | moves focus to "radix-_r_4_-trigger-resolved"; moves focus to "radix-_r_0_-trigger-resolved" |
| tab "Contact (1)" | button | admin | moves focus to "radix-_r_4_-trigger-contact"; moves focus to "radix-_r_0_-trigger-contact" |
| button "Mark resolved" | button | admin | updates the page |

## `/auth/error`

| Element | Type | States | Does |
|---|---|---|---|
| page layout | layout | logged-out | fits the screen (no sideways scroll) |
| link "CompanionAI home" | link | logged-out | → / |
| link "Back to sign in" | link | logged-out | → /login |

## `/chat`

| Element | Type | States | Does |
|---|---|---|---|
| page layout | layout | demo, user, admin | fits the screen (no sideways scroll) |
| link "CompanionAI home" | link | demo, user, admin | → / |
| link "Chat" | link | demo, user, admin | → /chat |
| link "Mood" | link | demo, user, admin | → /mood |
| button "Change color theme" | button | demo, user, admin | opens menu |
| button "Change color theme" › menuitemradio "Light" | button | demo, user, admin | acts and closes its menu/dialog |
| button "Change color theme" › menuitemradio "Dark" | button | demo, user, admin | acts and closes its menu/dialog |
| button "Change color theme" › menuitemradio "System" | button | demo, user, admin | acts and closes its menu/dialog |
| button "Account menu" | button | demo, user, admin | opens menu |
| button "Account menu" › menuitem "Chat" | link | demo, user, admin | → /chat |
| button "Account menu" › menuitem "Mood tracker" | link | demo, user, admin | → /mood |
| button "Account menu" › menuitem "Create a free account" | link | demo | → /login |
| button "Account menu" › menuitem "End demo" | button | demo | navigates → / |
| button "New chat" | button | demo, user, admin | moves focus to "chat-input" |
| button "How can I sleep better?" | button | demo, user, admin | navigates → /chat/aaaaaaaa-1111-4111-8111-111111111111 |
| button "Options for conversation: How can I sleep better?" | button | demo, user, admin | opens menu |
| button "Options for conversation: How can I sleep better?" › menuitem "Rename" | button | demo, user, admin | updates the page |
| button "Options for conversation: How can I sleep better?" › menuitem "Delete" | button | demo, user, admin | updates the page |
| button "Feeling overwhelmed tonight" | button | demo, user, admin | navigates → /chat/bbbbbbbb-2222-4222-8222-222222222222 |
| button "Options for conversation: Feeling overwhelmed tonight" | button | demo, user, admin | opens menu |
| button "Options for conversation: Feeling overwhelmed tonight" › menuitem "Rename" | button | demo, user, admin | updates the page |
| button "Options for conversation: Feeling overwhelmed tonight" › menuitem "Delete" | button | demo, user, admin | updates the page |
| link "Create a free account" | link | demo | → /login |
| button "I can't switch off at night. Any ideas?" | button | demo, user, admin | navigates → /chat/cccccccc-3333-4333-8333-333333333333 |
| button "Work has been really stressful lately." | button | demo, user, admin | navigates → /chat/cccccccc-3333-4333-8333-333333333333 |
| button "I feel a bit lonely since moving." | button | demo, user, admin | navigates → /chat/cccccccc-3333-4333-8333-333333333333 |
| button "How do I start journaling?" | button | demo, user, admin | navigates → /chat/cccccccc-3333-4333-8333-333333333333 |
| textarea "Message CompanionAI" | field | demo, user, admin | accepts typing |
| button "Send message" | button | demo, user, admin | disabled here (by design) |
| button "Open conversations" | button | demo, user, admin | opens dialog |
| button "Open conversations" › button "New chat" | button | demo, user, admin | acts and closes its menu/dialog |
| button "Open conversations" › button "How can I sleep better?" | button | demo, user, admin | navigates → /chat/aaaaaaaa-1111-4111-8111-111111111111 |
| button "Open conversations" › button "Options for conversation: How can I sleep better?" | button | demo, user, admin | opens menu |
| button "Open conversations" › button "Options for conversation: How can I sleep better?" › menuitem "Rename" | button | demo, user, admin | updates the page |
| button "Open conversations" › button "Options for conversation: How can I sleep better?" › menuitem "Delete" | button | demo, user, admin | updates the page |
| button "Open conversations" › button "Feeling overwhelmed tonight" | button | demo, user, admin | navigates → /chat/bbbbbbbb-2222-4222-8222-222222222222 |
| button "Open conversations" › button "Options for conversation: Feeling overwhelmed tonight" | button | demo, user, admin | opens menu |
| button "Open conversations" › button "Options for conversation: Feeling overwhelmed tonight" › menuitem "Rename" | button | demo, user, admin | updates the page |
| button "Open conversations" › button "Options for conversation: Feeling overwhelmed tonight" › menuitem "Delete" | button | demo, user, admin | updates the page |
| button "Open conversations" › button "Close" | button | demo, user, admin | acts and closes its menu/dialog; updates the page |
| button "Account menu" › menuitem "Sign out" | button | user, admin | navigates → / |
| link "Admin" | link | admin | → /admin |
| button "Account menu" › menuitem "Admin" | link | admin | → /admin |

## `/chat/aaaaaaaa-1111-4111-8111-111111111111`

| Element | Type | States | Does |
|---|---|---|---|
| page layout | layout | demo, user, admin | fits the screen (no sideways scroll) |
| button "New chat" | button | demo, user, admin | navigates → /chat |
| button "How can I sleep better?" | button | demo, user, admin | moves focus to "chat-input" |
| button "Options for conversation: How can I sleep better?" | button | demo, user, admin | opens menu |
| button "Options for conversation: How can I sleep better?" › menuitem "Rename" | button | demo, user, admin | updates the page |
| button "Options for conversation: How can I sleep better?" › menuitem "Delete" | button | demo, user, admin | updates the page |
| button "Feeling overwhelmed tonight" | button | demo, user, admin | navigates → /chat/bbbbbbbb-2222-4222-8222-222222222222 |
| button "Options for conversation: Feeling overwhelmed tonight" | button | demo, user, admin | opens menu |
| button "Options for conversation: Feeling overwhelmed tonight" › menuitem "Rename" | button | demo, user, admin | updates the page |
| button "Options for conversation: Feeling overwhelmed tonight" › menuitem "Delete" | button | demo, user, admin | updates the page |
| link "Create a free account" | link | demo | → /login |
| link "Source 1: Sleep Hygiene Basics (opens in a new tab)" | external link | demo, user, admin | new tab → https://www.cdc.gov/sleep/about/index.html |
| link "Source 2: Breathing Exercises for Stress (opens in a new tab)" | external link | demo, user, admin | new tab → https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/ |
| link "[1] Sleep Hygiene Basics cdc.gov (opens in a new tab)" | external link | demo, user, admin | new tab → https://www.cdc.gov/sleep/about/index.html |
| link "[2] Breathing Exercises for Stress nhs.uk (opens in a new tab)" | external link | demo, user, admin | new tab → https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/ |
| textarea "Message CompanionAI" | field | demo, user, admin | accepts typing |
| button "Send message" | button | demo, user, admin | disabled here (by design) |

## `/chat/bbbbbbbb-2222-4222-8222-222222222222`

| Element | Type | States | Does |
|---|---|---|---|
| page layout | layout | demo, user, admin | fits the screen (no sideways scroll) |
| button "New chat" | button | demo, user, admin | navigates → /chat |
| button "How can I sleep better?" | button | demo, user, admin | navigates → /chat/aaaaaaaa-1111-4111-8111-111111111111 |
| button "Options for conversation: How can I sleep better?" | button | demo, user, admin | opens menu |
| button "Options for conversation: How can I sleep better?" › menuitem "Rename" | button | demo, user, admin | updates the page |
| button "Options for conversation: How can I sleep better?" › menuitem "Delete" | button | demo, user, admin | updates the page |
| button "Feeling overwhelmed tonight" | button | demo, user, admin | moves focus to "chat-input" |
| button "Options for conversation: Feeling overwhelmed tonight" | button | demo, user, admin | opens menu |
| button "Options for conversation: Feeling overwhelmed tonight" › menuitem "Rename" | button | demo, user, admin | updates the page |
| button "Options for conversation: Feeling overwhelmed tonight" › menuitem "Delete" | button | demo, user, admin | updates the page |
| link "Call 988" | tel link | demo, user, admin | tel:988 |
| link "Text 988" | sms link | demo, user, admin | sms:988 |
| link "Chat online" | external link | demo, user, admin | new tab → https://988lifeline.org/chat/ |
| link "Outside the US" | external link | demo, user, admin | new tab → https://findahelpline.com/ |
| button "Hide crisis resources" | button | demo, user, admin | updates the page |
| link "Create a free account" | link | demo | → /login |
| textarea "Message CompanionAI" | field | demo, user, admin | accepts typing |
| button "Send message" | button | demo, user, admin | disabled here (by design) |

## `/contact`

| Element | Type | States | Does |
|---|---|---|---|
| page layout | layout | logged-out | fits the screen (no sideways scroll) |
| link "988" | tel link | logged-out | tel:988 |
| input "Name" | field | logged-out | accepts typing |
| input "Email" | field | logged-out | accepts typing |
| select "Topic" | select | logged-out | changes value (general → pro) |
| textarea "Message" | field | logged-out | accepts typing |
| button "Send message" | submit | logged-out | blocked until required fields are filled (browser shows which) |

## `/login`

| Element | Type | States | Does |
|---|---|---|---|
| page layout | layout | logged-out, demo | fits the screen (no sideways scroll) |
| link "CompanionAI home" | link | logged-out, demo | → / |
| input "Email address" | field | logged-out, demo | accepts typing |
| button "Email me a sign-in link" | submit | logged-out, demo | blocked until required fields are filled (browser shows which) |
| button "Try the 10-message demo" | button | logged-out, demo | navigates → /chat; updates the page |
| link "Terms" | link | logged-out, demo | → /terms |
| link "Privacy policy" | link | logged-out, demo | → /privacy |
| link "988" | tel link | logged-out, demo | tel:988 |

## `/mood`

| Element | Type | States | Does |
|---|---|---|---|
| page layout | layout | demo, user, admin | fits the screen (no sideways scroll) |
| link "Create a free account" | link | demo | → /login?next=/mood |
| slider "Mood, 1 to 10" | slider | user, admin | arrow keys move it (6 → 7) |
| textarea "Note (optional)" | field | user, admin | accepts typing |
| button "Save check-in" | button | user, admin | updates the page |
| radio "30 days" | button | user, admin | moves focus to "button" |
| radio "90 days" | button | user, admin | updates (aria-checked=true data-state=on) |

## `/no-such-page`

| Element | Type | States | Does |
|---|---|---|---|
| page layout | layout | logged-out | fits the screen (no sideways scroll) |
| link "Skip to content" | button | logged-out | navigates → /no-such-page |
| link "CompanionAI home" | link | logged-out | → / |
| link "How it works" | link | logged-out | → /#how-it-works |
| link "Safety" | link | logged-out | → /safety |
| link "Pricing" | link | logged-out | → /pricing |
| link "About" | link | logged-out | → /about |
| button "Change color theme" | button | logged-out | opens menu |
| button "Change color theme" › menuitemradio "Light" | button | logged-out | acts and closes its menu/dialog |
| button "Change color theme" › menuitemradio "Dark" | button | logged-out | acts and closes its menu/dialog |
| button "Change color theme" › menuitemradio "System" | button | logged-out | acts and closes its menu/dialog |
| link "Sign in" | link | logged-out | → /login |
| button "Try the demo" | button | logged-out | navigates → /chat; updates the page |
| link "Back home" | link | logged-out | → / |
| link "Contact us" | link | logged-out | → /contact |
| link "988" | tel link | logged-out | tel:988 |
| link "Chat" | link | logged-out | → /login?next=%2Fchat |
| link "Mood tracker" | link | logged-out | → /login?next=%2Fmood |
| link "How we keep you safe" | link | logged-out | → /safety |
| link "Contact" | link | logged-out | → /contact |
| link "Privacy policy" | link | logged-out | → /privacy |
| link "Terms of service" | link | logged-out | → /terms |
| button "Open menu" | button | logged-out | opens dialog |
| button "Open menu" › link "How it works" | link | logged-out | → /#how-it-works |
| button "Open menu" › link "Safety" | link | logged-out | → /safety |
| button "Open menu" › link "Pricing" | link | logged-out | → /pricing |
| button "Open menu" › link "About" | link | logged-out | → /about |
| button "Open menu" › link "Sign in" | link | logged-out | → /login |
| button "Open menu" › button "Try the demo" | button | logged-out | navigates → /chat |
| button "Open menu" › button "Close" | button | logged-out | acts and closes its menu/dialog |

## `/pricing`

| Element | Type | States | Does |
|---|---|---|---|
| page layout | layout | logged-out, demo, user | fits the screen (no sideways scroll) |
| link "Create a free account" | link | logged-out, demo, user | → /login; → /chat |
| link "Join the Pro waitlist" | link | logged-out, demo, user | → /contact?topic=pro |
| link "Talk to us" | link | logged-out, demo, user | → /contact?topic=clinic |

## `/privacy`

| Element | Type | States | Does |
|---|---|---|---|
| page layout | layout | logged-out | fits the screen (no sideways scroll) |
| link "contact form" | link | logged-out | → /contact?topic=privacy |
| link "Contact us" | link | logged-out | → /contact?topic=privacy |

## `/safety`

| Element | Type | States | Does |
|---|---|---|---|
| page layout | layout | logged-out | fits the screen (no sideways scroll) |
| link "Get in touch" | link | logged-out | → /contact |

## `/terms`

| Element | Type | States | Does |
|---|---|---|---|
| page layout | layout | logged-out | fits the screen (no sideways scroll) |
| link "pricing page" | link | logged-out | → /pricing |
| link "privacy policy" | link | logged-out | → /privacy |
| link "Contact us" | link | logged-out | → /contact |

