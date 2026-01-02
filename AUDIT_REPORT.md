# 🔍 Multi-Guild Isolation Audit Report

**Date:** 2025-01-27  
**Purpose:** Ensure complete data isolation between Discord servers (guilds) when running on a single hosting instance.

---

## ✅ **STRENGTHS - What's Working Well**

1. **Database Isolation** ✅
   - `db.js` properly uses `getPoolForGuild()` to create separate connection pools per guild
   - `guildContext.js` uses AsyncLocalStorage to maintain guild context
   - `interactionRouter.js` wraps all interactions with `withGuild()` context

2. **File System Isolation** ✅
   - `guildRegistry.js` provides `getGuildPaths()` that creates guild-specific directories:
     - `archiwum/{guildId}/`
     - `backup/{guildId}/`
   - `sendArchivePanel.js` correctly uses guild-specific archive directories
   - `endTournament.js` uses guild-specific archive paths

3. **Channel Validation** ✅
   - `sendArchivePanel.js` validates channel belongs to correct guild (lines 116-124)
   - `startExportPanel.js` validates channel belongs to correct guild (lines 106-114)

4. **Panel Management** ✅
   - Archive panels are created per-guild in guild-specific channels
   - Export panels are created per-guild in guild-specific channels

---

## 🚨 **CRITICAL ISSUES - Data Leakage Risks**

### 1. **Backup System - Uses Root Environment Variables** 🔴 CRITICAL

**File:** `handlers/backupDatabase.js`

**Problem:**
```javascript
// Lines 21-28: Uses process.env directly instead of guild config
await mysqldump({
  connection: {
    host: process.env.DB_HOST,      // ❌ Not guild-specific
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,  // ❌ Wrong database!
  },
  dumpToFile: filePath,
});
```

**Impact:** Backups will always use the root/default database, not the guild-specific database. This means:
- All guilds will backup to the same database
- Restoring will overwrite the wrong database
- **Data leakage between guilds**

**Fix Required:**
- Use `getGuildConfig(guildId)` to get guild-specific DB credentials
- Ensure `filePath` uses guild-specific backup directory (already partially done via `getGuildPaths`)

---

### 2. **Restore Backup - Hardcoded Backup Directory** 🔴 CRITICAL

**Files:**
- `handlers/restoreBackupButton.js` (line 10)
- `handlers/restoreBackupSelector.js` (no guild context)
- `handlers/confirmRestoreBackup.js` (line 29)

**Problem:**
```javascript
// handlers/restoreBackupButton.js line 10
const backupDir = path.join(__dirname, '..', 'backup');  // ❌ Not guild-specific

// handlers/confirmRestoreBackup.js line 29
const backupPath = path.join(__dirname, '..', 'backup', fileName);  // ❌ Not guild-specific
```

**Impact:**
- All guilds see the same backup files
- Restoring a backup from Guild A could restore it to Guild B's database
- **Complete data leakage and potential data corruption**

**Fix Required:**
- Use `getGuildPaths(guildId).backupDir` instead of hardcoded path
- Ensure all restore operations happen within `withGuild()` context

---

### 3. **Deadline Reminder - Queries All Guilds** 🔴 CRITICAL

**File:** `handlers/deadlineReminder.js`

**Problem:**
```javascript
// Line 79-82: Queries ALL panels from ALL guilds
const [panels] = await pool.query(
  `SELECT phase, stage, channel_id, message_id, deadline, reminded, closed 
   FROM active_panels`  // ❌ No WHERE clause filtering by guild
);
```

**Impact:**
- Watcher processes panels from all guilds simultaneously
- Could send reminders to wrong channels
- Could close panels from wrong guilds
- **Cross-guild interference**

**Fix Required:**
- `startDeadlineReminder()` is called per-guild in `onReady.js` (line 26)
- But the function doesn't accept or use `guildId` parameter
- Need to either:
  - Pass `guildId` and filter queries, OR
  - Ensure it runs within `withGuild()` context

---

### 4. **Match Lock Watcher - Queries All Guilds** 🔴 CRITICAL

**File:** `handlers/matchLockWatcher.js`

**Problem:**
```javascript
// Line 21-30: Queries ALL matches from ALL guilds
const [rows] = await pool.query(
  `SELECT id, panel_channel_id, panel_message_id
   FROM matches
   WHERE is_locked = 0
     AND start_time_utc IS NOT NULL
     AND ${timeCond}`  // ❌ No guild filtering
);
```

**Impact:**
- Locks matches from all guilds
- Could disable UI components in wrong guilds
- **Cross-guild interference**

**Fix Required:**
- Same issue as deadline reminder - called per-guild but doesn't use guild context
- Need to filter by guild or ensure proper context

---

### 5. **Commands Missing `withGuild()` Context** 🟡 HIGH

**Files:**
- `commands/startPickem.js` - Uses `pool.query()` directly (line 136) without `withGuild()`
- `commands/moje_typy.js` - Uses `pool.query()` directly (multiple lines) without `withGuild()`
- `commands/miejsce.js` - Uses `pool.query()` directly without `withGuild()`
- `commands/ranking.js` - Uses `pool.query()` directly without `withGuild()`
- `commands/pewniaczki.js` - Likely same issue
- `commands/setDeadline.js` - Uses `pool.query()` without `withGuild()`

**Impact:**
- Commands will use the default pool (fallback) instead of guild-specific pool
- If default pool is configured, could query wrong database
- **Potential data leakage**

