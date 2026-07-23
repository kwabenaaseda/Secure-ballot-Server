import express from 'express'
import cors from 'cors'
import ROUTES from './routes/routes'


const app = express()

app.use(express.json())
app.use(cors({
  origin: '*', // Allow requests from any origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allow specific HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow specific headers
}))
app.set('trust proxy', 1) // Enable trust proxy to get the correct client IP address
// ROUTES
app.use('/api/vx',ROUTES)

export default app