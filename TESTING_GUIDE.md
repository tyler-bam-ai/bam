# BAM.ai Testing Guide
**For Non-Technical Testers**

---

## Getting Started

1. **Download and Install**
   - Mac: Open the DMG file, drag BAM-AI to Applications
   - Windows: Run the EXE installer

2. **First Launch**
   - Open BAM-AI from Applications (Mac) or Start Menu (Windows)
   - Wait for the app to load (10-15 seconds first time)

---

## Test Scenarios

### ✅ Test 1: Login
**Steps:**
1. Enter your email and password
2. Click "Sign In"

**Expected:** Dashboard appears with your name

---

### ✅ Test 2: View Clients (Admin Only)
**Steps:**
1. Click "Admin" in the sidebar
2. You should see a list of clients (or empty state if none)

**Expected:** Client list loads from server, not blank

---

### ✅ Test 3: Create a New Client
**Steps:**
1. In Admin panel, click "Add Client"
2. Fill in company name, contact email
3. Click "Save"

**Expected:** New client appears in list

---

### ✅ Test 4: Demo Mode Toggle
**Steps:**
1. Go to Settings (gear icon)
2. Toggle "Demo Mode" ON
3. Navigate to Dashboard and Admin

**Expected:** Sample demo data appears everywhere

---

### ✅ Test 5: BAM Brains (AI Chat)
**Steps:**
1. Click "BAM Brains" in sidebar
2. Type a question in the chat box
3. Press Enter or click Send

**Expected:** AI responds within a few seconds

---

### ✅ Test 6: Brain Training (Upload Knowledge)
**Steps:**
1. Click "Brain Training" in sidebar  
2. Drag a document (PDF, DOC, TXT) into the upload area
3. Wait for processing

**Expected:** File appears in knowledge list

---

### ✅ Test 7: Check for Updates
**Steps:**
1. Go to App menu (Mac) or Help menu (Windows)
2. Click "Check for Updates"

**Expected:** Shows "up to date" message or update available

---

## Known Issues (Not Bugs)

| Issue | Explanation |
|-------|-------------|
| Mac update opens browser | Mac requires code signing ($99/year) for auto-install. Download DMG manually. |
| Backend warning on Windows | This may appear but Railway backend still works. Click OK to dismiss. |

---

## Reporting Bugs

If something doesn't work as expected:

1. **Take a screenshot** of the error/issue
2. **Note what you did** before the error
3. **Note the version** (visible in app title bar)
4. Send to Tyler

---

*Version 1.4.5 | January 2026*
