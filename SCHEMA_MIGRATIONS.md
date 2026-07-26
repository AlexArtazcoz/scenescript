# Database Schema Migrations

This document explains how the app handles database schema changes to ensure a fail-proof user experience.

## How It Works

### Automatic Schema Versioning

The app uses a **schema versioning system** that automatically detects and handles data structure changes:

1. **Version Tracking**: Current schema version is stored in `CURRENT_SCHEMA_VERSION` constant in `src/services/db.ts`
2. **Automatic Validation**: On app startup, the database validates all stored data against the current schema
3. **Migration or Reset**: If data doesn't match the schema, the app either migrates it or resets the database

### Schema Version History

- **v1**: Initial schema (scripts, scenes)
- **v2**: Added `status` field to Script type (`'backlog' | 'in-progress' | 'done'`)

## Making Schema Changes

When you need to modify the data structure:

### 1. Update the Types

Edit `src/types/index.ts` to add/modify fields:

```typescript
export interface Script {
  // ... existing fields
  newField: string; // New field added
}
```

### 2. Increment Schema Version

In `src/services/db.ts`, increment `CURRENT_SCHEMA_VERSION`:

```typescript
const CURRENT_SCHEMA_VERSION = 3; // Was 2, now 3
```

### 3. Add Dexie Version & Migration

Add a new Dexie version with migration logic:

```typescript
this.version(3)
  .stores({
    scripts: 'id, name, updatedAt, status, newField', // Add new indexed fields
    scenes: 'id, scriptId',
  })
  .upgrade(async tx => {
    // Migration logic to update existing data
    const scripts = await tx.table('scripts').toArray();
    for (const script of scripts) {
      if (!script.newField) {
        script.newField = 'default value';
        await tx.table('scripts').put(script);
      }
    }
  });
```

### 4. Update Validation

Update the `validateScript()` or `validateScene()` function to check new fields:

```typescript
function validateScript(script: any): script is Script {
  return (
    // ... existing checks
    typeof script.newField === 'string' // Add validation for new field
  );
}
```

## Development Tools

### Force Database Reset

In development mode, you can force clear the database from the browser console:

```javascript
resetDatabase()
```

This will:
- Clear all data from IndexedDB
- Reset the schema version
- Prompt you to reload the page

### Manual Schema Check

Check the current schema version in localStorage:

```javascript
localStorage.getItem('scenescript_schema_version')
```

## What Happens Automatically

### On App Start

1. **Check Schema Version**: Compare stored version with current version
2. **Run Migrations**: If version is old, Dexie runs migration logic
3. **Validate Data**: Check that all records match current TypeScript types
4. **Reset if Invalid**: If validation fails, clear database and start fresh

### User Experience

- **Seamless Upgrades**: Users get automatic migrations with no action needed
- **No Broken States**: Invalid data is automatically cleared
- **Development Friendly**: Old dev data won't break new features
- **Fail-proof**: Even if migration fails, app resets to a working state

## Best Practices

1. **Always increment schema version** when changing data structure
2. **Write migration logic** for backwards compatibility when possible
3. **Update validators** to match new schema
4. **Test migrations** with old data before deploying
5. **Document changes** in this file's version history

## Example: Adding a New Field

Let's say you want to add an `estimatedMinutes: number` field to Scene:

```typescript
// 1. Update types/index.ts
export interface Scene {
  // ... existing fields
  estimatedMinutes: number;
}

// 2. Update db.ts - increment version
const CURRENT_SCHEMA_VERSION = 3;

// 3. Add Dexie version
this.version(3)
  .stores({
    scripts: 'id, name, updatedAt, status',
    scenes: 'id, scriptId', // No change needed if not indexing new field
  })
  .upgrade(async tx => {
    const scenes = await tx.table('scenes').toArray();
    for (const scene of scenes) {
      if (typeof scene.estimatedMinutes !== 'number') {
        // Calculate from durationSec or use default
        scene.estimatedMinutes = Math.ceil(scene.durationSec / 60);
        await tx.table('scenes').put(scene);
      }
    }
  });

// 4. Update validator
function validateScene(scene: any): scene is Scene {
  return (
    // ... existing checks
    typeof scene.estimatedMinutes === 'number' &&
    scene.estimatedMinutes > 0
  );
}
```

Done! The app will automatically migrate existing scenes on next load.
