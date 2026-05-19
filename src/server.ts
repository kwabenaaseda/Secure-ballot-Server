// Imports
import { initializeDatabase } from "./config/database";
import app from "./app";
import dotenv from 'dotenv'
import { Log } from "./utils/Logger";

// Initializations
dotenv.config()

// variables
const PORT = process.env.PORT || 3000

// Server Start
async function startServer() {
    
    await initializeDatabase()

    app.listen(PORT,()=>{
    console.log(`SecureBallot-server is live on http://localhost:${PORT}`)
})

}

startServer().catch((err)=>{
    Log.warn(startServer.name,"Failed to start Server", err)
    process.exit(1)
})

