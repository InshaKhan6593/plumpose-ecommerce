// Any setup scripts you might need go here

// Load .env files
import 'dotenv/config'

/*
 * Integration tests create and delete records, and upload photos. When `.env`
 * points the app at the live database and the live bucket, the tests still use
 * the Docker database (LOCAL_DATABASE_URL) and the local disk — never Neon or R2.
 */
if (process.env.LOCAL_DATABASE_URL) process.env.DATABASE_URL = process.env.LOCAL_DATABASE_URL
process.env.MEDIA_STORAGE = ''
