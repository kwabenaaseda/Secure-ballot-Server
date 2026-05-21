import express from 'express'

import ROUTES from './routes/routes'


const app = express()

app.use(express.json())

// ROUTES
app.use('/api/vx',ROUTES)

export default app