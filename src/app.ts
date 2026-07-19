import express from 'express'

import ROUTES from './routes/routes'


const app = express()

app.use(express.json())
app.set('trust proxy', 1) // Enable trust proxy to get the correct client IP address
// ROUTES
app.use('/api/vx',ROUTES)

export default app