import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { createDatabase } from '../server/store.mjs'
import { migrateAdmin, email } from '../server/admin-db.mjs'
import { createAuth } from '../server/admin-auth.mjs'
import { invitationPreview, saveInvitationPreview } from '../server/admin.mjs'
const dataDir = resolve(
  process.env.AURAFLARE_DATA_DIR || process.env.LUMORA_DATA_DIR || '.data',
)
const db = createDatabase(resolve(dataDir, 'orders.sqlite'))
migrateAdmin(db)
const input = createInterface({ input: stdin, output: stdout })
try {
  const mode = process.argv.includes('--reset') ? 'reset' : 'setup'
  const identifier = email(await input.question('Account email: ')),
    auth = createAuth(db)
  let result
  if (mode === 'setup')
    result = auth.bootstrap(
      await input.question('Owner display name: '),
      identifier,
    )
  else {
    const user = db
      .prepare('SELECT * FROM studio_users WHERE email=? AND active=1')
      .get(identifier)
    if (!user) throw new Error('Active account not found.')
    result = { user, token: auth.invite(user, 'reset') }
  }
  const base = process.env.AURAFLARE_PUBLIC_URL || 'http://localhost:5173'
  const file = saveInvitationPreview(
    invitationPreview(result.token, result.user, base, mode),
    dataDir,
  )
  console.log('Private account setup preview written to:', file)
  console.log(
    'Open that file locally to use its single-use link. No email was sent. Do not share the file or link in chat.',
  )
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  input.close()
  db.close()
}
