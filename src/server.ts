// Imports
import { initializeDatabase } from "./config/database";
import app from "./app";
import dotenv from 'dotenv'
import { Log } from "./utils/Logger";
import { ENV, VALIDATE_ENV } from "./workers/env_validater";

// Initializations
dotenv.config()

// variables
const PORT = ENV("PORT")

// Server Start
async function startServer() {
    VALIDATE_ENV()
    await initializeDatabase()

    app.listen(PORT,()=>{
    //console.log(`SecureBallot-server is live on http://localhost:${PORT}`)
    Log.info(startServer.name,`Server started on port ${PORT} in ${ENV("NODE_ENV")} mode. URL: http://localhost:${PORT}`,"STARTUP SUCCESS")
})

}

startServer().catch((err)=>{
    Log.warn(startServer.name,"Failed to start Server", err)
    process.exit(1)
})

