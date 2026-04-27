# Lister Skill

OpenClaw skill for natural language control of [Lister.ai](https://lister.ai) task management.

## Setup

```bash
# Install dependencies
npm install

# Build
npm run build

# Set environment variables
export LISTER_BASE_URL="https://lister-api-staging.up.railway.app"
export LISTER_API_KEY="your-api-key-here"
```

## Usage

### CLI
```bash
node dist/index.js add "call Notary" to my today list
node dist/index.js get priority items
node dist/index.js mark item 123 done
node dist/index.js remove item 456
node dist/index.js update item 789 to "new title"
```

### As Module
```typescript
import { handleCommand } from './dist/index.js';

const response = await handleCommand('add "buy groceries" to my today list');
console.log(response);
```

## Supported Commands

| Command | Example |
|---------|---------|
| Add item | `add "task" to my [list] list` |
| Get items | `get my [list] list` |
| Priority items | `get priority items` |
| Mark done | `mark item [id] done` |
| Remove item | `remove item [id]` |
| Update item | `update item [id] to "new text"` |
| Move item | `move item [id] to my [list] list` |
| Add note | `note for item [id]: "text"` |

## API

- **Base URL:** `https://lister-api-staging.up.railway.app`
- **Auth:** Bearer token
- **Endpoints:** `/api/lists`, `/api/items`, `/api/items/priority`

## License

MIT
