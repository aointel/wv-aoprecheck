# ✅ GLOBAL STANDARD: ALL User-Facing Comparisons MUST Be Case-Insensitive

## 🚨 ABSOLUTE RULE

**NOTHING on the entire server should be case-sensitive for user-facing data.**

This includes:
- ✅ Email addresses
- ✅ Team names (MGA/RGA)
- ✅ User names
- ✅ Search queries
- ✅ Filter values
- ✅ All string comparisons in business logic

---

## 📋 IMPLEMENTATION STANDARDS

### 1. Database Queries

**Use `.ilike()` for ALL string comparisons:**
```typescript
// ❌ WRONG - Case-sensitive
query.eq('agent_email', email)

// ✅ CORRECT - Case-insensitive
query.ilike('agent_email', email)
```

**OR normalize to lowercase first:**
```typescript
// ✅ ALSO CORRECT - Normalize first, then use .eq()
const normalizedEmail = email.toLowerCase().trim();
query.eq('agent_email', normalizedEmail)
```

### 2. JavaScript Comparisons

**Always use `.toLowerCase()` for comparisons:**
```typescript
// ❌ WRONG - Case-sensitive
if (teamName === filterValue)

// ✅ CORRECT - Case-insensitive
if (teamName?.toLowerCase() === filterValue?.toLowerCase())
```

### 3. Email Normalization

**ALWAYS normalize emails to lowercase:**
```typescript
// ✅ STANDARD: Normalize all emails
const normalizedEmail = email.toLowerCase().trim();
```

---

## 🔍 WHAT WAS FIXED

1. **Team Filtering (RGA/MGA):**
   - ✅ Dropdown deduplication (case-insensitive)
   - ✅ Frontend filtering (`.toLowerCase()`)
   - ✅ Backend API filtering (`.ilike()`)
   - ✅ RBAC filtering (`.ilike()`)

2. **Search Queries:**
   - ✅ All search uses `.ilike()` with wildcards
   - ✅ Frontend search uses `.toLowerCase()`

3. **Email Comparisons:**
   - ✅ Most already normalize to lowercase
   - ✅ All new code MUST use `.ilike()` or normalize first

---

## ⚠️ EXCEPTIONS (Technical Only)

**These CAN be case-sensitive (not user-facing):**
- Database column names
- API keys/tokens (for security)
- File paths (system-dependent)
- Internal identifiers (UUIDs, IDs)

---

## ✅ VERIFICATION CHECKLIST

Before committing code with string comparisons:

- [ ] All email comparisons use `.ilike()` OR normalize to lowercase
- [ ] All team/name comparisons use `.ilike()` OR `.toLowerCase()`
- [ ] All search/filter comparisons are case-insensitive
- [ ] Frontend comparisons use `.toLowerCase()`
- [ ] Backend queries use `.ilike()` for strings

---

## 🚀 ENFORCEMENT

**This is a MANDATORY standard.**
- Code reviews MUST check for case sensitivity
- All user-facing comparisons MUST be case-insensitive
- No exceptions for user data