**Fix Required:**
- Wrap all command `execute()` functions with `withGuild(interaction.guildId, async () => { ... })`
- Ensure `interaction.guildId` is validated (not null)

---

### 6. **Export Classification - No Guild Context Check** 🟡 HIGH

**File:** `handlers/exportClassification.js`

**Problem:**
- Function uses `pool.query()` directly throughout (100+ queries)
- No explicit `withGuild()` wrapper
- Relies on being called from within guild context

**Impact:**
- If called outside guild context, will use default pool
- Could export data from wrong database
- **Data leakage risk**

**Fix Required:**
- Ensure all callers use `withGuild()` context
- Add explicit guild validation at function start
- Consider adding `guildId` parameter for safety

---

### 7. **Calculate Scores - No Guild Context Check** 🟡 HIGH

**File:** `handlers/calculateScores.js`

**Problem:**
- Similar to export - uses `pool.query()` directly
- No explicit guild context validation
- Called from `exportClassification.js` which also lacks context

**Impact:**
- Could calculate scores for wrong guild
- **Data corruption risk**

**Fix Required:**
- Add guild context validation
- Ensure called within `withGuild()` context

---

## ⚠️ **MODERATE ISSUES**

### 8. **Hardcoded Role IDs** 🟡 MODERATE

**File:** `commands/startPickem.js` (lines 12-16)

**Problem:**
```javascript
const allowedRoles = [
  "1164253439417659456",
  "1301530484479758407",
  "1386396019339825363"
];
```

**Impact:**
- Same admin roles for all guilds
- Not a data leakage issue, but configuration problem

**Fix Required:**
- Move to guild config or environment variables

---

### 9. **Teams Store - Needs Verification** 🟡 MODERATE

**File:** `utils/teamsStore.js`

**Status:** Needs review
- Functions accept `guildId` parameter ✅
- But need to verify all callers pass correct `guildId`
- Check if database queries are properly scoped

---

### 10. **Close Expired Panels - Needs Verification** 🟡 MODERATE

**File:** `utils/closeExpiredPanels.js`

**Status:** Needs review
- Function is called from `index.js` without guild context
- Need to verify it queries only current guild's panels

---

## 📋 **RECOMMENDATIONS**

### Immediate Actions (Critical):

1. **Fix Backup System:**
   ```javascript
   // handlers/backupDatabase.js
   const { getGuildConfig, getGuildPaths } = require('../utils/guildRegistry');
   const { withGuild } = require('../utils/guildContext');
   
   module.exports = async function backupDatabase(interaction) {
     const guildId = interaction.guildId;
     if (!guildId) return; // Error handling
     
     return withGuild(guildId, async () => {
       const cfg = getGuildConfig(guildId);
       const { backupDir } = getGuildPaths(guildId);
       // ... use cfg.DB_* and backupDir
     });
   };
   ```

2. **Fix Restore System:**
   ```javascript
   // handlers/restoreBackupButton.js
   const { getGuildPaths } = require('../utils/guildRegistry');
   
   function getBackupFiles(guildId) {
     const { backupDir } = getGuildPaths(guildId);
     // ... use backupDir
   }
   ```

3. **Fix Deadline Reminder:**
   ```javascript
   // handlers/deadlineReminder.js
   function startDeadlineReminder(client, guildId) {
     setInterval(async () => {
       await withGuild(guildId, async () => {
         const [panels] = await pool.query(
           `SELECT ... FROM active_panels WHERE ...` // Add guild filtering if needed
         );
       });
     }, 60 * 1000);
   }
   ```

4. **Fix Match Lock Watcher:**
   - Similar fix - ensure guild context and filtering

5. **Wrap All Commands:**
   ```javascript
   // Example: commands/startPickem.js
   async execute(interaction) {
     const guildId = interaction.guildId;
     if (!guildId) return interaction.reply({ content: '...', ephemeral: true });
     
     return withGuild(guildId, async () => {
       // ... existing code
     });
   }
   ```

### Testing Checklist:

- [ ] Test backup/restore with multiple guilds
- [ ] Verify each guild only sees its own backups
- [ ] Verify each guild only sees its own archive files
- [ ] Test commands from different guilds simultaneously
- [ ] Verify deadline reminders only affect correct guild
- [ ] Verify match locks only affect correct guild
- [ ] Test export/classification per guild
- [ ] Verify database queries use correct pool

### Long-term Improvements:

1. **Add Guild Validation Middleware:**
   - Create wrapper that ensures all handlers validate guild context

2. **Add Database Query Logging:**
   - Log which guild each query targets
   - Helps catch cross-guild leaks

3. **Add Integration Tests:**
   - Test multi-guild scenarios
   - Verify isolation

4. **Documentation:**
   - Document multi-guild setup requirements
   - Document guild-specific configuration

---

## 📊 **Summary**

| Category | Count | Severity |
|----------|-------|----------|
| Critical Issues | 4 | 🔴 Data Leakage Risk |
| High Issues | 3 | 🟡 Potential Data Leakage |
| Moderate Issues | 3 | 🟡 Configuration/Verification Needed |
| **Total Issues** | **10** | |

**Overall Assessment:** ⚠️ **NOT SAFE FOR MULTI-GUILD PRODUCTION**

The architecture is well-designed for multi-guild support, but several critical implementation gaps exist that could cause data leakage between guilds. These must be fixed before deploying to production with multiple guilds.

---

**Next Steps:**
1. Fix all Critical issues (1-4)
2. Fix High issues (5-7)
3. Review and fix Moderate issues (8-10)
4. Comprehensive testing with multiple guilds
5. Re-audit after fixes

